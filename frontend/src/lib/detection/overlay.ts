// Generic overlay renderer: draws whatever a DetectionResult exposes (boxes, face mesh,
// lane lines) onto a canvas sized to the source frame. One function covers every detector.

import { DrawingUtils, FaceLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { DetectionResult } from './types'

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color: string,
): void {
  ctx.lineWidth = Math.max(2, Math.round(ctx.canvas.width / 320))
  ctx.strokeStyle = color
  ctx.strokeRect(x, y, w, h)

  if (!label) return
  ctx.font = `${Math.max(12, Math.round(ctx.canvas.width / 40))}px ui-sans-serif, system-ui, sans-serif`
  const padding = 4
  const textW = ctx.measureText(label).width
  const textH = Math.max(14, Math.round(ctx.canvas.width / 36))
  const ly = y - textH - padding < 0 ? y + padding : y - textH - padding
  ctx.fillStyle = color
  ctx.fillRect(x, ly, textW + padding * 2, textH + padding)
  ctx.fillStyle = '#03070d'
  ctx.textBaseline = 'top'
  ctx.fillText(label, x + padding, ly + padding / 2)
}

/** Draw a detection result onto the (already-cleared) canvas context. */
export function drawResult(ctx: CanvasRenderingContext2D, result: DetectionResult): void {
  const accent = result.accent ?? '#2dd4bf'

  // Face mesh.
  if (result.landmarks && result.landmarks.length > 0) {
    drawFaceMesh(ctx, result.landmarks, accent)
  }

  // Lane line segments.
  if (result.lanes && result.lanes.length > 0) {
    ctx.lineWidth = Math.max(3, Math.round(ctx.canvas.width / 200))
    for (const seg of result.lanes) {
      ctx.strokeStyle = seg.color ?? accent
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.stroke()
    }
  }

  // Bounding boxes.
  for (const b of result.boxes) {
    const label = b.score > 0 ? `${b.label} ${(b.score * 100).toFixed(0)}%` : b.label
    drawBox(ctx, b.x, b.y, b.w, b.h, label, b.color ?? accent)
  }
}

function drawFaceMesh(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  accent: string,
): void {
  const du = new DrawingUtils(ctx)
  du.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
    color: 'rgba(120,160,255,0.18)',
    lineWidth: 0.5,
  })
  for (const conn of [
    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    FaceLandmarker.FACE_LANDMARKS_LIPS,
  ]) {
    du.drawConnectors(landmarks, conn, { color: accent, lineWidth: 2 })
  }
}
