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
import { gridSites, type Four, type GridPoint, type Site } from "./grid"
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
 * Sites on the bare white paper: the grid positions inside the Page where no Chip is printed
 * (the empty bottom right of most Pages). There are no holes there. The paper is one color
 * under one light, so the quality checks can use it to tell uneven light from a tone curve.
 */
export function pagePaperSites(hue: PageHue, taps: Corners): Site[] {
  const { chips, taps: known } = pageModel(hue)
  const lastRow = Math.max(...chips.map((c) => c.row))
  const empty: GridPoint[] = []
  for (let row = 0; row <= lastRow; row++) {
    for (let col = 0; col < PAGE_CHROMAS.length; col++) {
      if (!chips.some((c) => c.col === col && c.row === row)) empty.push({ col, row })
    }
  }
  return gridSites(known.map(gridPoint) as Four<GridPoint>, taps, empty)
}

/**
 * A hole's radius is two fifths of the column pitch, and the Chip read circle a fifth of it, so a
 * Spot circle of three fifths of the pitch (one and a half Chip circles) stays inside a hole even if
 * the tap is a tenth of a pitch off center.
 */
const SPOT_TO_CHIP_RADIUS = 1.5

/**
 * The radius to read a Spot on a Page. A Page is often photographed small in the frame, so the
 * usual Spot circle (a share of the Photo) can be wider than a hole and read the Chips around it.
 * Near the Page the circle follows the Chips' own scale: that of the Chip nearest the Spot.
 */
export function pageSpotRadius(sites: Site[], spot: XY, radius: number): number {
  const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)
  const nearest = sites.reduce((a, b) => (dist(b.center, spot) < dist(a.center, spot) ? b : a))
  return Math.max(2, Math.min(radius, SPOT_TO_CHIP_RADIUS * nearest.radius))
}
