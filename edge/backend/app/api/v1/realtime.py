"""Realtime WebSocket route.

The dashboard connects here to receive a live stream of advisory events. On connect we
send the recent event history so a freshly-opened (or reconnected) dashboard immediately
shows current state — important on flaky in-car networks.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db import repository
from app.realtime import manager

router = APIRouter()


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        # Initial state sync so the client isn't blank until the next event fires.
        await ws.send_json({"kind": "snapshot", "events": repository.list_recent_events(limit=25)})
        # Keep the connection open; we only push (clients aren't required to send).
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:  # noqa: BLE001 - any error means drop this client cleanly
        await manager.disconnect(ws)
