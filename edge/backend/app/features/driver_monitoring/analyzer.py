"""Temporal drowsiness analyzer.

Single-frame signals are noisy and must never trigger an alert on their own. This
analyzer maintains a short rolling history and derives smoothed indicators:

  * **PERCLOS** — the fraction of recent frames in which the eyes were closed. The most
    established drowsiness measure.
  * **continuous eye-closure** — how long the eyes have been closed *right now*; a long
    closure is a microsleep (the most dangerous signal).
  * **yawn rate** — yawns in the last 60 seconds (rising-edge counted, so one long yawn
    counts once).

It is pure and deterministic (time is derived from the frame count and fps), so it can be
unit-tested without any camera or wall-clock.
"""

from __future__ import annotations

from collections import deque

from app.features.driver_monitoring.schemas import (
    DrowsinessConfig,
    DrowsinessState,
    FrameSignals,
)


class DrowsinessAnalyzer:
    """Consumes per-frame signals and reports a smoothed drowsiness state."""

    def __init__(self, config: DrowsinessConfig, fps: float) -> None:
        if fps <= 0:
            raise ValueError("fps must be positive")
        self._cfg = config
        self._fps = fps
        self._window = max(1, int(config.window_seconds * fps))
        # PERCLOS is unreliable until the window holds enough samples — otherwise a single
        # closed frame reads as 100% closed. Require the window to be at least half full
        # (with a small absolute floor) before PERCLOS may raise a "drowsy" alert.
        self._perclos_min_frames = max(3, self._window // 2)

        # Rolling window of (face_found, eyes_closed) for PERCLOS.
        self._frames: deque[tuple[bool, bool]] = deque(maxlen=self._window)

        self._frame_index = 0
        self._consec_closed = 0           # consecutive closed frames right now
        self._was_yawning = False
        self._yawn_times: deque[float] = deque()  # timestamps (s) of yawn rising edges

    @property
    def fps(self) -> float:
        return self._fps

    def ingest(self, signals: FrameSignals) -> DrowsinessState:
        """Add one frame of signals and return the current smoothed state."""
        self._frame_index += 1
        now = self._frame_index / self._fps

        eyes_closed = signals.face_found and signals.ear < self._cfg.ear_closed_threshold
        self._frames.append((signals.face_found, eyes_closed))

        # Continuous closure (microsleep) tracking.
        self._consec_closed = self._consec_closed + 1 if eyes_closed else 0
        eyes_closed_seconds = self._consec_closed / self._fps

        # Yawn detection on the rising edge of mouth-open, counted over a 60s memory.
        yawning = signals.face_found and signals.mar >= self._cfg.mar_yawn_threshold
        if yawning and not self._was_yawning:
            self._yawn_times.append(now)
        self._was_yawning = yawning
        while self._yawn_times and now - self._yawn_times[0] > 60.0:
            self._yawn_times.popleft()
        yawns_per_minute = float(len(self._yawn_times))

        # PERCLOS over the window, using only frames where a face was actually found.
        face_frames = [closed for found, closed in self._frames if found]
        perclos = (sum(face_frames) / len(face_frames)) if face_frames else 0.0
        perclos_reliable = len(face_frames) >= self._perclos_min_frames

        level = self._classify(
            signals, eyes_closed_seconds, perclos, perclos_reliable, yawns_per_minute
        )

        return DrowsinessState(
            level=level,
            perclos=round(perclos, 3),
            eyes_closed_seconds=round(eyes_closed_seconds, 2),
            yawns_per_minute=yawns_per_minute,
            ear=round(signals.ear, 3),
            mar=round(signals.mar, 3),
        )

    def _classify(
        self,
        signals: FrameSignals,
        eyes_closed_seconds: float,
        perclos: float,
        perclos_reliable: bool,
        yawns_per_minute: float,
    ) -> str:
        if not signals.face_found:
            return "no_face"
        if eyes_closed_seconds >= self._cfg.microsleep_seconds:
            return "microsleep"
        drowsy_by_perclos = perclos_reliable and perclos >= self._cfg.perclos_warn
        drowsy_by_yawning = yawns_per_minute >= self._cfg.yawns_per_minute_warn
        if drowsy_by_perclos or drowsy_by_yawning:
            return "drowsy"
        return "alert"
