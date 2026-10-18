// The Photo: shows it full width and turns taps into Photo coordinates. It also draws
// what the user has marked (Card corners, the patch or Chip positions, Spots) over the Photo.
import * as React from "react"
import { pageModel, pageSites, patchSites, spotRadius, type Corners, type PageHue, type Site, type XY } from "@/engine"
import { Magnifier } from "@/components/Magnifier"
import { usePlacement } from "@/lib/placement"
import { CORNER_COUNT, type CardKind } from "@/lib/session"

interface Props {
  pixels: ImageData | null
  corners: XY[]
  spots: XY[]
  /** The radius each Spot was read with, once the engine has read it. */
  spotRadii?: number[]
  /** What each Spot is called on the Photo; their numbers when absent. */
  spotLabels?: string[]
  cardKind: CardKind
  /** The Page's hue, once chosen. */
  hue: PageHue | null
  /** A Page: the Chips the Card check left out, as notation. */
  leftOut?: string[]
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

/** A cross over a ring: this Chip is left out of the fit. */
function leftOutMark(ctx: CanvasRenderingContext2D, p: XY, radius: number, px: number) {
  const d = radius * 0.7
  for (const [style, width] of [["#000", 3.5 * px], ["#fff", 1.75 * px]] as const) {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(p.x - d, p.y - d)
    ctx.lineTo(p.x + d, p.y + d)
    ctx.moveTo(p.x - d, p.y + d)
    ctx.lineTo(p.x + d, p.y - d)
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

/** Where the Card's patches or Chips are read, and which of them the Card check left out. */
function cardSites(cardKind: CardKind, hue: PageHue | null, corners: XY[], leftOut: string[]) {
  if (cardKind === "colorchecker") return { sites: patchSites(corners as Corners), skipped: [] as number[] }
  if (!hue) return { sites: [] as Site[], skipped: [] as number[] }
  const { chips } = pageModel(hue)
  return {
    sites: pageSites(hue, corners as Corners),
    skipped: chips.flatMap((c, i) => (leftOut.includes(c.chip.notation) ? [i] : [])),
  }
}

function draw(
  canvas: HTMLCanvasElement,
  pixels: ImageData,
  corners: XY[],
  spots: XY[],
  spotRadii: number[] | undefined,
  spotLabels: string[] | undefined,
  cardKind: CardKind,
  hue: PageHue | null,
  leftOut: string[],
) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.putImageData(pixels, 0, 0)
  // One CSS pixel, in Photo pixels, so marks keep the same size on screen for any Photo.
  const shown = canvas.getBoundingClientRect().width
  const px = shown > 0 ? canvas.width / shown : 1
  if (corners.length === CORNER_COUNT) {
    // Every patch or Chip where, and as large as, the engine reads it; a left-out Chip is crossed.
    const { sites, skipped } = cardSites(cardKind, hue, corners, leftOut)
    sites.forEach(({ center, radius }, i) => {
      ring(ctx, center, radius, px * 0.6)
      if (skipped.includes(i)) leftOutMark(ctx, center, radius, px * 0.6)
    })
  }
  corners.forEach((c, i) => {
    ring(ctx, c, 8 * px, px)
    label(ctx, c, String(i + 1), px)
  })
  spots.forEach((s, i) => {
    ring(ctx, s, spotRadii?.[i] ?? spotRadius(pixels), px)
    label(ctx, s, spotLabels?.[i] ?? String(i + 1), px)
  })
}

const NONE: string[] = []

export function PhotoView({ pixels, corners, spots, spotRadii, spotLabels, cardKind, hue, leftOut = NONE, onTap }: Props) {
  const [canvas, setCanvas] = React.useState<HTMLCanvasElement | null>(null)
  const [shownWidth, setShownWidth] = React.useState(0)
  const { placing, handlers } = usePlacement(canvas, onTap)

  React.useEffect(() => {
    if (!canvas || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setShownWidth(entry.contentRect.width))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [canvas])

  React.useEffect(() => {
    if (canvas && pixels) draw(canvas, pixels, corners, spots, spotRadii, spotLabels, cardKind, hue, leftOut)
  }, [canvas, pixels, corners, spots, spotRadii, spotLabels, cardKind, hue, leftOut, shownWidth])

  if (!pixels) {
    return (
      <div className="grid aspect-[8/5] w-full place-items-center bg-muted px-6 text-center text-sm text-muted-foreground">
        No Photo yet. Take or choose one below, or practice with an example.
      </div>
    )
  }

  // touch-manipulation: a swipe on the Photo scrolls or pans the page and a pinch zooms it, as
  // anywhere else; usePlacement stops that only while a point is being placed. (It is "auto"
  // without double-tap zoom, which would turn two quick taps into a zoom.)
  return (
    <>
      <canvas
        ref={setCanvas}
        width={pixels.width}
        height={pixels.height}
        {...handlers}
        role="img"
        aria-label="Photo. Tap to mark the Card corners, then the Spots on the soil."
        data-testid="photo"
        className="block h-auto w-full cursor-crosshair touch-manipulation bg-muted select-none"
      />
      {placing && <Magnifier placing={placing} />}
    </>
  )
}
