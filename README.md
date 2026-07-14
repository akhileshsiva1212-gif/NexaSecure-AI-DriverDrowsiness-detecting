<div align="center">

# NexaSecure AI

**Edge-first · Privacy-first · Advisory-only driver-assistance platform**

*Real-time driver and road monitoring that runs entirely on-device — no cloud dependency, no raw video ever leaves the browser, and the vehicle stays in the driver's hands.*

</div>

---

## Safety boundary

> NexaSecure AI **assists** the driver with alerts and information. It **never controls the vehicle** and only *reads* vehicle data — it never writes to the CAN bus. Safety-critical features must be validated on recorded or simulated data under controlled conditions first. Never on demos alone. Never first in a moving vehicle.

---

## Why NexaSecure AI

Most driver-assistance demos either fake their data or ship your camera feed to a server. NexaSecure AI does neither:

- **Edge-first** — every AI model runs locally, in the browser or on the vehicle's edge computer. Nothing depends on the cloud to function.
- **Privacy-first** — raw camera and audio frames never leave the device. Only small, structured numbers (an eye-aspect ratio, a bounding box, a detected sign) are ever sent to the backend.
- **Advisory-only** — the system alerts and informs. It never steers, brakes, or accelerates, and every vehicle-data path is strictly read-only.
- **Honest by design** — there is no mock, scripted, or demo data anywhere in the pipeline. If no camera is live or no OBD-II adapter is connected, the dashboard says so instead of inventing numbers.

## How it's built

A three-tier system, each tier doing exactly one job:

| Tier | Responsibility |
|---|---|
| **Edge device** (in the vehicle) | Captures camera and sensor data, runs all AI locally, makes advisory decisions. Raw video never leaves the car. |
| **Local backend** (same device) | A FastAPI service exposing REST APIs and a real-time WebSocket feed, storing event history, serving the dashboard. |
| **Cloud** (strictly opt-in) | Software/model updates, fleet management, SOS relay, anonymized analytics. Never required for any safety feature. |

All computer-vision inference — face landmarks, object detection, lane finding, sign recognition — runs **in the browser** via MediaPipe, TensorFlow.js, and OpenCV.js. The backend only ever receives the numeric output of a detection, never the frame itself.

## Safety features

| Feature | What it does |
|---|---|
| **Driver Drowsiness** | Eye/mouth geometry (EAR/MAR) from live face tracking → PERCLOS, microsleep, and yawn detection. |
| **Driver Distraction** | Head pose and gaze direction to flag "eyes off the road." |
| **Traffic Sign Recognition** | In-browser STOP detection, with an optional multi-class classifier for other signs. |
| **Vehicle Health** | Real, read-only OBD-II telemetry (ELM327). Non-standard readings are reported empty, never faked. |
| **Predictive Maintenance** | Trend analysis over live telemetry to forecast time-to-threshold. |
| **Road Hazard Detection** | In-browser object detection for proximity and in-path obstacles. |
| **Lane Keeping** | Classic CV (Canny + Hough) lane-line detection via OpenCV.js. |
| **Forward Collision Warning** | Distance and time-to-collision estimation from detected objects. |
| **Accident Prediction** | Sensor fusion across every monitor into a single 0–100 crash-risk score. |
| **Emergency SOS** | Auto-arming state machine with a cancelable countdown; dispatch is advisory-only. |
| **My Mood** | A Web-Audio drowsiness wake-up alarm with custom, browser-stored sounds. |

Every feature supports three input modes — **live camera**, **file upload**, and batch evaluation in the **Detection Lab** — and every card stays idle until a real detection arrives.

## Technology stack

**Frontend** — React 18 · TypeScript 5 · Vite 5 · Tailwind CSS 3 · Progressive Web App
**Edge AI** — MediaPipe Tasks Vision (WASM) · TensorFlow.js · OpenCV.js
**Backend** — FastAPI · Uvicorn · Pydantic v2 · SQLAlchemy 2.0 + SQLite · pytest/httpx
**Hardware** — Read-only OBD-II via python-OBD/ELM327, with a software emulator for hardware-free testing

## Repository layout

```
edge/        # in-vehicle backend (FastAPI) + sensor drivers (camera, OBD)
frontend/    # responsive PWA dashboard + all in-browser detection (laptop + phone)
cloud/       # opt-in cloud services (kept separate to enforce privacy-first)
shared/      # schemas/contracts shared across services
docs/        # architecture + decision records (ADRs)
infra/       # docker, CI, monitoring
```

## Quick start

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

Use `localhost` for camera access — it's a secure-context requirement in the browser; testing over LAN or on a phone needs HTTPS.


## License

**Proprietary — Copyright (c) 2026 Akhilesh. All rights reserved.**

This is proprietary and confidential software. No permission is granted to use, copy, modify, distribute, or create derivative works without the prior written permission of the owner. See the [`LICENSE`](LICENSE) file for the full terms. For licensing inquiries, contact the owner.
