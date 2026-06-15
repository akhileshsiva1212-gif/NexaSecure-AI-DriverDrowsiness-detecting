// Traffic-sign detector. COCO's only sign class is "stop sign", so STOP is detected for real
// here. An optional GTSRB classifier (43 classes — speed limits, yield, school zone, …) can
// be loaded on demand to recognize the richer set; see signClassifier.ts. Detected sign
// labels (never video) are posted to /road/signs/ingest.

import type { Detector, DetectionFrame, DetectionResult, DetectorBox } from '../types'
import { createCocoRunner } from './objectBase'
import { type SignClassifier } from './signClassifier'

interface SignIngest {
  kind: string
  value: number | null
  confidence: number
}

export interface SignDetectorOptions {
  /** Optional GTSRB classifier for multi-class signs (loaded separately, opt-in). */
  classifier?: SignClassifier | null
}

export function createSignDetector(opts: SignDetectorOptions = {}): Detector {
  const coco = createCocoRunner(0.4, 8)
  const classifier = opts.classifier ?? null

  return {
    id: 'signs',
    label: 'Road Signs',
    accept: 'image/*,video/*',
    supportsImages: true,
    facing: 'environment',

    async load(onProgress) {
      await coco.load(onProgress)
      if (classifier) await classifier.load(onProgress)
    },
    dispose: coco.dispose,

    async detect(frame: DetectionFrame): Promise<DetectionResult> {
      const raw = await coco.run(frame)
      const boxes: DetectorBox[] = []
      const detections: SignIngest[] = []

      for (const d of raw) {
        if (d.category !== 'stop sign') continue
        boxes.push({ x: d.x, y: d.y, w: d.w, h: d.h, label: 'STOP', score: d.score, color: '#f87171' })
        detections.push({ kind: 'stop', value: null, confidence: d.score })
      }

      // Optional GTSRB multi-class pass (classifies the whole frame / detected regions).
      if (classifier) {
        const extra = await classifier.classify(frame)
        for (const s of extra) {
          if (s.kind === 'stop') continue // already covered by COCO
          detections.push(s)
          boxes.push({
            x: frame.width * 0.4,
            y: frame.height * 0.08,
            w: frame.width * 0.2,
            h: frame.width * 0.2,
            label: s.value != null ? `${s.kind} ${s.value}` : s.kind,
            score: s.confidence,
            color: '#38bdf8',
          })
        }
      }

      const dominant = detections[0]
      return {
        label: dominant?.kind ?? '',
        score: dominant?.confidence ?? 0,
        summary: dominant
          ? dominant.value != null
            ? `${dominant.kind} ${dominant.value}`
            : dominant.kind
          : 'No signs',
        boxes,
        ingest: { path: '/api/v1/road/signs/ingest', body: { detections } },
      }
    },
  }
}
