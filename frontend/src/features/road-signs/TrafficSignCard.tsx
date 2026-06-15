import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { TrafficSigns } from '../../lib/types'
import { DetectionSource } from '../_shared/DetectionSource'
import { LiveDot } from '../road-hazard/RoadHazardCard'
import { createSignDetector, createGtsrbClassifier } from '../../lib/detection'
import type { SignClassifier } from '../../lib/detection/detectors/signClassifier'

/** Classic red-roundel speed-limit sign. */
function SpeedLimitSign({ value }: { value: number | null }) {
  return (
    <div className="relative grid h-20 w-20 place-items-center rounded-full border-[6px] border-nexa-crit bg-white shadow-glow-crit">
      <span className="text-2xl font-extrabold leading-none text-black">{value ?? '—'}</span>
      <span className="absolute -bottom-5 text-[10px] uppercase tracking-wider text-slate-400">
        km/h
      </span>
    </div>
  )
}

export function TrafficSignCard() {
  const [data, setData] = useState<TrafficSigns | null>(null)
  // Opt-in GTSRB multi-class classifier (kept across re-renders so the model loads once).
  const classifierRef = useRef<SignClassifier | null>(null)
  const [multiClass, setMultiClass] = useState(false)

  useEffect(() => {
    let active = true
    const tick = () => api.trafficSigns().then((d) => active && setData(d)).catch(() => {})
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const makeDetector = () => {
    if (multiClass) {
      if (!classifierRef.current) classifierRef.current = createGtsrbClassifier()
      return createSignDetector({ classifier: classifierRef.current })
    }
    return createSignDetector()
  }

  const state = data?.state
  const live = data?.live ?? false
  const signs = state?.signs ?? []

  const multiToggle = (
    <button
      onClick={() => setMultiClass((v) => !v)}
      title="Load the GTSRB multi-class sign model (experimental)"
      className={`chip transition ${
        multiClass
          ? 'border-nexa-accent2/40 bg-nexa-accent2/10 text-nexa-accent2'
          : 'border-white/15 text-slate-400 hover:bg-white/5'
      }`}
    >
      Multi-class
    </button>
  )

  return (
    <section className="glass p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Road Signs
        </h2>
        <LiveDot live={live} />
      </header>

      <div className="flex items-center gap-4">
        <SpeedLimitSign value={state?.active_speed_limit ?? null} />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-400">Recently detected</div>
          {signs.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              Point the road camera or upload an image/video to detect signs.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {signs.slice(0, 5).map((s, i) => (
                <span
                  key={`${s.kind}-${s.value}-${i}`}
                  className={`chip border-white/15 text-slate-200 ${i === 0 ? 'bg-white/10' : ''}`}
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real in-browser sign detection (live road camera, image, or video). */}
      <div className="mt-4 border-t border-white/5 pt-3">
        <DetectionSource key={multiClass ? 'multi' : 'stop'} factory={makeDetector} extraControls={multiToggle} />
        <p className="mt-2 text-[11px] text-slate-500">
          Detected on-device — only labels are sent, never video. STOP is detected by the
          COCO model; enable <span className="text-slate-400">Multi-class</span> to add speed
          limits, yield &amp; more via the GTSRB model (experimental).
        </p>
      </div>
    </section>
  )
}
