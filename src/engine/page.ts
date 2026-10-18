// A Page of the soil book as the Card (ADR 0001). A hue Page is a regular grid: value rows
// top to bottom (light to dark) and chroma columns left to right, with gaps where no Chip is
// printed. Which Chips are on a Page comes from the Chip list; the grid is derived from it, so
// the bottom row (2/ on 10YR, 2.5/ on 7.5YR) and where a column starts follow each Page.
//
// Round holes are punched between vertically neighbouring Chips and the soil shows through
// them. The Chip's solid middle is the only place to read, and the grid read circle (grid.ts)
// stays well inside it.
import * as munsell from "munsell"
import { SOIL_BOOK_CHIPS } from "./chips"
import type { Vec3 } from "./color"
import { gridMap, gridSites, type Four, type GridPoint, type Site } from "./grid"
import type { Chip, ChipPage, Corners, XY } from "./types"

/** The Pages that hold one hue in rows of value and columns of chroma, and work as a Card. */
export const PAGE_HUES = ["2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y"] as const satisfies readonly ChipPage[]
export type PageHue = (typeof PAGE_HUES)[number]

export const isPageHue = (page: string): page is PageHue => (PAGE_HUES as readonly string[]).includes(page)

/**
 * The chroma columns of a hue Page, left to right. They are evenly spaced although the chroma
 * skips (/4 to /6 to /8), so a column is found by its position, never by its chroma number.
 */
export const PAGE_CHROMAS = [1, 2, 3, 4, 6, 8] as const

/** One printed Chip: where it sits in the Page's grid and its true color, from its notation. */
export interface PageChip {
  chip: Chip
  col: number
  row: number
  linear: Vec3
}

export interface PageModel {
  hue: PageHue
  /** The value of each row, top to bottom. */
  values: number[]
  /** Every printed Chip, row by row, left to right. */
  chips: PageChip[]
  /**
   * The four Chips the user taps, clockwise from the top left: the top row's /1, the top row's
   * last Chip, the lowest Chip of the last column, and the lowest /1. The grid's bottom right
   * is empty on most Pages, so these are not its corners.
   */
  taps: Four<PageChip>
}

const models = new Map<PageHue, PageModel>()

/** The grid of a hue Page, derived from the Chip list. */
export function pageModel(hue: PageHue): PageModel {
  const cached = models.get(hue)
  if (cached) return cached
  const printed = SOIL_BOOK_CHIPS.filter((chip) => chip.pages.includes(hue))
  const values = [...new Set(printed.map((chip) => chip.value))].sort((a, b) => b - a)
  const chips = printed
    .map((chip): PageChip => {
      const col = (PAGE_CHROMAS as readonly number[]).indexOf(chip.chroma)
      if (col < 0) throw new Error(`${chip.notation} sits on no chroma column of the ${hue} Page`)
      return { chip, col, row: values.indexOf(chip.value), linear: munsell.munsellToLinearRgb(chip.notation) as Vec3 }
    })
    .sort((a, b) => a.row - b.row || a.col - b.col)
  const lowest = (of: PageChip[]) => of.reduce((a, b) => (b.row > a.row ? b : a))
  const lastCol = Math.max(...chips.map((c) => c.col))
  const topRow = chips.filter((c) => c.row === 0)
  const model: PageModel = {
    hue,
    values,
    chips,
    taps: [
      topRow.find((c) => c.col === 0)!,
      topRow.reduce((a, b) => (b.col > a.col ? b : a)),
      lowest(chips.filter((c) => c.col === lastCol)),
      lowest(chips.filter((c) => c.col === 0)),
    ],
  }
  models.set(hue, model)
  return model
}

const gridPoint = ({ col, row }: PageChip | GridPoint): GridPoint => ({ col, row })

/**
 * Where to read each Chip of the Page (in `pageModel(hue).chips` order), from the four Chips the
 * user tapped. A homography, so a Page photographed at an angle still lands on every Chip.
 */
export function pageSites(hue: PageHue, taps: Corners): Site[] {
  const { chips, taps: known } = pageModel(hue)
  return gridSites(known.map(gridPoint) as Four<GridPoint>, taps, chips.map(gridPoint))
}

/**
 * How much taller a row is than a column is wide, as the book prints them (a row pitch of 198
 * pixels against a column pitch of 131 on Jon's 10YR Page). Holes and Chips are measured in
 * column pitches.
 */
export const PAGE_ROW_PITCHES = 1.5

/** The Page's column pitch in the Photo, in pixels, from the four taps: the median over the taps' pairs. */
export function pageSpacing(hue: PageHue, taps: Corners): number {
  const known = pageModel(hue).taps
  const ratios = known.flatMap((a, i) =>
    known.slice(i + 1).map((b, k) => {
      const [p, q] = [taps[i], taps[i + 1 + k]]
      const steps = Math.hypot(a.col - b.col, (a.row - b.row) * PAGE_ROW_PITCHES)
      return Math.hypot(p.x - q.x, p.y - q.y) / steps
    }),
  )
  return ratios.sort((x, y) => x - y)[Math.floor(ratios.length / 2)]
}

/** A paper gutter between two columns is a fifth of a column wide: its read circle is this share of a Chip's. */
const GUTTER_TO_CHIP_RADIUS = 0.35

/**
 * Sites on the bare white paper, spread over the whole Page: the gutters between the columns, down
 * every row, 35 of them. There are no holes in a gutter, and a gutter is paper on every hue Page,
 * which the empty cells at the bottom right are not (they are Chips on another Page), so a Page
 * read as the wrong hue still has its paper where the sites are. The paper is one color under one
 * light, so the quality checks can use it to tell uneven light from a tone curve.
 */
export function pagePaperSites(hue: PageHue, taps: Corners): Site[] {
  const { chips, taps: known } = pageModel(hue)
  const lastRow = Math.max(...chips.map((c) => c.row))
  const gutters: GridPoint[] = []
  for (let row = 0; row <= lastRow; row++) {
    for (let col = 0; col < PAGE_CHROMAS.length - 1; col++) gutters.push({ col: col + 0.5, row })
  }
  return gridSites(known.map(gridPoint) as Four<GridPoint>, taps, gutters).map(({ center, radius }) => ({
    center,
    radius: Math.max(2, GUTTER_TO_CHIP_RADIUS * radius),
  }))
}

/** A hole is a circle two fifths of a column pitch in radius (0.26 of the taller row pitch). */
const HOLE_COLUMN_PITCHES = 0.4
/**
 * A Spot's circle is this share of the hole's narrowest half-width in the Photo (the map at the
 * nearest Chip overstates a hole on the far side of a tilted Page by up to a tenth) ...
 */
const SPOT_IN_HOLE = 0.9
/** ... less a tap's error: a tap is up to this many column pitches off center. */
const TAP_ERROR_PITCHES = 0.1

/**
 * The radius to read a Spot on a Page. A Page is often photographed small in the frame, so the
 * usual Spot circle (a share of the Photo) can be wider than a hole and read the Chips around it.
 * Near the Page the circle is cut to fit the hole. Seen at an angle the hole is an ellipse, with
 * the Page turned and squeezed by a different amount in each direction, so its narrowest half-width
 * is found from how the grid moves across the Photo at the nearest Chip (the singular values of the
 * local map), not from the pitch along either grid direction: that overstates a hole the Page's
 * tilt has sheared. The circle is that, less a tap's error. Away from the Page, or with taps that
 * give no sound view of it, the usual circle stands.
 */
export function pageSpotRadius(hue: PageHue, taps: Corners): (spot: XY, radius: number) => number {
  const { chips, taps: known } = pageModel(hue)
  const map = gridMap(known.map(gridPoint) as Four<GridPoint>, taps)
  const centers = chips.map(map)
  const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)
  const rows = Math.max(...chips.map((c) => c.row))
  const lastCol = PAGE_CHROMAS.length - 1
  return (spot, radius) => {
    let nearest = 0
    centers.forEach((c, i) => {
      if (dist(c, spot) < dist(centers[nearest], spot)) nearest = i
    })
    const { col, row } = chips[nearest]
    const here = centers[nearest]
    // How one column step and one row step move across the Photo, per column pitch of the Page.
    const step = (to: GridPoint, scale: number): XY => {
      const p = map(to)
      return { x: ((p.x - here.x) * scale), y: ((p.y - here.y) * scale) }
    }
    const across = col < lastCol ? step({ col: col + 1, row }, 1) : step({ col: col - 1, row }, -1)
    const down = row < rows ? step({ col, row: row + 1 }, 1 / PAGE_ROW_PITCHES) : step({ col, row: row - 1 }, -1 / PAGE_ROW_PITCHES)
    // Singular values of the map [across down]: the hole's half-widths in the Photo, per unit radius.
    const [aa, bb, ab] = [across.x ** 2 + across.y ** 2, down.x ** 2 + down.y ** 2, across.x * down.x + across.y * down.y]
    const mean = (aa + bb) / 2
    const spreadOut = Math.sqrt(((aa - bb) / 2) ** 2 + ab ** 2)
    const narrowest = Math.sqrt(Math.max(0, mean - spreadOut))
    // No sound view of the Page (the taps repeat or lie on a line): nothing to follow.
    if (!(narrowest > 0)) return radius
    // Not on the Page: the soil beside it.
    if (dist(here, spot) > PAGE_ROW_PITCHES * Math.max(Math.sqrt(aa), Math.sqrt(bb))) return radius
    return Math.max(2, Math.min(radius, SPOT_IN_HOLE * HOLE_COLUMN_PITCHES * narrowest - TAP_ERROR_PITCHES * Math.sqrt(aa)))
  }
}

/**
 * The hue Page the Reading should suggest retaking with, when the nearest Chip is not on the Page
 * used; undefined when there is nothing better to suggest. Only the Pages that work as a Card are
 * suggested. A Chip on a hue Page goes to that Page. A WHITE Chip goes to its own hue's Page, if it
 * has one. Gley 1 and the 10Y-5GY Page, the yellow-greens, go to 5Y, the nearest hue Page; 10R, the
 * red next to 2.5YR, goes to 2.5YR. Neutral Chips and Gley 2 have no hue Page nearer than the one used.
 */
export function suggestedPage(used: PageHue, chip: Chip): PageHue | undefined {
  const onHuePage = chip.pages.find(isPageHue)
  const suggestion: string | undefined = onHuePage
    ? onHuePage
    : chip.pages.includes("WHITE")
      ? chip.hue
      : chip.pages.includes("GLEY1") || chip.pages.includes("10Y-5GY")
        ? "5Y"
        : chip.pages.includes("10R")
          ? "2.5YR"
          : undefined
  return suggestion && isPageHue(suggestion) && suggestion !== used && !chip.pages.includes(used) ? suggestion : undefined
}
