"""Decision engine — the safety-relevant brain of the backend.

Feature modules submit raw advisories here. The engine applies cross-cutting rules
before an advisory reaches the driver or the dashboard:

  * **Debounce** — suppress repeated identical advisories within a cool-down window so
    the driver is not spammed by the same warning every poll cycle.
  * **Prioritization hook** — severity is attached to every event; higher severities are
    always allowed through immediately, bypassing debounce.

Accepted advisories are published to the shared event bus, which fans them out to the
database and the dashboard. (Fusion across features — e.g. accident prediction — will be
added here in a later phase.)
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.logging import get_logger
from app.events import event_bus
from app.events.types import AdvisoryEvent, Severity

logger = get_logger("decision_engine")

# Per (domain, type) cool-down for non-critical advisories, in seconds.
_DEBOUNCE_SECONDS = 30.0


class DecisionEngine:
    """Applies debounce + prioritization, then publishes accepted advisories."""

    def __init__(self, debounce_seconds: float = _DEBOUNCE_SECONDS) -> None:
        self._debounce_seconds = debounce_seconds
        self._last_emitted: dict[tuple[str, str], datetime] = {}

    async def submit(self, event: AdvisoryEvent) -> bool:
        """Evaluate an advisory. Returns True if it was accepted and published."""
        key = (event.domain.value, event.type)
        now = datetime.now(timezone.utc)

        # Critical advisories always pass — never debounce a safety-critical alert.
        if event.severity is not Severity.CRITICAL:
            last = self._last_emitted.get(key)
            if last is not None and (now - last).total_seconds() < self._debounce_seconds:
                logger.debug("debounced %s/%s", *key)
                return False

        self._last_emitted[key] = now
        logger.info("advisory %s/%s [%s] %s", *key, event.severity.value, event.message)
        await event_bus.publish(event)
        return True


# Shared application-wide engine instance.
decision_engine = DecisionEngine()
