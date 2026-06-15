import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { COLLISION_STYLE } from '../../lib/levelStyle'
import type { ForwardCollision } from '../../lib/types'
import { DetectionSource } from '../_shared/DetectionSource'
import { LiveDot } from '../road-hazard/RoadHazardCard'
import { createForwardDetector } from '../../lib/detection'

const MESSAGE: Record<string, string> = {
  clear: 'Safe following distance.',
  tailgating: 'Following too closely — increase your gap.',
  warning: 'Forward collision risk — brake now.',
  warming_up: 'Point the road camera or upload footage to begin detection.',
}

function Metric({
  label,
  value,
  unit,
  highlight,
}: {
  label: string
  value: string | number | undefined
  unit?: string
  highlight?: boolean
}) {
  return (
    <div className="metric">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-base font-semibold ${highlight ? 'text-nexa-crit' : ''}`}>
        {value === undefined || value === null ? '—' : value}
        {unit && value !== undefined && value !== null && (
          <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
        )}
      </div>
    </div>
  )
}

export function ForwardCollisionCard() {
  const [data, setData] = useState<ForwardCollision | null>(null)

  useEffect(() => {
    let active = true
    const tick = () => api.forwardCollision().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const level = data?.status ?? 'warming_up'
  const s = data?.state
  const style = COLLISION_STYLE[level] ?? COLLISION_STYLE.warming_up
  const live = data?.live ?? false
  const ttc = s?.ttc_seconds ?? null

  return (
    <section className={`glass animate-float-in p-4 ${style.glow}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Forward Collision
        </h2>
        <div className="flex items-center gap-2">
          <LiveDot live={live} />
          <span className={`chip ${style.chip}`}>{style.label}</span>
        </div>
      </header>

      {/* Hero: time-to-collision */}
      <div className="mb-3 flex items-end gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Time to collision</div>
          <div className="text-3xl font-bold leading-tight" style={{ color: style.ring }}>
            {ttc !== null ? ttc.toFixed(1) : '—'}
            <span className="ml-1 text-base font-normal text-slate-400">s</span>
          </div>
        </div>
        <div className="ml-auto text-right text-xs text-slate-400">
          {s?.lead_present ? 'Vehicle ahead' : 'No vehicle ahead'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Distance" value={s?.lead_present ? s?.distance_m : undefined} unit="m" />
        <Metric
          label="Headway"
          value={s?.headway_seconds ?? undefined}
          unit="s"
          highlight={level === 'tailgating' || level === 'warning'}
        />
      </div>

      <p className="mt-3 text-sm text-slate-400">{MESSAGE[level] ?? MESSAGE.warming_up}</p>

      <div className="mt-3 border-t border-white/5 pt-3">
        <DetectionSource factory={createForwardDetector} />
        <p className="mt-2 text-[11px] text-slate-500">
          Lead-vehicle distance is estimated from box size on-device (monocular — approximate).
          Only the numbers are sent.
        </p>
      </div>
    </section>
  )
}
