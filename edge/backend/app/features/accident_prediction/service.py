"""Accident Prediction service — periodically fuses every monitor's latest state.

On a short timer it reads the current level from each feature monitor, scores the combined
risk (`fusion.score_risk`), and raises an edge-triggered advisory when the risk band changes
(low -> elevated -> high). The "high" advisory is what the SOS feature listens for to arm an
emergency response.
"""

from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.core.logging import get_logger
from app.decision_engine import decision_engine
from app.events.types import AdvisoryEvent, FeatureDomain, Severity
from app.features.accident_prediction.fusion import RiskState, score_risk
from app.features.driver_monitoring.service import distraction_monitor, monitor as drowsiness_monitor
from app.features.road_perception.monitors import forward_monitor, hazard_monitor, lane_monitor
from app.features.vehicle_health.schemas import evaluate
from app.features.vehicle_health.service import monitor as vehicle_monitor

logger = get_logger("feature.accident_prediction")

_BAND_ADVISORY: dict[str, tuple[Severity, str, str]] = {
    "elevated": (Severity.WARNING, "accident_risk_elevated",
                 "Elevated crash risk — multiple risk factors active."),
    "high": (Severity.CRITICAL, "accident_risk_high",
             "High crash risk — take corrective action now."),
}


def _vehicle_level() -> str:
    reading = vehicle_monitor.latest
    if reading is None:
        return "ok"
    findings = evaluate(reading)
    if any(f.severity is Severity.CRITICAL for f in findings):
        return "critical"
    if any(f.severity is Severity.WARNING for f in findings):
        return "warning"
    return "ok"


def _level_of(mon, baseline: str) -> str:
    state = mon.latest
    return state.level if state is not None else baseline


class AccidentPredictionEngine:
    """Fuses all feature states into a single rolling risk score."""

    def __init__(self) -> None:
        settings = get_settings()
        self._interval = settings.fusion_interval_seconds
        self._warn = settings.fusion_risk_warn
        self._critical = settings.fusion_risk_critical
        self._task: asyncio.Task | None = None
        self._latest: RiskState | None = None
        self._last_band = "low"

    @property
    def latest(self) -> RiskState | None:
        return self._latest

    def _gather_levels(self) -> dict[str, str]:
        return {
            "drowsiness": _level_of(drowsiness_monitor, "alert"),
            "distraction": _level_of(distraction_monitor, "attentive"),
            "forward_collision": _level_of(forward_monitor, "clear"),
            "hazard": _level_of(hazard_monitor, "clear"),
            "lane": _level_of(lane_monitor, "centered"),
            "vehicle": _vehicle_level(),
        }

    async def _evaluate_once(self) -> None:
        state = score_risk(self._gather_levels(), warn=self._warn, critical=self._critical)
        self._latest = state

        if state.level != self._last_band:
            advisory = _BAND_ADVISORY.get(state.level)
            if advisory is not None:
                severity, type_, message = advisory
                await decision_engine.submit(AdvisoryEvent(
                    domain=FeatureDomain.FUSION,
                    type=type_,
                    severity=severity,
                    message=message,
                    data={
                        "score": state.score,
                        "level": state.level,
                        "contributors": [c.model_dump() for c in state.contributors],
                    },
                ))
            self._last_band = state.level

    async def _run(self) -> None:
        logger.info("accident prediction engine started (interval=%ss, warn=%s, crit=%s)",
                    self._interval, self._warn, self._critical)
        while True:
            try:
                await self._evaluate_once()
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("fusion evaluation failed: %r", exc)
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


monitor = AccidentPredictionEngine()
