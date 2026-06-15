"""Frame signal sources for driver monitoring.

A source produces one `FrameSignals` per call.

  * `MediaPipeWebcamSource` — an optional server-side source: grabs webcam frames via OpenCV,
    extracts face landmarks via MediaPipe, and computes EAR/MAR with the pure functions in
    `geometry.py`. Its heavy dependencies (opencv-python, mediapipe) are imported lazily, so
    importing this module never requires them unless the webcam source is actually selected.

The primary real source is the **browser**: the dashboard runs MediaPipe FaceLandmarker on
the live webcam and POSTs only the computed numbers to `/driver/ingest`. With no source the
monitor stays idle until those live frames arrive — it never fabricates signals.

Privacy: sources compute ratios in memory and return only numbers. Raw frames and landmarks
are never stored or transmitted.
"""

from __future__ import annotations

from typing import Protocol

from app.features.driver_monitoring.geometry import (
    eye_aspect_ratio,
    gaze_offset,
    head_pitch_ratio,
    head_yaw_ratio,
    mouth_aspect_ratio,
)
from app.features.driver_monitoring.schemas import FrameSignals


class FrameSignalSource(Protocol):
    """Anything that can produce per-frame eye/mouth signals on demand."""

    def read(self) -> FrameSignals: ...
    def close(self) -> None: ...


# --- Real webcam source (heavy deps imported lazily) ---------------------------------

# MediaPipe FaceMesh landmark indices.
_LEFT_EYE = (33, 160, 158, 133, 153, 144)   # p1..p6 for EAR
_RIGHT_EYE = (362, 385, 387, 263, 373, 380)
_MOUTH = (61, 291, 13, 14)                    # left, right, top, bottom
_NOSE_TIP = 1
_LEFT_CHEEK = 234
_RIGHT_CHEEK = 454
_CHIN = 152
_LEFT_EYE_OUTER = 33
_RIGHT_EYE_OUTER = 263
_LEFT_EYE_INNER = 133
_LEFT_IRIS = 468                              # iris center (needs refine_landmarks)


class MediaPipeWebcamSource:
    """Real driver-facing source. Requires `opencv-python` and `mediapipe` (optional extras)."""

    def __init__(self, fps: float, cam_index: int = 0) -> None:
        try:
            import cv2  # noqa: F401
            import mediapipe as mp
        except ImportError as exc:  # pragma: no cover - exercised only with real hardware
            raise RuntimeError(
                "The webcam source needs the CV extras. Install them with "
                "`pip install -r requirements-cv.txt` on a supported Python, or use "
                "NEXA_DRIVER_CAM_SOURCE=mock."
            ) from exc

        import cv2

        self._cv2 = cv2
        self._cap = cv2.VideoCapture(cam_index)
        self._mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1, refine_landmarks=True,
            min_detection_confidence=0.5, min_tracking_confidence=0.5,
        )

    def read(self) -> FrameSignals:  # pragma: no cover - requires a camera
        ok, frame = self._cap.read()
        if not ok:
            return FrameSignals(face_found=False)

        h, w = frame.shape[:2]
        rgb = self._cv2.cvtColor(frame, self._cv2.COLOR_BGR2RGB)
        result = self._mesh.process(rgb)
        if not result.multi_face_landmarks:
            return FrameSignals(face_found=False)

        lm = result.multi_face_landmarks[0].landmark
        pt = lambda i: (lm[i].x * w, lm[i].y * h)

        ear = (
            eye_aspect_ratio([pt(i) for i in _LEFT_EYE])
            + eye_aspect_ratio([pt(i) for i in _RIGHT_EYE])
        ) / 2.0
        mar = mouth_aspect_ratio([pt(i) for i in _MOUTH])

        eye_mid = (
            (pt(_LEFT_EYE_OUTER)[0] + pt(_RIGHT_EYE_OUTER)[0]) / 2.0,
            (pt(_LEFT_EYE_OUTER)[1] + pt(_RIGHT_EYE_OUTER)[1]) / 2.0,
        )
        yaw = head_yaw_ratio(pt(_NOSE_TIP), pt(_LEFT_CHEEK), pt(_RIGHT_CHEEK))
        pitch = head_pitch_ratio(eye_mid, pt(_NOSE_TIP), pt(_CHIN))
        gaze = gaze_offset(pt(_LEFT_IRIS), pt(_LEFT_EYE_INNER), pt(_LEFT_EYE_OUTER))
        return FrameSignals(ear=ear, mar=mar, face_found=True, yaw=yaw, pitch=pitch, gaze=gaze)

    def close(self) -> None:  # pragma: no cover
        self._cap.release()
        self._mesh.close()


def make_frame_source(kind: str, fps: float, cam_index: int = 0) -> FrameSignalSource | None:
    """Factory: return the driver frame source selected by configuration.

    "none" returns None — the monitor idles until live browser frames arrive via
    POST /driver/ingest. "webcam" is the optional server-side OpenCV source for headless use.
    """
    if kind == "none":
        return None
    if kind == "webcam":
        return MediaPipeWebcamSource(fps=fps, cam_index=cam_index)
    raise ValueError(f"Unknown driver camera source '{kind}' (use 'none' or 'webcam').")


def make_distraction_source(kind: str, fps: float, cam_index: int = 0) -> FrameSignalSource | None:
    """Factory: return the distraction frame source selected by configuration.

    The real-camera path is the in-browser source via POST /driver/ingest (one webcam, frames
    feed both monitors). "none" idles until those live frames arrive; selecting the Python
    "webcam" source here as well as for drowsiness would open the camera twice — dev only.
    """
    if kind == "none":
        return None
    if kind == "webcam":
        return MediaPipeWebcamSource(fps=fps, cam_index=cam_index)
    raise ValueError(f"Unknown driver camera source '{kind}' (use 'none' or 'webcam').")
