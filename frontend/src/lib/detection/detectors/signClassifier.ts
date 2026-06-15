// Optional multi-class traffic-sign classifier (GTSRB, 43 classes) running on-device with
// TensorFlow.js. This is opt-in: COCO already gives us real STOP detection; loading this
// model adds speed limits, yield, school zone, pedestrian crossing, etc.
//
// GTSRB is a *classifier*, not a detector, so we classify candidate regions (the centre crop
// for now). Results are best-effort and labelled "experimental" in the UI. The model files
// live in /public/models/gtsrb/ (model.json + shards); if they are absent the classifier
// reports unavailable and the sign path falls back to STOP-only.

import type { DetectionFrame } from '../types'

export interface SignPrediction {
  kind: string
  value: number | null
  confidence: number
}

export interface SignClassifier {
  readonly available: boolean
  load(onProgress?: (msg: string) => void): Promise<void>
  classify(frame: DetectionFrame): Promise<SignPrediction[]>
  dispose(): void
}

const MODEL_URL = '/models/gtsrb/model.json'
const INPUT_SIZE = 48
const MIN_CONFIDENCE = 0.6

// GTSRB class index → backend sign kind + value (speed-limit number).
const GTSRB_MAP: Record<number, { kind: string; value: number | null }> = {
  0: { kind: 'speed_limit', value: 20 },
  1: { kind: 'speed_limit', value: 30 },
  2: { kind: 'speed_limit', value: 50 },
  3: { kind: 'speed_limit', value: 60 },
  4: { kind: 'speed_limit', value: 70 },
  5: { kind: 'speed_limit', value: 80 },
  7: { kind: 'speed_limit', value: 100 },
  8: { kind: 'speed_limit', value: 120 },
  13: { kind: 'yield', value: null },
  14: { kind: 'stop', value: null },
  17: { kind: 'no_entry', value: null },
  28: { kind: 'school_zone', value: null },
  27: { kind: 'pedestrian_crossing', value: null },
}

export function createGtsrbClassifier(): SignClassifier {
  // tf is loaded dynamically so the (large) TFJS runtime is only pulled in when the user
  // opts into multi-class signs, and a missing dependency/model degrades gracefully.
  let tf: any = null
  let model: any = null
  let available = false

  return {
    get available() {
      return available
    },

    async load(onProgress) {
      if (model) return
      onProgress?.('Loading multi-class sign model…')
      try {
        tf = await import('@tensorflow/tfjs')
        model = await tf.loadLayersModel(MODEL_URL)
        available = true
      } catch (e) {
        available = false
        throw new Error(
          'Multi-class sign model unavailable. Add @tensorflow/tfjs and place the GTSRB ' +
            'model in public/models/gtsrb/. STOP detection still works.',
        )
      }
    },

    async classify(frame: DetectionFrame): Promise<SignPrediction[]> {
      if (!model || !tf) return []
      // Classify the centre crop (a cheap region proposal). Replace with detected sign
      // regions once a real sign detector is available.
      return tf.tidy(() => {
        const img = tf.browser.fromPixels(frame.element)
        const side = Math.min(frame.width, frame.height)
        const x = Math.floor((frame.width - side) / 2)
        const y = Math.floor((frame.height - side) / 2)
        const crop = img.slice([y, x, 0], [side, side, 3])
        const input = tf.image
          .resizeBilinear(crop, [INPUT_SIZE, INPUT_SIZE])
          .toFloat()
          .div(255)
          .expandDims(0)
        const logits = model.predict(input) as { dataSync(): Float32Array }
        const probs = logits.dataSync()
        let best = -1
        let bestP = 0
        for (let i = 0; i < probs.length; i++) {
          if (probs[i] > bestP) {
            bestP = probs[i]
            best = i
          }
        }
        const mapped = GTSRB_MAP[best]
        if (!mapped || bestP < MIN_CONFIDENCE) return []
        return [{ kind: mapped.kind, value: mapped.value, confidence: bestP }]
      })
    },

    dispose() {
      model?.dispose?.()
      model = null
    },
  }
}
