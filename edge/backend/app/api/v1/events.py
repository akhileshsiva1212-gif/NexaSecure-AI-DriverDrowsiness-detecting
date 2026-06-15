"""Event history routes — the advisory timeline shown in the dashboard."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.db import repository

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def recent_events(limit: int = Query(default=50, ge=1, le=500)) -> dict:
    """Return recent advisory events, newest first."""
    return {"events": repository.list_recent_events(limit=limit)}
