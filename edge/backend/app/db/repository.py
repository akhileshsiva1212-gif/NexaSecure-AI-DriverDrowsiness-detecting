"""Repository layer — the only place that talks to the database directly.

Feature code calls these functions instead of using SQLAlchemy sessions itself.
This keeps business logic storage-agnostic and easy to test.
"""

from __future__ import annotations

from app.db.database import SessionLocal
from app.db.models import EventRecord, Preference, VehicleTelemetry
from app.events.types import AdvisoryEvent


def save_event(event: AdvisoryEvent) -> None:
    """Persist an advisory event."""
    with SessionLocal() as session:
        session.add(
            EventRecord(
                id=event.id,
                domain=event.domain.value,
                type=event.type,
                severity=event.severity.value,
                message=event.message,
                data=event.data,
                created_at=event.created_at,
            )
        )
        session.commit()


def list_recent_events(limit: int = 50) -> list[dict]:
    """Return the most recent events as plain dicts (newest first)."""
    with SessionLocal() as session:
        rows = (
            session.query(EventRecord)
            .order_by(EventRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "domain": r.domain,
                "type": r.type,
                "severity": r.severity,
                "message": r.message,
                "data": r.data,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]


def save_telemetry(reading: dict) -> None:
    """Persist a single vehicle telemetry reading."""
    with SessionLocal() as session:
        session.add(VehicleTelemetry(**reading))
        session.commit()


def _telemetry_to_dict(row: VehicleTelemetry) -> dict:
    return {
        "created_at": row.created_at.isoformat(),
        "engine_temp_c": row.engine_temp_c,
        "rpm": row.rpm,
        "speed_kph": row.speed_kph,
        "battery_voltage": row.battery_voltage,
        "coolant_pct": row.coolant_pct,
        "oil_pressure_kpa": row.oil_pressure_kpa,
    }


def latest_telemetry() -> dict | None:
    """Return the most recent telemetry reading, or None if there is none yet."""
    with SessionLocal() as session:
        row = (
            session.query(VehicleTelemetry)
            .order_by(VehicleTelemetry.created_at.desc())
            .first()
        )
        return _telemetry_to_dict(row) if row is not None else None


def list_recent_telemetry(limit: int = 60) -> list[dict]:
    """Return up to `limit` most recent telemetry readings, oldest first (for trending)."""
    with SessionLocal() as session:
        rows = (
            session.query(VehicleTelemetry)
            .order_by(VehicleTelemetry.created_at.desc())
            .limit(limit)
            .all()
        )
        return [_telemetry_to_dict(r) for r in reversed(rows)]


def get_preference(key: str, default: dict | None = None) -> dict | None:
    """Return a stored preference value by key, or `default` if not set."""
    with SessionLocal() as session:
        row = session.get(Preference, key)
        return row.value if row is not None else default


def set_preference(key: str, value: dict) -> dict:
    """Insert or update a preference, returning the stored value."""
    with SessionLocal() as session:
        row = session.get(Preference, key)
        if row is None:
            row = Preference(key=key, value=value)
            session.add(row)
        else:
            row.value = value
        session.commit()
        return value
