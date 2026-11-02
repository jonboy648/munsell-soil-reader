// A color typed in by hand: is it a Chip of the soil book, or a notation that is valid but not
// printed there? Either one is accepted and prints as typed; the second comes with a note.
import * as munsell from "munsell"
import { CHIPS } from "@/engine/chips"
import { notationOf } from "./model"

export type ColorCheck =
  /** A Chip in the soil book. */
  | { kind: "chip"; notation: string; name: string }
  /** A Munsell notation the app can read but the book does not print. */
  | { kind: "exact"; notation: string; note: string }
  | { kind: "bad"; problem: string }

const BAD = "type a soil-book color such as 10YR 4/2."

/** Munsell hue steps run to 10, value to 10, and the chroma of any soil color is well under 30. */
const MAX_CHROMA = 30

export function checkColor(text: string): ColorCheck {
  const notation = notationOf(text)
  if (!notation) return { kind: "bad", problem: BAD }
  if (notation.startsWith("GLEY")) {
    return { kind: "bad", problem: "write a gley color by its hue, such as 10Y 5/1 or N 4/." }
  }
  const chip = CHIPS.find((c) => c.chip.notation === notation)
  if (chip) return { kind: "chip", notation, name: chip.chip.name }

  // Not in the book: is it a color the Munsell system has at all?
  const [hue, rest] = notation.split(" ")
  const [value, chroma] = rest.split("/").map(Number)
  const hueNumber = hue === "N" ? 0 : Number.parseFloat(hue)
  const inRange = (hue === "N" || (hueNumber > 0 && hueNumber <= 10)) && value > 0 && value <= 10 && chroma <= MAX_CHROMA
  let readable = inRange
  if (inRange) {
    try {
      readable = [...munsell.munsellToLinearRgb(notation)].every(Number.isFinite)
    } catch {
      readable = false
    }
  }
  if (!readable) {
    return {
      kind: "bad",
      problem: `${notation} is outside the Munsell system (hue 10 or less, value above 0 and up to 10, chroma up to ${MAX_CHROMA}); ${BAD}`,
    }
  }
  return { kind: "exact", notation, note: `${notation} is not a Chip in the soil book. It is printed as you typed it.` }
}
