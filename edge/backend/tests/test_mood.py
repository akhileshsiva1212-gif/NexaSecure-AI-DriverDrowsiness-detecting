"""Tests for the My Mood feature: wake-up audio preference get/put + persistence."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


VALID_OPTIONS = {"default-alarm", "music-1", "music-2", "uploaded"}


def test_mood_get_returns_valid_preference():
    # Robust to a persisted dev DB: assert shape/validity, not a specific stored value.
    with TestClient(app) as client:
        r = client.get("/api/v1/mood")
        assert r.status_code == 200
        body = r.json()
        assert body["selected"] in VALID_OPTIONS
        assert 0.0 <= body["volume"] <= 1.0


def test_mood_put_persists_selection():
    with TestClient(app) as client:
        put = client.put(
            "/api/v1/mood",
            json={"selected": "music-2", "uploaded_name": None, "volume": 0.8},
        )
        assert put.status_code == 200
        assert put.json()["selected"] == "music-2"

        # A fresh read reflects the persisted value.
        got = client.get("/api/v1/mood").json()
        assert got["selected"] == "music-2"
        assert got["volume"] == 0.8


def test_mood_put_uploaded_keeps_name():
    with TestClient(app) as client:
        put = client.put(
            "/api/v1/mood",
            json={"selected": "uploaded", "uploaded_name": "my-song.mp3", "volume": 1.0},
        )
        assert put.status_code == 200
        assert put.json()["uploaded_name"] == "my-song.mp3"


def test_mood_rejects_unknown_option():
    with TestClient(app) as client:
        bad = client.put("/api/v1/mood", json={"selected": "siren-9000"})
        assert bad.status_code == 422


def test_mood_rejects_out_of_range_volume():
    with TestClient(app) as client:
        bad = client.put("/api/v1/mood", json={"selected": "music-1", "volume": 5})
        assert bad.status_code == 422
