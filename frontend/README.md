# NexaSecure AI — Dashboard (frontend)

Responsive PWA (React + TypeScript + Vite + Tailwind). Works on laptop and phone browsers.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173 (also exposed on the LAN for phone testing)
```

The dev server proxies `/api` and `/ws` to the edge backend on `localhost:8000`, so start
the backend first (see `../edge/backend`).

## Build

```bash
npm run build    # type-checks (tsc) then bundles to dist/
npm run preview  # serve the production build locally
```

## Structure

```
src/
  app/        App shell
  features/   one folder per feature UI (live-dashboard, vehicle-health, ...)
  components/ shared UI components
  lib/        api client, websocket client, shared types
  store/      client state (added as needed)
  styles/     global CSS / Tailwind entry
```
