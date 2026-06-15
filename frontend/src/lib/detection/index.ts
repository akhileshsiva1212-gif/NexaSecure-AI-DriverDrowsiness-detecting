// Public entry point for the in-browser detection pipeline.

export * from './types'
export { drawResult } from './overlay'
export { runLive, runVideoFile, runImage } from './runner'
export type { RunHandle, RunnerCallbacks } from './runner'

import type { Detector, DetectorFactory } from './types'
import { createFaceDetector } from './detectors/faceDetector'
import { createHazardDetector } from './detectors/hazardDetector'
import { createForwardDetector } from './detectors/forwardDetector'
import { createSignDetector } from './detectors/signDetector'

export { createFaceDetector } from './detectors/faceDetector'
export { createHazardDetector } from './detectors/hazardDetector'
export { createForwardDetector } from './detectors/forwardDetector'
export { createSignDetector } from './detectors/signDetector'
export { createGtsrbClassifier } from './detectors/signClassifier'

/** A detector available in the Detection Lab (batch evaluation over uploaded datasets). */
export interface DetectorEntry {
  id: string
  label: string
  factory: DetectorFactory
  /** Whether this detector classifies whole frames (meaningful confusion matrix). */
  classifier: boolean
}

export const DETECTOR_REGISTRY: DetectorEntry[] = [
  { id: 'signs', label: 'Road Signs', factory: () => createSignDetector(), classifier: false },
  { id: 'hazard', label: 'Road Hazards', factory: createHazardDetector, classifier: false },
  { id: 'forward', label: 'Forward Collision', factory: createForwardDetector, classifier: false },
  { id: 'driver', label: 'Driver (face)', factory: createFaceDetector, classifier: true },
]

export function getDetectorEntry(id: string): DetectorEntry | undefined {
  return DETECTOR_REGISTRY.find((d) => d.id === id)
}

export type { Detector }
