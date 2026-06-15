import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { VehicleHealth } from '../../lib/types'
import { BarGauge } from '../../components/BarGauge'
import { Sparkline } from '../../components/Sparkline'
import { GRAD, GlyphPlug, Tile3D } from '../../components/Icon3D'

const STATUS_CHIP: Record<string, string> = {
  ok: 'border-nexa-ok/40 text-nexa-ok bg-nexa-ok/10',
  warning: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
  critical: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
  warming_up: 'border-white/15 text-slate-300 bg-white/5',
}

const TEMP_ZONES = [
  { upTo: 100, color: '#34d399' },
  { upTo: 110, color: '#fbbf24' },
  { upTo: 130, color: '#fb7185' },
]

function Stat({
  label,
  value,
  unit,
}: {
  label: string
  value: number | null | undefined
  unit: string
}) {
  return (
    <div className="metric">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-base font-semibold">
        {value == null ? '—' : value}
        <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </div>
    </div>
  )
}

export function VehicleHealthCard() {
  const [health, setHealth] = useState<VehicleHealth | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tempHistory = useRef<number[]>([])
  const [, force] = useState(0)

  useEffect(() => {
    let active = true
    const tick = () =>
      api
        .vehicleHealth()
        .then((h) => {
          if (!active) return
          setHealth(h)
          if (h.reading) {
            tempHistory.current = [...tempHistory.current, h.reading.engine_temp_c].slice(-40)
            force((n) => n + 1)
          }
        })
        .catch(() => {})
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const toggle = async (mode: 'serial' | 'none') => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.setVehicleConnection(mode)
      if (!res.ok) {
        let detail = `Connection failed (${res.status})`
        try {
          const body = await res.json()
          if (body?.detail) detail = body.detail
        } catch {
          /* keep the generic message */
        }
        setError(detail)
        return
      }
      if (mode === 'none') tempHistory.current = []
    } catch {
      setError('Could not reach the backend.')
    } finally {
      setBusy(false)
    }
  }

  const connected = health?.connected ?? false
  const r = health?.reading
  const status = health?.status ?? 'warming_up'

  return (
    <section className="glass p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Vehicle Health
        </h2>
        {connected ? (
          <div className="flex items-center gap-2">
            <span className="chip border-white/15 text-slate-400">Real OBD</span>
            <span className={`chip ${STATUS_CHIP[status] ?? STATUS_CHIP.warming_up}`}>
              {status.replace('_', ' ')}
            </span>
          </div>
        ) : (
          <span className="chip border-white/15 text-slate-400">Not connected</span>
        )}
      </header>

      {!connected ? (
        // Honest disconnected state — no fabricated numbers.
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-7 text-center">
          <Tile3D grad={GRAD.slate} size={52}>
            <GlyphPlug />
          </Tile3D>
          <p className="max-w-xs text-sm text-slate-400">
            No OBD-II adapter connected. Connect a real read-only ELM327 adapter for live
            engine data — engine readings are never simulated.
          </p>
          <button
            onClick={() => toggle('serial')}
            disabled={busy}
            className="rounded-xl bg-nexa-accent px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            Connect Real OBD
          </button>
          {error && <p className="max-w-xs text-xs text-nexa-warn">{error}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="metric">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>Engine Temperature</span>
              </div>
              <BarGauge value={r?.engine_temp_c ?? 0} min={60} max={130} zones={TEMP_ZONES} unit="°C" />
            </div>
            <div className="metric">
              <div className="mb-1 text-xs text-slate-400">Temp Trend</div>
              <Sparkline values={tempHistory.current} color="#6ea8ff" min={70} max={125} />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="RPM" value={r?.rpm} unit="" />
            <Stat label="Speed" value={r?.speed_kph} unit="km/h" />
            <Stat label="Battery" value={r?.battery_voltage} unit="V" />
            <Stat label="Oil Press." value={r?.oil_pressure_kpa} unit="kPa" />
          </div>

          {health?.findings?.length ? (
            <ul className="mt-3 space-y-1">
              {health.findings.map((f) => (
                <li key={f.type} className="text-sm text-nexa-warn">{f.message}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">All readings within normal range.</p>
          )}

          <button
            onClick={() => toggle('none')}
            disabled={busy}
            className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Disconnect
          </button>
        </>
      )}
    </section>
  )
}
