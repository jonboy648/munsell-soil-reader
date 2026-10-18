// The magnifier: a round, zoomed view of the Photo held beside the finger so the finger does
// not hide it, with a crosshair at the exact point that will be placed on release. It sits
// above the finger, or beside it, toward the side with more room, when there is none above.
import * as React from "react"
import type { XY } from "@/engine"
import type { Placing } from "@/lib/placement"

const LENS = 136 // diameter, in CSS pixels
const ZOOM = 4 // times what the Photo looks like on screen
const GAP = 28 // between the finger and a lens above it
const SIDE = 40 // between the finger and a lens beside it, clear of the thumb
const MARGIN = 6 // kept clear at the screen edges

/** Where the lens goes for a finger at `at`, in the fixed-position space of the page. */
function lensPosition(at: XY): XY {
  // The part of the page that is on screen, which is smaller than the page when pinch-zoomed.
  const vv = window.visualViewport
  const left = vv?.offsetLeft ?? 0
  const top = vv?.offsetTop ?? 0
  const width = vv?.width ?? document.documentElement.clientWidth
  const height = vv?.height ?? window.innerHeight
  const within = (v: number, from: number, span: number) =>
    Math.min(Math.max(v, from + MARGIN), from + span - LENS - MARGIN)

  const above = at.y - GAP - LENS
  if (above >= top + MARGIN) return { x: within(at.x - LENS / 2, left, width), y: above }
  const toRight = left + width - at.x >= at.x - left
  return {
    x: within(toRight ? at.x + SIDE : at.x - SIDE - LENS, left, width),
    y: within(at.y - LENS / 2, top, height),
  }
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

function draw(lens: HTMLCanvasElement, { canvas, photo }: Placing) {
  const ctx = lens.getContext("2d")
  if (!ctx) return
  const px = lens.width / LENS // device pixels per CSS pixel
  const mid = lens.width / 2
  // The part of the Photo that fills the lens at ZOOM times its size on screen.
  const span = (LENS * canvas.width) / (ZOOM * canvas.getBoundingClientRect().width)

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

  React.useEffect(() => {
    if (ref.current) draw(ref.current, placing)
  }, [placing])

  const at = lensPosition(placing.client)
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
      style={{ left: at.x, top: at.y, width: LENS, height: LENS }}
    />
  )
}
