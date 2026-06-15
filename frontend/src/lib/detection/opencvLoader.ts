// Lazy loader for OpenCV.js (WASM, ~11 MB). Loaded only when a feature that needs it (lane
// detection) is actually activated. Everything runs locally in the browser once loaded —
// no frames leave the device.
//
// The runtime is vendored at /vendor/opencv.js (same-origin, reliable, offline-capable); the
// official CDN is kept as a fallback if the local copy is missing.

const OPENCV_SOURCES = ['/vendor/opencv.js', 'https://docs.opencv.org/4.x/opencv.js']

let loadPromise: Promise<any> | null = null

declare global {
  interface Window {
    cv?: any
  }
}

function awaitRuntime(resolve: (cv: any) => void, reject: (e: Error) => void, timeout: number) {
  const cv = window.cv
  if (!cv) {
    reject(new Error('OpenCV.js failed to initialize.'))
    return
  }
  // OpenCV signals readiness asynchronously via onRuntimeInitialized.
  if (cv.Mat) {
    window.clearTimeout(timeout)
    resolve(cv)
  } else {
    cv.onRuntimeInitialized = () => {
      window.clearTimeout(timeout)
      resolve(cv)
    }
  }
}

/** Load OpenCV.js once and resolve with the global `cv` runtime, trying each source in turn. */
export function loadOpenCv(onProgress?: (msg: string) => void): Promise<any> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve(window.cv)
      return
    }
    onProgress?.('Loading OpenCV runtime (~11 MB)…')

    const timeout = window.setTimeout(() => {
      reject(new Error('OpenCV.js load timed out. Check your connection and retry.'))
    }, 45000)

    const tryNext = (i: number) => {
      if (i >= OPENCV_SOURCES.length) {
        window.clearTimeout(timeout)
        reject(new Error('Could not load OpenCV.js.'))
        return
      }
      const script = document.createElement('script')
      script.src = OPENCV_SOURCES[i]
      script.async = true
      script.onload = () => awaitRuntime(resolve, reject, timeout)
      script.onerror = () => {
        script.remove()
        tryNext(i + 1) // fall back to the next source
      }
      document.head.appendChild(script)
    }
    tryNext(0)
  })

  return loadPromise
}
