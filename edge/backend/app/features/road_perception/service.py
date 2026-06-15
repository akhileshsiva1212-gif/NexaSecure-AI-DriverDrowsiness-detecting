"""Traffic Sign Recognition service.

Two frame inputs feed the SAME recognizer + decision pipeline:

  1. A background source loop (mock by default) — runs with no hardware.
  2. Externally pushed frames via `ingest_external()` — used by the browser dashboard, which
     runs a MediaPipe ObjectDetector on the real road camera and posts the detected signs.

**Live priority:** while real frames are arriving, the background mock loop pauses, so
opening the road camera seamlessly takes over and closing it lets the mock resume.

**Edge-triggered advisories:** an advisory is raised only when a sign is *newly confirmed*,
not on every frame it stays in view — so a stop sign held in the camera does not re-fire its
advisory dozens of times. The decision engine additionally debounces non-critical repeats.

Privacy: only the detected sign labels/values ever reach this service. Raw road-camera
frames stay in the browser and are never sent, stored, or logged.
"""

from __future__ import annotations

import asyncio
import time

from app.core.config import get_settings
from app.core.logging import get_logger
from app.decision_engine import decision_engine
from app.events.types import AdvisoryEvent, FeatureDomain
from app.features.road_perception.recognizer import TrafficSignRecognizer
from app.features.road_perception.schemas import (
    RecognizerConfig,
    SignFrame,
    TrafficSignState,
    advisory_for,
)
from app.features.road_perception.sources import make_sign_source

logger = get_logger("feature.traffic_signs")

# How long after the last real frame we keep treating the road camera as "live" (seconds).
_LIVE_GRACE_SECONDS = 1.5


class TrafficSignMonitor:
    """Runs the sign recognizer from either the mock loop or live browser frames."""

    def __init__(self) -> None:
        settings = get_settings()
        self._fps = settings.sign_fps
        self._interval = 1.0 / settings.sign_fps
        self._source = make_sign_source(settings.sign_source, fps=settings.sign_fps)
        self._recognizer = TrafficSignRecognizer(RecognizerConfig())
        self._task: asyncio.Task | None = None
        self._latest: TrafficSignState | None = None
        self._last_external = 0.0  # monotonic timestamp of the last pushed frame

    @property
    def latest(self) -> TrafficSignState | None:
        return self._latest

    def is_live(self) -> bool:
        """True when real browser frames have arrived recently (road camera is on)."""
        return (time.monotonic() - self._last_external) <= _LIVE_GRACE_SECONDS

    async def _process(self, frame: SignFrame) -> TrafficSignState:
        """Shared per-frame logic for both the mock loop and live ingest."""
        state = self._recognizer.ingest(frame)
        self._latest = state

        # Edge trigger: raise an advisory only for signs confirmed on this frame.
        for sign in self._recognizer.newly_confirmed:
            advisory = advisory_for(sign)
            if advisory is None:
                continue
            severity, type_, message = advisory
            await decision_engine.submit(AdvisoryEvent(
                domain=FeatureDomain.ROAD,
                type=type_,
                severity=severity,
                message=message,
                data={
                    "kind": sign.kind,
                    "value": sign.value,
                    "label": sign.label,
                    "active_speed_limit": state.active_speed_limit,
                    "source": "live" if self.is_live() else "mock",
                },
            ))
        return state

    async def ingest_external(self, frame: SignFrame) -> TrafficSignState:
        """Feed one real frame's detections (from the browser road camera) into the pipeline."""
        self._last_external = time.monotonic()
        return await self._process(frame)

    async def _poll_once(self) -> None:
        await self._process(self._source.read())

    async def _run(self) -> None:
        source_name = type(self._source).__name__ if self._source else "external"
        logger.info("traffic sign monitor started (fps=%s, source=%s)", self._fps, source_name)
        while True:
            try:
                # Live browser frames take priority; only poll a local source while idle.
                if self._source is not None and not self.is_live():
                    await self._poll_once()
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("traffic sign poll failed: %r", exc)
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


monitor = TrafficSignMonitor()
