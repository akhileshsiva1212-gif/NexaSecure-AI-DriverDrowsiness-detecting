"""Road Hazard Detection ("something in the driving path").

Obstacles on the road (a pedestrian, a stopped vehicle, debris, an animal) are detected on
the forward camera. Each detection carries an `area_ratio` — the fraction of the frame its
bounding box occupies — which is a rough proximity proxy: the bigger it looms, the closer and
more urgent it is.

Like every camera feature here, the real detection runs in the browser (MediaPipe
ObjectDetector on COCO classes) and only the labels + box sizes are posted to
`/road/hazards/ingest`. The analyzer is pure and temporally smoothed so a single noisy frame
never fires an alert.
"""

from __future__ import annotations

from collections import deque

from pydantic import BaseModel

from app.events.types import Severity

# COCO-detectable things that count as in-path road hazards, with display labels.
HAZARD_LABELS: dict[str, str] = {
    "person": "Pedestrian",
    "bicycle": "Cyclist",
    "motorcycle": "Motorcyclist",
    "car": "Stopped vehicle",
    "bus": "Bus",
    "truck": "Truck",
    "dog": "Animal",
    "debris": "Debris",
}

# Proximity bands by fraction of the frame the hazard occupies.
_IMMINENT_AREA = 0.18   # very close — critical
_WARN_AREA = 0.06       # noticeable — warning
_CONFIRM_FRAMES = 2     # consecutive frames before a hazard is acted on


class HazardDetection(BaseModel):
    kind: str
    area_ratio: float = 0.0   # bbox area / frame area (0..1)
    confidence: float = 1.0


class HazardFrame(BaseModel):
    detections: list[HazardDetection] = []


class HazardState(BaseModel):
    level: str                 # "clear" | "hazard" | "imminent"
    closest_kind: str | None
    closest_label: str | None
    closest_area_ratio: float
    count: int                 # number of in-path hazards this frame


def label_for(kind: str) -> str:
    return HAZARD_LABELS.get(kind, kind.replace("_", " ").title())


class HazardAnalyzer:
    """Temporally-smoothed in-path hazard assessment."""

    def __init__(self, confirm_frames: int = _CONFIRM_FRAMES, min_confidence: float = 0.4) -> None:
        self._confirm_frames = confirm_frames
        self._min_confidence = min_confidence
        self._streak = 0
        self._recent: deque[bool] = deque(maxlen=confirm_frames)

    def ingest(self, frame: HazardFrame) -> HazardState:
        hazards = [
            d for d in frame.detections
            if d.confidence >= self._min_confidence and d.kind in HAZARD_LABELS
        ]
        closest = max(hazards, key=lambda d: d.area_ratio, default=None)
        present = closest is not None and closest.area_ratio >= _WARN_AREA
        self._recent.append(present)
        confirmed = present and sum(self._recent) >= self._confirm_frames

        if not confirmed or closest is None:
            return HazardState(level="clear", closest_kind=None, closest_label=None,
                               closest_area_ratio=0.0, count=0)

        level = "imminent" if closest.area_ratio >= _IMMINENT_AREA else "hazard"
        return HazardState(
            level=level,
            closest_kind=closest.kind,
            closest_label=label_for(closest.kind),
            closest_area_ratio=round(closest.area_ratio, 3),
            count=len(hazards),
        )


# Advisory per level (severity, type, message). "clear" raises nothing.
_ADVISORY: dict[str, tuple[Severity, str, str]] = {
    "hazard": (Severity.WARNING, "road_hazard", "Hazard ahead on the road — stay alert."),
    "imminent": (Severity.CRITICAL, "road_hazard_imminent",
                 "Obstacle close ahead — be ready to brake."),
}


def advisory_for(state: HazardState) -> tuple[Severity, str, str] | None:
    return _ADVISORY.get(state.level)
