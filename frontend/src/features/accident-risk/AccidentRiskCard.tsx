import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { AlertnessRing } from '../../components/AlertnessRing'
import { RISK_STYLE } from '../../lib/levelStyle'
import type { RiskResponse } from '../../lib/types'

const MESSAGE: Record<string, string> = {
  low: 'No significant risk factors active.',
  elevated: 'Multiple risk factors active — stay sharp.',
  high: 'High crash risk — take corrective action now.',
  warming_up: 'Fusing signals from every feature…',
}

export function AccidentRiskCard() {
  const [data, setData] = useState<RiskResponse | null>(null)

  useEffect(() => {
    let active = true
    const tick = () => api.risk().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const level = data?.status ?? 'warming_up'
  const s = data?.state
  const style = RISK_STYLE[level] ?? RISK_STYLE.warming_up
  const score = s?.score ?? 0

  return (
    <section className={`glass animate-float-in p-4 ${style.glow}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Accident Risk
        </h2>
        <span className={`chip ${style.chip}`}>{style.label}</span>
      </header>

      <div className="flex items-center gap-4">
        <AlertnessRing value={score} color={style.ring} label={`${score}`} sublabel="risk" />
        <div className="min-w-0 flex-1">
          {s && s.contributors.length > 0 ? (
            <ul className="space-y-1">
              {s.contributors.slice(0, 4).map((c) => (
                <li key={c.source} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-300">{c.label}</span>
                  <span className={`shrink-0 font-semibold ${style.text}`}>+{c.points}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">All monitored signals nominal.</p>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-400">{MESSAGE[level] ?? MESSAGE.warming_up}</p>
    </section>
  )
}
