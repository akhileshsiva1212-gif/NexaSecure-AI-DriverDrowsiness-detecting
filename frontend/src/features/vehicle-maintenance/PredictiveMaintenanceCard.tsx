import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { MaintenanceForecast, MaintenanceResponse, Severity } from '../../lib/types'
import { GRAD, GlyphTrend, Tile3D } from '../../components/Icon3D'

// Status → header chip styling. Mirrors the local convention used by VehicleHealthCard
// rather than reaching into levelStyle.ts (whose maps key off the driver/distraction levels).
const STATUS_CHIP: Record<string, string> = {
  ok: 'border-nexa-ok/40 text-nexa-ok bg-nexa-ok/10',
  watch: 'border-white/15 text-slate-300 bg-white/5',
  warning: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
  critical: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
  insufficient_data: 'border-white/15 text-slate-400 bg-white/5',
  warming_up: 'border-white/15 text-slate-300 bg-white/5',
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'Healthy',
  watch: 'Watch',
  warning: 'Action soon',
  critical: 'Critical',
  insufficient_data: 'No data',
  warming_up: 'Starting…',
}

// Per-severity accents for a forecast row and its ETA pill.
const SEVERITY_TEXT: Record<Severity, string> = {
  info: 'text-slate-300',
  warning: 'text-nexa-warn',
  critical: 'text-nexa-crit',
}

const SEVERITY_PILL: Record<Severity, string> = {
  info: 'border-white/15 text-slate-300 bg-white/5',
  warning: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
  critical: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
}

// Glow the whole card when something needs attention, matching the other premium cards.
const STATUS_GLOW: Record<string, string> = {
  warning: 'shadow-glow-warn',
  critical: 'shadow-glow-crit',
}

function eta(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes < 1) return '<1 min'
  return `~${Math.round(minutes)} min`
}

function ForecastRow({ f }: { f: MaintenanceForecast }) {
  return (
    <li className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm font-semibold ${SEVERITY_TEXT[f.severity]}`}>{f.label}</span>
        {f.minutes_to_threshold !== null && (
          <span className={`chip ${SEVERITY_PILL[f.severity]}`}>{eta(f.minutes_to_threshold)}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{f.message}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        now {f.current} · limit {f.threshold}
      </p>
    </li>
  )
}

export function PredictiveMaintenanceCard() {
  const [data, setData] = useState<MaintenanceResponse | null>(null)

  useEffect(() => {
    let active = true
    const tick = () =>
      api
        .maintenance()
        .then((m) => {
          if (active) setData(m)
        })
        .catch(() => {})
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const status = data?.status ?? 'warming_up'
  const forecasts = data?.report?.forecasts ?? []

  return (
    <section className={`glass p-4 ${STATUS_GLOW[status] ?? ''}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Predictive Maintenance
        </h2>
        <span className={`chip ${STATUS_CHIP[status] ?? STATUS_CHIP.warming_up}`}>
          {STATUS_LABEL[status] ?? STATUS_LABEL.warming_up}
        </span>
      </header>

      {status === 'warming_up' || status === 'insufficient_data' ? (
        // Honest empty state — no fabricated forecasts without enough real telemetry.
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-7 text-center">
          <Tile3D grad={GRAD.cyan} size={52}>
            <GlyphTrend />
          </Tile3D>
          <p className="max-w-xs text-sm text-slate-400">
            Not enough telemetry yet. Connect the OBD feed in <strong>Vehicle Health</strong> to
            build a trend and enable failure forecasts.
          </p>
        </div>
      ) : forecasts.length === 0 ? (
        <p className="text-sm text-slate-400">All monitored metrics are trending safely.</p>
      ) : (
        <ul className="space-y-2">
          {forecasts.map((f) => (
            <ForecastRow key={f.metric} f={f} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-slate-600">
        Forecasts are projections from recent trends, not guarantees.
      </p>
    </section>
  )
}
