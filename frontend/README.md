# NexaSecure AI — Dashboard (frontend)

Responsive PWA (React + TypeScript + Vite + Tailwind). Works on laptop and phone browsers.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173 (also exposed on the LAN for phone testing)
```

The dev server proxies `/api` to the edge backend on `localhost:8000` (with `ws: true`, so it
also carries the realtime WebSocket at `/api/v1/ws`). Start the backend first (see
`../edge/backend`).

## Build

```bash
npm run build    # type-checks (tsc) then bundles to dist/
npm run preview  # serve the production build locally
```

## Structure

```
src/
  app/            App shell
  features/       one folder per feature UI (driver, vehicle-health, mood, detection-lab, ...)
  components/     shared UI components
  lib/
    detection/    in-browser Source→Detector→Sink pipeline (MediaPipe / OpenCV.js / TF.js)
    api.ts        REST client
    ws.ts         realtime WebSocket client (connects to /api/v1/ws)
    types.ts      shared types
  styles/         global CSS / Tailwind entry
```

All detection runs in the browser — raw camera frames never leave the device; only computed
numbers are POSTed to the backend. The **Detection Lab** (`#/lab`) runs a real detector over an
uploaded image folder/zip and reports accuracy / precision-recall / a confusion matrix when
images are labeled by subfolder (GTSRB/Kaggle layout).
