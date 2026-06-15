"""Tests for driver distraction: head-pose/gaze geometry, analyzer transitions, scenario."""

from __future__ import annotations

from app.features.driver_monitoring.distraction import DistractionAnalyzer
from app.features.driver_monitoring.geometry import (
    gaze_offset,
    head_pitch_ratio,
    head_yaw_ratio,
)
from app.features.driver_monitoring.schemas import DistractionConfig, FrameSignals


# ---- geometry ----------------------------------------------------------------------

def test_yaw_is_zero_looking_forward_and_positive_turned_right():
    left_face, right_face = (0.0, 0.0), (10.0, 0.0)
    assert head_yaw_ratio((5.0, 0.0), left_face, right_face) == 0.0       # centered
    assert head_yaw_ratio((8.0, 0.0), left_face, right_face) > 0.3        # nose near right


def test_pitch_increases_as_the_nose_drops_toward_the_chin():
    eye_mid, chin = (0.0, 0.0), (0.0, 10.0)
    forward = head_pitch_ratio(eye_mid, (0.0, 5.0), chin)
    looking_down = head_pitch_ratio(eye_mid, (0.0, 8.0), chin)
    assert looking_down > forward


def test_gaze_is_zero_centered_and_signed_toward_a_corner():
    inner, outer = (0.0, 0.0), (10.0, 0.0)
    assert gaze_offset((5.0, 0.0), inner, outer) == 0.0     # iris centered
    assert gaze_offset((8.0, 0.0), inner, outer) > 0.2      # toward the outer corner


# ---- analyzer ----------------------------------------------------------------------

def test_single_glance_does_not_trigger():
    a = DistractionAnalyzer(DistractionConfig(), fps=5.0)
    state = a.ingest(FrameSignals(face_found=True, yaw=0.5))  # one frame looking aside
    assert state.level == "attentive"          # temporal smoothing: no instant alarm
    assert state.direction == "right"


def test_sustained_look_away_escalates_to_eyes_off_road():
    cfg = DistractionConfig(eyes_off_road_seconds=2.5)
    a = DistractionAnalyzer(cfg, fps=5.0)
    state = None
    for _ in range(15):  # 15 frames @ 5fps = 3s of continuous look-away
        state = a.ingest(FrameSignals(face_found=True, yaw=0.5))
    assert state is not None and state.level == "eyes_off_road"
    assert state.off_road_seconds >= 2.5


def test_no_face_is_reported():
    a = DistractionAnalyzer(DistractionConfig(), fps=5.0)
    state = a.ingest(FrameSignals(face_found=False))
    assert state.level == "no_face"


# ---- scenario ----------------------------------------------------------------------

def test_scenario_produces_all_levels():
    """Feed an attentive -> distracted -> eyes-off-road -> face-lost sequence and confirm
    the analyzer surfaces every level (the live browser feed drives the same path)."""
    fps = 5.0
    analyzer = DistractionAnalyzer(DistractionConfig(), fps=fps)
    levels = set()

    # Attentive, looking forward.
    for _ in range(10):
        levels.add(analyzer.ingest(
            FrameSignals(ear=0.30, mar=0.18, face_found=True, yaw=0.0, pitch=0.5, gaze=0.0)
        ).level)
    # Frequent glancing aside (~75% off-road) -> distracted.
    for i in range(25):
        looking_away = (i % 4) < 3
        levels.add(analyzer.ingest(
            FrameSignals(ear=0.30, mar=0.18, face_found=True, yaw=0.5 if looking_away else 0.0)
        ).level)
    # Sustained look-down -> eyes_off_road.
    for _ in range(25):
        levels.add(analyzer.ingest(
            FrameSignals(ear=0.30, mar=0.18, face_found=True, pitch=0.9)
        ).level)
    # Face lost.
    for _ in range(10):
        levels.add(analyzer.ingest(FrameSignals(face_found=False)).level)

    assert {"attentive", "distracted", "eyes_off_road", "no_face"} <= levels


def test_ingest_endpoint_returns_distraction_block():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/driver/ingest",
            json={"ear": 0.3, "mar": 0.18, "face_found": True,
                  "yaw": 0.0, "pitch": 0.5, "gaze": 0.0},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "distraction" in body
        assert body["distraction"]["state"]["direction"] == "forward"
