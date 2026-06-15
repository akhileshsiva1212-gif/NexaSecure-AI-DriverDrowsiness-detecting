import { useEffect, useRef, useState } from 'react'
import { connectLive } from '../../lib/ws'
import type { AdvisoryEvent } from '../../lib/types'
import { StatusStrip } from '../../components/StatusStrip'
import { CameraPanel } from '../driver-camera/CameraPanel'
import { DriverStatusCard } from '../driver-status/DriverStatusCard'
import { DistractionCard } from '../driver-status/DistractionCard'
import { TrafficSignCard } from '../road-signs/TrafficSignCard'
import { VehicleHealthCard } from '../vehicle-health/VehicleHealthCard'
import { PredictiveMaintenanceCard } from '../vehicle-maintenance/PredictiveMaintenanceCard'
import { RoadHazardCard } from '../road-hazard/RoadHazardCard'
import { ForwardCollisionCard } from '../forward-collision/ForwardCollisionCard'
import { AccidentRiskCard } from '../accident-risk/AccidentRiskCard'
import { SosCard } from '../sos/SosCard'
import { MyMoodCard } from '../mood/MyMoodCard'
import { AlertsFeed } from './AlertsFeed'

const MAX_EVENTS = 50

export function Dashboard() {
  const [events, setEvents] = useState<AdvisoryEvent[]>([])
  const [connected, setConnected] = useState(false)
  const seen = useRef<Set<string>>(new Set())

  const addEvents = (incoming: AdvisoryEvent[]) => {
    setEvents((prev) => {
      const fresh = incoming.filter((e) => !seen.current.has(e.id))
      fresh.forEach((e) => seen.current.add(e.id))
      if (fresh.length === 0) return prev
      return [...fresh, ...prev].slice(0, MAX_EVENTS)
    })
  }

  useEffect(() => {
    const close = connectLive({
      onSnapshot: (evs) => addEvents(evs),
      onAdvisory: (e) => addEvents([e]),
      onStatus: setConnected,
    })
    return close
  }, [])

  return (
    <div className="min-h-full">
      {/* Sticky, frosted command-bar header. */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-nexa-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-nexa-accent to-nexa-accent2 text-lg font-black text-black shadow-glow-accent">
              N
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-nexa-bg bg-nexa-ok animate-pulse-soft" />
            </div>
            <div>
              <h1 className="text-[1.05rem] font-bold leading-tight tracking-tight">NexaSecure AI</h1>
              <p className="text-[11px] tracking-wide text-slate-400">
                Advisory-only · Privacy-first · On-device
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#/lab"
              className="chip border-white/15 text-slate-300 transition hover:border-nexa-accent/40 hover:bg-white/5"
              title="Batch-evaluate the detectors over your own datasets"
            >
              Detection Lab
            </a>
            <span
              className={`chip ${
                connected
                  ? 'border-nexa-ok/40 text-nexa-ok bg-nexa-ok/10'
                  : 'border-nexa-warn/40 text-nexa-warn bg-nexa-warn/10'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-current ${connected ? 'animate-pulse-soft' : ''}`} />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8">
        {/* At-a-glance KPI strip */}
        <StatusStrip alertsCount={events.length} />

        {/* Row 1 — camera hero on the left, driver + vehicle status stacked on the right. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CameraPanel />
          </div>
          <div className="flex flex-col gap-5">
            <DriverStatusCard />
            <DistractionCard />
            <VehicleHealthCard />
            <PredictiveMaintenanceCard />
          </div>
        </div>

        {/* Row 2 — Road Perception: forward-facing features in their own instrument panel. */}
        <section className="mt-8">
          <h2 className="section-label">Road Perception</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <TrafficSignCard />
            <RoadHazardCard />
            <ForwardCollisionCard />
          </div>
        </section>

        {/* Row 3 — Safety & Wellbeing: fused crash risk, SOS, and the My Mood wake-up alert. */}
        <section className="mt-8">
          <h2 className="section-label">Safety &amp; Wellbeing</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <AccidentRiskCard />
            <SosCard />
            <MyMoodCard />
          </div>
        </section>

        {/* Row 4 — live advisory feed, full width (the card carries its own header). */}
        <section className="mt-8">
          <AlertsFeed events={events} />
        </section>

        <footer className="mt-10 border-t border-white/[0.06] pt-6 text-center text-xs text-slate-600">
          NexaSecure assists the driver. It does not control the vehicle.
        </footer>
      </main>
    </div>
  )
}
