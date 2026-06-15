// Pipeline runners: feed a frame SOURCE (live camera / uploaded video / single image) into a
// DETECTOR and fan the result out to SINKS (canvas overlay, optional backend ingest, a result
// callback, an FPS meter). Shared by DetectionSource (live/upload) and the Detection Lab.

import type { Detector, DetectionFrame, DetectionResult, FrameElement } from './types'
import { drawResult } from './overlay'

export interface RunnerCallbacks {
  /** Called with every detection result (drives card UI / metrics). */
  onResult?: (r: DetectionResult, frame: DetectionFrame) => void
  /** FPS + inference-time meter. */
  onFps?: (fps: number, inferenceMs: number) => void
  /** POST the detector's ingest request to the backend to drive the dashboard. */
  ingest?: boolean
  /** Throttle for ingest POSTs (ms). */
  postIntervalMs?: number
}

export interface RunHandle {
  stop: () => void
}

function postIngest(r: DetectionResult): void {
  if (!r.ingest) return
  fetch(r.ingest.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r.ingest.body),
  }).catch(() => {})
}

function prepCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  return ctx
}

/** Run a detector continuously over a playing media element (live camera or uploaded video). */
function runMedia(
  detector: Detector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  cbs: RunnerCallbacks,
): RunHandle {
  let raf = 0
  let busy = false
  let lastPost = 0
  let lastFpsT = performance.now()
  let frames = 0
  let stopped = false
  const postInterval = cbs.postIntervalMs ?? 180

  const loop = async () => {
    if (stopped) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!busy && video.readyState >= 2 && w > 0) {
      busy = true
      const frame: DetectionFrame = {
        element: video,
        width: w,
        height: h,
        timestampMs: performance.now(),
        isVideo: true,
      }
      try {
        const t0 = performance.now()
        const result = await detector.detect(frame)
        const infMs = performance.now() - t0
        if (canvas) drawResult(prepCanvas(canvas, w, h), result)
        cbs.onResult?.(result, frame)
        if (cbs.ingest && frame.timestampMs - lastPost >= postInterval) {
          lastPost = frame.timestampMs
          postIngest(result)
        }
        frames++
        const now = performance.now()
        if (now - lastFpsT >= 1000) {
          cbs.onFps?.((frames * 1000) / (now - lastFpsT), infMs)
          frames = 0
          lastFpsT = now
        }
      } catch {
        /* keep the loop alive */
      } finally {
        busy = false
      }
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(raf)
    },
  }
}

export function runLive(
  detector: Detector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  cbs: RunnerCallbacks,
): RunHandle {
  return runMedia(detector, video, canvas, cbs)
}

export function runVideoFile(
  detector: Detector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement | null,
  cbs: RunnerCallbacks,
): RunHandle {
  return runMedia(detector, video, canvas, cbs)
}

/** Run a detector once on a still image and draw the overlay. Returns the result. */
export async function runImage(
  detector: Detector,
  image: FrameElement,
  canvas: HTMLCanvasElement | null,
  cbs: RunnerCallbacks = {},
): Promise<DetectionResult> {
  const w = (image as HTMLImageElement).naturalWidth || (image as HTMLCanvasElement).width
  const h = (image as HTMLImageElement).naturalHeight || (image as HTMLCanvasElement).height
  const frame: DetectionFrame = {
    element: image,
    width: w,
    height: h,
    timestampMs: performance.now(),
    isVideo: false,
  }
  const t0 = performance.now()
  const result = await detector.detect(frame)
  cbs.onFps?.(0, performance.now() - t0)
  if (canvas) drawResult(prepCanvas(canvas, w, h), result)
  cbs.onResult?.(result, frame)
  if (cbs.ingest) postIngest(result)
  return result
}
