"""Schemas and health-evaluation rules for the Vehicle Health feature."""

from __future__ import annotations

from pydantic import BaseModel

from app.events.types import Severity


class VehicleReading(BaseModel):
    """One snapshot of vehicle telemetry (the output of an OBD source).

    `coolant_pct` and `oil_pressure_kpa` are optional: they are not standard OBD-II PIDs, so a
    real serial adapter reports them as None (the mock source still provides all six).
    """

    engine_temp_c: float
    rpm: float
    speed_kph: float
    battery_voltage: float
    coolant_pct: float | None = None
    oil_pressure_kpa: float | None = None


class HealthFinding(BaseModel):
    """The result of evaluating a reading against the thresholds."""

    type: str
    severity: Severity
    message: str
    value: float


# Threshold table. Each entry: (event type, metric, comparison, limit, severity, message).
# Kept declarative so it is easy to read, test, and tune.
def evaluate(reading: VehicleReading) -> list[HealthFinding]:
    """Return any health findings triggered by this reading (may be empty)."""
    findings: list[HealthFinding] = []

    if reading.engine_temp_c >= 110:
        findings.append(HealthFinding(
            type="engine_overheat",
            severity=Severity.CRITICAL,
            message="Engine temperature critical — stop safely and check coolant.",
            value=reading.engine_temp_c,
        ))
    elif reading.engine_temp_c >= 100:
        findings.append(HealthFinding(
            type="engine_temp_high",
            severity=Severity.WARNING,
            message="Engine running hot — monitor temperature.",
            value=reading.engine_temp_c,
        ))

    if reading.battery_voltage < 12.0:
        findings.append(HealthFinding(
            type="battery_low",
            severity=Severity.WARNING,
            message="Battery voltage low — possible charging issue.",
            value=reading.battery_voltage,
        ))

    if reading.oil_pressure_kpa is not None and reading.oil_pressure_kpa < 150:
        findings.append(HealthFinding(
            type="oil_pressure_low",
            severity=Severity.CRITICAL,
            message="Oil pressure low — risk of engine damage.",
            value=reading.oil_pressure_kpa,
        ))

    if reading.coolant_pct is not None and reading.coolant_pct < 30:
        findings.append(HealthFinding(
            type="coolant_low",
            severity=Severity.WARNING,
            message="Coolant level low — top up soon.",
            value=reading.coolant_pct,
        ))

    return findings
