"""ORM models — the persisted shape of data.

Phase 0/1 stores advisory events and a slim time-series of vehicle telemetry.
Per the privacy architecture: NO raw frames or biometric images are ever stored —
only structured metadata.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class EventRecord(Base):
    """A stored advisory event (the audit/history trail shown in the dashboard)."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    domain: Mapped[str] = mapped_column(String(16), index=True)
    type: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    message: Mapped[str] = mapped_column(String(512))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class VehicleTelemetry(Base):
    """A single time-stamped vehicle reading (engine temp, RPM, battery, etc.).

    This is the slim start of the time-series store that will later move to
    TimescaleDB when data volume grows.
    """

    __tablename__ = "vehicle_telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    engine_temp_c: Mapped[float] = mapped_column(Float)
    rpm: Mapped[float] = mapped_column(Float)
    speed_kph: Mapped[float] = mapped_column(Float)
    battery_voltage: Mapped[float] = mapped_column(Float)
    # Not standard OBD-II PIDs — null when the data comes from a real serial adapter.
    coolant_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    oil_pressure_kpa: Mapped[float | None] = mapped_column(Float, nullable=True)


class Preference(Base):
    """A small key/value store for persisted user preferences (e.g. the My Mood
    wake-up audio selection). JSON value so a preference can hold a structured object."""

    __tablename__ = "preferences"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
