"""Vehicle Health REST routes."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import repository
from app.features.vehicle_health.schemas import evaluate
from app.features.vehicle_health.serial_source import ObdConnectionError
from app.features.vehicle_health.service import VALID_MODES, monitor

router = APIRouter(prefix="/vehicle", tags=["vehicle-health"])

_SEV_RANK = {"info": 0, "warning": 1, "critical": 2}


class ConnectionRequest(BaseModel):
    mode: str  # "none" | "serial"


@router.get("/health")
def current_health() -> dict:
    """Return the connection state plus the latest reading and any active findings.

    When no OBD adapter is connected, `connected` is false and no readings are returned —
    the system does not fabricate engine data.
    """
    if not monitor.connected:
        return {"connected": False, "mode": "none", "status": "not_connected",
                "reading": None, "findings": []}

    reading = monitor.latest
    if reading is None:
        return {"connected": True, "mode": monitor.mode, "status": "warming_up",
                "reading": None, "findings": []}

    findings = [f.model_dump(mode="json") for f in evaluate(reading)]
    status = "ok" if not findings else max(
        (f["severity"] for f in findings), key=lambda s: _SEV_RANK[s]
    )
    return {"connected": True, "mode": monitor.mode, "status": status,
            "reading": reading.model_dump(), "findings": findings}


@router.post("/connection")
async def set_connection(req: ConnectionRequest) -> dict:
    """Connect or disconnect an OBD source.

    `mode="serial"` connects a real read-only ELM327 adapter; `mode="none"` disconnects.
    """
    if req.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {VALID_MODES}")
    try:
        # A real serial adapter blocks on the ELM327 handshake (seconds), so connect off the
        # event loop. mock/none are instant — the thread hop is harmless.
        await asyncio.to_thread(monitor.connect, req.mode)
    except NotImplementedError as exc:      # optional dependency not installed
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ObdConnectionError as exc:        # no adapter responding / port unavailable
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"connected": monitor.connected, "mode": monitor.mode}


@router.get("/telemetry/latest")
def latest_telemetry() -> dict:
    """Return the most recent persisted telemetry row."""
    return {"telemetry": repository.latest_telemetry()}
