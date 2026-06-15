"""SOS / Emergency service — an armed-countdown state machine.

States: ``idle`` -> ``armed`` (countdown ticking) -> ``dispatched`` (timer elapsed) or back to
``idle`` (cancelled). It auto-arms by subscribing to the event bus and reacting to crash-class
advisories from the fusion and forward-collision features; it can also be armed/cancelled
manually from the dashboard.
"""

from __future__ import annotations

import asyncio
import time

from app.core.config import get_settings
from app.core.logging import get_logger
from app.decision_engine import decision_engine
from app.events import event_bus
from app.events.types import AdvisoryEvent, FeatureDomain, Severity

logger = get_logger("feature.sos")

# Advisory types that automatically arm SOS.
_AUTO_ARM_TYPES = {"accident_risk_high", "collision_warning"}


class SosService:
    """Arms a cancelable emergency countdown and dispatches if it is not cancelled."""

    def __init__(self) -> None:
        self._countdown = get_settings().sos_countdown_seconds
        self._state = "idle"          # "idle" | "armed" | "dispatched"
        self._reason = ""
        self._auto = False            # True if armed automatically (vs. manual button)
        self._armed_at = 0.0          # monotonic timestamp when armed
        self._task: asyncio.Task | None = None

    # ---- introspection ----

    def status(self) -> dict:
        remaining = 0.0
        if self._state == "armed":
            remaining = max(0.0, self._countdown - (time.monotonic() - self._armed_at))
        return {
            "state": self._state,
            "reason": self._reason,
            "auto": self._auto,
            "countdown_seconds": self._countdown,
            "seconds_remaining": round(remaining, 1),
        }

    # ---- control ----

    def arm(self, reason: str, auto: bool = False) -> dict:
        """Begin the emergency countdown (no-op if already armed or dispatched)."""
        if self._state == "armed":
            return self.status()
        self._state = "armed"
        self._reason = reason
        self._auto = auto
        self._armed_at = time.monotonic()
        self._task = asyncio.create_task(self._countdown_then_dispatch())
        logger.warning("SOS armed (%s): %s", "auto" if auto else "manual", reason)
        return self.status()

    def cancel(self) -> dict:
        """Cancel an armed countdown and return to idle (no-op if not armed)."""
        if self._state != "armed":
            return self.status()
        if self._task and not self._task.done():
            self._task.cancel()
        self._state = "idle"
        logger.info("SOS cancelled by driver")
        self._reason = ""
        self._auto = False
        return self.status()

    def reset(self) -> dict:
        """Clear a dispatched state back to idle (after an incident is handled)."""
        if self._state == "dispatched":
            self._state = "idle"
            self._reason = ""
            self._auto = False
        return self.status()

    async def _countdown_then_dispatch(self) -> None:
        try:
            await asyncio.sleep(self._countdown)
        except asyncio.CancelledError:
            return
        await self._dispatch()

    async def _dispatch(self) -> None:
        self._state = "dispatched"
        logger.error("SOS DISPATCHED: %s", self._reason)
        await decision_engine.submit(AdvisoryEvent(
            domain=FeatureDomain.SOS,
            type="sos_dispatched",
            severity=Severity.CRITICAL,
            message="Emergency SOS dispatched — contacting emergency services.",
            data={"reason": self._reason, "auto": self._auto},
        ))

    # ---- auto-arming via the event bus ----

    async def _on_event(self, event: AdvisoryEvent) -> None:
        if event.type in _AUTO_ARM_TYPES and self._state == "idle":
            self.arm(reason=f"Auto: {event.message}", auto=True)

    def register(self) -> None:
        """Subscribe to the event bus so crash-class advisories auto-arm SOS."""
        event_bus.subscribe(self._on_event)

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


service = SosService()
