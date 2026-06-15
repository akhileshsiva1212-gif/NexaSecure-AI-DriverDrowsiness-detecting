import { useEffect, useRef, useState } from 'react'

// Smoothly counts from the previous value to the new one (easeOutCubic). Gives the dashboard
// a "live instrument" feel instead of values snapping. Falls back gracefully for NaN.

interface Props {
  value: number
  decimals?: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({ value, decimals = 0, duration = 600, className, prefix = '', suffix = '' }: Props) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (!Number.isFinite(to)) {
      setDisplay(to)
      return
    }
    if (from === to) return

    let start: number | null = null
    const step = (ts: number) => {
      if (start === null) start = ts
      const t = Math.min(1, (ts - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  const text = Number.isFinite(display) ? display.toFixed(decimals) : '—'
  return (
    <span className={`tnum ${className ?? ''}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  )
}
