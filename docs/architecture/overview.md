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
  ai/         AI/CV models, pipelines (driver|road|fusion), inference, registry
  backend/    FastAPI app: api/v1, core, features/*, decision_engine, realtime, db, events
  sensors/    hardware interfaces: camera, obd, imu_gps
  security/   cyberattack protection layer (IDS, integrity checks)
frontend/     responsive PWA (React + TS + Vite + Tailwind)
cloud/        opt-in services (separate so the car never depends on them)
shared/       schemas/contracts shared across services (single source of truth)
infra/        docker, ci, monitoring
docs/         architecture + ADRs
```

## Build order

Phase 0 skeleton → **Phase 1: Vehicle Health (current)** → driver monitoring → road
perception → fusion (accident prediction, SOS) → security/privacy hardening → polish/deploy.

See the approved plan for the full feature dependency map and development order.
