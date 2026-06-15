"""Tests for the realtime path: event bus delivery and the WebSocket snapshot."""

from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

from app.events import EventBus
from app.events.types import AdvisoryEvent, FeatureDomain, Severity


def test_event_bus_delivers_to_subscribers():
    bus = EventBus()
    received: list[AdvisoryEvent] = []

    async def collector(event: AdvisoryEvent) -> None:
        received.append(event)

    async def scenario() -> None:
        bus.subscribe(collector)
        await bus.publish(AdvisoryEvent(
            domain=FeatureDomain.VEHICLE,
            type="engine_overheat",
            severity=Severity.CRITICAL,
            message="test",
        ))

    asyncio.run(scenario())
    assert len(received) == 1
    assert received[0].type == "engine_overheat"


def test_one_failing_subscriber_does_not_block_others():
    bus = EventBus()
    got: list[str] = []

    async def bad(_event: AdvisoryEvent) -> None:
        raise RuntimeError("boom")

    async def good(event: AdvisoryEvent) -> None:
        got.append(event.type)

    async def scenario() -> None:
        bus.subscribe(bad)
        bus.subscribe(good)
        await bus.publish(AdvisoryEvent(
            domain=FeatureDomain.SYSTEM, type="x", severity=Severity.INFO, message="m",
        ))

    asyncio.run(scenario())  # must not raise despite the failing subscriber
    assert got == ["x"]


def test_websocket_sends_initial_snapshot():
    from app.main import app

    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as ws:
            msg = ws.receive_json()
            assert msg["kind"] == "snapshot"
            assert isinstance(msg["events"], list)
