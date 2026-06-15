"""Smoke tests for the Phase 0/1 backend pipeline."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.features.vehicle_health.schemas import VehicleReading, evaluate
from app.events.types import Severity


def test_evaluate_flags_overheat_as_critical():
    reading = VehicleReading(
        engine_temp_c=115, rpm=1500, speed_kph=40,
        battery_voltage=13.5, coolant_pct=80, oil_pressure_kpa=300,
    )
    findings = evaluate(reading)
    types = {f.type: f for f in findings}
    assert "engine_overheat" in types
    assert types["engine_overheat"].severity is Severity.CRITICAL


def test_evaluate_clean_reading_has_no_findings():
    reading = VehicleReading(
        engine_temp_c=90, rpm=1500, speed_kph=40,
        battery_voltage=13.5, coolant_pct=80, oil_pressure_kpa=300,
    )
    assert evaluate(reading) == []


def test_app_health_and_vehicle_endpoints():
    # Import here so the app (and its lifespan wiring) builds within the test.
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/api/v1/health").json()["status"] == "ok"

        # Vehicle health starts disconnected and must not fabricate readings.
        body = client.get("/api/v1/vehicle/health").json()
        assert body["connected"] is False
        assert body["status"] == "not_connected"
        assert body["reading"] is None

        # The only real source is "serial"; unknown/demo modes are rejected.
        bad = client.post("/api/v1/vehicle/connection", json={"mode": "mock"})
        assert bad.status_code == 400

        assert "events" in client.get("/api/v1/events").json()
