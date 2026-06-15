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

## Features

Driver Drowsiness · Driver Distraction · Traffic Sign Recognition · Vehicle Health (real OBD-II) ·
Predictive Maintenance · Road Hazard Detection · Lane Keeping · Forward Collision Warning ·
Accident Prediction (sensor fusion) · Emergency SOS · My Mood (drowsiness wake-up alert).

All detection runs **in-browser** — live camera, image/video upload, or batch evaluation in the
**Detection Lab**. There is no scripted/mock data: each card stays idle until a real detection
arrives. Privacy-first by construction — raw video never leaves the browser; only numbers are
sent to the backend.

## Current status

**All planned features have a backend + dashboard UI.** Detection is real and in-browser
(MediaPipe FaceLandmarker / COCO ObjectDetector, OpenCV.js lane detection, opt-in TF.js GTSRB
signs); Vehicle Health reads a real **read-only** ELM327 over serial when an adapter is
connected, and Predictive Maintenance trends that live feed. No mock/scripted sources remain.
Backend suite: **71 tests passing**; frontend `npm run build` passes. See
[`RESUME.md`](RESUME.md) for the detailed state and pickup guide.

## Repository layout

See [`docs/architecture/overview.md`](docs/architecture/overview.md) for the full map.

```
edge/        # in-vehicle backend (FastAPI) + sensor drivers (camera, OBD)
frontend/    # responsive PWA dashboard + all in-browser detection (laptop + phone)
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

**Proprietary — Copyright (c) 2026 Akhilesh. All rights reserved.**

This is proprietary and confidential software. No permission is granted to use, copy, modify,
distribute, or create derivative works without the prior written permission of the owner. See
the [`LICENSE`](LICENSE) file for the full terms. For licensing inquiries, contact the owner.
