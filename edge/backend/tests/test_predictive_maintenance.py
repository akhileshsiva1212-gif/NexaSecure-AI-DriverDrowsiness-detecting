"""Tests for predictive maintenance trend analysis."""

from __future__ import annotations

from app.features.predictive_maintenance.trends import TelemetrySample, analyze


def _series(values: dict[str, list[float]], step_s: float = 10.0) -> list[TelemetrySample]:
    """Build a sample series; each metric list must be the same length."""
    n = len(next(iter(values.values())))
    base = {"engine_temp_c": 90.0, "battery_voltage": 13.5,
            "oil_pressure_kpa": 300.0, "coolant_pct": 80.0}
    samples = []
    for i in range(n):
        row = dict(base)
        for k, series in values.items():
            row[k] = series[i]
        samples.append(TelemetrySample(t_seconds=i * step_s, **row))
    return samples


def test_insufficient_data_returns_no_forecast():
    report = analyze(_series({"battery_voltage": [13.5, 13.4]}))
    assert report.status == "insufficient_data"
    assert report.forecasts == []


def test_steady_readings_forecast_nothing():
    report = analyze(_series({"engine_temp_c": [90.0] * 8}))
    assert report.status == "ok"
    assert report.forecasts == []


def test_rising_engine_temp_is_forecast():
    # Climbing ~1C every 10s -> 6C/min; from 100 it reaches 110 in well under the horizon.
    temps = [100.0 + i for i in range(8)]
    report = analyze(_series({"engine_temp_c": temps}))
    metrics = {f.metric for f in report.forecasts}
    assert "engine_temp_c" in metrics
    f = next(f for f in report.forecasts if f.metric == "engine_temp_c")
    assert f.slope_per_min > 0
    assert f.minutes_to_threshold is not None and f.minutes_to_threshold >= 0


def test_falling_battery_is_forecast_toward_threshold():
    volts = [12.6 - 0.05 * i for i in range(10)]  # dropping toward 12.0V
    report = analyze(_series({"battery_voltage": volts}))
    f = next(f for f in report.forecasts if f.metric == "battery_voltage")
    assert f.slope_per_min < 0
    assert f.minutes_to_threshold is not None


def test_falling_metric_already_safe_and_rising_is_not_forecast():
    volts = [13.0 + 0.02 * i for i in range(10)]  # battery rising = healthy
    report = analyze(_series({"battery_voltage": volts}))
    assert all(f.metric != "battery_voltage" for f in report.forecasts)


def test_slow_trend_beyond_horizon_is_ignored():
    # Battery falling extremely slowly: would take hours to reach 12.0V.
    volts = [13.5 - 0.0005 * i for i in range(12)]
    report = analyze(_series({"battery_voltage": volts}), horizon_minutes=30.0)
    assert all(f.metric != "battery_voltage" for f in report.forecasts)


def test_maintenance_endpoint_responds():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        resp = client.get("/api/v1/vehicle/maintenance")
        assert resp.status_code == 200
        assert "status" in resp.json()
