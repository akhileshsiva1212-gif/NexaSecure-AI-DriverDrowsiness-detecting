"""Driver drowsiness monitoring service.

Two frame inputs feed the SAME analyzer + decision pipeline:

  1. A background source loop (mock by default) — runs with no hardware.
  2. Externally pushed frames via `ingest_external()` — used by the browser dashboard, which
     runs MediaPipe FaceLandmarker on the real webcam and posts the computed EAR/MAR.

**Live priority:** while real frames are arriving, the background mock loop pauses, so opening
the camera seamlessly takes over and closing it lets the mock resume.

**Edge-triggered alerting:** an advisory is submitted only when the drowsiness *level
escalates* (e.g. alert -> drowsy -> microsleep), not on every frame — so a sustained
microsleep does not emit its critical alert dozens of times per second.

Privacy: only numeric signals (EAR/MAR/face-found) ever reach this service. Raw camera frames
stay in the browser and are never sent, stored, or logged.
"""

from __future__ import annotations

import asyncio
import time

from app.core.config import get_settings
from app.core.logging import get_logger
from app.decision_engine import decision_engine
from app.events.types import AdvisoryEvent, FeatureDomain, Severity
from app.features.driver_monitoring.analyzer import DrowsinessAnalyzer
from app.features.driver_monitoring.distraction import DistractionAnalyzer
from app.features.driver_monitoring.schemas import (
    DistractionConfig,
    DistractionState,
    DrowsinessConfig,
    DrowsinessState,
    FrameSignals,
)
from app.features.driver_monitoring.sources import make_distraction_source, make_frame_source

logger = get_logger("feature.drowsiness")

# How long after the last real frame we keep treating the camera as "live" (seconds).
_LIVE_GRACE_SECONDS = 1.5

# Map an analyzer level to an advisory (severity, type, driver-facing message).
# "alert" produces no advisory; it is the safe baseline.
_LEVEL_ADVISORY: dict[str, tuple[Severity, str, str]] = {
    "drowsy": (
        Severity.WARNING,
        "driver_drowsy",
        "Signs of drowsiness detected — consider taking a break.",
    ),
    "microsleep": (
        Severity.CRITICAL,
        "driver_microsleep",
        "Microsleep detected — eyes closed too long. Pull over safely.",
    ),
    "no_face": (
        Severity.INFO,
        "driver_no_face",
        "Driver's face not detected by the cabin camera.",
    ),
}


class DrowsinessMonitor:
    """Runs the drowsiness analyzer from either the mock loop or live browser frames."""

    def __init__(self) -> None:
        settings = get_settings()
        self._fps = settings.driver_fps
        self._interval = 1.0 / settings.driver_fps
        self._source = make_frame_source(
            settings.driver_cam_source, fps=settings.driver_fps,
            cam_index=settings.driver_cam_index,
        )
        self._analyzer = DrowsinessAnalyzer(DrowsinessConfig(), fps=settings.driver_fps)
        self._task: asyncio.Task | None = None
        self._latest: DrowsinessState | None = None
        self._last_level = "alert"
        self._last_external = 0.0  # monotonic timestamp of the last pushed frame

    @property
    def latest(self) -> DrowsinessState | None:
        return self._latest

    def is_live(self) -> bool:
        """True when real browser frames have arrived recently (camera is on)."""
        return (time.monotonic() - self._last_external) <= _LIVE_GRACE_SECONDS

    async def _process(self, signals: FrameSignals) -> DrowsinessState:
        """Shared per-frame logic for both the mock loop and live ingest."""
        state = self._analyzer.ingest(signals)
        self._latest = state

        # Edge trigger: only act when the level changes.
        if state.level != self._last_level:
            advisory = _LEVEL_ADVISORY.get(state.level)
            if advisory is not None:
                severity, type_, message = advisory
                await decision_engine.submit(AdvisoryEvent(
                    domain=FeatureDomain.DRIVER,
                    type=type_,
                    severity=severity,
                    message=message,
                    data={
                        "level": state.level,
                        "perclos": state.perclos,
                        "eyes_closed_seconds": state.eyes_closed_seconds,
                        "yawns_per_minute": state.yawns_per_minute,
                        "source": "live" if self.is_live() else "mock",
                    },
                ))
            self._last_level = state.level
        return state

    async def ingest_external(self, signals: FrameSignals) -> DrowsinessState:
        """Feed one real frame's signals (from the browser webcam) into the pipeline."""
        self._last_external = time.monotonic()
        return await self._process(signals)

    async def _poll_once(self) -> None:
        await self._process(self._source.read())

    async def _run(self) -> None:
        source_name = type(self._source).__name__ if self._source else "external"
        logger.info("drowsiness monitor started (fps=%s, source=%s)", self._fps, source_name)
        while True:
            try:
                # Live browser frames take priority; only poll a local source while idle.
                if self._source is not None and not self.is_live():
                    await self._poll_once()
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("drowsiness poll failed: %r", exc)
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._source is not None:
            self._source.close()


monitor = DrowsinessMonitor()


# Map a distraction level to an advisory. "attentive" produces none (the safe baseline);
# "no_face" produces none here because the drowsiness monitor already reports a lost face.
_DISTRACTION_ADVISORY: dict[str, tuple[Severity, str, str]] = {
    "distracted": (
        Severity.WARNING,
        "driver_distracted",
        "Eyes off the road — keep your attention forward.",
    ),
    "eyes_off_road": (
        Severity.CRITICAL,
        "driver_eyes_off_road",
        "Eyes off the road too long — look forward now.",
    ),
}


class DistractionMonitor:
    """Runs the distraction analyzer from either the mock loop or live browser frames.

    Mirrors DrowsinessMonitor: the same per-frame head-pose/gaze signals feed both a
    background mock loop (no hardware) and live frames pushed from the browser via
    `ingest_external()`. While real frames flow, the mock loop pauses (live priority).
    Advisories are edge-triggered, fired once per episode when the level escalates.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._fps = settings.driver_fps
        self._interval = 1.0 / settings.driver_fps
        self._source = make_distraction_source(
            settings.driver_cam_source, fps=settings.driver_fps,
            cam_index=settings.driver_cam_index,
        )
        self._analyzer = DistractionAnalyzer(DistractionConfig(), fps=settings.driver_fps)
        self._task: asyncio.Task | None = None
        self._latest: DistractionState | None = None
        self._last_level = "attentive"
        self._last_external = 0.0

    @property
    def latest(self) -> DistractionState | None:
        return self._latest

    def is_live(self) -> bool:
        return (time.monotonic() - self._last_external) <= _LIVE_GRACE_SECONDS

    async def _process(self, signals: FrameSignals) -> DistractionState:
        state = self._analyzer.ingest(signals)
        self._latest = state

        if state.level != self._last_level:
            advisory = _DISTRACTION_ADVISORY.get(state.level)
            if advisory is not None:
                severity, type_, message = advisory
                await decision_engine.submit(AdvisoryEvent(
                    domain=FeatureDomain.DRIVER,
                    type=type_,
                    severity=severity,
                    message=message,
                    data={
                        "level": state.level,
                        "direction": state.direction,
                        "off_road_ratio": state.off_road_ratio,
                        "off_road_seconds": state.off_road_seconds,
                        "source": "live" if self.is_live() else "mock",
                    },
                ))
            self._last_level = state.level
        return state

    async def ingest_external(self, signals: FrameSignals) -> DistractionState:
        self._last_external = time.monotonic()
        return await self._process(signals)

    async def _poll_once(self) -> None:
        await self._process(self._source.read())

    async def _run(self) -> None:
        source_name = type(self._source).__name__ if self._source else "external"
        logger.info("distraction monitor started (fps=%s, source=%s)", self._fps, source_name)
        while True:
            try:
                if self._source is not None and not self.is_live():
                    await self._poll_once()
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("distraction poll failed: %r", exc)
            await asyncio.sleep(self._interval)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._source is not None:
            self._source.close()


distraction_monitor = DistractionMonitor()
