// Driver-monitoring detector: MediaPipe FaceLandmarker → EAR/MAR/head-pose/gaze.
// Powers both drowsiness and distraction (one frame, one POST to /driver/ingest).

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { EMPTY_FACE, landmarksToSignals } from '../../faceMesh'
import type { Detector, DetectionFrame, DetectionResult } from '../types'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export function createFaceDetector(): Detector {
  let landmarker: FaceLandmarker | null = null
  let mode: 'VIDEO' | 'IMAGE' = 'VIDEO'

  async function ensureMode(want: 'VIDEO' | 'IMAGE') {
    if (!landmarker || mode === want) return
    await landmarker.setOptions({ runningMode: want })
    mode = want
  }

  return {
    id: 'driver',
    label: 'Driver Monitoring',
    accept: 'image/*,video/*',
    supportsImages: true,
    facing: 'user',

    async load(onProgress) {
      if (landmarker) return
      onProgress?.('Loading face model…')
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
      try {
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        })
      } catch {
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        })
      }
      mode = 'VIDEO'
    },

    async detect(frame: DetectionFrame): Promise<DetectionResult> {
      if (!landmarker || frame.width === 0 || frame.height === 0) {
        return faceResult(EMPTY_FACE)
      }
      await ensureMode(frame.isVideo ? 'VIDEO' : 'IMAGE')
      const res = frame.isVideo
        ? landmarker.detectForVideo(frame.element, frame.timestampMs)
        : landmarker.detect(frame.element)
      const faces = res.faceLandmarks
      if (!faces || faces.length === 0) return faceResult(EMPTY_FACE)
      return faceResult(landmarksToSignals(faces[0], frame.width, frame.height))
    },

    dispose() {
      landmarker?.close()
      landmarker = null
    },
  }
}

function faceResult(f: ReturnType<typeof landmarksToSignals>): DetectionResult {
  if (!f.faceFound) {
    return {
      label: 'no_face',
      score: 0,
      summary: 'No face detected',
      boxes: [],
      landmarks: null,
      ingest: {
        path: '/api/v1/driver/ingest',
        body: { ear: 0, mar: 0, face_found: false, yaw: 0, pitch: 0, gaze: 0 },
      },
    }
  }
  return {
    label: 'face',
    score: 1,
    summary: `EAR ${f.ear.toFixed(2)} · MAR ${f.mar.toFixed(2)}`,
    boxes: [],
    landmarks: f.landmarks,
    ingest: {
      path: '/api/v1/driver/ingest',
      body: {
        ear: f.ear,
        mar: f.mar,
        face_found: true,
        yaw: f.yaw,
        pitch: f.pitch,
        gaze: f.gaze,
      },
    },
  }
}
