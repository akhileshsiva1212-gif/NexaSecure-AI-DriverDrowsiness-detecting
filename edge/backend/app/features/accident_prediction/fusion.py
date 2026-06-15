"""Pure risk-scoring for accident prediction.

Each feature contributes risk points based on its current level; the points are summed and
capped at 100. Keeping the scoring table here (pure, table-driven) makes the model easy to
read, tune, and unit-test without running any monitors.
"""

from __future__ import annotations

from pydantic import BaseModel

# Risk points contributed by each feature level. Absent/baseline levels contribute 0.
RISK_POINTS: dict[str, dict[str, int]] = {
    "drowsiness": {"alert": 0, "drowsy": 25, "microsleep": 45, "no_face": 10},
    "distraction": {"attentive": 0, "distracted": 20, "eyes_off_road": 40, "no_face": 5},
    "forward_collision": {"clear": 0, "tailgating": 20, "warning": 45},
    "hazard": {"clear": 0, "hazard": 20, "imminent": 40},
    "lane": {"centered": 0, "no_lane": 0, "drifting": 10, "departure": 25},
    "vehicle": {"ok": 0, "warning": 15, "critical": 35},
}

# Friendly labels for the dashboard's contributing-factors list.
SOURCE_LABELS: dict[str, str] = {
    "drowsiness": "Driver drowsiness",
    "distraction": "Driver distraction",
    "forward_collision": "Forward collision",
    "hazard": "Road hazard",
    "lane": "Lane departure",
    "vehicle": "Vehicle health",
}


class RiskContributor(BaseModel):
    source: str
    label: str
    level: str
    points: int


class RiskState(BaseModel):
    score: int                       # 0..100 fused risk
    level: str                       # "low" | "elevated" | "high"
    contributors: list[RiskContributor]  # only sources contributing > 0, highest first


def score_risk(levels: dict[str, str], warn: int, critical: int) -> RiskState:
    """Combine per-feature levels into a fused risk state.

    `levels` maps a source key (e.g. "drowsiness") to its current level string. Unknown
    sources/levels simply contribute nothing.
    """
    contributors: list[RiskContributor] = []
    total = 0
    for source, level in levels.items():
        points = RISK_POINTS.get(source, {}).get(level, 0)
        if points > 0:
            total += points
            contributors.append(RiskContributor(
                source=source, label=SOURCE_LABELS.get(source, source),
                level=level, points=points,
            ))

    score = min(100, total)
    contributors.sort(key=lambda c: c.points, reverse=True)

    if score >= critical:
        level = "high"
    elif score >= warn:
        level = "elevated"
    else:
        level = "low"

    return RiskState(score=score, level=level, contributors=contributors)
