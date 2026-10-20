// The magnifier: a round, zoomed view of the Photo held beside the finger so the finger does
// not hide it, with a crosshair at the exact point that will be placed on release. It sits
// above the finger, or beside it, toward the side with more room, when there is none above.
import * as React from "react"
import type { XY } from "@/engine"
import type { Placing } from "@/lib/placement"

// Sizes are in pixels on the screen, so the lens looks the same size however far the user has
// pinch-zoomed the page; lensLayout turns them into CSS pixels.
const LENS = 136 // diameter
const MIN_LENS = 80 // the smallest it shrinks to, beside the finger on a very narrow screen
const ZOOM = 4 // times what the Photo looks like on screen
const GAP = 28 // between the finger and a lens above it
const SIDE = 40 // between the finger and a lens beside it, clear of the thumb
const MARGIN = 6 // kept clear at the screen edges

/** Where the lens goes for a finger at `client`, and how big, in the page's fixed-position space. */
function lensLayout(client: XY) {
  // What is on screen is only part of the page when it is pinch-zoomed, and `scale` times bigger.
  const vv = window.visualViewport
  const scale = vv?.scale ?? 1
  const offset = { x: vv?.offsetLeft ?? 0, y: vv?.offsetTop ?? 0 }
  const width = (vv?.width ?? document.documentElement.clientWidth) * scale
  const height = (vv?.height ?? window.innerHeight) * scale
  // The finger, in screen pixels from the top left of what is on screen.
  const x = (client.x - offset.x) * scale
  const y = (client.y - offset.y) * scale
  const within = (v: number, size: number, span: number) =>
    Math.min(Math.max(v, MARGIN), span - size - MARGIN)

  let size = LENS
  let left: number
  let top: number
  if (y - GAP - LENS >= MARGIN) {
    left = within(x - LENS / 2, size, width)
    top = within(y - GAP - LENS, size, height)
  } else {
    // No room above. Beside it, shrinking the lens rather than letting it back over the finger.
    const toRight = width - x >= x
    size = Math.max(MIN_LENS, Math.min(LENS, (toRight ? width - x : x) - SIDE - MARGIN))
    left = within(toRight ? x + SIDE : x - SIDE - size, size, width)
    top = within(y - size / 2, size, height)
  }
  return { left: offset.x + left / scale, top: offset.y + top / scale, size: size / scale, scale }
}

// White with a black edge, like the marks on the Photo: neutral, and visible on any soil.
function outlined(ctx: CanvasRenderingContext2D, px: number, path: () => void) {
  for (const [style, width] of [["#000", 3.5 * px], ["#fff", 1.75 * px]] as const) {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.beginPath()
    path()
    ctx.stroke()
  }
}

/** Draws the lens, which is `onScreen` pixels across on the screen. */
function draw(lens: HTMLCanvasElement, { canvas, photo }: Placing, onScreen: number, scale: number) {
  const ctx = lens.getContext("2d")
  if (!ctx) return
  const px = lens.width / LENS // lens pixels per pixel of a full-size lens
  const mid = lens.width / 2
  // The part of the Photo that fills the lens at ZOOM times its size on screen.
  const span = (onScreen * canvas.width) / (ZOOM * canvas.getBoundingClientRect().width * scale)

  ctx.fillStyle = "#262626" // shows past the Photo's edge
  ctx.fillRect(0, 0, lens.width, lens.height)
  ctx.drawImage(canvas, photo.x - span / 2, photo.y - span / 2, span, span, 0, 0, lens.width, lens.height)

  const arm = 22 * px
  const hole = 4 * px // left open so the exact point stays visible
  outlined(ctx, px, () => {
    ctx.moveTo(mid - arm, mid)
    ctx.lineTo(mid - hole, mid)
    ctx.moveTo(mid + hole, mid)
    ctx.lineTo(mid + arm, mid)
    ctx.moveTo(mid, mid - arm)
    ctx.lineTo(mid, mid - hole)
    ctx.moveTo(mid, mid + hole)
    ctx.lineTo(mid, mid + arm)
  })
  outlined(ctx, px, () => ctx.arc(mid, mid, mid - 2 * px, 0, 2 * Math.PI))
}

export function Magnifier({ placing }: { placing: Placing }) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const [, relayout] = React.useReducer((n: number) => n + 1, 0)

  // The visual viewport moves and rescales when the page is pinch-zoomed or scrolled.
  React.useEffect(() => {
    const vv = window.visualViewport
    vv?.addEventListener("resize", relayout)
    vv?.addEventListener("scroll", relayout)
    return () => {
      vv?.removeEventListener("resize", relayout)
      vv?.removeEventListener("scroll", relayout)
    }
  }, [])

  const lens = lensLayout(placing.client)
  React.useEffect(() => {
    if (ref.current) draw(ref.current, placing, lens.size * lens.scale, lens.scale)
  }, [placing, lens.size, lens.scale])

  const dpr = window.devicePixelRatio || 1
  return (
    <canvas
      ref={ref}
      width={Math.round(LENS * dpr)}
      height={Math.round(LENS * dpr)}
      aria-hidden="true"
      data-testid="magnifier"
      data-zoom={ZOOM}
      className="pointer-events-none fixed z-50 rounded-full"
      style={{ left: lens.left, top: lens.top, width: lens.size, height: lens.size }}
    />
  )
}
