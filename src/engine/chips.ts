// The Chips a Reading can land on: the Chips really in the soil book, gley and neutral
// included. The CC0 list (chipList.ts) is the base; bookCorrections.ts adds what it lacks and
// fixes stale names, as checked against the physical book.
//
// A Chip's color comes from its notation, computed with munsell.js. Matching happens in Lab,
// from the unclamped color, so a Chip outside the sRGB gamut still matches; only its on-screen
// swatch (`rgb`) is clamped.
import * as munsell from "munsell"
import { deltaE2000, linearToLab, linearToRgb255, type Vec3 } from "./color"
import { BOOK_ADDITIONS, BOOK_RENAMES } from "./bookCorrections"
import { CHIP_LIST } from "./chipList"
import type { Chip, ChipPage, RgbTriple } from "./types"

export interface ChipEntry {
  chip: Chip
  lab: Vec3
  rgb: RgbTriple
}

const HUE_PAGES = new Set(["10R", "2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y"])
const GLEY2_HUES = new Set(["10G", "5BG", "10BG", "5B", "10B", "5PB"])

/**
 * The Page a Chip is printed on. The hue Pages hold one hue each. 10Y and 5GY have two Pages:
 * chroma 1 is on Gley 1, chromas 2 and 4 on the 10Y-5GY Page. Gley 1 also holds N, 10GY and 5G.
 */
function pageOf(hue: string, chroma: number): ChipPage {
  if (HUE_PAGES.has(hue)) return hue as ChipPage
  if (GLEY2_HUES.has(hue)) return "GLEY2"
  return (hue === "10Y" || hue === "5GY") && chroma > 1 ? "10Y-5GY" : "GLEY1"
}

function buildChips(): ChipEntry[] {
  const renames = new Map(BOOK_RENAMES)
  const base = CHIP_LIST.map(([notation, name]) => [notation, renames.get(notation) ?? name] as const)
  return [...base, ...BOOK_ADDITIONS].map(([notation, name]) => {
    const [hue, rest] = notation.split(" ")
    const [value, chroma] = rest.split("/").map(Number) // 'N 5/' has no chroma: Number('') is 0
    const lin = munsell.munsellToLinearRgb(notation)
    return {
      chip: { notation, name, hue, value, chroma, page: pageOf(hue, chroma) },
      lab: linearToLab(lin),
      rgb: linearToRgb255(lin),
    }
  })
}

export const CHIPS: readonly ChipEntry[] = buildChips()

/** Every Chip in the soil book that the engine knows, in a plain form for callers. */
export const SOIL_BOOK_CHIPS: readonly Chip[] = CHIPS.map((entry) => entry.chip)

/** The nearest Chip to a Lab color, and the three nearest, by CIEDE2000. */
export function nearestChips(lab: Vec3): { chip: ChipEntry; de: number }[] {
  return CHIPS.map((chip) => ({ chip, de: deltaE2000(lab, chip.lab) }))
    .sort((a, b) => a.de - b.de)
    .slice(0, 3)
}
