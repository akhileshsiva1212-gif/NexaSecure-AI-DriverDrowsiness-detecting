// Forward-collision detector: track the lead vehicle and estimate distance + closing speed.
//
// From the largest in-path vehicle box we estimate distance with a pinhole approximation
// (distance ≈ K / bbox_width_px) and closing speed from how fast that distance shrinks
// frame-to-frame (EMA-smoothed). The backend turns these into TTC / headway. Monocular
// distance is an estimate (no depth sensor), so it is clamped and labelled as such.
//
// ego_speed is genuinely unknown without OBD, so we post 0; the backend then runs TTC-only
// and simply deactivates the headway/tailgating branch. If a real OBD adapter is connected,
// the dashboard's vehicle-speed feed could be wired in later.

import type { Detector, DetectionFrame, DetectionResult, DetectorBox } from '../types'
import { createCocoRunner } from './objectBase'

const VEHICLE_CLASSES = new Set(['car', 'bus', 'truck', 'motorcycle'])
const IN_PATH_MIN = 0.3
const IN_PATH_MAX = 0.7

// Pinhole constant K = focal_px * real_width_m, tuned for a ~1.8 m wide car at a typical
// phone/webcam field of view. distance_m = K / bbox_width_px.
const K = 1260
const DIST_MIN = 2
const DIST_MAX = 80
const EMA_ALPHA = 0.3
const LOST_AFTER_MS = 600

export function createForwardDetector(): Detector {
  const coco = createCocoRunner(0.4, 10)
  let prevDistance: number | null = null
  let prevTs = 0
  let smoothedClosing = 0

  return {
    id: 'forward',
    label: 'Forward Collision',
    accept: 'image/*,video/*',
    supportsImages: true,
    facing: 'environment',

    load: coco.load,
    dispose: coco.dispose,

    async detect(frame: DetectionFrame): Promise<DetectionResult> {
      const raw = await coco.run(frame)

      // Largest in-path vehicle = the lead vehicle.
      let lead: { x: number; y: number; w: number; h: number; score: number } | null = null
      for (const d of raw) {
        if (!VEHICLE_CLASSES.has(d.category)) continue
        const centerX = (d.x + d.w / 2) / frame.width
        if (centerX < IN_PATH_MIN || centerX > IN_PATH_MAX) continue
        if (!lead || d.w * d.h > lead.w * lead.h) lead = d
      }

      if (!lead) {
        prevDistance = null
        smoothedClosing = 0
        return {
          label: '',
          score: 0,
          summary: 'No lead vehicle',
          boxes: [],
          ingest: { path: '/api/v1/road/forward-collision/ingest', body: { lead_present: false } },
        }
      }

      const distance = clamp(K / lead.w, DIST_MIN, DIST_MAX)
      const dt = (frame.timestampMs - prevTs) / 1000
      if (prevDistance !== null && dt > 0 && dt < LOST_AFTER_MS / 1000) {
        const instClosing = (prevDistance - distance) / dt // +ve = closing in
        smoothedClosing = EMA_ALPHA * instClosing + (1 - EMA_ALPHA) * smoothedClosing
      } else {
        smoothedClosing = 0
      }
      prevDistance = distance
      prevTs = frame.timestampMs

      const closing = Math.max(0, smoothedClosing)
      const ttc = closing > 0.05 ? distance / closing : null
      const boxes: DetectorBox[] = [
        {
          x: lead.x,
          y: lead.y,
          w: lead.w,
          h: lead.h,
          label: `Lead ~${distance.toFixed(0)} m`,
          score: lead.score,
          color: ttc !== null && ttc <= 2.5 ? '#f87171' : '#38bdf8',
        },
      ]

      return {
        label: 'lead_vehicle',
        score: 1,
        summary:
          `Lead ~${distance.toFixed(0)} m` +
          (ttc !== null ? ` · TTC ${ttc.toFixed(1)} s` : ' · steady'),
        boxes,
        ingest: {
          path: '/api/v1/road/forward-collision/ingest',
          body: {
            lead_present: true,
            distance_m: distance,
            closing_speed_mps: closing,
            ego_speed_kph: 0,
          },
        },
      }
    },
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
