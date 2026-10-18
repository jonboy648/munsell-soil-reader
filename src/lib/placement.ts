// Placing a point on the Photo with a finger, a pen or a mouse. Pressing starts it, dragging
// adjusts it, and the point is placed where the pointer is released. A quick tap is just a
// press and a release in the same place.
import * as React from "react"
import type { XY } from "@/engine"

/** A point being placed: where the pointer is now, in Photo pixels and on screen. */
export interface Placing {
  pointerId: number
  canvas: HTMLCanvasElement
  photo: XY
  client: XY
}

const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max)

function locate(e: React.PointerEvent<HTMLCanvasElement>): Placing {
  const canvas = e.currentTarget
  const rect = canvas.getBoundingClientRect()
  return {
    pointerId: e.pointerId,
    canvas,
    // A drag can end past the Photo's edge; the point stays on the Photo.
    photo: {
      x: clamp((e.clientX - rect.left) * (canvas.width / rect.width), canvas.width),
      y: clamp((e.clientY - rect.top) * (canvas.height / rect.height), canvas.height),
    },
    client: { x: e.clientX, y: e.clientY },
  }
}

export function usePlacement(onPlace: (point: XY) => void) {
  const [placing, setPlacing] = React.useState<Placing | null>(null)

  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      // One pointer at a time, and for a mouse only the main button.
      if (placing || !e.isPrimary || e.button !== 0) return
      // Keeps the drag coming to the Photo after the pointer leaves it.
      e.currentTarget.setPointerCapture(e.pointerId)
      setPlacing(locate(e))
    },
    onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (placing?.pointerId === e.pointerId) setPlacing(locate(e))
    },
    onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      if (placing?.pointerId !== e.pointerId) return
      setPlacing(null)
      onPlace(locate(e).photo)
    },
    onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
      if (placing?.pointerId === e.pointerId) setPlacing(null)
    },
  }

  return { placing, handlers }
}
