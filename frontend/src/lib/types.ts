// Shared TypeScript types — mirror the backend's event contracts in app/events/types.py.
// (In a later phase these can be generated from a shared JSON schema so they never drift.)

export type Severity = 'info' | 'warning' | 'critical'

export type FeatureDomain =
  | 'driver'
  | 'road'
  | 'vehicle'
  | 'fusion'
  | 'sos'
  | 'security'
  | 'system'

export interface AdvisoryEvent {
  id: string
  domain: FeatureDomain
  type: string
  severity: Severity
  message: string
  data: Record<string, unknown>
  created_at: string
}

export interface VehicleReading {
  engine_temp_c: number
  rpm: number
  speed_kph: number
  battery_voltage: number
  // Not standard OBD-II PIDs — null when the data comes from a real serial adapter.
  coolant_pct: number | null
  oil_pressure_kpa: number | null
}

export interface VehicleHealth {
  connected: boolean
  mode: 'none' | 'serial'
  status: 'not_connected' | 'warming_up' | 'ok' | 'warning' | 'critical'
  reading: VehicleReading | null
  findings: { type: string; severity: Severity; message: string; value: number }[]
}

export type DrowsinessLevel = 'alert' | 'drowsy' | 'microsleep' | 'no_face'

export interface DrowsinessState {
  level: DrowsinessLevel
  perclos: number
  eyes_closed_seconds: number
  yawns_per_minute: number
  ear: number
  mar: number
}

export interface Drowsiness {
  status: DrowsinessLevel | 'warming_up'
  state: DrowsinessState | null
  live: boolean
}

export type DistractionLevel = 'attentive' | 'distracted' | 'eyes_off_road' | 'no_face'
export type LookDirection = 'forward' | 'left' | 'right' | 'up' | 'down'

export interface DistractionState {
  level: DistractionLevel
  off_road_ratio: number
  off_road_seconds: number
  direction: LookDirection
  yaw: number
  pitch: number
  gaze: number
}

export interface Distraction {
  status: DistractionLevel | 'warming_up'
  state: DistractionState | null
  live: boolean
}

export interface FrameSignals {
  ear: number
  mar: number
  face_found: boolean
  yaw: number
  pitch: number
  gaze: number
}

// Response of POST /driver/ingest: drowsiness at the top level (back-compatible) plus a
// nested distraction block, since one frame feeds both pipelines.
export interface IngestResult extends Drowsiness {
  distraction: { status: DistractionLevel; state: DistractionState }
}

// ---- Traffic Sign Recognition (road perception) ----

export interface RecognizedSign {
  kind: string
  value: number | null
  label: string
}

export interface TrafficSignState {
  active_speed_limit: number | null
  signs: RecognizedSign[] // recently confirmed signs, newest first
}

export interface TrafficSigns {
  status: 'warming_up' | 'ok'
  state: TrafficSignState | null
  live: boolean
}

// One road-camera frame's detections, pushed to the backend (mirrors backend SignFrame).
export interface SignDetectionPayload {
  kind: string
  value: number | null
  confidence: number
}

export interface SignFrame {
  detections: SignDetectionPayload[]
}

// ---- Road Hazard ----

export type HazardLevel = 'clear' | 'hazard' | 'imminent'

export interface HazardState {
  level: HazardLevel
  closest_kind: string | null
  closest_label: string | null
  closest_area_ratio: number
  count: number
}

export interface Hazards {
  status: HazardLevel | 'warming_up'
  state: HazardState | null
  live: boolean
}

// ---- Forward Collision ----

export type ForwardLevel = 'clear' | 'tailgating' | 'warning'

export interface ForwardState {
  level: ForwardLevel
  lead_present: boolean
  distance_m: number
  ttc_seconds: number | null
  headway_seconds: number | null
}

export interface ForwardCollision {
  status: ForwardLevel | 'warming_up'
  state: ForwardState | null
  live: boolean
}

// ---- Accident Prediction (fusion) ----

export type RiskLevel = 'low' | 'elevated' | 'high'

export interface RiskContributor {
  source: string
  label: string
  level: string
  points: number
}

export interface RiskState {
  score: number // 0..100
  level: RiskLevel
  contributors: RiskContributor[]
}

export interface RiskResponse {
  status: RiskLevel | 'warming_up'
  state: RiskState | null
}

// ---- SOS / Emergency ----

export type SosState = 'idle' | 'armed' | 'dispatched'

export interface SosStatus {
  state: SosState
  reason: string
  auto: boolean
  countdown_seconds: number
  seconds_remaining: number
}

// ---- My Mood (wake-up audio) ----

// The four selectable wake-up sources. Presets are synthesized in the browser; "uploaded"
// is a local file the driver added (its blob lives client-side in IndexedDB).
export type AudioOption = 'default-alarm' | 'music-1' | 'music-2' | 'uploaded'

export interface MoodPreference {
  selected: AudioOption
  uploaded_name: string | null
  volume: number // 0.0–1.0
}

// ---- Predictive Maintenance (vehicle) ----

// Mirrors backend trends.Forecast: a projected concern for one trended metric.
export interface MaintenanceForecast {
  metric: string
  label: string
  current: number
  slope_per_min: number
  threshold: number
  minutes_to_threshold: number | null
  severity: Severity
  message: string
}

export interface MaintenanceReport {
  status: 'ok' | 'watch' | 'warning' | 'critical' | 'insufficient_data'
  samples: number
  forecasts: MaintenanceForecast[]
}

export interface MaintenanceResponse {
  status: 'warming_up' | 'ok' | 'watch' | 'warning' | 'critical' | 'insufficient_data'
  report: MaintenanceReport | null
}
