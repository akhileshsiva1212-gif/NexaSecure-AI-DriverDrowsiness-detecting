# NexaSecure AI

An **edge-first, privacy-first, advisory-only** AI driver-assistance platform.

> ⚠️ **Safety boundary:** NexaSecure AI *assists* the driver with alerts and information.
> It **never controls the vehicle** and only reads vehicle data (never writes to the CAN bus).
> Safety features must be validated on recorded/simulated data in controlled conditions —
> never on demos alone, never first in a moving vehicle.

## What this is

A three-tier system:

1. **Edge device (in the vehicle)** — captures camera + sensor data, runs all AI locally,
   makes advisory decisions. Raw video never leaves the car.
2. **Local backend (same device)** — FastAPI service exposing APIs + a real-time WebSocket
   feed, storing events, serving the dashboard.
3. **Cloud (opt-in only)** — software/model updates, fleet management, SOS relay, anonymized
   analytics. Never required for safety features.

## Planned features

Driver Drowsiness · Driver Distraction · Lane Detection · Forward Collision Warning ·
Accident Prediction · Vehicle Health · Predictive Maintenance · Road Hazard Detection ·
Traffic Sign Recognition · Emergency SOS · Privacy-First Local AI · Cyberattack Protection.

## Current status

**Phase 0 (skeleton) + Phase 1 (first feature) in progress.**
The first end-to-end feature is **Vehicle Health Monitoring**, driven by a *simulated*
OBD-II source so the whole pipeline runs with no hardware.

## Repository layout

See [`docs/architecture/overview.md`](docs/architecture/overview.md) for the full map.

```
edge/        # everything that runs in the vehicle (AI, backend, sensors, security)
frontend/    # responsive PWA dashboard (laptop + phone)
cloud/       # opt-in cloud services (kept separate to enforce privacy-first)
shared/      # schemas/contracts shared across services
docs/        # architecture + decision records (ADRs)
infra/       # docker, CI, monitoring
```

## Quick start (development)

### Backend
```bash
cd edge/backend
python -m venv .venv
# Windows (bash): source .venv/Scripts/activate
# Linux/Mac:      source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# open http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# open the printed localhost URL
```

## License

TBD.
