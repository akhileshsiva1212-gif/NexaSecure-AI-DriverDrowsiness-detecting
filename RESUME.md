# RESUME HERE 👋

Quick pickup guide for NexaSecure AI. Last worked: **2026-06-13**.

Project location: `C:\Users\leoak\nexasecure-ai`
(Note: bash lands in `/c/Users/leoak`; always use absolute paths.)

---

## 😴 NEW FEATURE (2026-06-13): "My Mood" replaces "Security & Privacy"

The **Security & Privacy** card/feature was removed entirely and replaced by **My Mood** — a
driver wake-up alert that plays a chosen sound *only* when drowsiness crosses the threshold.

- **Backend:** deleted `app/features/security/` + `tests/test_security.py`; unregistered from
  `router.py` and `main.py` (security_monitor gone). Added a tiny **mood** feature:
  `app/features/mood/routes.py` → `GET/PUT /api/v1/mood` persisting `{selected, uploaded_name,
  volume}` via a new key/value `Preference` model (`db/models.py`) + `repository.get_preference/
  set_preference`. New `tests/test_mood.py` (5 tests). **Suite now 71 passed** (was 73: −7
  security +5 mood). The `FeatureDomain.SECURITY` enum member was left in place (harmless, no
  longer referenced).
- **Frontend:** deleted `features/security/`; removed `SecurityStatus/PrivacyPosture` types and
  `api.security()`. Added `lib/types` `MoodPreference`/`AudioOption`, `api.getMood()/setMood()`.
  New `features/mood/`:
  - `audioEngine.ts` — **Web Audio synthesis** of the 3 presets (no asset files, works offline):
    `default-alarm` = harsh LFO siren, `music-1` = bright arpeggio loop, `music-2` = calm
    pentatonic loop; `uploaded` plays a user MP3/WAV via `<audio>` (falls back to siren if it
    can't play). Handles autoplay unlock on user gesture + volume.
  - `audioStore.ts` — **IndexedDB** persistence for the uploaded blob (stays in-browser; backend
    only stores the selection + filename).
  - `MyMoodCard.tsx` — 4 single-select sources, upload w/ MP3/WAV + 15 MB validation, volume
    slider, Test/preview, "currently selected" display. **Polls `api.drowsiness()` (1s)** and
    auto-plays when `live && status ∈ {drowsy, microsleep}`; auto-stops when attentive
    (`status==='alert'`); manual **Stop** suppresses re-trigger until attentive again.
  - Dashboard row 3 renamed **"Safety & Security" → "Safety & Wellbeing"**; `<SecurityCard/>`
    swapped for `<MyMoodCard/>`.
- **Verify:** `pytest -q` (71 pass) · `npm run build` (passes). On the dashboard, enable Driver
  Monitoring **Live**, pick a sound in **My Mood**, and it sounds when drowsiness is detected.

---

## 🔧 Fixes (2026-06-13, later session): live WS 403 + stale drowsy data

Two dashboard bugs found and fixed while bringing the app back up:

1. **Live feed stuck on "RECONNECTING…"** — the realtime WebSocket was 403'ing on a path
   mismatch. Backend mounts it at **`/api/v1/ws`** (realtime router is under the `/api/v1`
   prefix), but the frontend connected to `/ws`. Fixed:
   - `frontend/src/lib/ws.ts` → now connects to `/api/v1/ws` (correct in production too, not
     just behind the dev proxy).
   - `frontend/vite.config.ts` → the `/api` proxy now carries WS upgrades (`ws: true`); the
     dead `/ws` proxy entry was removed.
   - Verified: handshake to `/api/v1/ws` via the proxy returns **101 Switching Protocols**.
2. **Phantom "Drowsy" readings with the camera Off** — the Driver Status card showed stale
   `DROWSY · EAR 0.206 · 4 yawns/min` even though `live:false`. This was old mock-era data
   persisted in SQLite (and held in the monitor's in-memory `.latest`). Cleared the documented
   way: **stop backend → delete `edge/backend/nexasecure.sqlite3` → restart**. Driver endpoints
   now correctly return `warming_up / state: null`. (Deleting the DB alone isn't enough — the
   monitor keeps state in memory, so a backend restart is required.)

Note: the **camera being "off" is not a bug** — the source toggle defaults to Off; click
**● Live** on the Driver Monitoring card (and allow camera access) to start detection.

---

## 🚨 MAJOR UPDATE (2026-06-13): all mock data removed — real detection only

The platform no longer ships any scripted/mock data. **Every Mock\*Source was deleted** and the
backend monitors now idle until **real** detections arrive. All detection is **in-browser** and
each module has three input modes: **Live camera**, **Image/Video upload**, and **dataset batch
evaluation** (the new Detection Lab).

- **Backend:** removed `MockObdSource`, `MockDrowsinessSource`, `MockDistractionSource`,
  `MockTrafficSignSource`, `MockHazardSource`, `MockLaneSource`, `MockForwardSource` + factories.
  Sources default to `none`; monitors run but skip processing until live frames POST to the
  existing `/driver/ingest` + `/road/*` ingest endpoints (1.5s live-priority unchanged). Vehicle
  Health is real OBD (`serial`) or disconnected — no demo mode. Config defaults flipped to `none`.
  **73 pytest still pass.** Delete `edge/backend/nexasecure.sqlite3` once to clear old mock rows.
- **Frontend detection pipeline** (`frontend/src/lib/detection/`): a Source→Detector→Sink
  abstraction. Detectors: **driver** (MediaPipe FaceLandmarker), **hazard** + **forward
  collision** (MediaPipe COCO ObjectDetector → area_ratio / pinhole distance), **signs** (COCO
  STOP + opt-in GTSRB), **lane** (OpenCV.js Canny+Hough, lazy-loaded). `runner.ts` runs live/
  video/image; `overlay.ts` draws boxes/mesh/lane lines.
- **Shared UI:** `features/_shared/DetectionSource.tsx` (Live / Upload / Off + overlay + FPS),
  embedded in every card. `components/EmptyState.tsx`. "Simulated" badges replaced with a live/off
  `LiveDot`. Lane card has a manual ◄ ► turn-signal toggle.
- **Detection Lab** (`features/detection-lab/`, route `#/lab`): upload a folder/zip/images, run a
  real detector over all, see a gallery + accuracy / precision-recall / **confusion matrix** when
  images are labeled by subfolder (GTSRB/Kaggle layout). No in-browser training (infeasible).
- **New deps:** `@tensorflow/tfjs` (opt-in GTSRB, dynamically imported), `jszip` (Lab). OpenCV.js
  + GTSRB model load from CDN/`public/` only when used.
- **GTSRB model:** drop `model.json`+shards into `frontend/public/models/gtsrb/` (see its README)
  to enable multi-class signs; STOP works without it.

**Verify:** `cd edge/backend && source .venv/Scripts/activate && python -m pytest -q` (73 pass) ·
`cd frontend && npm run build` (passes). Open `http://localhost:5173`, click **Live** on any card
(or **Upload** a photo/clip), and watch the card + alerts react to real detections.

Plan file: `C:\Users\leoak\.claude\plans\keen-questing-lake.md`.

--- *(historical notes below predate the 2026-06-13 mock removal)* ---

## ✅ Done so far

- **Phase 0** — full skeleton, FastAPI backend, React+TS+Vite+Tailwind PWA, SQLite,
  event bus, decision engine, WebSocket. **Backend suite now 73/73 passing; frontend
  `npm run build` passes.**
- **Feature 1 — Vehicle Health Monitoring** — connection-aware: shows real engine data
  ONLY when an OBD adapter is connected (default = Not Connected). Gauge + live trend
  sparkline. **Now has a REAL read-only OBD-II serial driver** (not just the demo) — see
  "Genuinely live" below. Dashboard has **Connect Real OBD** + **Demo Data** buttons. *(Card ✓)*
- **Feature 2 — Driver Drowsiness Detection** — real in-browser MediaPipe face tracking
  (EAR/MAR), temporal analyzer (PERCLOS / microsleep / yawns), edge-triggered alerts.
  Raw video stays in the browser; only numbers are sent to the backend. *(Card ✓)*
- **Feature 3 — Driver Distraction Detection** — "eyes off the road" from head pose
  (yaw/pitch) + gaze, computed in-browser from the *same* MediaPipe frames. Levels:
  attentive / distracted / eyes_off_road / no_face. *(Card ✓)*
- **Feature 4 — Traffic Sign Recognition** — road-facing perception with temporal-confirmation
  recognizer; real in-browser STOP detection (MediaPipe ObjectDetector / COCO), the rest a
  labeled Simulated demo. *(Card ✓)*
- **Feature 5 — Predictive Maintenance** — **backend + frontend done.** Pure least-squares
  trend analysis (`features/predictive_maintenance/trends.py`) over recent telemetry; projects
  minutes-to-threshold per metric (engine temp, battery, oil pressure, coolant) and raises an
  edge-triggered forecast when a metric newly trends toward a limit within a 30-min horizon
  (CRITICAL ≤5 min, WARNING ≤15 min). Honest by construction — no OBD feed → `insufficient_data`,
  no forecasts. `GET /api/v1/vehicle/maintenance`. New "Predictive Maintenance" dashboard card
  with an honest empty state + severity-colored forecast rows with ETA pills. *(Card ✓)*
- **Features 6–8 — Road Hazard / Lane Keeping / Forward Collision** — **backend + frontend done
  (cards added 2026-06-12).** `GET /api/v1/road/{hazards,lane,forward-collision}`; pure analyzers
  in `features/road_perception/{hazard,lane,collision}.py` (14 tests). New cards:
  `features/road-hazard/RoadHazardCard.tsx` (hazard glyph + proximity bar + in-path count),
  `features/lane/LaneCard.tsx` (live lane diagram with a car marker driven by `offset`, signaling
  chip), `features/forward-collision/ForwardCollisionCard.tsx` (TTC hero readout + distance +
  headway). Types in `lib/types.ts`, `api.hazards()/lane()/forwardCollision()`, style maps
  `HAZARD_STYLE/LANE_STYLE/COLLISION_STYLE` + `hazardIcon()` in `lib/levelStyle.ts`. *(Cards ✓)*
  **Still mock-driven** (backend mock loops) — no real browser detector yet.
- **Features 9–11 — Accident Prediction / SOS / Security & Privacy** — **backend + frontend done
  (wired + cards added 2026-06-12).** All three were already implemented in the backend; this
  session **registered** them (`api/v1/router.py` + `main.py` lifespan) and built the UI.
  - **Accident Prediction (fusion)** — `features/accident_prediction/` reads every other
    monitor's `.latest`, sums a table-driven 0–100 crash-risk score (`fusion.py` `RISK_POINTS` /
    `score_risk()`), emits band-change advisories (low→elevated→high). `GET /api/v1/fusion/risk`.
    Card: `features/accident-risk/AccidentRiskCard.tsx` (risk ring + ranked contributors).
  - **SOS** — `features/sos/` state machine idle→armed→dispatched, cancelable countdown
    (`sos_countdown_seconds=15`), **auto-arms** on `accident_risk_high`/`collision_warning` via the
    event bus. `GET /sos/status`, `POST /sos/{arm,cancel,reset}`. Card: `features/sos/SosCard.tsx`
    (interactive arm/cancel/reset + live countdown). **Dispatch is advisory-only** (records +
    surfaces a CRITICAL advisory; real eCall/SMS + GPS is a deployment concern — labeled on card).
  - **Security & Privacy** — `features/security/` telemetry plausibility IDS (`check_plausibility`
    flags physically-impossible readings = possible CAN-bus spoofing) + privacy posture from the
    config flags. `GET /security/status|privacy`. Card: `features/security/SecurityCard.tsx`
    (intrusion status + on-device privacy posture).
  - Two bugs fixed while wiring: `check_plausibility` now skips `None` (real OBD omits
    oil/coolant); SOS routes made `async` (sync handlers can't `asyncio.create_task`).
  - Tests: `tests/test_{accident_prediction,security,sos}.py`. *(Cards ✓)*

**🎉 Milestone (2026-06-12): every planned feature now has a backend + UI.** Remaining work is
no longer "features" — see "Next up".

- **Premium UI — "HUD Teal" (2026-06-12)** — automotive instrument-cluster theme: near-black
  base (`#03070d`), teal accent (`#2dd4bf`) + sky blue (`accent2 #38bdf8`), cooler frosted glass
  with a cyan rim-light (`.glass::before` gradient ring), teal→sky logo. Safety colors stay
  green/amber/red. Tokens in `tailwind.config.js` + `styles/index.css` (changing the token values
  re-skins every card). Dashboard reorganized into sections: camera hero + driver/vehicle stack,
  then a full-width **"Road Perception"** grid (Signs / Hazard / Lane / Forward), then a
  **"Safety & Security"** grid (Accident Risk / SOS / Security), then the Alerts feed. Glass
  cards, KPI status strip, alertness ring, face-mesh overlay, sparklines.

### 🔌 Genuinely live (real sensors, not mock) — the "not a showcase" track
- **Real OBD-II serial driver** — `NEXA_OBD_SOURCE=serial` now works. `SerialObdSource`
  (`features/vehicle_health/serial_source.py`) reads a real ELM327 over USB/serial via
  python-OBD's non-blocking `obd.Async`. **Read-only** (mode-01 reads + `ATRV` voltage; never
  writes the CAN bus). Maps the 4 real standard PIDs → engine_temp(coolant temp), rpm, speed,
  battery_voltage. **Oil pressure & coolant *level* are NOT standard OBD-II PIDs → reported as
  `null`** (no fabrication); `VehicleReading`/`TelemetrySample`/telemetry table made those two
  optional, and `evaluate()`/PM `analyze()` skip None. Connect via the dashboard button or
  `POST /vehicle/connection {"mode":"serial"}` → **409** if python-OBD isn't installed, **503**
  if no adapter responds; boot tolerates a missing adapter (stays disconnected, no crash).
  This makes **Vehicle Health + Predictive Maintenance** real the moment hardware is attached.
  - **PROVEN LIVE (2026-06-12)** end-to-end via the ELM327 software emulator over TCP — the
    backend streamed real changing RPM/speed/coolant-temp/voltage with oil/coolant correctly
    `null`, and Predictive Maintenance trended the real feed. python-OBD 0.7.3 installed on
    Python 3.14.
  - To repeat it (no car, native Windows OK): `pip install -r edge/backend/requirements-obd.txt`,
    run `sleep 100000 | python -m elm -n 35000`, then start the backend with
    `NEXA_OBD_SERIAL_PORT=socket://localhost:35000` **and** `NEXA_OBD_BAUDRATE=38400` (the
    explicit baudrate is required over a socket), and POST/click Connect Real OBD. Full recipe +
    gotchas in `edge/sensors/obd/README.md`. A physical ELM327 works the same with auto-baud.
- **Driver Drowsiness + Distraction** — already real (live webcam, in-browser MediaPipe).
- Still mock-only / partial: **Traffic Signs** (only STOP is real in-browser; rest simulated),
  **Road Hazard/Lane/Forward Collision** (mock scripted sources, no real browser detector yet).

## ▶️ Next up

**✅ All planned features now have a backend + UI (2026-06-12).** What's left is making the
mock-driven features real, platform hardening, and final cleanup — no new features.

**A. Make the remaining mock features genuinely real (priority):**
1. ~~Real OBD path~~ ✅ **DONE** — proven live via the ELM327 emulator over TCP.
2. **Real road CV detectors** (browser) for Hazard / Lane / Forward Collision → the cards exist
   but are mock-driven; build browser detectors that `POST .../ingest` to make them real.
   **Multi-class traffic-sign model** → makes signs beyond STOP real.

**B. Platform / "really live" infrastructure:**
- **HTTPS/TLS** (camera on LAN/phone needs a secure context), **real auth** (replace
  `dev-only-change-me`), **GPS/location** (for SOS/accident/hazards — SOS dispatch is
  advisory-only until then), cloud-sync/incident-storage (off by design).

**C. Polish / deferred:**
- **Phone/hand distraction** — needs a second MediaPipe model (HandLandmarker / object detector).
- **Vehicle Health debounce fix** — critical overheat still fires every poll.
- **Bluetooth/Wi-Fi OBD** (serial/USB only today).

**D. Deferred to the very end (user decision):** strip ALL mock/scripted sources so the system is
real-detection-only — `MockObdSource`, `MockDrowsinessSource`, `MockDistractionSource`,
`MockTrafficSignSource`, `MockHazardSource`, `MockLaneSource`, `MockForwardSource` (+ their
`make_*_source` factories and mock-loop wiring in the monitors/`main.py`). Do this LAST, once
every feature has a real input — Hazard/Lane/Forward Collision still need real browser detectors
first, or they'll go dark. (No git here → not auto-reversible; confirm scope before deleting.)

Known refinement: Vehicle Health *critical* advisories still bypass debounce (fire every poll
during sustained overheat). Apply the edge-triggered pattern used in `driver_monitoring/service.py`.

---

## 🚀 Start the app (two terminals)

**Terminal 1 — backend** (open http://localhost:8000/docs):
```bash
cd /c/Users/leoak/nexasecure-ai/edge/backend
source .venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend** (open http://localhost:5173 on this laptop):
```bash
cd /c/Users/leoak/nexasecure-ai/frontend
npm run dev
```

Use **`localhost`** for the camera (it needs a secure context; the phone/LAN URL needs
HTTPS, which comes in the deployment phase).

## 🧪 Verify
```bash
# Backend tests (expect 73 passed)
cd /c/Users/leoak/nexasecure-ai/edge/backend && source .venv/Scripts/activate && python -m pytest -q
# Frontend type-check + build
cd /c/Users/leoak/nexasecure-ai/frontend && npm run build
```

## 🔌 Run with REAL OBD data (optional — needs the extra deps)
```bash
cd /c/Users/leoak/nexasecure-ai/edge/backend && source .venv/Scripts/activate
pip install -r requirements-obd.txt        # python-OBD (+ pyserial) and the dev emulator
# Option A: plug in a real ELM327 (USB/serial)
# Option B: run the software emulator (easiest under WSL on Windows):
python -m elm                               # prints the pseudo-tty / COM port to use
# then point the backend at it and start as usual:
export NEXA_OBD_SOURCE=serial NEXA_OBD_SERIAL_PORT=<port-from-above>
uvicorn app.main:app --reload --port 8000
```
The mock/demo path needs none of this. Full details in `edge/sensors/obd/README.md`.

---

## 💬 How to resume the conversation with Claude

Open Claude Code in this folder and say something like:

> "Resume NexaSecure AI — ALL planned features now have a backend + UI (drowsiness, distraction,
> traffic signs, vehicle health w/ real OBD, predictive maintenance, road hazard/lane/forward
> collision, accident-prediction fusion, SOS, security) on a 'HUD Teal' dashboard; 73 tests pass.
> Next: make the mock-driven features real (browser CV detectors for road; multi-class signs), or
> platform work (HTTPS/auth/GPS). Final step is stripping all mock sources."

Claude keeps a memory note about this project, so it will recall the architecture, file
locations, and decisions even in a fresh session. If anything seems off, point it to this
file (`RESUME.md`) and `docs/architecture/overview.md`.
