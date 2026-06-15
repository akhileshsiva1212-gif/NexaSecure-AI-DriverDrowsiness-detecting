// Shared MediaPipe ObjectDetector (EfficientDet-Lite0 / COCO) plumbing.
//
// COCO gives us people, vehicles, animals and a "stop sign" class — enough to power real
// hazard detection, forward-collision distance estimation, and STOP-sign recognition. Each
// higher-level detector (hazard/forward/signs) owns its own instance so their per-frame
// loops never fight over MediaPipe's monotonic-timestamp requirement.

import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import type { DetectionFrame } from '../types'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite'

/** One COCO detection, with the bounding box already converted to source-frame pixels. */
export interface RawDetection {
  category: string
  score: number
  x: number
  y: number
  w: number
  h: number
}

export interface CocoRunner {
  load(onProgress?: (msg: string) => void): Promise<void>
  run(frame: DetectionFrame): Promise<RawDetection[]>
  dispose(): void
}

export function createCocoRunner(scoreThreshold = 0.4, maxResults = 8): CocoRunner {
  let detector: ObjectDetector | null = null
  let mode: 'VIDEO' | 'IMAGE' = 'VIDEO'

  async function ensureMode(want: 'VIDEO' | 'IMAGE') {
    if (!detector || mode === want) return
    await detector.setOptions({ runningMode: want })
    mode = want
  }

  return {
    async load(onProgress) {
      if (detector) return
      onProgress?.('Loading object model…')
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        scoreThreshold,
        maxResults,
      }
      try {
        detector = await ObjectDetector.createFromOptions(fileset, options)
      } catch {
        detector = await ObjectDetector.createFromOptions(fileset, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        })
      }
      mode = 'VIDEO'
    },

    async run(frame: DetectionFrame): Promise<RawDetection[]> {
      if (!detector || frame.width === 0 || frame.height === 0) return []
      await ensureMode(frame.isVideo ? 'VIDEO' : 'IMAGE')
      const res = frame.isVideo
        ? detector.detectForVideo(frame.element, frame.timestampMs)
        : detector.detect(frame.element)
      const out: RawDetection[] = []
      for (const det of res.detections) {
        const top = det.categories[0]
        const bb = det.boundingBox
        if (!top || !bb) continue
        out.push({
          category: top.categoryName,
          score: top.score,
          x: bb.originX,
          y: bb.originY,
          w: bb.width,
          h: bb.height,
        })
      }
      return out
    },

    dispose() {
      detector?.close()
      detector = null
    },
  }
}
