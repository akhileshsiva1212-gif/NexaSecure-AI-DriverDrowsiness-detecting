import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { SOS_STYLE } from '../../lib/levelStyle'
import type { SosStatus } from '../../lib/types'

export function SosCard() {
  const [data, setData] = useState<SosStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => api.sos().then(setData).catch(() => {})

  useEffect(() => {
    let active = true
    const tick = () => api.sos().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const act = async (fn: () => Promise<Response>) => {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const state = data?.state ?? 'idle'
  const style = SOS_STYLE[state]
  const remaining = data?.seconds_remaining ?? 0

  return (
    <section className={`glass animate-float-in p-4 ${style.glow}`}>
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Emergency SOS
        </h2>
        <span className={`chip ${style.chip} ${state === 'armed' ? 'animate-pulse-soft' : ''}`}>
          {style.label}
        </span>
      </header>

      {state === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-center text-sm text-slate-400">
            No emergency active. Press to start a {data?.countdown_seconds ?? 15}s cancelable
            countdown.
          </p>
          <button
            onClick={() => act(() => api.armSos('Manual SOS'))}
            disabled={busy}
            className="grid h-20 w-20 place-items-center rounded-full bg-nexa-crit text-lg font-bold text-white shadow-glow-crit transition hover:brightness-110 disabled:opacity-50"
          >
            SOS
          </button>
        </div>
      )}

      {state === 'armed' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="text-center">
            <div className="text-4xl font-bold text-nexa-warn">{Math.ceil(remaining)}s</div>
            <p className="mt-1 text-xs text-slate-400">{data?.reason}</p>
          </div>
          <button
            onClick={() => act(api.cancelSos)}
            disabled={busy}
            className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:brightness-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <p className="text-[11px] text-slate-500">
            {data?.auto ? 'Auto-armed by a crash-class alert' : 'Manually armed'}
          </p>
        </div>
      )}

      {state === 'dispatched' && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-xl border border-nexa-crit/40 bg-nexa-crit/10 px-4 py-3 text-center">
            <div className="text-sm font-semibold text-nexa-crit">SOS dispatched</div>
            <p className="mt-1 text-xs text-slate-400">{data?.reason}</p>
          </div>
          <button
            onClick={() => act(api.resetSos)}
            disabled={busy}
            className="rounded-lg border border-white/15 px-4 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-slate-600">
        Advisory-only — a production build would contact emergency services.
      </p>
    </section>
  )
}
