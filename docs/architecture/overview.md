# NexaSecure AI — Architecture Overview

This is the living map of the system. See `docs/adr/` for the *why* behind key decisions.

## Three tiers

| Tier | Where | Responsibility |
|------|-------|----------------|
| **Edge device** | In the vehicle | Capture sensors/cameras, run AI locally, make advisory decisions. Raw video never leaves. |
| **Local backend** | Same device | APIs, real-time WebSocket feed, event storage, serves dashboard, SOS logic. |
| **Cloud (opt-in)** | Remote | Updates, fleet mgmt, SOS relay, anonymized analytics. Never required for safety. |

## Core principles

1. **Edge-first** — everything that *can* run locally *does*.
2. **Privacy-first** — store events/metadata, not raw footage; consent gates every cloud flow.
3. **Advisory-only** — alerts the driver, never controls the car; reads vehicle data only.
4. **Modular monolith** — one backend, internally split by feature; split to services only when needed.
5. **Graceful degradation** — safety alerts fire locally even if the dashboard/cloud is offline.

## Data flow (one feature, end to end)

```
sensor source ─▶ feature module ─▶ decision engine ─▶ event bus ─┬─▶ database (store)
                                                                 └─▶ websocket ─▶ dashboard
```

## Folder map

```
edge/
  backend/    FastAPI app: api/v1, core, features/*, decision_engine, realtime, db, events
  sensors/    hardware interfaces: camera, obd (real read-only ELM327 driver)
  ai/         placeholder — all AI/CV now runs in-browser (see frontend/src/lib/detection)
  security/   placeholder — the security/IDS feature was removed (replaced by "My Mood")
frontend/     responsive PWA (React + TS + Vite + Tailwind) + all in-browser detection
cloud/        opt-in services (separate so the car never depends on them)
shared/       schemas/contracts shared across services (single source of truth)
infra/        docker, ci, monitoring
docs/         architecture + ADRs
```

Detection is **in-browser** (`frontend/src/lib/detection/`): a Source→Detector→Sink pipeline
over MediaPipe (face landmarks, COCO object detection), OpenCV.js (lane lines) and opt-in
TF.js (multi-class GTSRB signs). The backend monitors idle until real detections POST to the
`/driver/ingest` and `/road/*` ingest endpoints.

## Build order (history)

Phase 0 skeleton → Vehicle Health (real OBD) → driver monitoring → road perception → fusion
(accident prediction, SOS) → **all mock/scripted sources removed (real detection only)**.
**All planned features now have a backend + UI.** Remaining work is platform hardening
(HTTPS/TLS, real auth, GPS) and polish — see `RESUME.md` for the current backlog.
