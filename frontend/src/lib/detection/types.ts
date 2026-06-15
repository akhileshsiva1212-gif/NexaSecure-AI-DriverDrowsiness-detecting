// Core types for the unified in-browser detection pipeline.
//
// A DETECTOR runs a real AI/CV model on a single frame and returns a normalized
// DetectionResult that carries everything downstream needs: overlay geometry (boxes /
// landmarks / lane lines), a human summary for galleries & metrics, and an optional ingest
// request to drive the live dashboard. The same detector is fed by a live camera, an
// uploaded image, an uploaded video, or a dataset iterator — see runner.ts and DetectionSource.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type SourceMode = 'off' | 'live' | 'image' | 'video' | 'dataset'

export type FrameElement = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement

export interface DetectionFrame {
  element: FrameElement
  width: number
  height: number
  /** Monotonic timestamp (ms) for MediaPipe VIDEO mode. */
  timestampMs: number
  /** true → use the model's VIDEO running mode; false → IMAGE mode (still frames). */
  isVideo: boolean
  /** Optional context for dataset/upload frames (filename, ground-truth label, position). */
  meta?: { label?: string; name?: string; index?: number; total?: number }
}

/** A request the detector wants POSTed to the backend to drive the dashboard. */
export interface IngestRequest {
  path: string
  body: unknown
}

/** A bounding box in pixels of the source frame, for overlay drawing. */
export interface DetectorBox {
  x: number
  y: number
  w: number
  h: number
  label: string
  score: number
  color?: string
}

/** A lane line segment in pixels of the source frame. */
export interface LaneSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  color?: string
}

/** Normalized output of every detector — drives overlay, gallery, metrics and ingest. */
export interface DetectionResult {
  /** Dominant finding label for galleries/metrics ('' = nothing detected). */
  label: string
  /** Confidence of the dominant finding (0..1). */
  score: number
  /** Short human-readable summary, e.g. "STOP", "Pedestrian (0.41)", "offset −0.6". */
  summary: string
  /** Bounding boxes to draw (object/sign/hazard/forward detectors). */
  boxes: DetectorBox[]
  /** Face-mesh landmarks to draw (driver detector). */
  landmarks?: NormalizedLandmark[] | null
  /** Lane line segments to draw (lane detector). */
  lanes?: LaneSegment[]
  /** Accent colour for the overlay (mesh/lane), if the detector wants to tint it. */
  accent?: string
  /** POST to drive the live dashboard, or null to only display locally. */
  ingest: IngestRequest | null
}

export const EMPTY_RESULT: DetectionResult = {
  label: '',
  score: 0,
  summary: 'No detection',
  boxes: [],
  landmarks: null,
  ingest: null,
}

export interface Detector {
  readonly id: string
  readonly label: string
  /** File-input accept attribute for upload mode. */
  readonly accept: string
  /** Whether this detector supports still-image / dataset evaluation (IMAGE mode). */
  readonly supportsImages: boolean
  /** Whether the live/road camera should face the environment (rear) vs the user. */
  readonly facing: 'user' | 'environment'
  /** Lazily load the model/runtime. `onProgress` reports human-readable load steps. */
  load(onProgress?: (msg: string) => void): Promise<void>
  /** Run the model on one frame. May be async (e.g. running-mode switches). */
  detect(frame: DetectionFrame): Promise<DetectionResult> | DetectionResult
  /** Release resources. */
  dispose?(): void
}

export type DetectorFactory = () => Detector
