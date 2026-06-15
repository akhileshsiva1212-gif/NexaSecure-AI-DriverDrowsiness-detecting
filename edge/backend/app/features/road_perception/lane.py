"""Lane Detection / Lane-Departure Warning.

The forward camera estimates the car's lateral position within its lane as an `offset` in
[-1, 1] (0 = centered, -1 = on the left line, +1 = on the right line). Drifting to a lane
edge and holding there — *without* a turn signal — is an unintended lane departure and the
analyzer escalates it. With the turn signal on, the same drift is a deliberate lane change and
raises nothing.

The browser estimates `offset` with classical computer vision (OpenCV.js: Canny + Hough lane
lines) and posts it to `/road/lane/ingest`; the analyzer itself is pure and temporally smoothed.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.events.types import Severity


class LaneSignals(BaseModel):
    lane_found: bool = True
    offset: float = 0.0       # lateral position in lane: -1 (left line) .. 0 (center) .. +1 (right line)
    turn_signal: bool = False  # driver's turn signal — a signalled drift is a deliberate lane change


class LaneState(BaseModel):
    level: str                 # "no_lane" | "centered" | "drifting" | "departure"
    offset: float
    side: str                  # "center" | "left" | "right"
    signaling: bool


_DRIFT_OFFSET = 0.55   # |offset| beyond this is drifting toward an edge
_DEPART_OFFSET = 0.8   # |offset| beyond this is at the lane line
_DRIFT_FRAMES = 3      # consecutive drifting frames before a drift advisory
_DEPART_FRAMES = 4     # consecutive departing frames before a departure advisory


class LaneAnalyzer:
    """Temporally-smoothed lane-position assessment."""

    def __init__(self) -> None:
        self._drift_streak = 0
        self._depart_streak = 0

    def ingest(self, signals: LaneSignals) -> LaneState:
        if not signals.lane_found:
            self._drift_streak = 0
            self._depart_streak = 0
            return LaneState(level="no_lane", offset=0.0, side="center",
                             signaling=signals.turn_signal)

        offset = signals.offset
        side = "center"
        if offset <= -_DRIFT_OFFSET:
            side = "left"
        elif offset >= _DRIFT_OFFSET:
            side = "right"

        drifting = abs(offset) >= _DRIFT_OFFSET
        departing = abs(offset) >= _DEPART_OFFSET

        self._drift_streak = self._drift_streak + 1 if drifting else 0
        self._depart_streak = self._depart_streak + 1 if departing else 0

        # A signalled drift is a deliberate lane change — raise nothing.
        if signals.turn_signal:
            level = "centered"
        elif self._depart_streak >= _DEPART_FRAMES:
            level = "departure"
        elif self._drift_streak >= _DRIFT_FRAMES:
            level = "drifting"
        else:
            level = "centered"

        return LaneState(level=level, offset=round(offset, 3), side=side,
                         signaling=signals.turn_signal)


# Advisory per level (severity, type, message). "centered"/"no_lane" raise nothing.
_ADVISORY: dict[str, tuple[Severity, str, str]] = {
    "drifting": (Severity.INFO, "lane_drift", "Drifting toward the lane edge."),
    "departure": (Severity.WARNING, "lane_departure",
                  "Lane departure — no turn signal. Steer back to center."),
}


def advisory_for(state: LaneState) -> tuple[Severity, str, str] | None:
    base = _ADVISORY.get(state.level)
    if base is None:
        return base
    severity, type_, message = base
    if state.side != "center":
        return (severity, type_, f"{message} ({state.side})")
    return (severity, type_, message)
