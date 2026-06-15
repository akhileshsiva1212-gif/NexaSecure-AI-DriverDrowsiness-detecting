import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { LEVEL_STYLE } from '../../lib/levelStyle'
import type { Drowsiness } from '../../lib/types'
import { LiveDot } from '../road-hazard/RoadHazardCard'

function Metric({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div className="metric">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-semibold">
        {value === undefined ? '—' : value}
        <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </div>
    </div>
  )
}

export function DriverStatusCard() {
  const [data, setData] = useState<Drowsiness | null>(null)

  useEffect(() => {
    let active = true
    const tick = () => api.drowsiness().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const level = data?.status ?? 'warming_up'
  const s = data?.state
  const style = LEVEL_STYLE[level]
  const live = data?.live ?? false

  return (
    <section className={`glass p-4 ${style.glow}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Driver Status
        </h2>
        <div className="flex items-center gap-2">
          <LiveDot live={live} />
          <span className={`chip ${style.chip}`}>{style.label}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Eye Openness" value={s?.ear} unit="EAR" />
        <Metric label="PERCLOS" value={s ? Math.round(s.perclos * 100) : undefined} unit="%" />
        <Metric label="Eyes Closed" value={s?.eyes_closed_seconds} unit="s" />
        <Metric label="Yawns" value={s?.yawns_per_minute} unit="/min" />
      </div>

      <p className="mt-3 text-sm text-slate-400">
        {level === 'alert' && 'Driver appears alert.'}
        {level === 'drowsy' && 'Signs of drowsiness — a break is advised.'}
        {level === 'microsleep' && 'Microsleep detected — pull over safely.'}
        {level === 'no_face' && 'Driver face not detected by the cabin camera.'}
        {level === 'warming_up' && 'Enable the Driver Monitoring camera to begin.'}
      </p>
    </section>
  )
}
