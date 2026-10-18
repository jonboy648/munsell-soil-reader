// Placing a point on the Photo with a finger, a pen or a mouse.
//
// A mouse press shows the magnifier at once: dragging adjusts the point, releasing places it.
// A finger or pen is also how the user scrolls and pinch-zooms, so it has to be told apart:
//   tap    lifted before HOLD_MS, still within SLOP: places the point where it came down
//   hold   stays within SLOP for HOLD_MS: the magnifier shows, dragging adjusts, lifting places
//   swipe  leaves SLOP first: nothing is placed and the page scrolls with the finger
//   pinch  a second finger, or the browser taking the gesture over: nothing is placed
import * as React from "react"
import type { XY } from "@/engine"

const HOLD_MS = 200
const SLOP = 10 // CSS pixels a finger may wander and still be a tap or a hold
const EDGE = 24 // CSS pixels past the Photo's edge that still count as on it

/** A point being placed: where the pointer is now, in Photo pixels and on screen. */
export interface Placing {
  canvas: HTMLCanvasElement
  photo: XY
  client: XY
}

interface Gesture {
  pointerId: number
  canvas: HTMLCanvasElement
  from: XY // on screen, where the pointer came down
  at: XY // on screen, where it is now
  scrolled: XY // on screen, how far a swipe has scrolled the page so far
  mode: "pending" | "placing" | "swiping"
  timer: number
}

/** The Photo pixel under a place on screen; null when that is well off the Photo. */
function photoPoint(canvas: HTMLCanvasElement, at: XY): XY | null {
  const rect = canvas.getBoundingClientRect()
  if (at.x < rect.left - EDGE || at.x > rect.right + EDGE) return null
  if (at.y < rect.top - EDGE || at.y > rect.bottom + EDGE) return null
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max)
  return {
    x: clamp((at.x - rect.left) * (canvas.width / rect.width), canvas.width),
    y: clamp((at.y - rect.top) * (canvas.height / rect.height), canvas.height),
  }
}

/** What to show for a gesture: nothing while it is off the Photo, since lifting there cancels. */
function placingOf(g: Gesture): Placing | null {
  const photo = photoPoint(g.canvas, g.at)
  return photo && { canvas: g.canvas, photo, client: g.at }
}

const clientOf = (e: React.PointerEvent | PointerEvent): XY => ({ x: e.clientX, y: e.clientY })

export function usePlacement(onPlace: (point: XY) => void) {
  const [placing, setPlacing] = React.useState<Placing | null>(null)
  const gesture = React.useRef<Gesture | null>(null)

  const end = () => {
    if (gesture.current) window.clearTimeout(gesture.current.timer)
    gesture.current = null
    setPlacing(null)
  }

  // A second finger is a pinch, wherever it lands.
  React.useEffect(() => {
    const onAnyDown = (e: PointerEvent) => {
      if (gesture.current && e.pointerId !== gesture.current.pointerId) end()
    }
    window.addEventListener("pointerdown", onAnyDown, true)
    return () => {
      window.removeEventListener("pointerdown", onAnyDown, true)
      if (gesture.current) window.clearTimeout(gesture.current.timer)
    }
  }, [])

  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      // One pointer at a time, and for a mouse only the main button.
      if (gesture.current || !e.isPrimary || e.button !== 0) return
      // Keeps the drag coming to the Photo after the pointer leaves it.
      e.currentTarget.setPointerCapture(e.pointerId)
      const at = clientOf(e)
      const g: Gesture = {
        pointerId: e.pointerId,
        canvas: e.currentTarget,
        from: at,
        at,
        scrolled: at,
        mode: e.pointerType === "mouse" ? "placing" : "pending",
        timer: 0,
      }
      gesture.current = g
      if (g.mode === "placing") {
        setPlacing(placingOf(g))
      } else {
        g.timer = window.setTimeout(() => {
          if (gesture.current !== g) return
          g.mode = "placing"
          setPlacing(placingOf(g))
        }, HOLD_MS)
      }
    },
    onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return
      g.at = clientOf(e)
      if (g.mode === "pending" && Math.hypot(g.at.x - g.from.x, g.at.y - g.from.y) > SLOP) {
        window.clearTimeout(g.timer)
        g.mode = "swiping"
      }
      if (g.mode === "swiping") {
        window.scrollBy(g.scrolled.x - g.at.x, g.scrolled.y - g.at.y)
        g.scrolled = g.at
      } else if (g.mode === "placing") {
        setPlacing(placingOf(g))
      }
    },
    onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return
      end()
      if (g.mode === "swiping") return
      // A tap places the point where it came down; a hold, where it is lifted.
      const point = photoPoint(g.canvas, g.mode === "pending" ? g.from : clientOf(e))
      if (point) onPlace(point)
    },
    onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
      if (gesture.current?.pointerId === e.pointerId) end()
    },
    // No context menu from a long press while placing; a mouse right-click stays normal.
    onContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
      if (gesture.current) e.preventDefault()
    },
  }

  return { placing, handlers }
}
