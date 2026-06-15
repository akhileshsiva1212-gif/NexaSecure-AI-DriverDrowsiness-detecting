"""Canonical event contracts for the whole backend.

Every feature module produces `AdvisoryEvent`s. The decision engine consumes them,
the database stores them, and the realtime layer broadcasts them to the dashboard.
Keeping these types in one place makes them the single source of truth.

Reminder on the safety boundary: events are *advisories* for the driver. They never
command the vehicle.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class FeatureDomain(str, enum.Enum):
    """High-level source domain of an event (mirrors the feature folders)."""

    DRIVER = "driver"            # drowsiness, distraction
    ROAD = "road"                # lane, collision, hazard, signs
    VEHICLE = "vehicle"          # health, predictive maintenance
    FUSION = "fusion"            # accident prediction
    SOS = "sos"                  # emergency
    SECURITY = "security"        # cyberattack protection
    SYSTEM = "system"            # platform-level events


class Severity(str, enum.Enum):
    """Advisory severity. Drives alert prioritization in the decision engine."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

    @property
    def rank(self) -> int:
        return {"info": 0, "warning": 1, "critical": 2}[self.value]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AdvisoryEvent(BaseModel):
    """A single advisory produced by a feature module."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    domain: FeatureDomain
    type: str = Field(..., description="Machine-readable event type, e.g. 'engine_overheat'.")
    severity: Severity
    message: str = Field(..., description="Human-readable, driver-facing summary.")
    data: dict = Field(default_factory=dict, description="Structured metadata (no media).")
    created_at: datetime = Field(default_factory=_now)
