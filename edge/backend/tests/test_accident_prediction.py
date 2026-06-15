"""Tests for accident-prediction risk fusion."""

from __future__ import annotations

from app.features.accident_prediction.fusion import score_risk

WARN = 50
CRIT = 75


def test_all_baseline_is_low_zero():
    levels = {
        "drowsiness": "alert",
        "distraction": "attentive",
        "forward_collision": "clear",
        "hazard": "clear",
        "lane": "centered",
        "vehicle": "ok",
    }
    state = score_risk(levels, warn=WARN, critical=CRIT)
    assert state.score == 0
    assert state.level == "low"
    assert state.contributors == []


def test_combined_factors_sum_and_sort_desc():
    # drowsy(25) + tailgating(20) + departure(25) = 70 -> elevated (>=50, <75)
    levels = {
        "drowsiness": "drowsy",
        "distraction": "attentive",
        "forward_collision": "tailgating",
        "hazard": "clear",
        "lane": "departure",
        "vehicle": "ok",
    }
    state = score_risk(levels, warn=WARN, critical=CRIT)
    assert state.score == 70
    assert state.level == "elevated"
    # Only contributing sources, highest points first.
    pts = [c.points for c in state.contributors]
    assert pts == sorted(pts, reverse=True)
    assert {c.source for c in state.contributors} == {"drowsiness", "forward_collision", "lane"}


def test_high_band_and_score_caps_at_100():
    # microsleep(45) + eyes_off_road(40) + warning(45) + imminent(40) = 170 -> capped 100, high
    levels = {
        "drowsiness": "microsleep",
        "distraction": "eyes_off_road",
        "forward_collision": "warning",
        "hazard": "imminent",
        "lane": "departure",
        "vehicle": "critical",
    }
    state = score_risk(levels, warn=WARN, critical=CRIT)
    assert state.score == 100
    assert state.level == "high"


def test_unknown_source_or_level_contributes_nothing():
    state = score_risk({"mystery": "boom", "drowsiness": "unknown"}, warn=WARN, critical=CRIT)
    assert state.score == 0
    assert state.level == "low"


def test_fusion_endpoint_responds():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        resp = client.get("/api/v1/fusion/risk")
        assert resp.status_code == 200
        assert "status" in resp.json()
