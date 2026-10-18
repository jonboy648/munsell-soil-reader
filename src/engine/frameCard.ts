// The frame as a Card (ADR 0003): from the four corners of its outline in the Photo, where
// every patch, the window and the black base are. The patch colors come from the frame's batch.
// The same homography as the other Cards, from the layout's millimetres.
//
// This file is in the app. The finder that makes the outline is not (frame.ts, loaded only
// when a frame is chosen).
import { labD50ToLinear, luminance } from "./color"
import type { Reference } from "./correction"
import type { Batch } from "./batch"
import { EVENNESS_MM, EVENNESS_RADIUS_MM, OUTLINE_MM, REFERENCE_PATCHES, WINDOW_MM, type Mm } from "./frameLayout"
import { gridMap, type Four, type GridPoint, type Site } from "./grid"
import type { Evenness, QualityReference } from "./quality"
import { medianLinear } from "./sampling"
import type { Corners, Pixels, XY } from "./types"

/** Share of a tile's side that the read circle takes as its radius. */
const READ_FRACTION = 0.3
/** Read radius floor, in Photo pixels. */
const MIN_RADIUS = 2

/** Spread of the black base, in stops, above which the light is uneven; and above which it is the outline, not the light. As for the ColorChecker's black frame. */
const UNEVEN_STOPS = 0.3
const OFF_CARD_STOPS = 3

/** The distance between neighbouring tiles' centres, in millimetres: what the spacing check measures. */
const PITCH_MM = Math.min(
  ...REFERENCE_PATCHES.flatMap((a, i) =>
    REFERENCE_PATCHES.slice(i + 1).map((b) => Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y)),
  ),
)

interface FrameMap {
  /** Where a place on the card is in the Photo. */
  at: (mm: Mm) => XY
  /** Photo pixels to the millimetre at a place on the card, the smaller of the two directions. */
  scaleAt: (mm: Mm) => number
}

const KNOWN = OUTLINE_MM.map(({ x, y }) => ({ col: x, row: y })) as Four<GridPoint>

/** The map from the card to the Photo, fixed by the outline's four corners. */
function frameMap(outline: Corners): FrameMap {
  const map = gridMap(KNOWN, outline)
  const at = ({ x, y }: Mm): XY => map({ col: x, row: y })
  const apart = (a: Mm, b: Mm) => {
    const [p, q] = [at(a), at(b)]
    return Math.hypot(p.x - q.x, p.y - q.y) / Math.hypot(a.x - b.x, a.y - b.y)
  }
  const scaleAt = ({ x, y }: Mm) =>
    Math.min(apart({ x: x - 1, y }, { x: x + 1, y }), apart({ x, y: y - 1 }, { x, y: y + 1 }))
  return { at, scaleAt }
}

/** Where to read each reference patch (the six grays, then the soil colors), with its ID. */
export function framePatchSites(outline: Corners): { id: string; site: Site }[] {
  const map = frameMap(outline)
  return REFERENCE_PATCHES.map(({ id, center, size }) => ({
    id,
    site: {
      center: map.at(center),
      radius: Math.max(MIN_RADIUS, READ_FRACTION * size * map.scaleAt(center)),
    },
  }))
}

/** The window in the Photo: top left, top right, bottom right, bottom left. */
export const frameWindow = (outline: Corners): Four<XY> => {
  const map = frameMap(outline)
  return WINDOW_MM.map((corner) => map.at(corner)) as Four<XY>
}

/** Whether a place in the Photo is inside the frame's window. */
export function insideWindow(outline: Corners, spot: XY): boolean {
  const window = frameWindow(outline)
  // Inside a convex quadrilateral: on the same side of every edge.
  const sides = window.map((p, i) => {
    const q = window[(i + 1) % 4]
    return (q.x - p.x) * (spot.y - p.y) - (q.y - p.y) * (spot.x - p.x)
  })
  return sides.every((s) => s >= 0) || sides.every((s) => s <= 0)
}

function truthOf(batch: Batch, id: string) {
  const patch = batch.patches.find((p) => p.id === id)
  if (!patch) throw new Error(`Batch ${batch.code} has no measurement for patch ${id}.`)
  return labD50ToLinear(patch.lab)
}

/** What the camera measured on each reference patch, and what the batch says it really is. The grays are the tone ladder. */
export function frameReferences(pixels: Pixels, outline: Corners, batch: Batch): Reference[] {
  return framePatchSites(outline).map(({ id, site }, i) => ({
    measured: medianLinear(pixels, site.center, site.radius),
    truth: truthOf(batch, id),
    ladder: REFERENCE_PATCHES[i].kind === "gray",
  }))
}

/**
 * What the quality checks need from the frame: its patches as references (the grays are the
 * tonal ladder), the black base as the evenness samples, and the spacing of the patches in the
 * Photo: the smallest it is anywhere on the card, where a tilted card is farthest.
 */
export function frameQuality(
  outline: Corners,
  batch: Batch,
): { references: QualityReference[]; spacing: number; evenness: Evenness } {
  const map = frameMap(outline)
  const references = framePatchSites(outline).map(({ id, site }, i) => ({
    at: site.center,
    radius: site.radius,
    y: luminance(truthOf(batch, id)),
    ladder: REFERENCE_PATCHES[i].kind === "gray",
  }))
  const samples = EVENNESS_MM.map((mm) => ({
    at: map.at(mm),
    radius: Math.max(MIN_RADIUS, EVENNESS_RADIUS_MM * map.scaleAt(mm)),
    y: 1,
  }))
  const spacing = PITCH_MM * Math.min(...REFERENCE_PATCHES.map((p) => map.scaleAt(p.center)))
  return { references, spacing, evenness: { samples, limitStops: UNEVEN_STOPS, offCardStops: OFF_CARD_STOPS } }
}
