// Real-time face detection in the browser using MediaPipe FaceLandmarker (WebAssembly).
//
// This runs entirely on the user's machine. It produces the same EAR/MAR signals the
// Python backend's geometry module computes — so the browser is a real "frame source"
// for the existing drowsiness pipeline. Raw frames never leave the page.

import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// FaceMesh landmark indices (must match the backend geometry module).
const LEFT_EYE = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380]
const MOUTH = [61, 291, 13, 14] // left, right, top, bottom
// Head-pose / gaze landmarks (distraction).
const NOSE_TIP = 1
const LEFT_CHEEK = 234
const RIGHT_CHEEK = 454
const CHIN = 152
const LEFT_EYE_OUTER = 33
const RIGHT_EYE_OUTER = 263
const LEFT_EYE_INNER = 133
const LEFT_IRIS = 468 // iris center (the face_landmarker model outputs 478 points incl. irises)

export interface FaceResult {
  faceFound: boolean
  ear: number
  mar: number
  // Head pose / gaze — mirror the backend geometry module (normalized, scale-invariant).
  yaw: number
  pitch: number
  gaze: number
  landmarks: NormalizedLandmark[] | null
}

/** Load the FaceLandmarker model (GPU, falling back to CPU). */
export async function createFaceMesh(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    })
  } catch {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    })
  }
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark, w: number, h: number): number {
  const dx = (a.x - b.x) * w
  const dy = (a.y - b.y) * h
  return Math.hypot(dx, dy)
}

function eyeAspectRatio(lm: NormalizedLandmark[], idx: number[], w: number, h: number): number {
  const [p1, p2, p3, p4, p5, p6] = idx.map((i) => lm[i])
  const horizontal = dist(p1, p4, w, h)
  if (horizontal === 0) return 0
  return (dist(p2, p6, w, h) + dist(p3, p5, w, h)) / (2 * horizontal)
}

function mouthAspectRatio(lm: NormalizedLandmark[], w: number, h: number): number {
  const [left, right, top, bottom] = MOUTH.map((i) => lm[i])
  const width = dist(left, right, w, h)
  if (width === 0) return 0
  return dist(top, bottom, w, h) / width
}

// Head pose / gaze — normalized landmark coords (0..1) are used directly; each ratio is
// scale-invariant, so it matches the backend geometry module without multiplying by w/h.
function headYawRatio(lm: NormalizedLandmark[]): number {
  const nose = lm[NOSE_TIP]
  const left = Math.abs(nose.x - lm[LEFT_CHEEK].x)
  const right = Math.abs(nose.x - lm[RIGHT_CHEEK].x)
  const total = left + right
  return total === 0 ? 0 : (left - right) / total
}

function headPitchRatio(lm: NormalizedLandmark[]): number {
  const eyeMidY = (lm[LEFT_EYE_OUTER].y + lm[RIGHT_EYE_OUTER].y) / 2
  const span = Math.abs(lm[CHIN].y - eyeMidY)
  return span === 0 ? 0 : (lm[NOSE_TIP].y - eyeMidY) / span
}

function gazeOffset(lm: NormalizedLandmark[]): number {
  const inner = lm[LEFT_EYE_INNER].x
  const outer = lm[LEFT_EYE_OUTER].x
  const width = outer - inner
  return width === 0 ? 0 : (lm[LEFT_IRIS].x - inner) / width - 0.5
}

/** Convert a set of face landmarks into the EAR/MAR/head-pose signals the backend expects. */
export function landmarksToSignals(lm: NormalizedLandmark[], w: number, h: number): FaceResult {
  const ear = (eyeAspectRatio(lm, LEFT_EYE, w, h) + eyeAspectRatio(lm, RIGHT_EYE, w, h)) / 2
  const mar = mouthAspectRatio(lm, w, h)
  const yaw = headYawRatio(lm)
  const pitch = headPitchRatio(lm)
  const gaze = gazeOffset(lm)
  return { faceFound: true, ear, mar, yaw, pitch, gaze, landmarks: lm }
}

export const EMPTY_FACE: FaceResult = {
  faceFound: false, ear: 0, mar: 0, yaw: 0, pitch: 0, gaze: 0, landmarks: null,
}

/** Run detection on one video frame and compute EAR/MAR. */
export function analyzeFrame(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceResult {
  const w = video.videoWidth
  const h = video.videoHeight
  if (w === 0 || h === 0) return EMPTY_FACE

  const result = landmarker.detectForVideo(video, timestampMs)
  const faces = result.faceLandmarks
  if (!faces || faces.length === 0) return EMPTY_FACE
  return landmarksToSignals(faces[0], w, h)
}

/** Draw the live face mesh overlay, tinted by drowsiness level. */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  accent: string,
): void {
  const du = new DrawingUtils(ctx)
  du.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
    color: 'rgba(120,160,255,0.18)',
    lineWidth: 0.5,
  })
  for (const conn of [
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LIPS,
  ]) {
    du.drawConnectors(landmarks, conn, { color: accent, lineWidth: 2 })
  }
}
