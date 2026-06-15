// Minimal dependency-free SVG sparkline for live metric trends.

interface Props {
  values: number[]
  color: string
  height?: number
  /** Optional fixed value range; otherwise auto-scales to the data. */
  min?: number
  max?: number
}

export function Sparkline({ values, color, height = 40, min, max }: Props) {
  const width = 120
  if (values.length < 2) {
    return <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" />
  }

  const lo = min ?? Math.min(...values)
  const hi = max ?? Math.max(...values)
  const span = hi - lo || 1
  const stepX = width / (values.length - 1)

  const pts = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - lo) / span) * (height - 4) - 2 // 2px padding top/bottom
    return [x, Math.max(0, Math.min(height, y))] as const
  })

  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const gid = `spark-${color.replace('#', '')}`

  const [hx, hy] = pts[pts.length - 1]

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`${gid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter={`url(#${gid}-glow)`}
        vectorEffect="non-scaling-stroke"
      />
      {/* Leading-edge dot marks the latest reading. */}
      <circle cx={hx} cy={hy} r={2.2} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
