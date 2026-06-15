"""Tests for forward-camera road features: hazard, lane departure, forward collision."""

from __future__ import annotations

from app.features.road_perception.collision import (
    ForwardCollisionAnalyzer,
    ForwardSignals,
)
from app.features.road_perception.hazard import (
    HazardAnalyzer,
    HazardDetection,
    HazardFrame,
)
from app.features.road_perception.lane import LaneAnalyzer, LaneSignals


# ---- Hazard ------------------------------------------------------------------------

def _hz(kind: str, area: float) -> HazardFrame:
    return HazardFrame(detections=[HazardDetection(kind=kind, area_ratio=area, confidence=0.9)])


def test_empty_road_is_clear():
    a = HazardAnalyzer()
    assert a.ingest(HazardFrame()).level == "clear"


def test_single_frame_does_not_confirm_hazard():
    a = HazardAnalyzer(confirm_frames=2)
    assert a.ingest(_hz("person", 0.10)).level == "clear"  # needs 2 consecutive


def test_sustained_near_hazard_warns_then_imminent():
    a = HazardAnalyzer(confirm_frames=2)
    a.ingest(_hz("person", 0.10))
    assert a.ingest(_hz("person", 0.10)).level == "hazard"
    a.ingest(_hz("person", 0.25))
    assert a.ingest(_hz("person", 0.25)).level == "imminent"


def test_hazard_scenario_reaches_imminent():
    """A pedestrian looming closer (growing box) crosses warning then imminent, as the
    browser's posted area_ratio would."""
    a = HazardAnalyzer()
    levels = {a.ingest(HazardFrame()).level}  # clear road
    for area in (0.07, 0.10, 0.14, 0.20, 0.25):  # box grows as it nears
        levels.add(a.ingest(_hz("person", area)).level)
        levels.add(a.ingest(_hz("person", area)).level)
    assert "imminent" in levels and "clear" in levels


# ---- Lane --------------------------------------------------------------------------

def test_centered_driving_is_calm():
    a = LaneAnalyzer()
    assert a.ingest(LaneSignals(offset=0.05)).level == "centered"


def test_unsignaled_sustained_drift_is_departure():
    a = LaneAnalyzer()
    state = None
    for _ in range(6):
        state = a.ingest(LaneSignals(offset=-0.9, turn_signal=False))
    assert state is not None and state.level == "departure"
    assert state.side == "left"


def test_signaled_lane_change_does_not_alarm():
    a = LaneAnalyzer()
    state = None
    for _ in range(6):
        state = a.ingest(LaneSignals(offset=0.9, turn_signal=True))
    assert state is not None and state.level == "centered"


def test_lost_lane_lines_report_no_lane():
    a = LaneAnalyzer()
    assert a.ingest(LaneSignals(lane_found=False)).level == "no_lane"


def test_lane_scenario_produces_departure():
    """Centered driving, an unsignaled drift-out to a departure, then lost lane lines —
    the same offset stream the browser CV would post."""
    a = LaneAnalyzer()
    levels = set()
    for _ in range(5):  # centered
        levels.add(a.ingest(LaneSignals(offset=0.05)).level)
    for _ in range(6):  # unsignaled drift to the left line
        levels.add(a.ingest(LaneSignals(offset=-0.9, turn_signal=False)).level)
    for _ in range(3):  # lane lines lost
        levels.add(a.ingest(LaneSignals(lane_found=False)).level)
    assert "departure" in levels and "no_lane" in levels


# ---- Forward collision -------------------------------------------------------------

def test_no_lead_vehicle_is_clear():
    a = ForwardCollisionAnalyzer()
    assert a.ingest(ForwardSignals(lead_present=False)).level == "clear"


def test_fast_closing_triggers_collision_warning():
    a = ForwardCollisionAnalyzer()
    # 10m gap, closing at 8 m/s -> TTC 1.25s < 2.5s.
    state = a.ingest(ForwardSignals(lead_present=True, distance_m=10.0,
                                    closing_speed_mps=8.0, ego_speed_kph=70.0))
    assert state.level == "warning"
    assert state.ttc_seconds is not None and state.ttc_seconds < 2.5


def test_close_steady_following_is_tailgating():
    a = ForwardCollisionAnalyzer()
    # 12m gap at 60 km/h (~16.7 m/s) -> headway ~0.72s < 1.0s, not closing.
    state = a.ingest(ForwardSignals(lead_present=True, distance_m=12.0,
                                    closing_speed_mps=0.0, ego_speed_kph=60.0))
    assert state.level == "tailgating"


def test_forward_scenario_reaches_warning():
    """Open road, steady tailgating, then a hard-closing lead vehicle — the distance/closing
    estimates the browser posts from the lead box geometry."""
    a = ForwardCollisionAnalyzer()
    levels = {a.ingest(ForwardSignals(lead_present=False)).level}  # open road
    # Steady close following (tailgating, not closing fast).
    levels.add(a.ingest(ForwardSignals(lead_present=True, distance_m=12.0,
                                       closing_speed_mps=0.0, ego_speed_kph=60.0)).level)
    # Lead brakes / we close in fast -> short TTC.
    for distance in (24.0, 18.0, 12.0, 6.0):
        levels.add(a.ingest(ForwardSignals(lead_present=True, distance_m=distance,
                                           closing_speed_mps=8.0, ego_speed_kph=70.0)).level)
    assert "warning" in levels and "clear" in levels


# ---- API smoke ---------------------------------------------------------------------

def test_road_feature_endpoints_respond():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        for path in ("/api/v1/road/hazards", "/api/v1/road/lane", "/api/v1/road/forward-collision"):
            assert client.get(path).status_code == 200
