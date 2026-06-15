import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DIRECTION_LABEL, DISTRACTION_STYLE, LEVEL_STYLE } from '../../lib/levelStyle'
import type { Drowsiness, DistractionState, DrowsinessLevel } from '../../lib/types'
import { AlertnessRing } from '../../components/AlertnessRing'
import { DetectionSource } from '../_shared/DetectionSource'
import { createFaceDetector } from '../../lib/detection'

export function CameraPanel() {
  const [drowsy, setDrowsy] = useState<Drowsiness | null>(null)
  const [distraction, setDistraction] = useState<DistractionState | null>(null)
  const [instantEar, setInstantEar] = useState<number | null>(null)

  // Poll the backend analysis (driven by whatever frames the detector is posting).
  useEffect(() => {
    let active = true
    const tick = () => {
      api.drowsiness().then((d) => active && setDrowsy(d)).catch(() => {})
      api.distraction().then((d) => active && setDistraction(d.state)).catch(() => {})
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const live = drowsy?.live ?? false
  const level: DrowsinessLevel | 'warming_up' = live ? drowsy?.state?.level ?? 'warming_up' : 'warming_up'
  const style = LEVEL_STYLE[level]
  const dStyle = DISTRACTION_STYLE[(live && distraction?.level) || 'warming_up']
  const perclos = drowsy?.state?.perclos ?? 0
  const score = live ? Math.round(100 - Math.min(100, perclos * 140)) : 0

  return (
    <section className={`glass overflow-hidden ${live ? style.glow : ''}`}>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Driver Monitoring
        </h2>
        {live && (
          <div className="flex items-center gap-2">
            <span className={`chip ${dStyle.chip}`}>
              {distraction && distraction.direction !== 'forward'
                ? DIRECTION_LABEL[distraction.direction]
                : dStyle.label}
            </span>
            <span className={`chip ${style.chip}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
              Live · {style.label}
            </span>
          </div>
        )}
      </div>

      {/* Camera / upload source with live face-mesh overlay. */}
      <div className="px-4 pt-3">
        <DetectionSource
          factory={createFaceDetector}
          mirror
          onResult={(r) => {
            const m = /EAR ([\d.]+)/.exec(r.summary)
            setInstantEar(m ? Number(m[1]) : null)
          }}
        />
      </div>

      <div className="flex items-center gap-4 px-4 py-4">
        <AlertnessRing
          value={score}
          color={style.ring}
          label={live ? `${score}` : '—'}
          sublabel="Alertness"
        />
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="metric">
            <div className="text-xs text-slate-400">Eye Openness</div>
            <div className="text-lg font-semibold">
              {instantEar ?? '—'}<span className="ml-1 text-xs text-slate-400">EAR</span>
            </div>
          </div>
          <div className="metric">
            <div className="text-xs text-slate-400">PERCLOS</div>
            <div className="text-lg font-semibold">
              {drowsy?.state ? Math.round(drowsy.state.perclos * 100) : '—'}
              <span className="ml-1 text-xs text-slate-400">%</span>
            </div>
          </div>
          <div className="metric">
            <div className="text-xs text-slate-400">Eyes Closed</div>
            <div className="text-lg font-semibold">
              {drowsy?.state?.eyes_closed_seconds ?? '—'}<span className="ml-1 text-xs text-slate-400">s</span>
            </div>
          </div>
          <div className="metric">
            <div className="text-xs text-slate-400">Yawns</div>
            <div className="text-lg font-semibold">
              {drowsy?.state?.yawns_per_minute ?? '—'}<span className="ml-1 text-xs text-slate-400">/min</span>
            </div>
          </div>
        </div>
      </div>

      <p className="border-t border-white/5 px-4 py-2.5 text-[11px] text-slate-500">
        Processed locally with MediaPipe. Video never leaves your browser — only anonymous
        eye/mouth ratios are sent. Use Live for the webcam or Upload to test a photo/clip.
      </p>
    </section>
  )
}
