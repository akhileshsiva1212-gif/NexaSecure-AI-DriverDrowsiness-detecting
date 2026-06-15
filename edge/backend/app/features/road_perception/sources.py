"""Sign-detection sources for the road-facing camera.

The *real* detection path is the browser: the dashboard runs a MediaPipe ObjectDetector (and
an optional GTSRB classifier) on the road camera locally and POSTs only the detected sign
labels to `/road/signs/ingest`. Raw video never reaches the backend, so there is no Python
road-camera source — with no source the recognizer idles until live frames arrive. See
`routes.ingest` and `frontend/src/lib/detection/`.
"""

from __future__ import annotations

from typing import Protocol

from app.features.road_perception.schemas import SignFrame


class SignFrameSource(Protocol):
    """Anything that can produce per-frame sign detections on demand."""

    def read(self) -> SignFrame: ...
    def close(self) -> None: ...


def make_sign_source(kind: str, fps: float) -> SignFrameSource | None:
    """Factory: return the sign-detection source selected by configuration.

    Only "none" is supported — real detection runs in the browser and is pushed to
    POST /road/signs/ingest, so the monitor idles (source is None) until live frames arrive.
    """
    if kind == "none":
        return None
    raise ValueError(
        f"Unknown sign source '{kind}' (use 'none'; real detection runs in the browser "
        "via POST /road/signs/ingest)."
    )
