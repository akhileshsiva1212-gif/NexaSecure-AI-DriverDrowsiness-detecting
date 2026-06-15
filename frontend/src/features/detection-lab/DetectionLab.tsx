import { useRef, useState } from 'react'
import JSZip from 'jszip'
import { DETECTOR_REGISTRY, runImage, type Detector } from '../../lib/detection'
import { evaluate, type LabEvaluation, type SampleResult } from './metrics'

interface LabFile {
  blob: Blob
  name: string
  label?: string
}

const IMAGE_RE = /\.(png|jpe?g|webp|bmp|gif)$/i
const MAX_THUMBS = 120

function labelFromPath(path: string): string | undefined {
  const parts = path.split('/').filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : undefined
}

async function filesFrom(list: FileList): Promise<LabFile[]> {
  const out: LabFile[] = []
  for (const f of Array.from(list)) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      out.push(...(await filesFromZip(f)))
    } else if (IMAGE_RE.test(f.name)) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || ''
      out.push({ blob: f, name: f.name, label: rel ? labelFromPath(rel) : undefined })
    }
  }
  return out
}

async function filesFromZip(file: File): Promise<LabFile[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const out: LabFile[] = []
  const entries = Object.values(zip.files)
  for (const entry of entries) {
    if (entry.dir || !IMAGE_RE.test(entry.name)) continue
    const blob = await entry.async('blob')
    out.push({ blob, name: entry.name.split('/').pop() ?? entry.name, label: labelFromPath(entry.name) })
  }
  return out
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode failed'))
    img.src = url
  })
}

export function DetectionLab() {
  const [detectorId, setDetectorId] = useState(DETECTOR_REGISTRY[0].id)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'running' | 'done'>('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [samples, setSamples] = useState<SampleResult[]>([])
  const [evalResult, setEvalResult] = useState<LabEvaluation | null>(null)
  const [error, setError] = useState('')
  const cancelRef = useRef(false)
  const folderRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)

  const entry = DETECTOR_REGISTRY.find((d) => d.id === detectorId)!

  const reset = () => {
    samples.forEach((s) => s.thumbUrl && URL.revokeObjectURL(s.thumbUrl))
    setSamples([])
    setEvalResult(null)
    setError('')
    setProgress({ done: 0, total: 0 })
  }

  const run = async (list: FileList) => {
    reset()
    setPhase('loading')
    cancelRef.current = false
    let files: LabFile[]
    try {
      files = await filesFrom(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the files.')
      setPhase('idle')
      return
    }
    if (files.length === 0) {
      setError('No images found. Select a folder, image files, or a .zip of images.')
      setPhase('idle')
      return
    }

    const detector: Detector = entry.factory()
    try {
      await detector.load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the model.')
      setPhase('idle')
      return
    }

    setPhase('running')
    setProgress({ done: 0, total: files.length })
    const collected: SampleResult[] = []

    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break
      const f = files[i]
      const url = URL.createObjectURL(f.blob)
      try {
        const img = await loadImage(url)
        const result = await runImage(detector, img, null)
        const keepThumb = collected.length < MAX_THUMBS
        collected.push({
          name: f.name,
          predicted: result.label,
          confidence: result.score,
          truth: f.label,
          thumbUrl: keepThumb ? url : '',
        })
        if (!keepThumb) URL.revokeObjectURL(url)
      } catch {
        URL.revokeObjectURL(url)
      }
      if (i % 5 === 0 || i === files.length - 1) {
        setProgress({ done: i + 1, total: files.length })
        setSamples([...collected])
      }
    }

    detector.dispose?.()
    setSamples(collected)
    setEvalResult(evaluate(collected))
    setPhase('done')
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Detection Lab</h1>
          <p className="text-xs text-slate-400">
            Evaluate the on-device detectors over your own images (Kaggle/Google/GTSRB folders,
            or a zip). Runs entirely in your browser — nothing is uploaded.
          </p>
        </div>
        <a href="#/" className="chip border-white/15 text-slate-300 hover:bg-white/5">
          Back to dashboard
        </a>
      </header>

      {/* Controls */}
      <section className="glass p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">Detector</label>
          <select
            value={detectorId}
            onChange={(e) => setDetectorId(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-slate-200"
          >
            {DETECTOR_REGISTRY.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => folderRef.current?.click()}
            disabled={phase === 'running' || phase === 'loading'}
            className="rounded-lg bg-nexa-accent px-3 py-1.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            Upload folder
          </button>
          <button
            onClick={() => filesRef.current?.click()}
            disabled={phase === 'running' || phase === 'loading'}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5 disabled:opacity-50"
          >
            Images or .zip
          </button>
          {phase === 'running' && (
            <button
              onClick={() => (cancelRef.current = true)}
              className="rounded-lg border border-nexa-crit/40 px-3 py-1.5 text-sm font-semibold text-nexa-crit transition hover:bg-nexa-crit/10"
            >
              Cancel
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Tip: organise images into one subfolder per class (e.g. <code>stop/</code>,{' '}
          <code>speed_limit/</code>) and the Lab computes accuracy, precision/recall and a
          confusion matrix. Otherwise it reports prediction counts.
        </p>

        <input
          ref={folderRef}
          type="file"
          // @ts-expect-error — non-standard but widely supported directory picker.
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => e.target.files && run(e.target.files)}
        />
        <input
          ref={filesRef}
          type="file"
          accept="image/*,.zip"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && run(e.target.files)}
        />

        {(phase === 'loading' || phase === 'running') && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{phase === 'loading' ? 'Loading model…' : 'Evaluating…'}</span>
              <span>
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-nexa-accent transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-nexa-crit">{error}</p>}
      </section>

      {evalResult && <Metrics evalResult={evalResult} />}
      {samples.length > 0 && <Gallery samples={samples} />}
    </div>
  )
}

function Metrics({ evalResult }: { evalResult: LabEvaluation }) {
  const e = evalResult
  return (
    <section className="glass mt-4 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">Results</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Images" value={`${e.total}`} />
        <Stat label="Detected" value={`${Math.round(e.detectionRate * 100)}%`} />
        <Stat label="Mean confidence" value={`${Math.round(e.meanConfidence * 100)}%`} />
        {e.labeled && <Stat label="Accuracy" value={`${Math.round(e.accuracy * 100)}%`} highlight />}
      </div>

      {e.labeled ? (
        <>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Per-class
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="py-1 pr-4">Class</th>
                  <th className="py-1 pr-4">Support</th>
                  <th className="py-1 pr-4">Precision</th>
                  <th className="py-1 pr-4">Recall</th>
                  <th className="py-1">F1</th>
                </tr>
              </thead>
              <tbody>
                {e.classes.map((c) => (
                  <tr key={c.label} className="border-t border-white/5">
                    <td className="py-1 pr-4 text-slate-200">{c.label}</td>
                    <td className="py-1 pr-4 text-slate-400">{c.support}</td>
                    <td className="py-1 pr-4">{(c.precision * 100).toFixed(0)}%</td>
                    <td className="py-1 pr-4">{(c.recall * 100).toFixed(0)}%</td>
                    <td className="py-1">{(c.f1 * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {e.confusion && <Confusion confusion={e.confusion} />}
        </>
      ) : (
        <>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Predicted classes
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(e.predictedCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <span key={k} className="chip border-white/15 text-slate-200">
                  {k}: {v}
                </span>
              ))}
          </div>
        </>
      )}
    </section>
  )
}

function Confusion({ confusion }: { confusion: { labels: string[]; matrix: number[][] } }) {
  const max = Math.max(1, ...confusion.matrix.flat())
  return (
    <>
      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Confusion matrix (rows = truth, cols = predicted)
      </h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {confusion.labels.map((l) => (
                <th key={l} className="max-w-[60px] truncate p-1 text-slate-400" title={l}>
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {confusion.matrix.map((row, i) => (
              <tr key={confusion.labels[i]}>
                <td className="p-1 pr-2 text-right text-slate-400" title={confusion.labels[i]}>
                  {confusion.labels[i]}
                </td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className="p-1 text-center text-slate-100"
                    style={{ background: `rgba(45,212,191,${v ? 0.15 + (v / max) * 0.6 : 0})` }}
                  >
                    {v || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="metric">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-xl font-semibold ${highlight ? 'text-nexa-accent' : ''}`}>{value}</div>
    </div>
  )
}

function Gallery({ samples }: { samples: SampleResult[] }) {
  const shown = samples.filter((s) => s.thumbUrl)
  return (
    <section className="glass mt-4 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
        Gallery {shown.length < samples.length && `(first ${shown.length} of ${samples.length})`}
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((s, i) => {
          const correct = s.truth ? matchesLoose(s.predicted, s.truth) : null
          return (
            <div key={i} className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
              <img src={s.thumbUrl} alt={s.name} className="aspect-square w-full object-cover" />
              <div className="p-1.5">
                <div className="truncate text-[11px] text-slate-200" title={s.predicted || '(none)'}>
                  {s.predicted || '(none)'}{' '}
                  {s.confidence > 0 && (
                    <span className="text-slate-500">{Math.round(s.confidence * 100)}%</span>
                  )}
                </div>
                {s.truth && (
                  <div
                    className={`truncate text-[10px] ${correct ? 'text-nexa-ok' : 'text-nexa-crit'}`}
                    title={s.truth}
                  >
                    {s.truth}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function matchesLoose(predicted: string, truth: string): boolean {
  if (!predicted) return false
  const n = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '')
  const p = n(predicted)
  const t = n(truth)
  return p === t || t.includes(p) || p.includes(t)
}
