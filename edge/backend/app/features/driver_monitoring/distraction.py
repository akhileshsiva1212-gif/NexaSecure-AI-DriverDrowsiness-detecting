"""Temporal driver-distraction analyzer ("eyes off the road").

Like the drowsiness analyzer, a single frame must never raise an alert on its own — a
quick mirror/instrument glance is normal and safe. This analyzer maintains a short rolling
history of the per-frame head-pose/gaze signals and derives smoothed indicators:

  * **off-road fraction** — the fraction of recent frames in which the driver was looking
    away from the road. Sustained high fraction -> "distracted".
  * **continuous off-road time** — how long the driver has been looking away *right now*;
    a long continuous look-away is the dangerous "eyes_off_road" signal.

Per frame, the dominant axis (head yaw, head pitch, or gaze) decides the look direction.
It is pure and deterministic (time is derived from the frame count and fps), so it can be
unit-tested without any camera or wall-clock.
"""

from __future__ import annotations

from collections import deque

from app.features.driver_monitoring.schemas import (
    DistractionConfig,
    DistractionState,
    FrameSignals,
)


class DistractionAnalyzer:
    """Consumes per-frame head-pose/gaze signals and reports a smoothed distraction state."""

    def __init__(self, config: DistractionConfig, fps: float) -> None:
        if fps <= 0:
            raise ValueError("fps must be positive")
        self._cfg = config
        self._fps = fps
        self._window = max(1, int(config.window_seconds * fps))
        # The off-road fraction is unreliable until the window holds enough samples.
        self._min_frames = max(3, self._window // 2)

        # Rolling window of (face_found, off_road) for the off-road fraction.
        self._frames: deque[tuple[bool, bool]] = deque(maxlen=self._window)

        self._frame_index = 0
        self._consec_off = 0  # consecutive off-road frames right now

    @property
    def fps(self) -> float:
        return self._fps

    def _direction(self, signals: FrameSignals) -> str:
        """Classify the look direction for one frame from the dominant axis."""
        cfg = self._cfg
        if abs(signals.yaw) >= cfg.yaw_threshold:
            return "right" if signals.yaw > 0 else "left"
        if signals.pitch >= cfg.pitch_neutral + cfg.pitch_down_delta:
            return "down"
        if signals.pitch <= cfg.pitch_neutral - cfg.pitch_up_delta:
            return "up"
        if abs(signals.gaze) >= cfg.gaze_threshold:
            return "right" if signals.gaze > 0 else "left"
        return "forward"

    def ingest(self, signals: FrameSignals) -> DistractionState:
        """Add one frame of signals and return the current smoothed state."""
        self._frame_index += 1

        direction = self._direction(signals) if signals.face_found else "forward"
        off_road = signals.face_found and direction != "forward"
        self._frames.append((signals.face_found, off_road))

        # Continuous look-away (the dangerous signal) tracking.
        self._consec_off = self._consec_off + 1 if off_road else 0
        off_road_seconds = self._consec_off / self._fps

        # Off-road fraction over the window, using only frames where a face was found.
        face_frames = [away for found, away in self._frames if found]
        off_road_ratio = (sum(face_frames) / len(face_frames)) if face_frames else 0.0
        ratio_reliable = len(face_frames) >= self._min_frames

        level = self._classify(signals, off_road, off_road_seconds, off_road_ratio, ratio_reliable)

        return DistractionState(
            level=level,
            off_road_ratio=round(off_road_ratio, 3),
            off_road_seconds=round(off_road_seconds, 2),
            direction=direction,
            yaw=round(signals.yaw, 3),
            pitch=round(signals.pitch, 3),
            gaze=round(signals.gaze, 3),
        )

    def _classify(
        self,
        signals: FrameSignals,
        off_road: bool,
        off_road_seconds: float,
        off_road_ratio: float,
        ratio_reliable: bool,
    ) -> str:
        if not signals.face_found:
            return "no_face"
        if off_road and off_road_seconds >= self._cfg.eyes_off_road_seconds:
            return "eyes_off_road"
        if ratio_reliable and off_road_ratio >= self._cfg.off_road_warn:
            return "distracted"
        return "attentive"
