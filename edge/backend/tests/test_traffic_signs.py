"""Tests for traffic sign recognition: temporal confirmation, advisories, scenario, API."""

from __future__ import annotations

from app.events.types import Severity
from app.features.road_perception.recognizer import TrafficSignRecognizer
from app.features.road_perception.schemas import (
    RecognizedSign,
    RecognizerConfig,
    SignDetection,
    SignFrame,
    advisory_for,
    label_for,
)


def _frame(kind: str, value: int | None = None, conf: float = 0.9) -> SignFrame:
    return SignFrame(detections=[SignDetection(kind=kind, value=value, confidence=conf)])


# ---- labels & advisories -----------------------------------------------------------

def test_speed_limit_label_includes_value():
    assert label_for("speed_limit", 50) == "Speed limit 50"
    assert label_for("stop", None) == "Stop"


def test_speed_limit_advisory_is_info_with_value():
    sev, type_, msg = advisory_for(RecognizedSign(kind="speed_limit", value=30, label="Speed limit 30"))
    assert sev is Severity.INFO
    assert type_ == "sign_speed_limit"
    assert "30" in msg


def test_stop_sign_advisory_is_warning():
    sev, type_, _ = advisory_for(RecognizedSign(kind="stop", value=None, label="Stop"))
    assert sev is Severity.WARNING and type_ == "sign_stop"


# ---- recognizer: temporal confirmation ---------------------------------------------

def test_single_frame_does_not_confirm():
    r = TrafficSignRecognizer(RecognizerConfig(confirm_frames=3))
    state = r.ingest(_frame("stop"))
    assert r.newly_confirmed == []
    assert state.signs == []


def test_sign_confirms_after_enough_consecutive_frames():
    r = TrafficSignRecognizer(RecognizerConfig(confirm_frames=3))
    r.ingest(_frame("stop"))
    r.ingest(_frame("stop"))
    state = r.ingest(_frame("stop"))  # third consecutive frame -> confirmed
    assert [s.kind for s in r.newly_confirmed] == ["stop"]
    assert state.signs[0].kind == "stop"


def test_interrupted_streak_resets_confirmation():
    r = TrafficSignRecognizer(RecognizerConfig(confirm_frames=3))
    r.ingest(_frame("stop"))
    r.ingest(_frame("stop"))
    r.ingest(SignFrame(detections=[]))  # sign left view before confirming
    r.ingest(_frame("stop"))
    state = r.ingest(_frame("stop"))
    assert r.newly_confirmed == []      # only 2 consecutive since reset
    assert state.signs == []


def test_lingering_sign_confirms_only_once():
    r = TrafficSignRecognizer(RecognizerConfig(confirm_frames=2))
    confirmed_counts = []
    for _ in range(6):  # sign stays in view for many frames
        r.ingest(_frame("stop"))
        confirmed_counts.append(len(r.newly_confirmed))
    assert sum(confirmed_counts) == 1   # confirmed exactly once, not every frame


def test_speed_limit_persists_as_active_until_changed():
    r = TrafficSignRecognizer(RecognizerConfig(confirm_frames=2))
    r.ingest(_frame("speed_limit", 50))
    state = r.ingest(_frame("speed_limit", 50))
    assert state.active_speed_limit == 50

    # Open road for a while — active limit persists.
    state = r.ingest(SignFrame(detections=[]))
    assert state.active_speed_limit == 50

    # A new limit replaces it once confirmed.
    r.ingest(_frame("speed_limit", 30))
    state = r.ingest(_frame("speed_limit", 30))
    assert state.active_speed_limit == 30


def test_low_confidence_detections_are_ignored():
    r = TrafficSignRecognizer(RecognizerConfig(confirm_frames=2, min_confidence=0.5))
    r.ingest(_frame("stop", conf=0.2))
    state = r.ingest(_frame("stop", conf=0.2))
    assert state.signs == []


# ---- scenario ----------------------------------------------------------------------

def test_scenario_confirms_a_sequence_of_signs():
    """A sequence of signs (as the browser would post them) each confirm once after their
    temporal-confirmation window, with clear road between them."""
    recognizer = TrafficSignRecognizer(RecognizerConfig(confirm_frames=3))
    sequence = [
        ("speed_limit", 50),
        ("stop", None),
        ("pedestrian_crossing", None),
        ("school_zone", None),
        ("yield", None),
    ]

    confirmed_kinds = set()
    for kind, value in sequence:
        for _ in range(4):  # held in view long enough to confirm
            recognizer.ingest(_frame(kind, value))
            confirmed_kinds.update(s.kind for s in recognizer.newly_confirmed)
        for _ in range(3):  # clear road between signs resets the streak
            recognizer.ingest(SignFrame(detections=[]))

    assert {"speed_limit", "stop", "pedestrian_crossing", "school_zone", "yield"} <= confirmed_kinds


# ---- API ---------------------------------------------------------------------------

def test_signs_endpoint_reports_state():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        resp = client.get("/api/v1/road/signs")
        assert resp.status_code == 200
        assert "state" in resp.json()


def test_ingest_endpoint_confirms_a_pushed_sign():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        body = {"detections": [{"kind": "stop", "value": None, "confidence": 0.95}]}
        last = None
        for _ in range(5):  # push enough frames to clear temporal confirmation
            last = client.post("/api/v1/road/signs/ingest", json=body)
        assert last is not None and last.status_code == 200
        data = last.json()
        assert data["live"] is True
        assert any(s["kind"] == "stop" for s in data["state"]["signs"])
