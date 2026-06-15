"""Accident Prediction REST routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.features.accident_prediction.service import monitor

router = APIRouter(prefix="/fusion", tags=["accident-prediction"])


@router.get("/risk")
def risk() -> dict:
    """Return the current fused crash-risk score and contributing factors."""
    state = monitor.latest
    if state is None:
        return {"status": "warming_up", "state": None}
    return {"status": state.level, "state": state.model_dump()}
