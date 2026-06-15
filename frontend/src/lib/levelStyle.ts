// Shared visual mapping for driver drowsiness levels — keeps colors/labels consistent
// across the camera panel, driver card, and overlay tint.

import type {
  DistractionLevel,
  DrowsinessLevel,
  ForwardLevel,
  HazardLevel,
  LookDirection,
  RiskLevel,
  SosState,
} from './types'

export interface LevelStyle {
  label: string
  text: string
  chip: string
  ring: string // hex for SVG / canvas
  glow: string // tailwind shadow class
}

export const LEVEL_STYLE: Record<DrowsinessLevel | 'warming_up', LevelStyle> = {
  alert: {
    label: 'Alert',
    text: 'text-nexa-ok',
    chip: 'border-nexa-ok/40 text-nexa-ok bg-nexa-ok/10',
    ring: '#34d399',
    glow: 'shadow-glow-ok',
  },
  drowsy: {
    label: 'Drowsy',
    text: 'text-nexa-warn',
    chip: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
    ring: '#fbbf24',
    glow: 'shadow-glow-warn',
  },
  microsleep: {
    label: 'Microsleep',
    text: 'text-nexa-crit',
    chip: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
    ring: '#fb7185',
    glow: 'shadow-glow-crit',
  },
  no_face: {
    label: 'No Face',
    text: 'text-slate-300',
    chip: 'border-white/20 text-slate-300 bg-white/5',
    ring: '#94a3b8',
    glow: '',
  },
  warming_up: {
    label: 'Starting…',
    text: 'text-slate-300',
    chip: 'border-white/20 text-slate-300 bg-white/5',
    ring: '#94a3b8',
    glow: '',
  },
}

// Visual mapping for driver distraction ("eyes off the road") levels.
export const DISTRACTION_STYLE: Record<DistractionLevel | 'warming_up', LevelStyle> = {
  attentive: {
    label: 'Eyes on road',
    text: 'text-nexa-ok',
    chip: 'border-nexa-ok/40 text-nexa-ok bg-nexa-ok/10',
    ring: '#34d399',
    glow: 'shadow-glow-ok',
  },
  distracted: {
    label: 'Distracted',
    text: 'text-nexa-warn',
    chip: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
    ring: '#fbbf24',
    glow: 'shadow-glow-warn',
  },
  eyes_off_road: {
    label: 'Eyes off road',
    text: 'text-nexa-crit',
    chip: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
    ring: '#fb7185',
    glow: 'shadow-glow-crit',
  },
  no_face: {
    label: 'No Face',
    text: 'text-slate-300',
    chip: 'border-white/20 text-slate-300 bg-white/5',
    ring: '#94a3b8',
    glow: '',
  },
  warming_up: {
    label: 'Starting…',
    text: 'text-slate-300',
    chip: 'border-white/20 text-slate-300 bg-white/5',
    ring: '#94a3b8',
    glow: '',
  },
}

// Human-readable look direction for distraction messages/badges.
export const DIRECTION_LABEL: Record<LookDirection, string> = {
  forward: 'Forward',
  left: 'Looking left',
  right: 'Looking right',
  up: 'Looking up',
  down: 'Looking down',
}

// ---- Shared status presets (reused by the road-perception cards) -----------------------------

const OK_STYLE: LevelStyle = {
  label: 'OK',
  text: 'text-nexa-ok',
  chip: 'border-nexa-ok/40 text-nexa-ok bg-nexa-ok/10',
  ring: '#34d399',
  glow: 'shadow-glow-ok',
}
const WARN_STYLE: LevelStyle = {
  label: 'Warning',
  text: 'text-nexa-warn',
  chip: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
  ring: '#fbbf24',
  glow: 'shadow-glow-warn',
}
const CRIT_STYLE: LevelStyle = {
  label: 'Critical',
  text: 'text-nexa-crit',
  chip: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
  ring: '#fb7185',
  glow: 'shadow-glow-crit',
}
const NEUTRAL_STYLE: LevelStyle = {
  label: 'Idle',
  text: 'text-slate-300',
  chip: 'border-white/20 text-slate-300 bg-white/5',
  ring: '#94a3b8',
  glow: '',
}
const WARMING_STYLE: LevelStyle = { ...NEUTRAL_STYLE, label: 'Starting…' }

// Road Hazard: clear (ok) -> hazard (warn) -> imminent (crit).
export const HAZARD_STYLE: Record<HazardLevel | 'warming_up', LevelStyle> = {
  clear: { ...OK_STYLE, label: 'Clear' },
  hazard: { ...WARN_STYLE, label: 'Hazard' },
  imminent: { ...CRIT_STYLE, label: 'Imminent' },
  warming_up: WARMING_STYLE,
}

// Forward collision: clear (ok) -> tailgating (warn) -> warning (crit).
export const COLLISION_STYLE: Record<ForwardLevel | 'warming_up', LevelStyle> = {
  clear: { ...OK_STYLE, label: 'Clear' },
  tailgating: { ...WARN_STYLE, label: 'Tailgating' },
  warning: { ...CRIT_STYLE, label: 'Collision risk' },
  warming_up: WARMING_STYLE,
}


// Accident-prediction fused risk band: low (ok) -> elevated (warn) -> high (crit).
export const RISK_STYLE: Record<RiskLevel | 'warming_up', LevelStyle> = {
  low: { ...OK_STYLE, label: 'Low risk' },
  elevated: { ...WARN_STYLE, label: 'Elevated' },
  high: { ...CRIT_STYLE, label: 'High risk' },
  warming_up: WARMING_STYLE,
}

// SOS state machine: idle (neutral) -> armed (warn) -> dispatched (crit).
export const SOS_STYLE: Record<SosState, LevelStyle> = {
  idle: { ...NEUTRAL_STYLE, label: 'Standby' },
  armed: { ...WARN_STYLE, label: 'Armed' },
  dispatched: { ...CRIT_STYLE, label: 'Dispatched' },
}
