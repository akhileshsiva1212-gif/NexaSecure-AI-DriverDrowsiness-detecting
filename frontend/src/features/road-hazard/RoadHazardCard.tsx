import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { HAZARD_STYLE } from '../../lib/levelStyle'
import type { Hazards } from '../../lib/types'
import { DetectionSource } from '../_shared/DetectionSource'
import { createHazardDetector } from '../../lib/detection'
import { GRAD, GlyphAlert, GlyphCar, GlyphPerson, GlyphRoad, Tile3D, type GradKey } from '../../components/Icon3D'

const MESSAGE: Record<string, string> = {
  clear: 'Road clear ahead.',
  hazard: 'Hazard ahead on the road — stay alert.',
  imminent: 'Obstacle close ahead — be ready to brake.',
  warming_up: 'Point the road camera or upload footage to begin detection.',
}

const VEHICLE_KINDS = new Set(['car', 'bus', 'truck', 'motorcycle', 'bicycle'])

function hazardGlyph(kind: string | null) {
  if (!kind) return <GlyphRoad />
  if (kind === 'person' || kind === 'dog') return <GlyphPerson />
  if (VEHICLE_KINDS.has(kind)) return <GlyphCar />
  return <GlyphAlert />
}

// closest_area_ratio (~0..0.5) → a 0..100 proximity reading. Bigger box = closer.
function proximityPct(ratio: number): number {
  return Math.max(0, Math.min(100, Math.round((ratio / 0.4) * 100)))
}

export function RoadHazardCard() {
  const [data, setData] = useState<Hazards | null>(null)

  useEffect(() => {
    let active = true
    const tick = () => api.hazards().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const level = data?.status ?? 'warming_up'
  const s = data?.state
  const style = HAZARD_STYLE[level] ?? HAZARD_STYLE.warming_up
  const live = data?.live ?? false
  const hasHazard = !!s && s.level !== 'clear' && !!s.closest_kind
  const prox = s ? proximityPct(s.closest_area_ratio) : 0
  const hazardGrad: GradKey =
    level === 'imminent' ? 'red' : level === 'hazard' ? 'amber' : level === 'clear' ? 'green' : 'slate'

  return (
    <section className={`glass animate-float-in p-4 ${live ? style.glow : ''}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Road Hazard
        </h2>
        <div className="flex items-center gap-2">
          <LiveDot live={live} />
          <span className={`chip ${style.chip}`}>{style.label}</span>
        </div>
      </header>

      <div className="flex items-center gap-4">
        <Tile3D grad={GRAD[hazardGrad]} size={60} pulse={hasHazard} className="shrink-0">
          <span className="block" style={{ transform: 'scale(1.35)' }}>
            {hazardGlyph(s?.closest_kind ?? null)}
          </span>
        </Tile3D>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-lg font-semibold ${style.text}`}>
            {hasHazard ? s?.closest_label : 'Road clear'}
          </div>
          {hasHazard ? (
            <>
              <div className="mb-1 mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Proximity</span>
                <span>{prox}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${prox}%`,
                    background: style.ring,
                    transition: 'width 0.5s ease, background 0.3s ease',
                  }}
                />
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-400">No in-path obstacles detected.</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-slate-400">{MESSAGE[level] ?? MESSAGE.warming_up}</p>
        {s && s.count > 0 && (
          <span className="chip border-white/15 text-slate-300">
            {s.count} in path
          </span>
        )}
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        <DetectionSource factory={createHazardDetector} />
        <p className="mt-2 text-[11px] text-slate-500">
          Real object detection (MediaPipe COCO) runs on-device. Only labels &amp; box sizes
          are sent — never video.
        </p>
      </div>
    </section>
  )
}

/** Honest live/off indicator: green when live detections are arriving, grey otherwise. */
export function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      className={`chip ${
        live ? 'border-nexa-ok/40 bg-nexa-ok/10 text-nexa-ok' : 'border-white/15 text-slate-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${live ? 'animate-pulse-soft' : ''}`} />
      {live ? 'Live' : 'Off'}
    </span>
  )
}
