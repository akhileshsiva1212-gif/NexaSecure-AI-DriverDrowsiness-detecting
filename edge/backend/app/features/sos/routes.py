"""SOS / Emergency REST routes."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.features.sos.service import service

router = APIRouter(prefix="/sos", tags=["sos"])


class ArmRequest(BaseModel):
    reason: str = "Manual SOS"


@router.get("/status")
async def status() -> dict:
    """Return the current SOS state and countdown."""
    return service.status()


@router.post("/arm")
async def arm(req: ArmRequest) -> dict:
    """Manually arm the SOS countdown (driver-initiated emergency).

    `async` so the handler runs on the event loop — `service.arm()` schedules the countdown
    via `asyncio.create_task`, which needs a running loop (a sync handler would run in a
    threadpool with no loop and fail).
    """
    return service.arm(reason=req.reason, auto=False)


@router.post("/cancel")
async def cancel() -> dict:
    """Cancel an armed SOS countdown."""
    return service.cancel()


@router.post("/reset")
async def reset() -> dict:
    """Clear a dispatched SOS back to idle once the incident is handled."""
    return service.reset()
