"""Tests for driver drowsiness: geometry math, analyzer transitions, and the scenario."""

from __future__ import annotations

from app.features.driver_monitoring.analyzer import DrowsinessAnalyzer
from app.features.driver_monitoring.geometry import eye_aspect_ratio, mouth_aspect_ratio
from app.features.driver_monitoring.schemas import DrowsinessConfig, FrameSignals


# ---- geometry ----------------------------------------------------------------------

def test_open_eye_has_higher_ear_than_closed_eye():
    # Eye spanning x=0..4 horizontally. Open: verticals ~2 high; closed: verticals ~0.2.
    open_eye = [(0, 1), (1, 2), (3, 2), (4, 1), (3, 0), (1, 0)]
    closed_eye = [(0, 1), (1, 1.1), (3, 1.1), (4, 1), (3, 0.9), (1, 0.9)]
    assert eye_aspect_ratio(open_eye) > eye_aspect_ratio(closed_eye)
    assert eye_aspect_ratio(closed_eye) < 0.2  # closed eye is below the threshold


def test_yawn_has_higher_mar_than_closed_mouth():
    # mouth = (left, right, top, bottom); width fixed at 4.
    closed = [(0, 0), (4, 0), (2, 0.4), (2, -0.4)]   # 0.8 tall -> MAR 0.2
    yawn = [(0, 0), (4, 0), (2, 1.5), (2, -1.5)]      # 3.0 tall -> MAR 0.75
    assert mouth_aspect_ratio(yawn) > mouth_aspect_ratio(closed)
    assert mouth_aspect_ratio(yawn) >= 0.6


# ---- analyzer ----------------------------------------------------------------------

def test_single_closed_frame_does_not_trigger():
    a = DrowsinessAnalyzer(DrowsinessConfig(), fps=5.0)
    state = a.ingest(FrameSignals(ear=0.10, mar=0.2))  # one closed frame
    assert state.level == "alert"  # temporal smoothing: no instant alarm


def test_sustained_closure_escalates_to_microsleep():
    cfg = DrowsinessConfig(microsleep_seconds=2.0)
    a = DrowsinessAnalyzer(cfg, fps=5.0)
    state = None
    for _ in range(15):  # 15 frames @ 5fps = 3s of continuous closure
        state = a.ingest(FrameSignals(ear=0.10, mar=0.2))
    assert state is not None and state.level == "microsleep"
    assert state.eyes_closed_seconds >= 2.0


def test_no_face_is_reported():
    a = DrowsinessAnalyzer(DrowsinessConfig(), fps=5.0)
    state = a.ingest(FrameSignals(face_found=False))
    assert state.level == "no_face"


# ---- scenario ----------------------------------------------------------------------

def test_scenario_produces_all_levels():
    """Feed a realistic alert -> drowsy -> microsleep -> face-lost sequence and confirm
    the analyzer surfaces every level (the live browser feed drives the same path)."""
    fps = 5.0
    analyzer = DrowsinessAnalyzer(DrowsinessConfig(), fps=fps)
    levels = set()

    # Alert baseline.
    for _ in range(10):
        levels.add(analyzer.ingest(FrameSignals(ear=0.30, mar=0.18, face_found=True)).level)
    # Drowsy: frequent partial closures push PERCLOS up.
    for i in range(40):
        ear = 0.15 if (i % 5) < 2 else 0.28
        levels.add(analyzer.ingest(FrameSignals(ear=ear, mar=0.20, face_found=True)).level)
    # Microsleep: eyes held shut continuously.
    for _ in range(25):
        levels.add(analyzer.ingest(FrameSignals(ear=0.10, mar=0.20, face_found=True)).level)
    # Face lost.
    for _ in range(10):
        levels.add(analyzer.ingest(FrameSignals(ear=0.0, mar=0.0, face_found=False)).level)

    assert {"alert", "drowsy", "microsleep", "no_face"} <= levels


def test_ingest_endpoint_marks_session_live():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/driver/ingest",
            json={"ear": 0.3, "mar": 0.18, "face_found": True},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["live"] is True
        assert body["state"]["ear"] == 0.3
