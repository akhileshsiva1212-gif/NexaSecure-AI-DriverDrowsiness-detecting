"""Predictive Maintenance REST routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.features.predictive_maintenance.service import monitor

router = APIRouter(prefix="/vehicle", tags=["predictive-maintenance"])


@router.get("/maintenance")
def maintenance() -> dict:
    """Return the latest predictive-maintenance forecast report for the dashboard."""
    report = monitor.latest
    if report is None:
        return {"status": "warming_up", "report": None}
    return {"status": report.status, "report": report.model_dump()}
