// Horizontal bar gauge with colored threshold zones and a value marker.
// Used for metrics with a meaningful range (e.g. engine temperature).

interface Zone {
  upTo: number // zone ends at this value
  color: string
}

interface Props {
  value: number
  min: number
  max: number
  zones: Zone[] // ordered low -> high; last zone should reach `max`
  unit?: string
}

export function BarGauge({ value, min, max, zones, unit = '' }: Props) {
  const span = max - min || 1
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100))
  const markerPct = pct(value)

  // Color of the zone the current value falls into.
  const activeColor = zones.find((z) => value <= z.upTo)?.color ?? zones[zones.length - 1].color

  // Build the gradient stops from the zones.
  let prev = 0
  const stops: string[] = []
  for (const z of zones) {
    const end = pct(z.upTo)
    stops.push(`${z.color} ${prev}%`, `${z.color} ${end}%`)
    prev = end
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold" style={{ color: activeColor }}>
          {value}
          <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
        </span>
      </div>
      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full">
        <div className="absolute inset-0 opacity-70" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
        <div
          className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `calc(${markerPct}% - 2px)`, transition: 'left 0.5s ease' }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
