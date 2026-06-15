"""Tests for the real (read-only) OBD-II serial driver and the optional-metric handling.

These run with NO hardware and WITHOUT importing python-OBD: `SerialObdSource` accepts an
injected fake connection + command map, so we exercise the PID->VehicleReading mapping and the
"oil pressure / coolant level aren't standard OBD-II PIDs" behaviour deterministically.
"""

from __future__ import annotations

from app.features.predictive_maintenance.trends import TelemetrySample, analyze
from app.features.vehicle_health.schemas import evaluate
from app.features.vehicle_health.serial_source import SerialObdSource


# ---- Fakes that mimic the tiny slice of python-OBD we use ------------------------------------

class _Quantity:
    """Stand-in for a Pint quantity (only `.magnitude` is read)."""

    def __init__(self, magnitude: float) -> None:
        self.magnitude = magnitude


class _Response:
    """Stand-in for obd.OBDResponse (`.value` + `.is_null()`)."""

    def __init__(self, magnitude: float | None) -> None:
        self.value = None if magnitude is None else _Quantity(magnitude)

    def is_null(self) -> bool:
        return self.value is None


class _Cmd:
    def __init__(self, name: str) -> None:
        self.name = name


class FakeConnection:
    """A fake obd.Async: returns canned responses keyed by command identity."""

    def __init__(self, values: dict) -> None:
        self._values = values  # maps the SAME command objects -> magnitude (or None)

    def query(self, cmd) -> _Response:
        return _Response(self._values.get(cmd))


# Shared command map injected in place of obd.commands.* (avoids importing python-OBD).
CMDS = {
    "coolant_temp": _Cmd("COOLANT_TEMP"),
    "rpm": _Cmd("RPM"),
    "speed": _Cmd("SPEED"),
    "voltage": _Cmd("ELM_VOLTAGE"),
}


def _source(temp=92.0, rpm=2100.0, speed=64.0, volt=13.9) -> SerialObdSource:
    conn = FakeConnection({
        CMDS["coolant_temp"]: temp,
        CMDS["rpm"]: rpm,
        CMDS["speed"]: speed,
        CMDS["voltage"]: volt,
    })
    return SerialObdSource(connection=conn, commands=CMDS)


# ---- Mapping --------------------------------------------------------------------------------

def test_read_maps_standard_pids_and_nulls_unsupported():
    reading = _source(temp=92.0, rpm=2100.0, speed=64.0, volt=13.9).read()
    assert reading.engine_temp_c == 92.0
    assert reading.rpm == 2100.0
    assert reading.speed_kph == 64.0
    assert reading.battery_voltage == 13.9
    # Not standard OBD-II PIDs — must be None, never fabricated.
    assert reading.coolant_pct is None
    assert reading.oil_pressure_kpa is None


def test_missing_core_metric_falls_back_to_last_known():
    src = _source(rpm=2000.0)
    first = src.read()
    assert first.rpm == 2000.0
    # Now RPM goes null (e.g. a dropped frame) — should reuse the last known value.
    src._conn = FakeConnection({
        CMDS["coolant_temp"]: 92.0,
        CMDS["rpm"]: None,
        CMDS["speed"]: 64.0,
        CMDS["voltage"]: 13.9,
    })
    second = src.read()
    assert second.rpm == 2000.0


# ---- evaluate() must not fabricate findings for None metrics ---------------------------------

def test_evaluate_skips_none_oil_and_coolant():
    reading = _source().read()  # oil_pressure_kpa / coolant_pct are None
    findings = {f.type for f in evaluate(reading)}
    assert "oil_pressure_low" not in findings
    assert "coolant_low" not in findings


def test_evaluate_still_flags_real_metrics_when_others_are_none():
    reading = _source(temp=115.0, volt=11.5).read()
    findings = {f.type for f in evaluate(reading)}
    assert "engine_overheat" in findings   # temp rule still fires
    assert "battery_low" in findings        # battery rule still fires
    assert "oil_pressure_low" not in findings


# ---- Predictive-maintenance trends skip all-None metric series -------------------------------

def test_analyze_skips_metrics_that_are_all_none():
    # Engine temp rising fast; oil pressure absent (real OBD) -> only engine temp is forecast.
    samples = [
        TelemetrySample(
            t_seconds=i * 10.0,
            engine_temp_c=100.0 + i,
            battery_voltage=13.5,
            oil_pressure_kpa=None,
            coolant_pct=None,
        )
        for i in range(8)
    ]
    report = analyze(samples)
    metrics = {f.metric for f in report.forecasts}
    assert "engine_temp_c" in metrics
    assert "oil_pressure_kpa" not in metrics
    assert "coolant_pct" not in metrics
