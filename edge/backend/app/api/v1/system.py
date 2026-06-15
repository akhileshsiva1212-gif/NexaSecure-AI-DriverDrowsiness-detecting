"""System-level routes (app liveness/readiness)."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.core.config import get_settings

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    """App liveness probe — confirms the backend process is up."""
    return {"status": "ok", "service": "nexasecure-edge-backend", "version": __version__}


@router.get("/info")
def info() -> dict:
    """Non-sensitive runtime info (safe to expose to the dashboard)."""
    s = get_settings()
    return {
        "env": s.env,
        "version": __version__,
        "obd_source": s.obd_source,
        "privacy": {
            "cloud_sync": s.cloud_sync,
            "store_incident_clips": s.store_incident_clips,
            "anonymized_analytics": s.anonymized_analytics,
        },
    }
