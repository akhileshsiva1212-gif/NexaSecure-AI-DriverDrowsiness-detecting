"""Vehicle Health monitoring service.

Mirrors the driver-camera model: **real engine data is shown only when an OBD-II adapter
is actually connected.** With no adapter the monitor stays disconnected and reports no
readings — it never fabricates numbers. The only source is the real read-only ELM327/serial
adapter; connect it at runtime via POST /vehicle/connection {"mode": "serial"} or on startup
with NEXA_OBD_SOURCE=serial.

    OBD source (when connected) -> evaluate -> decision engine -> event bus -> dashboard
"""

from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import repository
from app.decision_engine import decision_engine
from app.events.types import AdvisoryEvent, FeatureDomain
from app.features.vehicle_health.obd_source import make_obd_source
from app.features.vehicle_health.schemas import VehicleReading, evaluate
from app.features.vehicle_health.serial_source import ObdConnectionError

logger = get_logger("feature.vehicle_health")

# Connection modes: "none" = disconnected; "serial" = real read-only ELM327 adapter.
VALID_MODES = ("none", "serial")


class VehicleHealthMonitor:
    """Polls a connected OBD source; idle (and honest) when nothing is connected."""

    def __init__(self) -> None:
        settings = get_settings()
        self._poll_seconds = settings.obd_poll_seconds
        self._auto_mode = settings.obd_source  # what to connect on startup (may be "none")
        self._source = None
        self._mode = "none"
        self._latest: VehicleReading | None = None
        self._task: asyncio.Task | None = None

    @property
    def connected(self) -> bool:
        return self._source is not None

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def latest(self) -> VehicleReading | None:
        return self._latest

    def connect(self, mode: str) -> None:
        """Connect an OBD source. Raises on an unsupported/unavailable adapter."""
        if mode not in VALID_MODES:
            raise ValueError(f"mode must be one of {VALID_MODES}")
        if mode == "none":
            self.disconnect()
            return
        source = make_obd_source(mode)  # may raise NotImplementedError for "serial"
        self._source = source
        self._mode = mode
        logger.info("OBD connected (mode=%s)", mode)

    def disconnect(self) -> None:
        # Release a real serial adapter cleanly (stops its background poll thread).
        close = getattr(self._source, "close", None)
        if callable(close):
            close()
        self._source = None
        self._mode = "none"
        self._latest = None
        logger.info("OBD disconnected")

    async def _poll_once(self) -> None:
        if self._source is None:
            return
        reading = self._source.read()
        self._latest = reading
        repository.save_telemetry(reading.model_dump())
        for finding in evaluate(reading):
            await decision_engine.submit(AdvisoryEvent(
                domain=FeatureDomain.VEHICLE,
                type=finding.type,
                severity=finding.severity,
                message=finding.message,
                data={"value": finding.value, "mode": self._mode,
                      "reading": reading.model_dump()},
            ))

    async def _run(self) -> None:
        logger.info("vehicle health monitor started (poll=%ss)", self._poll_seconds)
        while True:
            try:
                await self._poll_once()  # no-op while disconnected
            except Exception as exc:  # noqa: BLE001 - keep the loop alive
                logger.error("poll failed: %r", exc)
            await asyncio.sleep(self._poll_seconds)

    def start(self) -> None:
        # Auto-connect only if explicitly configured (default "none" stays disconnected).
        if self._auto_mode and self._auto_mode != "none":
            try:
                self.connect(self._auto_mode)
            except (NotImplementedError, ObdConnectionError) as exc:
                logger.warning("configured OBD adapter '%s' unavailable (%s); staying disconnected",
                               self._auto_mode, exc)
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


monitor = VehicleHealthMonitor()
