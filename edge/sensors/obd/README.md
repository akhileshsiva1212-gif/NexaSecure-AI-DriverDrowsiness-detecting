# OBD-II sensor driver (hardware interface)

The **real, read-only** OBD-II driver (ELM327 adapter over USB/serial) is implemented in the
backend package so it's importable by the app:

> `edge/backend/app/features/vehicle_health/serial_source.py` — `SerialObdSource`

It implements the `ObdSource` interface
(`edge/backend/app/features/vehicle_health/obd_source.py`) and is selected by setting
`NEXA_OBD_SOURCE=serial` (or via `POST /api/v1/vehicle/connection {"mode":"serial"}` /
the dashboard's **Connect Real OBD** button). No feature code changes when hardware is added.

**Hard rule:** OBD access is **read-only**. This driver only issues mode-01 reads and the
ELM327 `ATRV` voltage query — it never writes to the CAN bus. That is both a safety boundary
(advisory-only system) and a security boundary.

## What it reads

Standard OBD-II only exposes a subset of what the dashboard shows:

| Reading            | Source                             |
|--------------------|------------------------------------|
| `engine_temp_c`    | coolant **temperature** (PID 0105) |
| `rpm`              | engine RPM (PID 010C)              |
| `speed_kph`        | vehicle speed (PID 010D)           |
| `battery_voltage`  | ELM327 adapter voltage (`ATRV`)    |
| `coolant_pct`      | **not** a standard PID → `null`    |
| `oil_pressure_kpa` | **not** a standard PID → `null`    |

Coolant *level* and oil pressure are not standard OBD-II PIDs, so they're reported as `null`
rather than fabricated. Predictive Maintenance simply doesn't trend those two on real hardware.

## Install

```bash
cd edge/backend
source .venv/Scripts/activate        # (Windows bash)
pip install -r requirements-obd.txt  # python-OBD (+ pyserial) and the dev emulator
```

## Run with a real adapter

Plug in an ELM327 (USB/serial), then:

```bash
export NEXA_OBD_SOURCE=serial
export NEXA_OBD_SERIAL_PORT=auto      # or COM3 / /dev/ttyUSB0
uvicorn app.main:app --reload --port 8000
```

## Test without a car (software emulator)

`requirements-obd.txt` includes **ELM327-emulator**, a software ELM327. The simplest
cross-platform way to use it (works on **native Windows**, no com0com needed) is its **TCP
mode** combined with pyserial's `socket://` URL — this is verified working:

```bash
# 1) Run the emulator as a TCP server (keep stdin open so it doesn't exit when detached):
sleep 100000 | python -m elm -n 35000     # serves on TCP port 35000

# 2) Point the backend at it over a socket. IMPORTANT: set an explicit baudrate — python-OBD's
#    auto-baud probe sends bytes that a socket can't interpret, so it must be skipped.
export NEXA_OBD_SOURCE=none                 # boot disconnected; connect via the API/button
export NEXA_OBD_SERIAL_PORT=socket://localhost:35000
export NEXA_OBD_BAUDRATE=38400
uvicorn app.main:app --reload --port 8000
```

Then `POST /api/v1/vehicle/connection {"mode":"serial"}` (or click **Connect Real OBD**) and
watch `GET /api/v1/vehicle/health` report `mode: "serial"` with real-shaped, changing RPM/
speed/coolant-temp/voltage and `null` oil-pressure/coolant-level.

**Two gotchas learned the hard way:**
- **Set `NEXA_OBD_BAUDRATE` explicitly** for the socket/emulator path. With baudrate unset,
  python-OBD runs an auto-baud probe (sends `\x7F\x7F`) that only makes sense on a real UART and
  prevents the handshake over a socket. A real USB adapter is fine with auto (`baudrate` blank).
- **The emulator serves one TCP client per run** — it wedges for a second connection. Restart
  it (`python -m elm -n ...`) before each fresh connect while testing.

> The emulator's classic **pseudo-tty / serial** mode (`-p`) needs a Unix pty or, on native
> Windows, [`com0com`](https://com0com.sourceforge.net/) for a virtual COM pair — the TCP recipe
> above avoids all of that. Note: ELM327-emulator's `setup.py` needs `pkg_resources`, so on a
> fresh venv install `setuptools` first (`pip install "setuptools<81"`) or it won't build.

The automated unit tests (`tests/test_obd_serial.py`) cover the PID→reading mapping on any OS by
injecting a fake connection — no emulator or hardware required.

With no adapter (and `NEXA_OBD_SOURCE=none`, the default) the vehicle monitor stays
**disconnected** and reports nothing — engine data is never fabricated. There is no mock/demo
OBD source: Vehicle Health and Predictive Maintenance become live only when a real ELM327 (or
the emulator above) is connected.
