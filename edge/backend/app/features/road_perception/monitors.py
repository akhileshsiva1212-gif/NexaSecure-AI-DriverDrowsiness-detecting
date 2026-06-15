"""Monitors for the forward-camera road features (hazard, lane, forward-collision).

These three share the exact runtime shape already established by the driver monitors: real
browser frames arrive via `ingest_external()` (live priority), and edge-triggered advisories
are raised only when the assessed *level changes*. Rather than copy that machinery three times,
`RoadFeatureMonitor` captures it once and is parameterized by the feature's analyzer, optional
local source, and advisory mapping. Detection runs in the browser (MediaPipe ObjectDetector +
OpenCV.js lane CV) and is pushed to the `/road/*` ingest endpoints, so the local source is
normally `None` and the monitor idles until live frames arrive.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from typing import Any, Protocol

from app.core.config import get_settings
from app.core.logging import get_logger
from app.decision_engine import decision_engine
from app.events.types import AdvisoryEvent, FeatureDomain, Severity
from app.features.road_perception.collision import ForwardCollisionAnalyzer, ForwardSignals
from app.features.road_perception.collision import advisory_for as forward_advisory
from app.features.road_perception.hazard import HazardAnalyzer, HazardFrame
from app.features.road_perception.hazard import advisory_for as hazard_advisory
from app.features.road_perception.lane import LaneAnalyzer, LaneSignals
from app.features.road_perception.lane import advisory_for as lane_advisory

logger = get_logger("feature.road_perception")

_LIVE_GRACE_SECONDS = 1.5


class _LevelState(Protocol):
    level: str
    def model_dump(self) -> dict: ...


class _Analyzer(Protocol):
    def ingest(self, signals: Any) -> _LevelState: ...


class _Source(Protocol):
    def read(self) -> Any: ...
    def close(self) -> None: ...


AdvisoryFn = Callable[[Any], tuple[Severity, str, str] | None]


class RoadFeatureMonitor:
    """Runs one road analyzer from either its mock loop or live browser frames."""

    def __init__(
        self,
        name: str,
        analyzer: _Analyzer,
        source: _Source | None,
        advisory_for: AdvisoryFn,
        baseline_level: str,
        fps: float,
    ) -> None:
        self._name = name
        self._analyzer = analyzer
        self._source = source
        self._advisory_for = advisory_for
        self._fps = fps
        self._interval = 1.0 / fps
        self._task: asyncio.Task | None = None
        self._latest: _LevelState | None = None
        self._last_level = baseline_level
        self._last_external = 0.0

    @property
    def latest(self) -> _LevelState | None:
        return self._latest

    def is_live(self) -> bool:
        return (time.monotonic() - self._last_external) <= _LIVE_GRACE_SECONDS

    async def _process(self, signals: Any) -> _LevelState:
        state = self._analyzer.ingest(signals)
        self._latest = state
        if state.level != self._last_level:
            advisory = self._advisory_for(state)
            if advisory is not None:
                severity, type_, message = advisory
                await decision_engine.submit(AdvisoryEvent(
                    domain=FeatureDomain.ROAD,
                    type=type_,
                    severity=severity,
                    message=message,
                    data={**state.model_dump(), "source": "live" if self.is_live() else "mock"},
                ))
            self._last_level = state.level
        return state

    async def ingest_external(self, signals: Any) -> _LevelState:
        self._last_external = time.monotonic()
        return await self._process(signals)

    async def _run(self) -> None:
        logger.info("%s monitor started (fps=%s)", self._name, self._fps)
        while True:
            try:
                # Live browser frames take priority; only poll a local source while idle.
                if self._source is not None and not self.is_live():
                    await self._process(self._source.read())
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("%s poll failed: %r", self._name, exc)
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


_fps = get_settings().road_fps

# Detection runs in the browser and is pushed to the /road/* ingest endpoints, so these
# monitors carry no local source (source=None) and idle until live frames arrive.
hazard_monitor = RoadFeatureMonitor(
    "hazard", HazardAnalyzer(), None, hazard_advisory,
    baseline_level="clear", fps=_fps,
)
lane_monitor = RoadFeatureMonitor(
    "lane", LaneAnalyzer(), None, lane_advisory,
    baseline_level="centered", fps=_fps,
)
forward_monitor = RoadFeatureMonitor(
    "forward_collision", ForwardCollisionAnalyzer(), None, forward_advisory,
    baseline_level="clear", fps=_fps,
)

# Re-exported so routes can parse the right payload type per endpoint.
__all__ = [
    "hazard_monitor", "lane_monitor", "forward_monitor",
    "HazardFrame", "LaneSignals", "ForwardSignals",
]
