// The Chips a Reading can land on.
//
// This is the prototype's approximate soil-book grid (10R to 5Y, values 2.5 to 8, chromas 1
// to 8, in-gamut only, plus neutrals). It is NOT the official Chip list and has no color
// names; the real list replaces it in ticket 3, behind the same `CHIPS` table.
import * as munsell from "munsell"
import { deltaE2000, linearToLab, linearToRgb255, type Vec3 } from "./color"
import type { Chip, RgbTriple } from "./types"

export interface ChipEntry {
  chip: Chip
  lab: Vec3
  rgb: RgbTriple
}

const HUES: [string, number][] = [
  ["10R", 10], ["2.5YR", 12.5], ["5YR", 15], ["7.5YR", 17.5], ["10YR", 20], ["2.5Y", 22.5], ["5Y", 25],
]
const VALUES = [2.5, 3, 4, 5, 6, 7, 8]
const CHROMAS = [1, 2, 3, 4, 6, 8]

function buildChips(): ChipEntry[] {
  const entries: ChipEntry[] = []
  const add = (hue: string, notation: string, h: number, value: number, chroma: number) => {
    const lin = munsell.mhvcToLinearRgb(h, value, chroma)
    if (!lin.every((x) => x >= 0 && x <= 1)) return // outside the sRGB screen
    entries.push({
      chip: { notation, name: "", hue, value, chroma },
      lab: linearToLab(lin),
      rgb: linearToRgb255(lin),
    })
  }
  for (const [hue, h] of HUES)
    for (const v of VALUES)
      for (const c of CHROMAS) add(hue, `${hue} ${v}/${c}`, h, v, c)
  for (const v of VALUES) add("N", `N ${v}`, 0, v, 0)
  return entries
}

export const CHIPS: readonly ChipEntry[] = buildChips()

/** The nearest Chip to a Lab color, and the three nearest, by CIEDE2000. */
export function nearestChips(lab: Vec3): { chip: ChipEntry; de: number }[] {
  return CHIPS.map((chip) => ({ chip, de: deltaE2000(lab, chip.lab) }))
    .sort((a, b) => a.de - b.de)
    .slice(0, 3)
}
