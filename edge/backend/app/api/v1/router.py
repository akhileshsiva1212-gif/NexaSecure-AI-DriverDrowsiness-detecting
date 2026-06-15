"""Aggregate API router for version 1.

Each feature contributes its own router; they are all mounted under `/api/v1`.
New features (driver monitoring, road perception, ...) plug in here as they are built.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import events, realtime, system
from app.features.accident_prediction import routes as accident_prediction
from app.features.driver_monitoring import routes as driver_monitoring
from app.features.predictive_maintenance import routes as predictive_maintenance
from app.features.mood import routes as mood
from app.features.road_perception import routes as road_perception
from app.features.sos import routes as sos
from app.features.vehicle_health import routes as vehicle_health

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(events.router)
api_router.include_router(realtime.router)
api_router.include_router(vehicle_health.router)
api_router.include_router(driver_monitoring.router)
api_router.include_router(road_perception.router)
api_router.include_router(predictive_maintenance.router)
api_router.include_router(accident_prediction.router)
api_router.include_router(sos.router)
api_router.include_router(mood.router)
