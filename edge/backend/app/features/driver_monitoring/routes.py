"""Driver monitoring REST routes (drowsiness + distraction)."""

from __future__ import annotations

from fastapi import APIRouter

from app.features.driver_monitoring.schemas import FrameSignals
from app.features.driver_monitoring.service import distraction_monitor, monitor

router = APIRouter(prefix="/driver", tags=["driver-monitoring"])


@router.get("/drowsiness")
def drowsiness() -> dict:
    """Return the current smoothed drowsiness state for the dashboard."""
    state = monitor.latest
    if state is None:
        return {"status": "warming_up", "state": None, "live": monitor.is_live()}
    return {"status": state.level, "state": state.model_dump(), "live": monitor.is_live()}


@router.get("/distraction")
def distraction() -> dict:
    """Return the current smoothed distraction ("eyes off road") state for the dashboard."""
    state = distraction_monitor.latest
    if state is None:
        return {"status": "warming_up", "state": None, "live": distraction_monitor.is_live()}
    return {
        "status": state.level,
        "state": state.model_dump(),
        "live": distraction_monitor.is_live(),
    }


@router.post("/ingest")
async def ingest(signals: FrameSignals) -> dict:
    """Ingest one real frame's signals from the browser webcam.

    The browser runs MediaPipe locally and posts only these numbers — never the image. One
    frame carries both the eye/mouth ratios and the head-pose/gaze signals, so it feeds the
    drowsiness and distraction pipelines together through the same decision engine.
    """
    drowsy = await monitor.ingest_external(signals)
    distract = await distraction_monitor.ingest_external(signals)
    return {
        "status": drowsy.level,
        "state": drowsy.model_dump(),
        "live": True,
        "distraction": {"status": distract.level, "state": distract.model_dump()},
    }
