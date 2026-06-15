// Thin REST client for the edge backend. URLs are relative so the Vite dev proxy
// (and, in production, same-origin serving) routes them to the backend.

import type {
  AdvisoryEvent,
  Distraction,
  Drowsiness,
  ForwardCollision,
  FrameSignals,
  Hazards,
  IngestResult,
  MaintenanceResponse,
  MoodPreference,
  RiskResponse,
  SignFrame,
  SosStatus,
  TrafficSigns,
  VehicleHealth,
} from './types'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const api = {
  vehicleHealth: () => getJson<VehicleHealth>('/api/v1/vehicle/health'),
  maintenance: () => getJson<MaintenanceResponse>('/api/v1/vehicle/maintenance'),
  setVehicleConnection: (mode: 'none' | 'serial') =>
    fetch('/api/v1/vehicle/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }),
  drowsiness: () => getJson<Drowsiness>('/api/v1/driver/drowsiness'),
  distraction: () => getJson<Distraction>('/api/v1/driver/distraction'),
  recentEvents: (limit = 50) =>
    getJson<{ events: AdvisoryEvent[] }>(`/api/v1/events?limit=${limit}`).then((r) => r.events),
  info: () => getJson<Record<string, unknown>>('/api/v1/info'),

  // Push one real webcam frame's signals to the backend pipeline (feeds both drowsiness
  // and distraction). Returns drowsiness at the top level plus a nested distraction block.
  ingestFrame: (signals: FrameSignals): Promise<Response> =>
    fetch('/api/v1/driver/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signals),
    }),

  trafficSigns: () => getJson<TrafficSigns>('/api/v1/road/signs'),

  // Road-perception feature states (fed by the in-browser detectors via /road/* ingest).
  hazards: () => getJson<Hazards>('/api/v1/road/hazards'),
  forwardCollision: () => getJson<ForwardCollision>('/api/v1/road/forward-collision'),

  // Accident prediction (fused crash-risk score).
  risk: () => getJson<RiskResponse>('/api/v1/fusion/risk'),

  // SOS emergency state machine.
  sos: () => getJson<SosStatus>('/api/v1/sos/status'),
  armSos: (reason = 'Manual SOS'): Promise<Response> => postJson('/api/v1/sos/arm', { reason }),
  cancelSos: (): Promise<Response> => postJson('/api/v1/sos/cancel'),
  resetSos: (): Promise<Response> => postJson('/api/v1/sos/reset'),

  // My Mood — persisted wake-up audio preference (played in-browser on drowsiness alert).
  getMood: () => getJson<MoodPreference>('/api/v1/mood'),
  setMood: (pref: MoodPreference): Promise<Response> =>
    fetch('/api/v1/mood', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pref),
    }),

  // Push one road-camera frame's detected signs to the backend recognizer.
  ingestSigns: (frame: SignFrame): Promise<Response> =>
    fetch('/api/v1/road/signs/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frame),
    }),
}

export type { IngestResult }
