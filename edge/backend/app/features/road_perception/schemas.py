"""Schemas, labels, and recognition config for Traffic Sign Recognition."""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel

from app.events.types import Severity

# Human-readable labels per sign kind. Speed-limit labels append their value at render time.
SIGN_LABELS: dict[str, str] = {
    "speed_limit": "Speed limit",
    "stop": "Stop",
    "yield": "Yield",
    "no_entry": "No entry",
    "pedestrian_crossing": "Pedestrian crossing",
    "school_zone": "School zone",
}


class SignDetection(BaseModel):
    """One raw per-frame sign detection from a source (mock or, later, a real detector)."""

    kind: str
    value: int | None = None   # the number on a speed-limit sign; None for non-numeric signs
    confidence: float = 1.0


class SignFrame(BaseModel):
    """All sign detections found in a single road-camera frame (often empty)."""

    detections: list[SignDetection] = []


class RecognizedSign(BaseModel):
    """A sign that has been temporally confirmed and is shown to the driver."""

    kind: str
    value: int | None
    label: str


class TrafficSignState(BaseModel):
    """Aggregated recognition state — what the dashboard displays."""

    active_speed_limit: int | None   # last confirmed speed limit; persists until it changes
    signs: list[RecognizedSign]      # recently confirmed signs, newest first


@dataclass(frozen=True)
class RecognizerConfig:
    """Tunables for temporal confirmation. Defaults are sensible dev values, not validated."""

    confirm_frames: int = 3      # consecutive frames a sign must persist before it's confirmed
    history_size: int = 6        # how many recent confirmed signs to keep for display
    min_confidence: float = 0.5  # detections below this confidence are ignored


def label_for(kind: str, value: int | None) -> str:
    """Human-readable label for a sign, appending the value for speed limits."""
    base = SIGN_LABELS.get(kind, kind.replace("_", " ").title())
    if kind == "speed_limit" and value is not None:
        return f"{base} {value}"
    return base


# Advisory mapping for a NEWLY confirmed sign -> (severity, event type, message), or None.
_ADVISORIES: dict[str, tuple[Severity, str, str]] = {
    "stop": (Severity.WARNING, "sign_stop", "Stop sign ahead."),
    "yield": (Severity.WARNING, "sign_yield", "Yield — give way ahead."),
    "no_entry": (Severity.WARNING, "sign_no_entry", "No entry — do not enter."),
    "pedestrian_crossing": (
        Severity.WARNING, "sign_pedestrian_crossing", "Pedestrian crossing ahead.",
    ),
    "school_zone": (Severity.WARNING, "sign_school_zone", "School zone — slow down."),
}


def advisory_for(sign: RecognizedSign) -> tuple[Severity, str, str] | None:
    """Return the advisory a newly confirmed sign should raise, or None for no advisory."""
    if sign.kind == "speed_limit":
        value = sign.value if sign.value is not None else "?"
        return (Severity.INFO, "sign_speed_limit", f"Speed limit: {value} km/h.")
    return _ADVISORIES.get(sign.kind)
