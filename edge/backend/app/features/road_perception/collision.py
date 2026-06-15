"""Forward Collision Warning (FCW).

Tracks the vehicle directly ahead and estimates **time-to-collision (TTC)** = gap distance /
closing speed. A short TTC is the dangerous case (you are closing on the lead car fast); a
short *headway* (time gap at current speed) without high closing speed is tailgating.

The browser estimates the lead vehicle's distance and closing speed from its bounding-box
geometry over successive frames (a bigger, faster-growing box = closer, faster closing) and
posts the numbers to `/road/forward-collision/ingest`. The analyzer is pure.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.events.types import Severity


class ForwardSignals(BaseModel):
    lead_present: bool = False
    distance_m: float = 0.0       # estimated gap to the lead vehicle (meters)
    closing_speed_mps: float = 0.0  # positive = closing in; <=0 = holding/opening the gap
    ego_speed_kph: float = 0.0    # our speed, for the headway (time-gap) calculation


class ForwardState(BaseModel):
    level: str                    # "clear" | "tailgating" | "warning"
    lead_present: bool
    distance_m: float
    ttc_seconds: float | None     # None when not closing in
    headway_seconds: float | None  # time gap at current ego speed


_TTC_WARN = 2.5        # seconds — below this closing TTC is a collision warning
_HEADWAY_TAILGATE = 1.0  # seconds — below this time gap is tailgating


def _ttc(distance_m: float, closing_mps: float) -> float | None:
    return distance_m / closing_mps if closing_mps > 0.05 else None


def _headway(distance_m: float, ego_kph: float) -> float | None:
    ego_mps = ego_kph / 3.6
    return distance_m / ego_mps if ego_mps > 0.5 else None


class ForwardCollisionAnalyzer:
    """Stateless-per-frame TTC/headway assessment (each frame already carries the kinematics)."""

    def ingest(self, signals: ForwardSignals) -> ForwardState:
        if not signals.lead_present:
            return ForwardState(level="clear", lead_present=False, distance_m=0.0,
                                ttc_seconds=None, headway_seconds=None)

        ttc = _ttc(signals.distance_m, signals.closing_speed_mps)
        headway = _headway(signals.distance_m, signals.ego_speed_kph)

        if ttc is not None and ttc <= _TTC_WARN:
            level = "warning"
        elif headway is not None and headway <= _HEADWAY_TAILGATE:
            level = "tailgating"
        else:
            level = "clear"

        return ForwardState(
            level=level,
            lead_present=True,
            distance_m=round(signals.distance_m, 1),
            ttc_seconds=round(ttc, 2) if ttc is not None else None,
            headway_seconds=round(headway, 2) if headway is not None else None,
        )


_ADVISORY: dict[str, tuple[Severity, str, str]] = {
    "tailgating": (Severity.WARNING, "following_too_close",
                   "Following too closely — increase your gap."),
    "warning": (Severity.CRITICAL, "collision_warning",
                "Forward collision risk — brake now."),
}


def advisory_for(state: ForwardState) -> tuple[Severity, str, str] | None:
    return _ADVISORY.get(state.level)
