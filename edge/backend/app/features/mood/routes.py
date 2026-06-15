"""My Mood REST routes — persist the wake-up audio preference.

The wake-up sound is chosen by the driver and plays in the browser only when the
drowsiness detector crosses the alert threshold. The backend stores *which* sound is
selected (not the audio data); uploaded files stay on the client. This keeps the
preference durable across reloads without moving any media off-device.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.db import repository

router = APIRouter(prefix="/mood", tags=["mood"])

PREF_KEY = "mood_audio"

# The four selectable sources. The three presets are synthesized in the browser; "uploaded"
# refers to a file the driver added locally (the blob lives in the browser, not here).
AudioOption = Literal["default-alarm", "music-1", "music-2", "uploaded"]


class MoodPreference(BaseModel):
    """The driver's wake-up audio preference."""

    selected: AudioOption = "default-alarm"
    # Display name of the uploaded file, when `selected == "uploaded"`. Just a label.
    uploaded_name: str | None = None
    # Playback volume for the wake-up alert (0.0–1.0); defaults loud.
    volume: float = Field(default=0.9, ge=0.0, le=1.0)


DEFAULT = MoodPreference()


@router.get("")
def get_mood() -> MoodPreference:
    """Return the stored wake-up audio preference (defaults if never set)."""
    stored = repository.get_preference(PREF_KEY)
    if not stored:
        return DEFAULT
    # Validate/coerce stored JSON so an old or malformed row can't break the dashboard.
    return MoodPreference(**stored)


@router.put("")
def set_mood(pref: MoodPreference) -> MoodPreference:
    """Persist the wake-up audio preference."""
    repository.set_preference(PREF_KEY, pref.model_dump())
    return pref
