import type { AdvisoryEvent, Severity } from '../../lib/types'

const SEV_CHIP: Record<Severity, string> = {
  info: 'border-nexa-accent/40 text-nexa-accent bg-nexa-accent/10',
  warning: 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10',
  critical: 'border-nexa-crit/40 text-nexa-crit bg-nexa-crit/10',
}

export function AlertsFeed({ events }: { events: AdvisoryEvent[] }) {
  return (
    <section className="glass p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Live Alerts
        </h2>
        {events.length > 0 && (
          <span className="chip border-white/15 text-slate-400">{events.length}</span>
        )}
      </header>

      {events.length === 0 ? (
        <p className="text-sm text-slate-400">No advisories yet. The system is monitoring.</p>
      ) : (
        <ul className="thin-scroll max-h-80 space-y-2 overflow-y-auto pr-1">
          {events.map((e) => (
            <li
              key={e.id}
              className="animate-float-in flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
            >
              <span className={`chip ${SEV_CHIP[e.severity]} shrink-0`}>{e.severity}</span>
              <div className="min-w-0">
                <div className="truncate text-sm text-slate-100">{e.message}</div>
                <div className="text-xs text-slate-500">
                  {e.domain} · {e.type} · {new Date(e.created_at).toLocaleTimeString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
