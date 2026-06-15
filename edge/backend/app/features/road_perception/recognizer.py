"""Temporal traffic-sign recognizer.

A single road-camera frame must never confirm a sign on its own — a momentary false
positive (a red billboard, a reflection) should not flash a "Stop sign ahead" advisory.
This recognizer requires a sign to persist across several consecutive frames before it is
*confirmed* and shown to the driver.

Behavior:

  * Per frame, the highest-confidence detection of each kind (above `min_confidence`) is
    considered "seen". A streak counter per (kind, value) increments while the sign keeps
    appearing and resets the moment a frame misses it.
  * When a streak reaches `confirm_frames`, the sign is *newly confirmed*: it is added to
    the recent-signs history, becomes the active speed limit (for speed-limit signs), and
    is returned in `newly_confirmed` so the service can raise a single advisory for it.
  * A sign already confirmed will not re-confirm until its streak has lapsed and rebuilt,
    so a sign lingering in view does not spam the history or the advisory pipeline.

It is pure and deterministic (no camera, no wall-clock), so it can be unit-tested by
feeding hand-built `SignFrame`s.
"""

from __future__ import annotations

from collections import deque

from app.features.road_perception.schemas import (
    RecognizedSign,
    RecognizerConfig,
    SignFrame,
    TrafficSignState,
    label_for,
)


def _key(kind: str, value: int | None) -> tuple[str, int | None]:
    return (kind, value)


class TrafficSignRecognizer:
    """Consumes per-frame sign detections and reports a temporally-confirmed state."""

    def __init__(self, config: RecognizerConfig) -> None:
        if config.confirm_frames < 1:
            raise ValueError("confirm_frames must be >= 1")
        self._cfg = config
        self._streaks: dict[tuple[str, int | None], int] = {}
        self._confirmed_keys: set[tuple[str, int | None]] = set()
        self._history: deque[RecognizedSign] = deque(maxlen=config.history_size)
        self._active_speed_limit: int | None = None
        # Signs confirmed on the most recent ingest() call (for edge-triggered advisories).
        self.newly_confirmed: list[RecognizedSign] = []

    def ingest(self, frame: SignFrame) -> TrafficSignState:
        """Add one frame of detections and return the current confirmed state."""
        self.newly_confirmed = []

        # Best detection per kind this frame, ignoring anything below the confidence floor.
        best: dict[str, tuple[int | None, float]] = {}
        for det in frame.detections:
            if det.confidence < self._cfg.min_confidence:
                continue
            current = best.get(det.kind)
            if current is None or det.confidence > current[1]:
                best[det.kind] = (det.value, det.confidence)

        seen_keys = {_key(kind, value) for kind, (value, _) in best.items()}

        # Decay streaks for signs no longer in view; clear their confirmed latch so they
        # can be confirmed again on a future re-appearance.
        for key in list(self._streaks):
            if key not in seen_keys:
                self._streaks[key] = 0
                self._confirmed_keys.discard(key)

        # Advance streaks for signs in view and confirm any that cross the threshold.
        for key in seen_keys:
            self._streaks[key] = self._streaks.get(key, 0) + 1
            if (
                self._streaks[key] >= self._cfg.confirm_frames
                and key not in self._confirmed_keys
            ):
                self._confirm(key)

        return self.state()

    def _confirm(self, key: tuple[str, int | None]) -> None:
        kind, value = key
        self._confirmed_keys.add(key)
        sign = RecognizedSign(kind=kind, value=value, label=label_for(kind, value))
        self._history.appendleft(sign)
        self.newly_confirmed.append(sign)
        if kind == "speed_limit" and value is not None:
            self._active_speed_limit = value

    def state(self) -> TrafficSignState:
        """Current aggregated state for the dashboard (newest signs first)."""
        return TrafficSignState(
            active_speed_limit=self._active_speed_limit,
            signs=list(self._history),
        )
