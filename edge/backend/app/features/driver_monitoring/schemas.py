"""Schemas and tunable configuration for driver drowsiness detection."""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel


class FrameSignals(BaseModel):
    """Per-frame measurements produced by any frame source.

    `face_found` is False when no face is detected (e.g. driver looked away or the camera
    is blocked) — the analyzer treats those frames as "unknown", not "eyes closed".
    """

    ear: float = 0.0          # eye aspect ratio (averaged over both eyes)
    mar: float = 0.0          # mouth aspect ratio
    face_found: bool = True

    # Head pose / gaze (distraction). Default 0.0 == looking straight ahead, so a source
    # that only measures drowsiness (or an older client) leaves the driver "attentive".
    yaw: float = 0.0          # head turn: -1 (left) .. +1 (right); 0 = forward
    pitch: float = 0.0        # head tilt along the eye->chin axis; ~0.5 = forward, higher = down
    gaze: float = 0.0         # horizontal gaze offset: -0.5 .. +0.5; 0 = looking straight


class DrowsinessState(BaseModel):
    """Aggregated, smoothed drowsiness state — what the dashboard displays."""

    level: str                # "alert" | "drowsy" | "microsleep" | "no_face"
    perclos: float            # fraction of recent frames with eyes closed (0..1)
    eyes_closed_seconds: float
    yawns_per_minute: float
    ear: float
    mar: float


class DistractionState(BaseModel):
    """Aggregated, smoothed distraction state — what the dashboard displays."""

    level: str                # "attentive" | "distracted" | "eyes_off_road" | "no_face"
    off_road_ratio: float     # fraction of recent frames looking away (0..1)
    off_road_seconds: float   # continuous current look-away duration
    direction: str            # "forward" | "left" | "right" | "up" | "down"
    yaw: float
    pitch: float
    gaze: float


@dataclass(frozen=True)
class DrowsinessConfig:
    """Thresholds, expressed in real-world units so they're resolution/fps independent.

    Tune these against real footage before any on-road use. The defaults are reasonable
    starting points from the literature, not validated safety values.
    """

    ear_closed_threshold: float = 0.20      # EAR below this = eyes considered closed
    mar_yawn_threshold: float = 0.60        # MAR above this = mouth considered yawning
    window_seconds: float = 10.0            # sliding window for PERCLOS / yawn rate
    perclos_warn: float = 0.35              # PERCLOS at/above this within window -> drowsy
    microsleep_seconds: float = 2.0         # continuous eye closure -> microsleep (critical)
    yawns_per_minute_warn: float = 3.0      # sustained yawning -> drowsy


@dataclass(frozen=True)
class DistractionConfig:
    """Thresholds for "eyes off the road" detection.

    Advisory-grade proxies (see geometry.py); tune against real footage before any on-road
    use. A frame counts as "off road" when the head is turned/tilted past these bands or
    the gaze is pulled aside.
    """

    yaw_threshold: float = 0.35       # |yaw| above this = head clearly turned aside
    gaze_threshold: float = 0.22      # |gaze| above this = eyes pulled aside
    pitch_neutral: float = 0.5        # forward-facing nose position on the eye->chin axis
    pitch_down_delta: float = 0.30    # pitch >= neutral+delta -> looking down (lap/phone)
    pitch_up_delta: float = 0.30      # pitch <= neutral-delta -> looking up
    window_seconds: float = 6.0       # sliding window for the off-road fraction
    off_road_warn: float = 0.5        # off-road fraction at/above this -> distracted
    eyes_off_road_seconds: float = 2.5  # continuous look-away -> eyes_off_road (warning)
