// The Photo: shows it full width and turns taps into Photo coordinates. It also draws
// what the user has marked (Card corners, the patch positions, Spots) over the Photo.
import * as React from "react"
import { patchSites, spotRadius, type Corners, type XY } from "@/engine"
import { CORNER_COUNT } from "@/lib/session"

interface Props {
  pixels: ImageData | null
  corners: XY[]
  spots: XY[]
  onTap: (point: XY) => void
}

// Marks are white with a black edge: neutral, and visible on any soil or Card color.
function ring(ctx: CanvasRenderingContext2D, p: XY, radius: number, px: number) {
  for (const [style, width] of [["#000", 3.5 * px], ["#fff", 1.75 * px]] as const) {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI)
    ctx.stroke()
  }
}

function label(ctx: CanvasRenderingContext2D, p: XY, text: string, px: number) {
  const r = 9 * px
  const at = { x: p.x + 15 * px, y: p.y - 15 * px }
  ctx.fillStyle = "#fff"
  ctx.strokeStyle = "#000"
  ctx.lineWidth = 1.5 * px
  ctx.beginPath()
  ctx.arc(at.x, at.y, r, 0, 2 * Math.PI)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#000"
  ctx.font = `700 ${12 * px}px "IBM Plex Mono", monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, at.x, at.y + px * 0.5)
}

function draw(canvas: HTMLCanvasElement, pixels: ImageData, corners: XY[], spots: XY[]) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.putImageData(pixels, 0, 0)
  // One CSS pixel, in Photo pixels, so marks keep the same size on screen for any Photo.
  const shown = canvas.getBoundingClientRect().width
  const px = shown > 0 ? canvas.width / shown : 1
  if (corners.length === CORNER_COUNT) {
    // Every patch where, and as large as, the engine reads it.
    for (const { center, radius } of patchSites(corners as Corners)) ring(ctx, center, radius, px * 0.6)
  }
  corners.forEach((c, i) => {
    ring(ctx, c, 8 * px, px)
    label(ctx, c, String(i + 1), px)
  })
  const r = spotRadius(pixels)
  spots.forEach((s, i) => {
    ring(ctx, s, r, px)
    label(ctx, s, String(i + 1), px)
  })
}

export function PhotoView({ pixels, corners, spots, onTap }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [shownWidth, setShownWidth] = React.useState(0)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setShownWidth(entry.contentRect.width))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [pixels])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && pixels) draw(canvas, pixels, corners, spots)
  }, [pixels, corners, spots, shownWidth])

  if (!pixels) {
    return (
      <div className="grid aspect-[8/5] w-full place-items-center bg-muted px-6 text-center text-sm text-muted-foreground">
        No Photo yet. Take or choose one below, or practice with an example.
      </div>
    )
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    onTap({
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    })
  }

  return (
    <canvas
      ref={canvasRef}
      width={pixels.width}
      height={pixels.height}
      onClick={handleClick}
      role="img"
      aria-label="Photo. Tap to mark the Card corners, then the Spots on the soil."
      data-testid="photo"
      className="block h-auto w-full cursor-crosshair bg-muted"
    />
  )
}
