import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  runImage,
  runLive,
  runVideoFile,
  type Detector,
  type DetectorFactory,
  type DetectionResult,
  type RunHandle,
  type SourceMode,
} from '../../lib/detection'

type Phase = 'idle' | 'loading' | 'running' | 'error'

export interface DetectionSourceProps {
  /** Creates the detector instance for this module (one per mounted control). */
  factory: DetectorFactory
  /** Live camera feeds the dashboard via ingest (default true). */
  ingestLive?: boolean
  /** Uploaded media also feeds the dashboard (default false — display locally only). */
  ingestUploads?: boolean
  /** Result callback (drives module-specific UI / metrics). */
  onResult?: (r: DetectionResult) => void
  /** Notifies the parent when a detector instance is created (e.g. lane turn-signal control). */
  onDetector?: (d: Detector) => void
  /** Extra controls rendered in the source toolbar (e.g. lane ←/→ signal buttons). */
  extraControls?: ReactNode
  /** Mirror the preview (selfie view) — defaults to true for user-facing cameras. */
  mirror?: boolean
}

/**
 * Reusable detection source control: switch between Live camera / Upload (image or video) /
 * Off, run the module's REAL detector on the chosen input, draw overlays, and (for live) push
 * results to the backend. The same control is embedded in every detection module.
 */
export function DetectionSource({
  factory,
  ingestLive = true,
  ingestUploads = false,
  onResult,
  onDetector,
  extraControls,
  mirror,
}: DetectionSourceProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<Detector | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const handleRef = useRef<RunHandle | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [mode, setMode] = useState<SourceMode>('off')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [loadMsg, setLoadMsg] = useState('')
  const [fps, setFps] = useState(0)
  const [infMs, setInfMs] = useState(0)
  const [summary, setSummary] = useState('')
  const [showMedia, setShowMedia] = useState(false)

  const isUser = mirror ?? detectorRef.current?.facing === 'user'

  function ensureDetector(): Detector {
    if (!detectorRef.current) {
      detectorRef.current = factory()
      onDetector?.(detectorRef.current)
    }
    return detectorRef.current
  }

  function teardown() {
    handleRef.current?.stop()
    handleRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    const v = videoRef.current
    if (v) {
      v.srcObject = null
      v.removeAttribute('src')
      v.load()
    }
    const c = canvasRef.current
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setShowMedia(false)
    setFps(0)
    setSummary('')
  }

  const handleResult = (r: DetectionResult) => {
    setSummary(r.summary)
    onResult?.(r)
  }
  const handleFps = (f: number, ms: number) => {
    setFps(f)
    setInfMs(ms)
  }

  async function loadDetector(): Promise<Detector | null> {
    const det = ensureDetector()
    setPhase('loading')
    setError('')
    try {
      await det.load(setLoadMsg)
      return det
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the model.')
      setPhase('error')
      return null
    }
  }

  const startLive = async () => {
    teardown()
    setMode('live')
    const det = await loadDetector()
    if (!det) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // `ideal` (not exact) so a laptop with only a front camera still starts for the
        // road-facing detectors (lane / hazard / forward / signs) instead of failing.
        video: { facingMode: { ideal: det.facing }, width: 1280, height: 720 },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setShowMedia(true)
      setPhase('running')
      handleRef.current = runLive(det, video, canvasRef.current, {
        ingest: ingestLive,
        onResult: handleResult,
        onFps: handleFps,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the camera.')
      setPhase('error')
      teardown()
    }
  }

  const onFile = async (file: File) => {
    teardown()
    const det = await loadDetector()
    if (!det) return
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url

    if (file.type.startsWith('video/')) {
      setMode('video')
      const video = videoRef.current!
      video.srcObject = null
      video.src = url
      video.loop = true
      video.muted = true
      try {
        await video.play()
        setShowMedia(true)
        setPhase('running')
        handleRef.current = runVideoFile(det, video, canvasRef.current, {
          ingest: ingestUploads,
          onResult: handleResult,
          onFps: handleFps,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not play the video.')
        setPhase('error')
      }
    } else {
      setMode('image')
      const img = imgRef.current!
      img.src = url
      try {
        await img.decode()
        setShowMedia(true)
        setPhase('running')
        await runImage(det, img, canvasRef.current, {
          ingest: ingestUploads,
          onResult: handleResult,
          onFps: handleFps,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the image.')
        setPhase('error')
      }
    }
  }

  const stop = () => {
    teardown()
    setMode('off')
    setPhase('idle')
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      teardown()
      detectorRef.current?.dispose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const accept = detectorRef.current?.accept ?? 'image/*,video/*'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
          <button
            onClick={startLive}
            className={`px-3 py-1 text-xs font-medium transition ${
              mode === 'live' ? 'bg-nexa-accent text-black' : 'bg-black/30 text-slate-300 hover:bg-white/5'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`border-l border-white/10 px-3 py-1 text-xs font-medium transition ${
              mode === 'image' || mode === 'video'
                ? 'bg-nexa-accent text-black'
                : 'bg-black/30 text-slate-300 hover:bg-white/5'
            }`}
          >
            Upload
          </button>
          <button
            onClick={stop}
            className={`border-l border-white/10 px-3 py-1 text-xs font-medium transition ${
              mode === 'off' ? 'bg-white/10 text-slate-200' : 'bg-black/30 text-slate-400 hover:bg-white/5'
            }`}
          >
            Off
          </button>
        </div>
        {extraControls}
        {phase === 'running' && (
          <span className="chip border-white/10 text-slate-400">
            {fps > 0 ? `${fps.toFixed(0)} fps · ` : ''}
            {infMs > 0 ? `${infMs.toFixed(0)} ms` : 'image'}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* Preview */}
      <div
        className={`relative mt-2 w-full overflow-hidden rounded-lg bg-black/40 ${
          showMedia || phase === 'loading' ? 'aspect-video' : 'h-0'
        }`}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-contain ${isUser ? '-scale-x-100' : ''} ${
            showMedia && mode !== 'image' ? 'block' : 'hidden'
          }`}
        />
        <img
          ref={imgRef}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain ${
            showMedia && mode === 'image' ? 'block' : 'hidden'
          }`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full object-contain ${isUser ? '-scale-x-100' : ''}`}
        />
        {phase === 'loading' && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <p className="text-xs text-slate-300">{loadMsg || 'Loading…'}</p>
          </div>
        )}
      </div>

      {summary && phase === 'running' && (
        <p className="mt-1.5 text-xs text-slate-400">{summary}</p>
      )}
      {phase === 'error' && <p className="mt-1.5 text-xs text-nexa-crit">{error}</p>}
    </div>
  )
}
