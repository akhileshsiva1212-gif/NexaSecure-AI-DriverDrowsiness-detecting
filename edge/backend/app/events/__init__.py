"""In-process asynchronous event bus (publish/subscribe).

Feature modules publish `AdvisoryEvent`s without knowing who consumes them. The
decision engine, database writer, and websocket broadcaster each subscribe. This
keeps the modules decoupled.

For Phase 0/1 this is a simple in-memory bus. The same interface can later be backed
by Redis pub/sub when the system grows — without changing any publisher.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from app.core.logging import get_logger
from app.events.types import AdvisoryEvent

logger = get_logger("events.bus")

Subscriber = Callable[[AdvisoryEvent], Awaitable[None]]


class EventBus:
    """Minimal async pub/sub. One bus instance is shared across the app."""

    def __init__(self) -> None:
        self._subscribers: list[Subscriber] = []

    def subscribe(self, subscriber: Subscriber) -> None:
        """Register an async callback to receive every published event."""
        self._subscribers.append(subscriber)

    async def publish(self, event: AdvisoryEvent) -> None:
        """Deliver an event to all subscribers concurrently.

        A failing subscriber is logged but never blocks the others — safety
        advisories must keep flowing even if one consumer errors.
        """
        if not self._subscribers:
            return

        results = await asyncio.gather(
            *(sub(event) for sub in self._subscribers),
            return_exceptions=True,
        )
        for sub, result in zip(self._subscribers, results):
            if isinstance(result, Exception):
                logger.error("subscriber %s failed: %r", getattr(sub, "__name__", sub), result)


# Shared application-wide bus instance.
event_bus = EventBus()
