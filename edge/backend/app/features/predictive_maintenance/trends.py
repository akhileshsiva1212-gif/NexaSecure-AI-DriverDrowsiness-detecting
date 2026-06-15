"""Pure trend-analysis for predictive maintenance.

Each metric we care about has a "danger direction" and a threshold (the same limits the
Vehicle Health rules use). We fit a least-squares line to the recent samples of a metric,
read off its slope, and project when — if ever — it will reach the threshold. If that moment
falls inside the look-ahead horizon, we raise a forecast whose severity depends on how soon.

This module is pure and deterministic (it takes a list of samples and returns forecasts), so
it can be unit-tested with hand-built series and no database or clock.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel

from app.events.types import Severity


class TelemetrySample(BaseModel):
    """One time-stamped reading, as needed for trending (seconds since an arbitrary origin).

    `oil_pressure_kpa` and `coolant_pct` may be None when the data comes from a real OBD
    adapter (they are not standard OBD-II PIDs); such metrics are simply not trended.
    """

    t_seconds: float
    engine_temp_c: float
    battery_voltage: float
    oil_pressure_kpa: float | None = None
    coolant_pct: float | None = None


class Forecast(BaseModel):
    """A projected maintenance concern for a single metric."""

    metric: str
    label: str
    current: float
    slope_per_min: float        # rate of change (units per minute)
    threshold: float
    minutes_to_threshold: float | None  # None = not trending toward the threshold
    severity: str
    message: str


class MaintenanceReport(BaseModel):
    """Aggregated predictive-maintenance state for the dashboard."""

    status: str                 # "ok" | "watch" | "warning" | "critical" | "insufficient_data"
    samples: int
    forecasts: list[Forecast]   # only metrics projected to breach within the horizon


@dataclass(frozen=True)
class MetricRule:
    metric: str
    label: str
    threshold: float
    direction: str   # "rising" = bad when increasing; "falling" = bad when decreasing
    message: str


# The metrics we trend, with the same danger limits used by the Vehicle Health rules.
RULES: tuple[MetricRule, ...] = (
    MetricRule("engine_temp_c", "Engine temperature", 110.0, "rising",
               "Engine temperature is trending up toward the critical limit."),
    MetricRule("battery_voltage", "Battery voltage", 12.0, "falling",
               "Battery voltage is trending down — charging system may be degrading."),
    MetricRule("oil_pressure_kpa", "Oil pressure", 150.0, "falling",
               "Oil pressure is trending down toward an unsafe level."),
    MetricRule("coolant_pct", "Coolant level", 30.0, "falling",
               "Coolant level is trending down — a top-up or leak check is due."),
)

# Minimum samples before a trend is trustworthy, and the look-ahead horizon.
_MIN_SAMPLES = 6
_HORIZON_MINUTES = 30.0
# Severity bands by how soon the threshold is projected to be reached.
_CRITICAL_WITHIN = 5.0
_WARNING_WITHIN = 15.0


def _linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    """Ordinary least-squares; returns (slope, intercept). Slope is 0 if x has no spread."""
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    sxx = sum((x - mean_x) ** 2 for x in xs)
    if sxx == 0:
        return 0.0, mean_y
    sxy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    slope = sxy / sxx
    return slope, mean_y - slope * mean_x


def _severity_for(minutes: float) -> Severity:
    if minutes <= _CRITICAL_WITHIN:
        return Severity.CRITICAL
    if minutes <= _WARNING_WITHIN:
        return Severity.WARNING
    return Severity.INFO


def analyze(samples: list[TelemetrySample], horizon_minutes: float = _HORIZON_MINUTES) -> MaintenanceReport:
    """Trend each metric and return forecasts for those projected to breach within the horizon."""
    if len(samples) < _MIN_SAMPLES:
        return MaintenanceReport(status="insufficient_data", samples=len(samples), forecasts=[])

    forecasts: list[Forecast] = []

    for rule in RULES:
        # Keep only samples that actually carry this metric — a real OBD adapter omits some
        # (e.g. oil pressure / coolant level), so those metrics are simply not trended.
        pairs = [(s.t_seconds, getattr(s, rule.metric)) for s in samples
                 if getattr(s, rule.metric) is not None]
        if len(pairs) < _MIN_SAMPLES:
            continue
        xs = [p[0] for p in pairs]
        ys = [p[1] for p in pairs]
        slope_per_sec, _ = _linear_fit(xs, ys)
        slope_per_min = slope_per_sec * 60.0
        current = ys[-1]

        # Is the trend heading the dangerous way fast enough to matter?
        gap = rule.threshold - current  # signed distance to the threshold
        minutes_to: float | None = None
        if rule.direction == "rising" and slope_per_min > 1e-6 and gap > 0:
            minutes_to = gap / slope_per_min
        elif rule.direction == "falling" and slope_per_min < -1e-6 and gap < 0:
            minutes_to = gap / slope_per_min  # negative/negative -> positive minutes

        if minutes_to is None or minutes_to > horizon_minutes:
            continue

        severity = _severity_for(minutes_to)
        forecasts.append(Forecast(
            metric=rule.metric,
            label=rule.label,
            current=round(current, 2),
            slope_per_min=round(slope_per_min, 4),
            threshold=rule.threshold,
            minutes_to_threshold=round(minutes_to, 1),
            severity=severity.value,
            message=f"{rule.message} (~{round(minutes_to)} min at the current rate).",
        ))

    if not forecasts:
        status = "ok"
    else:
        worst = max(forecasts, key=lambda f: Severity(f.severity).rank)
        status = {"critical": "critical", "warning": "warning", "info": "watch"}[worst.severity]

    return MaintenanceReport(status=status, samples=len(samples), forecasts=forecasts)
