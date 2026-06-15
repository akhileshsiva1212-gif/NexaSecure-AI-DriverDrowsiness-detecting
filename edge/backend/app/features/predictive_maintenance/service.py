"""Predictive Maintenance service.

Periodically pulls the recent vehicle-telemetry time-series from the repository, trends it
(`trends.analyze`), and publishes an edge-triggered advisory the moment a metric *newly*
starts projecting a breach within the horizon — and clears its latch when it recovers, so a
persistent slow trend does not spam the driver.

This is honest by construction: with no OBD adapter connected there is no fresh telemetry, so
the report stays `insufficient_data` and nothing is forecast.
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import repository
from app.decision_engine import decision_engine
from app.events.types import AdvisoryEvent, FeatureDomain, Severity
from app.features.predictive_maintenance.trends import (
    MaintenanceReport,
    TelemetrySample,
    analyze,
)

logger = get_logger("feature.predictive_maintenance")


def _to_samples(rows: list[dict]) -> list[TelemetrySample]:
    """Convert persisted telemetry dicts into trend samples with a relative time axis."""
    if not rows:
        return []
    t0 = datetime.fromisoformat(rows[0]["created_at"])
    samples: list[TelemetrySample] = []
    for row in rows:
        t = (datetime.fromisoformat(row["created_at"]) - t0).total_seconds()
        samples.append(TelemetrySample(
            t_seconds=t,
            engine_temp_c=row["engine_temp_c"],
            battery_voltage=row["battery_voltage"],
            oil_pressure_kpa=row["oil_pressure_kpa"],
            coolant_pct=row["coolant_pct"],
        ))
    return samples


class PredictiveMaintenanceMonitor:
    """Trends telemetry on a timer and raises forecasts of impending issues."""

    def __init__(self) -> None:
        settings = get_settings()
        self._interval = settings.maintenance_interval_seconds
        self._window = settings.maintenance_window
        self._task: asyncio.Task | None = None
        self._latest: MaintenanceReport | None = None
        self._active_metrics: set[str] = set()  # metrics currently forecasting a breach

    @property
    def latest(self) -> MaintenanceReport | None:
        return self._latest

    async def _evaluate_once(self) -> None:
        rows = repository.list_recent_telemetry(self._window)
        report = analyze(_to_samples(rows))
        self._latest = report

        forecast_by_metric = {f.metric: f for f in report.forecasts}
        current = set(forecast_by_metric)

        # Edge trigger: advise only for metrics that just began forecasting a breach.
        for metric in current - self._active_metrics:
            f = forecast_by_metric[metric]
            await decision_engine.submit(AdvisoryEvent(
                domain=FeatureDomain.VEHICLE,
                type=f"maintenance_{metric}",
                severity=Severity(f.severity),
                message=f.message,
                data={
                    "metric": metric,
                    "current": f.current,
                    "slope_per_min": f.slope_per_min,
                    "minutes_to_threshold": f.minutes_to_threshold,
                    "kind": "predictive_maintenance",
                },
            ))
        self._active_metrics = current

    async def _run(self) -> None:
        logger.info("predictive maintenance monitor started (interval=%ss, window=%s)",
                    self._interval, self._window)
        while True:
            try:
                await self._evaluate_once()
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("maintenance evaluation failed: %r", exc)
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


monitor = PredictiveMaintenanceMonitor()
