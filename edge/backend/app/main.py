"""NexaSecure AI — edge backend application entry point.

Wires the whole Phase 0/1 pipeline together on startup:

  * init the database
  * subscribe the persistence writer and the websocket broadcaster to the event bus
  * start the Vehicle Health background monitor

Run locally:
    uvicorn app.main:app --reload --port 8000
Then open http://localhost:8000/docs
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import repository
from app.db.database import init_db
from app.events import event_bus
from app.events.types import AdvisoryEvent
from app.features.accident_prediction.service import monitor as fusion_monitor
from app.features.driver_monitoring.service import distraction_monitor
from app.features.driver_monitoring.service import monitor as drowsiness_monitor
from app.features.predictive_maintenance.service import monitor as maintenance_monitor
from app.features.road_perception.monitors import forward_monitor, hazard_monitor, lane_monitor
from app.features.road_perception.service import monitor as sign_monitor
from app.features.sos.service import service as sos_service
from app.features.vehicle_health.service import monitor as vehicle_monitor
from app.realtime import register_realtime

logger = get_logger("app")


async def _persist_event(event: AdvisoryEvent) -> None:
    """Event-bus subscriber that writes every accepted advisory to the database."""
    repository.save_event(event)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("starting NexaSecure edge backend v%s (env=%s)", __version__, settings.env)

    init_db()
    event_bus.subscribe(_persist_event)  # store advisories
    register_realtime()                  # broadcast advisories to dashboards
    vehicle_monitor.start()              # idle until a real OBD adapter is connected
    drowsiness_monitor.start()           # idle until live webcam frames arrive (browser)
    distraction_monitor.start()          # idle until live head-pose/gaze frames arrive
    sign_monitor.start()                 # idle until live road-sign detections arrive
    hazard_monitor.start()               # idle until live hazard detections arrive
    lane_monitor.start()                 # idle until live lane estimates arrive
    forward_monitor.start()              # idle until live lead-vehicle estimates arrive
    maintenance_monitor.start()          # begin trending telemetry for forecasts
    fusion_monitor.start()               # begin fusing all features into a crash-risk score
    sos_service.register()               # auto-arm SOS on crash-class advisories

    yield

    await sos_service.stop()
    await fusion_monitor.stop()
    await maintenance_monitor.stop()
    await forward_monitor.stop()
    await lane_monitor.stop()
    await hazard_monitor.stop()
    await sign_monitor.stop()
    await distraction_monitor.stop()
    await drowsiness_monitor.stop()
    await vehicle_monitor.stop()
    logger.info("edge backend stopped")


app = FastAPI(
    title="NexaSecure AI — Edge Backend",
    version=__version__,
    summary="Advisory-only, privacy-first driver-assistance backend.",
    lifespan=lifespan,
)

# CORS: the dashboard is served from a different dev port (Vite 5173). In production the
# allowed origins should be locked down to the known dashboard origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root() -> dict:
    return {"service": "nexasecure-edge-backend", "docs": "/docs", "api": "/api/v1"}
