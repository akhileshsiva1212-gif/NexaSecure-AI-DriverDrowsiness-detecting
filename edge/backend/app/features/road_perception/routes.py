"""Road perception REST routes (traffic sign recognition)."""

from __future__ import annotations

from fastapi import APIRouter

from app.features.road_perception.collision import ForwardSignals
from app.features.road_perception.hazard import HazardFrame
from app.features.road_perception.lane import LaneSignals
from app.features.road_perception.monitors import (
    forward_monitor,
    hazard_monitor,
    lane_monitor,
)
from app.features.road_perception.schemas import SignFrame
from app.features.road_perception.service import monitor

router = APIRouter(prefix="/road", tags=["road-perception"])


def _state_response(mon) -> dict:
    state = mon.latest
    if state is None:
        return {"status": "warming_up", "state": None, "live": mon.is_live()}
    return {"status": state.level, "state": state.model_dump(), "live": mon.is_live()}


@router.get("/signs")
def signs() -> dict:
    """Return the current confirmed traffic-sign state for the dashboard."""
    state = monitor.latest
    if state is None:
        return {"status": "warming_up", "state": None, "live": monitor.is_live()}
    return {"status": "ok", "state": state.model_dump(), "live": monitor.is_live()}


@router.post("/signs/ingest")
async def ingest(frame: SignFrame) -> dict:
    """Ingest one road-camera frame's detections from the browser.

    The browser runs a MediaPipe ObjectDetector locally and posts only the detected sign
    labels — never the image. These feed the same temporal recognizer + decision engine as
    the mock source, so confirmed signs raise the usual advisories.
    """
    state = await monitor.ingest_external(frame)
    return {"status": "ok", "state": state.model_dump(), "live": True}


# ---- Road hazard ----

@router.get("/hazards")
def hazards() -> dict:
    """Current in-path road-hazard assessment."""
    return _state_response(hazard_monitor)


@router.post("/hazards/ingest")
async def ingest_hazards(frame: HazardFrame) -> dict:
    """Ingest forward-camera obstacle detections (labels + box sizes) from the browser."""
    state = await hazard_monitor.ingest_external(frame)
    return {"status": state.level, "state": state.model_dump(), "live": True}


# ---- Lane departure ----

@router.get("/lane")
def lane() -> dict:
    """Current lane-position / departure assessment."""
    return _state_response(lane_monitor)


@router.post("/lane/ingest")
async def ingest_lane(signals: LaneSignals) -> dict:
    """Ingest a forward-camera lane-offset estimate from the browser."""
    state = await lane_monitor.ingest_external(signals)
    return {"status": state.level, "state": state.model_dump(), "live": True}


# ---- Forward collision ----

@router.get("/forward-collision")
def forward_collision() -> dict:
    """Current forward-collision (TTC/headway) assessment."""
    return _state_response(forward_monitor)


@router.post("/forward-collision/ingest")
async def ingest_forward(signals: ForwardSignals) -> dict:
    """Ingest a lead-vehicle distance/closing-speed estimate from the browser."""
    state = await forward_monitor.ingest_external(signals)
    return {"status": state.level, "state": state.model_dump(), "live": True}
