"""Tests for the SOS emergency state machine (via the API, exercising the real async path)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_sos_arm_then_cancel_cycle():
    with TestClient(app) as client:
        # Starts idle.
        assert client.get("/api/v1/sos/status").json()["state"] == "idle"

        # Manual arm -> armed, with a counting-down timer.
        armed = client.post("/api/v1/sos/arm", json={"reason": "test"}).json()
        assert armed["state"] == "armed"
        assert armed["auto"] is False
        assert armed["seconds_remaining"] > 0
        assert armed["reason"] == "test"

        # Cancel -> back to idle (the safety valve against false alarms).
        cancelled = client.post("/api/v1/sos/cancel").json()
        assert cancelled["state"] == "idle"


def test_sos_status_shape():
    with TestClient(app) as client:
        body = client.get("/api/v1/sos/status").json()
        for key in ("state", "reason", "auto", "countdown_seconds", "seconds_remaining"):
            assert key in body
