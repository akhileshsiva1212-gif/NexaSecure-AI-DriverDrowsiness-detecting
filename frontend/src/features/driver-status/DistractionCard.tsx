import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DIRECTION_LABEL, DISTRACTION_STYLE } from '../../lib/levelStyle'
import type { Distraction } from '../../lib/types'
import { LiveDot } from '../road-hazard/RoadHazardCard'

function Metric({ label, value, unit }: { label: string; value: number | string | undefined; unit?: string }) {
  return (
    <div className="metric">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold">
        {value === undefined ? '—' : value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </div>
    </div>
  )
}

export function DistractionCard() {
  const [data, setData] = useState<Distraction | null>(null)

  useEffect(() => {
    let active = true
    const tick = () => api.distraction().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const level = data?.status ?? 'warming_up'
  const s = data?.state
  const style = DISTRACTION_STYLE[level]
  const live = data?.live ?? false
  const direction = s ? DIRECTION_LABEL[s.direction] : '—'

  return (
    <section className={`glass p-4 ${style.glow}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Driver Attention
        </h2>
        <div className="flex items-center gap-2">
          <LiveDot live={live} />
          <span className={`chip ${style.chip}`}>{style.label}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Looking" value={direction} />
        <Metric label="Off-road" value={s ? Math.round(s.off_road_ratio * 100) : undefined} unit="%" />
        <Metric label="Away" value={s?.off_road_seconds} unit="s" />
        <Metric label="Head Yaw" value={s?.yaw} />
      </div>

      <p className="mt-3 text-sm text-slate-400">
        {level === 'attentive' && 'Driver is watching the road.'}
        {level === 'distracted' && 'Frequent glances away — keep your eyes on the road.'}
        {level === 'eyes_off_road' && 'Eyes off the road too long — look forward now.'}
        {level === 'no_face' && 'Driver face not detected by the cabin camera.'}
        {level === 'warming_up' && 'Enable the Driver Monitoring camera to begin.'}
      </p>
    </section>
  )
}
