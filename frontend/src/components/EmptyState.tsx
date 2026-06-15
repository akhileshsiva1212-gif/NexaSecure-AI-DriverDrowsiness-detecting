import type { ReactNode } from 'react'

/** Calm "nothing connected yet" panel used by modules with no active detection source. */
export function EmptyState({
  icon = '',
  title,
  hint,
  action,
}: {
  icon?: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center">
      <div className="text-2xl opacity-60">{icon}</div>
      <p className="text-sm text-slate-300">{title}</p>
      {hint && <p className="max-w-xs text-xs text-slate-500">{hint}</p>}
      {action}
    </div>
  )
}
