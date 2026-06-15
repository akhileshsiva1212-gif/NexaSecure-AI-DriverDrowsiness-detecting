"""Eye/mouth geometry — the pure-math heart of drowsiness detection.

These functions are deliberately free of any camera or MediaPipe dependency so they can
be unit-tested with hand-crafted coordinates. The real webcam source feeds them landmark
points extracted by MediaPipe; the mock source bypasses them entirely.

References:
  * Eye Aspect Ratio (EAR) — Soukupová & Čech, "Real-Time Eye Blink Detection using
    Facial Landmarks" (2016).
  * Mouth Aspect Ratio (MAR) — same idea applied to the mouth for yawn detection.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

Point = tuple[float, float]


def _dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def eye_aspect_ratio(eye: Sequence[Point]) -> float:
    """Eye Aspect Ratio from 6 eye landmarks.

    Point order (as in the reference paper):
        p1, p4 = horizontal corners (left, right)
        p2, p6 and p3, p5 = the two vertical pairs (top, bottom)

        EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)

    Open eye ~0.3; closed eye approaches ~0.0. A degenerate (zero-width) eye returns 0.0.
    """
    if len(eye) != 6:
        raise ValueError("eye_aspect_ratio expects exactly 6 points")
    p1, p2, p3, p4, p5, p6 = eye
    horizontal = _dist(p1, p4)
    if horizontal == 0:
        return 0.0
    vertical = _dist(p2, p6) + _dist(p3, p5)
    return vertical / (2.0 * horizontal)


def mouth_aspect_ratio(mouth: Sequence[Point]) -> float:
    """Mouth Aspect Ratio from 4 landmarks: (left_corner, right_corner, top_lip, bottom_lip).

        MAR = |top - bottom| / |left - right|

    Closed mouth ~0.1-0.3; a wide yawn pushes it above ~0.6.
    """
    if len(mouth) != 4:
        raise ValueError("mouth_aspect_ratio expects exactly 4 points")
    left, right, top, bottom = mouth
    width = _dist(left, right)
    if width == 0:
        return 0.0
    return _dist(top, bottom) / width


# --- Head pose & gaze (distraction) --------------------------------------------------
#
# These are deliberately simple 2D-landmark *proxies*, not a full solvePnP head-pose
# solution. They are advisory-grade signals for "eyes off the road" and, like the EAR/MAR
# thresholds, should be tuned against real footage before any on-road use. Each is
# normalized (by face width/height or eye width) so it is invariant to scale and distance.


def head_yaw_ratio(nose: Point, left_face: Point, right_face: Point) -> float:
    """Horizontal head turn from the nose's position between the two face-side landmarks.

    Uses only horizontal offsets, so a vertical tilt does not affect it.

        ~0.0  looking straight ahead (nose centered between the cheeks)
        ->+1  turned until the nose nears the right-side landmark
        ->-1  turned until the nose nears the left-side landmark
    """
    left = abs(nose[0] - left_face[0])
    right = abs(nose[0] - right_face[0])
    total = left + right
    if total == 0:
        return 0.0
    return (left - right) / total


def head_pitch_ratio(eye_mid: Point, nose_tip: Point, chin: Point) -> float:
    """Vertical head tilt: the nose's position along the eye->chin axis.

    Normalized by face height, so it is scale invariant.

        ~0.0  nose at eye level
        ~1.0  nose at the chin
    Looking down raises the value; looking up lowers it. A forward-facing driver sits
    near the middle of this range (see DistractionConfig.pitch_neutral).
    """
    span = abs(chin[1] - eye_mid[1])
    if span == 0:
        return 0.0
    return (nose_tip[1] - eye_mid[1]) / span


def gaze_offset(iris: Point, eye_inner: Point, eye_outer: Point) -> float:
    """Horizontal gaze direction: the iris position between the eye corners, centered.

    Normalized by eye width, so it is robust to distance.

        ~0.0  iris centered (looking straight)
        ->+0.5  toward the outer corner
        ->-0.5  toward the inner corner
    """
    width = eye_outer[0] - eye_inner[0]
    if width == 0:
        return 0.0
    return (iris[0] - eye_inner[0]) / width - 0.5
