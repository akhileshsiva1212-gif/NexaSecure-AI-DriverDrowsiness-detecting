// Road-hazard detector: real COCO object detection → in-path obstacles + proximity.
//
// We keep COCO classes that are genuine road hazards, filter to those roughly in the
// driving path (box centred in the middle of the frame), and compute each box's area_ratio
// (fraction of the frame it fills) as a proximity proxy. The backend's HazardAnalyzer takes
// the closest box and applies its warn/imminent bands + temporal confirmation.

import type { Detector, DetectionFrame, DetectionResult, DetectorBox } from '../types'
import { createCocoRunner } from './objectBase'

// COCO category → backend hazard kind + display label.
const HAZARD_KINDS: Record<string, string> = {
  person: 'person',
  bicycle: 'bicycle',
  motorcycle: 'motorcycle',
  car: 'car',
  bus: 'bus',
  truck: 'truck',
  dog: 'dog',
}
const LABELS: Record<string, string> = {
  person: 'Pedestrian',
  bicycle: 'Cyclist',
  motorcycle: 'Motorcyclist',
  car: 'Vehicle',
  bus: 'Bus',
  truck: 'Truck',
  dog: 'Animal',
}

// Horizontal band (fraction of frame width) treated as "in the driving path".
const IN_PATH_MIN = 0.3
const IN_PATH_MAX = 0.7

export function createHazardDetector(): Detector {
  const coco = createCocoRunner(0.4, 10)

  return {
    id: 'hazard',
    label: 'Road Hazard',
    accept: 'image/*,video/*',
    supportsImages: true,
    facing: 'environment',

    load: coco.load,
    dispose: coco.dispose,

    async detect(frame: DetectionFrame): Promise<DetectionResult> {
      const raw = await coco.run(frame)
      const boxes: DetectorBox[] = []
      const ingestDetections: { kind: string; area_ratio: number; confidence: number }[] = []
      const frameArea = frame.width * frame.height || 1

      let closest: { label: string; area: number } | null = null
      for (const d of raw) {
        const kind = HAZARD_KINDS[d.category]
        if (!kind) continue
        const centerX = (d.x + d.w / 2) / frame.width
        const inPath = centerX >= IN_PATH_MIN && centerX <= IN_PATH_MAX
        const areaRatio = (d.w * d.h) / frameArea
        const label = LABELS[kind] ?? kind
        boxes.push({
          x: d.x,
          y: d.y,
          w: d.w,
          h: d.h,
          label,
          score: d.score,
          color: inPath ? hazardColor(areaRatio) : 'rgba(148,163,184,0.7)',
        })
        if (!inPath) continue
        ingestDetections.push({ kind, area_ratio: areaRatio, confidence: d.score })
        if (!closest || areaRatio > closest.area) closest = { label, area: areaRatio }
      }

      return {
        label: closest?.label ?? '',
        score: closest ? 1 : 0,
        summary: closest
          ? `${closest.label} ahead (${(closest.area * 100).toFixed(0)}% of view)`
          : 'Road clear',
        boxes,
        ingest: { path: '/api/v1/road/hazards/ingest', body: { detections: ingestDetections } },
      }
    },
  }
}

function hazardColor(area: number): string {
  if (area >= 0.18) return '#f87171' // imminent
  if (area >= 0.06) return '#fbbf24' // warning
  return '#2dd4bf'
}
