"""Realtime WebSocket layer.

Maintains the set of connected dashboard clients and broadcasts advisory events to
them. Subscribes to the shared event bus on startup so every accepted advisory is
pushed live.

Resilience: a send failure simply drops that client from the set — a flaky phone
connection must never break the broadcast for everyone else, and safety alerts also
fire locally in the vehicle regardless of dashboard connectivity.
"""

from __future__ import annotations

import asyncio

from fastapi import WebSocket

from app.core.logging import get_logger
from app.events import event_bus
from app.events.types import AdvisoryEvent

logger = get_logger("realtime.ws")


class ConnectionManager:
    """Tracks live dashboard WebSocket connections and broadcasts to them."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        logger.info("dashboard connected (%d total)", len(self._clients))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)
        logger.info("dashboard disconnected (%d total)", len(self._clients))

    async def broadcast(self, event: AdvisoryEvent) -> None:
        """Push one advisory to every connected client; drop the dead ones."""
        payload = {"kind": "advisory", "event": event.model_dump(mode="json")}
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_json(payload)
            except Exception:  # noqa: BLE001 - any send error means the client is gone
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)


manager = ConnectionManager()


async def _on_event(event: AdvisoryEvent) -> None:
    await manager.broadcast(event)


def register_realtime() -> None:
    """Subscribe the broadcaster to the event bus. Call once at startup."""
    event_bus.subscribe(_on_event)
