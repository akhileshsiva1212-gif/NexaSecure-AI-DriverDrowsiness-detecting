import { lazy, Suspense, useEffect, useState } from 'react'
import { Dashboard } from '../features/live-dashboard/Dashboard'
import { Backdrop } from '../components/Backdrop'

// Lazy-loaded so the Lab's heavier deps (jszip, tfjs) stay out of the dashboard bundle.
const DetectionLab = lazy(() =>
  import('../features/detection-lab/DetectionLab').then((m) => ({ default: m.DetectionLab })),
)

/** Minimal hash routing: #/lab → Detection Lab, everything else → the live dashboard. */
export default function App() {
  const [route, setRoute] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return (
    <>
      <Backdrop />
      <div className="relative z-10">
        {route.startsWith('#/lab') ? (
          <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading Detection Lab…</div>}>
            <DetectionLab />
          </Suspense>
        ) : (
          <Dashboard />
        )}
      </div>
    </>
  )
}
