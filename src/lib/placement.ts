// Placing a point on the Photo with a finger, a pen or a mouse.
//
// A mouse press shows the magnifier at once: dragging adjusts the point, releasing places it.
// A finger or pen is also how the user scrolls, pans a pinch-zoomed page and pinch-zooms, and the
// browser does all of that itself, so the Photo only has to tell them apart from placing:
//   tap    lifted before HOLD_MS, still within SLOP: places the point where it came down, unless
//          a finger had just scrolled the page: then it only stopped the page coasting
//   hold   stays within SLOP for HOLD_MS: the magnifier shows, dragging adjusts, lifting places
//   swipe  leaves SLOP first: nothing is placed, and the browser scrolls or pans the page
//   pinch  a second finger, or the browser taking the gesture over: nothing is placed
import * as React from "react"
import type { XY } from "@/engine"

const HOLD_MS = 200
const SLOP = 10 // CSS pixels a finger may wander and still be a tap or a hold
const EDGE = 24 // CSS pixels past the Photo's edge that still count as on it
const COASTING_MS = 300 // a finger coming down this soon after the page last moved is stopping it

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
  mode: "pending" | "placing" | "swiping"
  stopsScroll: boolean // came down on a page a finger had just scrolled
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

export function usePlacement(canvas: HTMLCanvasElement | null, onPlace: (point: XY) => void) {
  const [placing, setPlacing] = React.useState<Placing | null>(null)
  const gesture = React.useRef<Gesture | null>(null)
  const pageMovedAt = React.useRef(-Infinity) // when the page last scrolled, panned or zoomed
  const fingerMovedPage = React.useRef(false) // a finger scrolled or zoomed it since one came down
  const stopsScroll = React.useRef(false) // the finger that is down came down on a coasting page

  const end = () => {
    if (gesture.current) window.clearTimeout(gesture.current.timer)
    gesture.current = null
    setPlacing(null)
  }

  React.useEffect(() => {
    const pageMoved = () => {
      pageMovedAt.current = performance.now()
    }
    // The browser takes a finger over (a pointercancel) to scroll, pan or zoom the page.
    const onAnyCancel = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") fingerMovedPage.current = true
    }
    const onAnyDown = (e: PointerEvent) => {
      // A second finger is a pinch, wherever it lands.
      if (gesture.current && e.pointerId !== gesture.current.pointerId) end()
      // A swipe coasts after the finger lifts, and the natural way to stop it is a tap. That is
      // not a point to place. Only a finger's scroll counts: the app scrolls the page itself, to
      // the top when a new Photo comes, and a tap right after that is meant.
      stopsScroll.current =
        e.pointerType !== "mouse" &&
        fingerMovedPage.current &&
        performance.now() - pageMovedAt.current < COASTING_MS
      fingerMovedPage.current = false
    }
    const vv = window.visualViewport
    window.addEventListener("scroll", pageMoved)
    vv?.addEventListener("scroll", pageMoved) // panning a pinch-zoomed page
    vv?.addEventListener("resize", pageMoved) // zooming it
    window.addEventListener("pointercancel", onAnyCancel, true)
    window.addEventListener("pointerdown", onAnyDown, true)
    return () => {
      window.removeEventListener("scroll", pageMoved)
      vv?.removeEventListener("scroll", pageMoved)
      vv?.removeEventListener("resize", pageMoved)
      window.removeEventListener("pointercancel", onAnyCancel, true)
      window.removeEventListener("pointerdown", onAnyDown, true)
      if (gesture.current) window.clearTimeout(gesture.current.timer)
    }
  }, [])

  // Once the hold has fired, dragging the finger adjusts the point and must not also scroll or
  // pan the page. The browser decides that at the first touchmove, and only a listener that is
  // not passive can cancel it (React's own touch handlers are passive). It is on the Photo alone,
  // so scrolling anywhere else stays on the browser's fast path.
  React.useEffect(() => {
    if (!canvas) return
    const keepPut = (e: TouchEvent) => {
      if (gesture.current?.mode === "placing" && e.cancelable) e.preventDefault()
    }
    canvas.addEventListener("touchmove", keepPut, { passive: false })
    return () => canvas.removeEventListener("touchmove", keepPut)
  }, [canvas])

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
        mode: e.pointerType === "mouse" ? "placing" : "pending",
        stopsScroll: stopsScroll.current,
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
      } else if (g.mode === "placing") {
        setPlacing(placingOf(g))
      }
    },
    onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      const g = gesture.current
      if (!g || g.pointerId !== e.pointerId) return
      end()
      if (g.mode === "swiping" || (g.mode === "pending" && g.stopsScroll)) return
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
