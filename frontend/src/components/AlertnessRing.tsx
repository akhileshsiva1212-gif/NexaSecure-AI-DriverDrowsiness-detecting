// Instrument-style radial gauge for the "alertness" score (0–100). A gradient arc with a soft
// glow, tick marks around the bezel, a pulsing halo, and an animated sweep give it the feel of
// a real cluster dial rather than a flat ring.

interface Props {
  value: number // 0..100
  color: string // arc color (hex)
  label: string
  sublabel?: string
}

export function AlertnessRing({ value, color, label, sublabel }: Props) {
  const size = 140
  const stroke = 11
  const c = size / 2
  const r = (size - stroke) / 2 - 6 // leave room for tick marks on the bezel
  const circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circ * (1 - clamped / 100)
  const uid = color.replace('#', '')

  // 36 tick marks around the dial (every 10°), brighter where the value has "filled".
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const ang = (i / 36) * 2 * Math.PI - Math.PI / 2
    const inner = r + 7
    const outer = r + (i % 3 === 0 ? 13 : 10)
    const filled = i / 36 <= clamped / 100
    return {
      x1: c + inner * Math.cos(ang),
      y1: c + inner * Math.sin(ang),
      x2: c + outer * Math.cos(ang),
      y2: c + outer * Math.sin(ang),
      filled,
    }
  })

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {/* Pulsing halo behind the dial. */}
      <div
        className="absolute h-[78%] w-[78%] rounded-full blur-xl animate-ring-pulse"
        style={{ background: color, opacity: 0.18 }}
      />
      <svg width={size} height={size} className="relative">
        <defs>
          <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Bezel ticks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.filled ? color : 'rgba(255,255,255,0.14)'}
            strokeWidth={i % 3 === 0 ? 1.8 : 1}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.4s ease' }}
          />
        ))}

        <g transform={`rotate(-90 ${c} ${c})`}>
          {/* Track */}
          <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          {/* Value arc */}
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={`url(#grad-${uid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            filter={`url(#glow-${uid})`}
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </g>
      </svg>

      <div className="absolute flex flex-col items-center">
        <span className="text-[2rem] font-bold leading-none tnum" style={{ color }}>
          {label}
        </span>
        {sublabel && (
          <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{sublabel}</span>
        )}
      </div>
    </div>
  )
}
