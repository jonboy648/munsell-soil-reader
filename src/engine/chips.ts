// The Chips a Reading can land on: the Chips really in the soil book (chipList.ts), gley
// included.
//
// A Chip's color comes from its notation, computed with munsell.js. Matching happens in Lab,
// from the unclamped color, so a Chip outside the sRGB gamut still matches; only its on-screen
// swatch (`rgb`) is clamped.
import * as munsell from "munsell"
import { deltaE2000, linearToLab, linearToRgb255, type Vec3 } from "./color"
import { CHIP_LIST } from "./chipList"
import type { Chip, RgbTriple } from "./types"

export interface ChipEntry {
  chip: Chip
  lab: Vec3
  rgb: RgbTriple
}

function buildChips(): ChipEntry[] {
  return CHIP_LIST.map(([notation, name]) => {
    const [hue, rest] = notation.split(" ")
    const [value, chroma] = rest.split("/").map(Number)
    const lin = munsell.munsellToLinearRgb(notation)
    return {
      chip: { notation, name, hue, value, chroma },
      lab: linearToLab(lin),
      rgb: linearToRgb255(lin),
    }
  })
}

export const CHIPS: readonly ChipEntry[] = buildChips()

/** The nearest Chip to a Lab color, and the three nearest, by CIEDE2000. */
export function nearestChips(lab: Vec3): { chip: ChipEntry; de: number }[] {
  return CHIPS.map((chip) => ({ chip, de: deltaE2000(lab, chip.lab) }))
    .sort((a, b) => a.de - b.de)
    .slice(0, 3)
}
