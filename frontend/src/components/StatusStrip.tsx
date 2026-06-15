import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { LEVEL_STYLE } from '../lib/levelStyle'
import type { Drowsiness, VehicleHealth } from '../lib/types'
import { AnimatedNumber } from './AnimatedNumber'
import {
  GRAD,
  GlyphBell,
  GlyphCar,
  GlyphShield,
  GlyphShieldAlert,
  GlyphUser,
  Tile3D,
  type GradKey,
} from './Icon3D'

interface Props {
  alertsCount: number
}

function Tile({
  label,
  value,
  accent,
  grad,
  glyph,
  pulse,
  delay,
}: {
  label: string
  value: ReactNode
  accent: string
  grad: GradKey
  glyph: ReactNode
  pulse?: boolean
  delay: number
}) {
  return (
    <div
      className="glass glass-hover relative overflow-hidden px-4 py-3.5 animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Left accent rail (glows in the status color). */}
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
        style={{ background: accent, boxShadow: `0 0 18px ${accent}` }}
      />
      <div className="flex items-center justify-between pl-1.5">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-1 text-xl font-bold leading-none tnum" style={{ color: accent }}>
            {value}
          </div>
        </div>
        <Tile3D grad={GRAD[grad]} size={38} pulse={pulse}>
          {glyph}
        </Tile3D>
      </div>
    </div>
  )
}

export function StatusStrip({ alertsCount }: Props) {
  const [driver, setDriver] = useState<Drowsiness | null>(null)
  const [vehicle, setVehicle] = useState<VehicleHealth | null>(null)

  useEffect(() => {
    let active = true
    const tick = () => {
      api.drowsiness().then((d) => active && setDriver(d)).catch(() => {})
      api.vehicleHealth().then((v) => active && setVehicle(v)).catch(() => {})
    }
    tick()
    const id = setInterval(tick, 1500)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const driverLevel = driver?.status ?? 'warming_up'
  const driverStyle = LEVEL_STYLE[driverLevel]
  const vehicleStatus = vehicle?.status ?? 'warming_up'

  // Overall safety = worst of driver + vehicle.
  const critical = driverLevel === 'microsleep' || vehicleStatus === 'critical'
  const caution = driverLevel === 'drowsy' || vehicleStatus === 'warning'
  const overall = critical
    ? { value: 'Critical', accent: '#fb7185', grad: 'red' as GradKey, glyph: <GlyphShieldAlert /> }
    : caution
      ? { value: 'Caution', accent: '#fbbf24', grad: 'amber' as GradKey, glyph: <GlyphShieldAlert /> }
      : { value: 'Good', accent: '#34d399', grad: 'green' as GradKey, glyph: <GlyphShield /> }

  const vehicleConnected = vehicle?.connected
  const vehicleAccent = vehicleConnected
    ? vehicleStatus === 'critical'
      ? '#fb7185'
      : vehicleStatus === 'warning'
        ? '#fbbf24'
        : '#34d399'
    : '#94a3b8'
  const vehicleGrad: GradKey = !vehicleConnected
    ? 'slate'
    : vehicleStatus === 'critical'
      ? 'red'
      : vehicleStatus === 'warning'
        ? 'amber'
        : 'green'

  const driverGrad: GradKey =
    driverLevel === 'microsleep' ? 'red' : driverLevel === 'drowsy' ? 'amber' : driverLevel === 'alert' ? 'green' : 'cyan'

  return (
    <div className="mb-5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
      <Tile label="Overall Safety" value={overall.value} accent={overall.accent} grad={overall.grad} glyph={overall.glyph} pulse={critical} delay={0} />
      <Tile label="Driver" value={driverStyle.label} accent={driverStyle.ring} grad={driverGrad} glyph={<GlyphUser />} pulse={driverLevel === 'microsleep'} delay={70} />
      <Tile
        label="Vehicle"
        value={vehicleConnected ? vehicleStatus.replace('_', ' ') : 'Offline'}
        accent={vehicleAccent}
        grad={vehicleGrad}
        glyph={<GlyphCar />}
        delay={140}
      />
      <Tile
        label="Active Alerts"
        value={<AnimatedNumber value={alertsCount} duration={500} />}
        accent={alertsCount ? '#fbbf24' : '#34d399'}
        grad={alertsCount ? 'amber' : 'cyan'}
        glyph={<GlyphBell />}
        pulse={alertsCount > 0}
        delay={210}
      />
    </div>
  )
}
