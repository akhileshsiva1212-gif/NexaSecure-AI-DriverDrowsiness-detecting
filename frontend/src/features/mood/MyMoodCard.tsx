import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { AudioOption, DrowsinessLevel, MoodPreference } from '../../lib/types'
import { WakeAudioEngine } from './audioEngine'
import { clearUploadedAudio, loadUploadedAudio, saveUploadedAudio } from './audioStore'
import {
  GRAD,
  GlyphAlert,
  GlyphMusic,
  GlyphSiren,
  GlyphUpload,
  Tile3D,
  type GradKey,
} from '../../components/Icon3D'

// Drowsiness levels at/above which the wake-up alert fires (the "sleep threshold").
const DANGER: ReadonlySet<string> = new Set<DrowsinessLevel>(['drowsy', 'microsleep'])
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

interface OptionMeta {
  id: AudioOption
  Glyph: () => JSX.Element
  grad: GradKey
  label: string
  desc: string
}

const OPTIONS: OptionMeta[] = [
  { id: 'default-alarm', Glyph: GlyphSiren, grad: 'red', label: 'Default Alarm', desc: 'Loud emergency siren' },
  { id: 'music-1', Glyph: GlyphMusic, grad: 'violet', label: 'Music 1', desc: 'Bright arpeggio' },
  { id: 'music-2', Glyph: GlyphMusic, grad: 'cyan', label: 'Music 2', desc: 'Calm melody' },
  { id: 'uploaded', Glyph: GlyphUpload, grad: 'pink', label: 'Upload Audio', desc: 'Your MP3 / WAV' },
]

const DEFAULT_PREF: MoodPreference = { selected: 'default-alarm', uploaded_name: null, volume: 0.9 }

export function MyMoodCard() {
  const [pref, setPref] = useState<MoodPreference>(DEFAULT_PREF)
  const [uploadedName, setUploadedName] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [alerting, setAlerting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [driverStatus, setDriverStatus] = useState<DrowsinessLevel | 'warming_up'>('warming_up')
  const [driverLive, setDriverLive] = useState(false)

  const engineRef = useRef(new WakeAudioEngine())
  const uploadedUrlRef = useRef<string | null>(null)
  const prefRef = useRef(pref)
  const alertingRef = useRef(false)
  const suppressedRef = useRef(false) // true after a manual stop, until the driver is attentive
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    prefRef.current = pref
  }, [pref])
  useEffect(() => {
    alertingRef.current = alerting
  }, [alerting])

  // Load the saved preference (backend) and the uploaded blob (IndexedDB) on mount.
  useEffect(() => {
    let active = true
    ;(async () => {
      const stored = await loadUploadedAudio().catch(() => null)
      if (active && stored) {
        uploadedUrlRef.current = URL.createObjectURL(stored.blob)
        setUploadedName(stored.name)
      }
      const p = await api.getMood().catch(() => null)
      if (active && p) setPref(p)
    })()
    const engine = engineRef.current
    return () => {
      active = false
      engine.stop()
      if (uploadedUrlRef.current) URL.revokeObjectURL(uploadedUrlRef.current)
    }
  }, [])

  const startAlert = useCallback(() => {
    const p = prefRef.current
    void engineRef.current.play(p.selected, { volume: p.volume, uploadedUrl: uploadedUrlRef.current })
    setPreviewing(false)
    setAlerting(true)
  }, [])

  const stopAudio = useCallback(() => {
    engineRef.current.stop()
    setAlerting(false)
    setPreviewing(false)
  }, [])

  // Manual stop: silence now and don't re-trigger until the driver is attentive again.
  const stopAlertManual = useCallback(() => {
    suppressedRef.current = true
    stopAudio()
  }, [stopAudio])

  // Real-time integration with the drowsiness pipeline: poll the same endpoint the driver
  // cards use, and play the wake-up sound the moment the threshold is crossed.
  useEffect(() => {
    let active = true
    const tick = async () => {
      try {
        const d = await api.drowsiness()
        if (!active) return
        setDriverStatus(d.status)
        setDriverLive(d.live)
        const danger = d.live && DANGER.has(d.status)
        if (d.status === 'alert') suppressedRef.current = false // attentive → re-arm
        if (danger && !alertingRef.current && !suppressedRef.current) {
          startAlert()
        } else if (!danger && alertingRef.current) {
          stopAudio() // attentive again / face lost / camera off → stop
        }
      } catch {
        /* backend hiccup — keep polling */
      }
    }
    void tick()
    const id = window.setInterval(tick, 1000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [startAlert, stopAudio])

  const persist = (next: MoodPreference) => {
    setPref(next)
    void api.setMood(next).catch(() => {})
  }

  const choose = async (opt: AudioOption) => {
    if (opt === 'uploaded' && !uploadedUrlRef.current) {
      fileInputRef.current?.click()
      return
    }
    await engineRef.current.unlock() // user gesture: enable later alert playback
    const next = { ...prefRef.current, selected: opt }
    persist(next)
    if (previewing) void engineRef.current.play(opt, { volume: next.volume, uploadedUrl: uploadedUrlRef.current })
  }

  const onUpload = async (file: File) => {
    setUploadError('')
    const okType = /audio\/(mpeg|mp3|wav|x-wav|wave)/i.test(file.type) || /\.(mp3|wav)$/i.test(file.name)
    if (!okType) {
      setUploadError('Please choose an MP3 or WAV file.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('File is too large (max 15 MB).')
      return
    }
    try {
      await saveUploadedAudio(file, file.name)
    } catch {
      setUploadError('Could not save the file on this device.')
      return
    }
    if (uploadedUrlRef.current) URL.revokeObjectURL(uploadedUrlRef.current)
    uploadedUrlRef.current = URL.createObjectURL(file)
    setUploadedName(file.name)
    await engineRef.current.unlock()
    persist({ selected: 'uploaded', uploaded_name: file.name, volume: prefRef.current.volume })
  }

  const removeUpload = async () => {
    await clearUploadedAudio().catch(() => {})
    if (uploadedUrlRef.current) {
      URL.revokeObjectURL(uploadedUrlRef.current)
      uploadedUrlRef.current = null
    }
    setUploadedName(null)
    if (prefRef.current.selected === 'uploaded') {
      persist({ ...prefRef.current, selected: 'default-alarm', uploaded_name: null })
    } else {
      persist({ ...prefRef.current, uploaded_name: null })
    }
  }

  const togglePreview = async () => {
    if (previewing) {
      stopAudio()
      return
    }
    await engineRef.current.unlock()
    await engineRef.current.play(prefRef.current.selected, {
      volume: prefRef.current.volume,
      uploadedUrl: uploadedUrlRef.current,
    })
    setPreviewing(true)
  }

  const onVolume = (v: number) => {
    engineRef.current.setVolume(v)
    setPref((p) => ({ ...p, volume: v }))
  }

  const selectedMeta = OPTIONS.find((o) => o.id === pref.selected) ?? OPTIONS[0]
  const selectedLabel = pref.selected === 'uploaded' ? uploadedName ?? 'Upload Audio' : selectedMeta.label

  return (
    <section
      className={`glass animate-float-in p-4 ${alerting ? 'shadow-glow-crit ring-1 ring-nexa-crit/50' : ''}`}
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">My Mood</h2>
        <span
          className={`chip ${
            alerting
              ? 'border-nexa-crit/40 bg-nexa-crit/10 text-nexa-crit'
              : driverLive
                ? 'border-nexa-ok/40 bg-nexa-ok/10 text-nexa-ok'
                : 'border-white/20 bg-white/5 text-slate-300'
          }`}
        >
          {alerting ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" /> Alerting
            </>
          ) : driverLive ? (
            'Armed'
          ) : (
            'Standby'
          )}
        </span>
      </header>

      {/* Alerting banner with a prominent manual stop. */}
      {alerting ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-nexa-crit/40 bg-nexa-crit/10 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-nexa-crit">
            <Tile3D grad={GRAD.red} size={26} className="shrink-0">
              <GlyphAlert />
            </Tile3D>
            <span className="font-semibold">Wake up! Drowsiness detected.</span>
          </div>
          <button
            onClick={stopAlertManual}
            className="rounded-md bg-nexa-crit px-3 py-1 text-xs font-semibold text-black transition hover:brightness-110"
          >
            Stop
          </button>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-slate-400">
          Plays only when Driver Drowsiness crosses the alert threshold — silent otherwise.
        </p>
      )}

      {/* Audio source selection (single active source). */}
      <div role="radiogroup" aria-label="Wake-up sound" className="space-y-1.5">
        {OPTIONS.map((o) => {
          const active = pref.selected === o.id
          const sub = o.id === 'uploaded' ? uploadedName ?? o.desc : o.desc
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={active}
              onClick={() => choose(o.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? 'border-nexa-accent/60 bg-nexa-accent/10'
                  : 'border-white/10 bg-black/20 hover:bg-white/5'
              }`}
            >
              <Tile3D grad={GRAD[o.grad]} size={34} className="shrink-0">
                <o.Glyph />
              </Tile3D>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-200">{o.label}</span>
                <span className="block truncate text-[11px] text-slate-400">{sub}</span>
              </span>
              {o.id === 'uploaded' && uploadedName && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    void removeUpload()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      void removeUpload()
                    }
                  }}
                  className="grid place-items-center rounded p-1 text-slate-400 hover:text-nexa-crit"
                  title="Remove uploaded file"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </span>
              )}
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                  active ? 'border-nexa-accent bg-nexa-accent' : 'border-white/30'
                }`}
              />
            </button>
          )
        })}
      </div>

      {/* Upload control + validation message. */}
      <div className="mt-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-[11px] text-nexa-accent hover:underline"
        >
          {uploadedName ? 'Replace uploaded file…' : 'Upload MP3 / WAV…'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onUpload(f)
            e.target.value = ''
          }}
        />
        {uploadError && <p className="mt-1 text-[11px] text-nexa-crit">{uploadError}</p>}
      </div>

      {/* Volume */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-slate-400">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={pref.volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          onPointerUp={() => persist(prefRef.current)}
          className="h-1 flex-1 cursor-pointer accent-nexa-accent"
          aria-label="Alert volume"
        />
        <span className="w-8 text-right text-[11px] tabular-nums text-slate-400">
          {Math.round(pref.volume * 100)}%
        </span>
      </div>

      {/* Selected summary + preview/test */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Tile3D grad={GRAD[selectedMeta.grad]} size={34} className="shrink-0">
            <selectedMeta.Glyph />
          </Tile3D>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Selected alert</div>
            <div className="truncate text-sm font-medium text-slate-200">{selectedLabel}</div>
          </div>
        </div>
        <button
          onClick={togglePreview}
          disabled={alerting}
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            previewing
              ? 'border-nexa-accent/60 bg-nexa-accent/10 text-nexa-accent'
              : 'border-white/15 text-slate-300 hover:bg-white/5'
          } ${alerting ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {previewing ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5l11 7-11 7z" />
            </svg>
          )}
          {previewing ? 'Stop' : 'Test'}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        {driverStatus === 'warming_up'
          ? 'Enable Driver Monitoring (Live) to arm the wake-up alert.'
          : 'Audio plays on-device. Uploaded files stay in your browser.'}
      </p>
    </section>
  )
}
