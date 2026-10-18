// The color tests the hydric soil indicators are written in, over Munsell notation: hue steps,
// gleyed and depleted matrices, and the contrast of a redox feature against its matrix. Pure.
// Sources: NRCS Field Indicators of Hydric Soils v9.3 (2026), glossary p. 38-41, and its Feb 2026 errata.

/** A color as the indicators read it. */
export interface Color {
  notation: string
  /** Position on the hue circle, 0 to 100 (10R is 10, 10YR is 20, 10Y is 30, 5G is 45), or null for neutral. */
  hue: number | null
  value: number
  chroma: number
}

const FAMILIES = ["R", "YR", "Y", "GY", "G", "BG", "B", "PB", "P", "RP"]

/** `10YR` as a place on the hue circle: 20. Null when it is not a soil-book hue. */
export function huePosition(hue: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([A-Z]+)$/.exec(hue.toUpperCase())
  const family = m ? FAMILIES.indexOf(m[2]) : -1
  return m && family >= 0 ? family * 10 + Number(m[1]) : null
}

/** The Munsell notation as `{ hue, value, chroma }`, or null. Reads `10YR 4/2`, `N 2.5/` and `GLEY1 3/10Y`. */
export function parseColor(notation: string): Color | null {
  const text = notation.trim().toUpperCase()
  const standard = /^(\d+(?:\.\d+)?[A-Z]+)\s*(\d+(?:\.\d+)?)\/(\d+)$/.exec(text)
  if (standard) {
    const hue = huePosition(standard[1])
    return hue === null ? null : { notation, hue, value: Number(standard[2]), chroma: Number(standard[3]) }
  }
  const neutral = /^N\s*(\d+(?:\.\d+)?)\/?$/.exec(text)
  if (neutral) return { notation, hue: null, value: Number(neutral[1]), chroma: 0 }
  // The gley charts print the hue after the slash, and their chroma is 1 (N has none).
  const gley = /^GLEY[12]\s*(\d+(?:\.\d+)?)\/(N|\d+[A-Z]+)$/.exec(text)
  if (gley) {
    if (gley[2] === "N") return { notation, hue: null, value: Number(gley[1]), chroma: 0 }
    const hue = huePosition(gley[2])
    return hue === null ? null : { notation, hue, value: Number(gley[1]), chroma: 1 }
  }
  return null
}

/** Hue steps between two colors (one step is 2.5 hue units), around the circle. Neutral has no hue: 0. */
export function hueSteps(a: Color, b: Color): number {
  if (a.hue === null || b.hue === null) return 0
  const apart = Math.abs(a.hue - b.hue)
  return Math.min(apart, 100 - apart) / 2.5
}

/** 10Y, 5GY, 10GY, 10G, 5BG, 10BG, 5B, 10B and 5PB: the gley hues that need a chroma of 1 or less. */
const GLEY_HUES = [30, 35, 40, 50, 55, 60, 65, 70, 75]
const GLEY_5G = 45

/**
 * A gleyed matrix (glossary p. 41): value 4 or more with a gley hue and chroma 1 or less, or 5G
 * with chroma 2 or less, or neutral. Chroma is never rounded.
 */
export function isGleyed({ hue, value, chroma }: Color): boolean {
  if (value < 4) return false
  if (hue === null) return true
  if (hue === GLEY_5G) return chroma <= 2
  return GLEY_HUES.includes(hue) && chroma <= 1
}

export type Contrast = "faint" | "distinct or prominent"

/**
 * How a redox feature contrasts with its matrix (glossary p. 39-40). Faint is: the same hue and a
 * value within 2 and chroma within 1; or one hue step and value within 1 and chroma within 1; or
 * two steps and no difference in value or chroma; or, at any hue, both colors dark and weak (value
 * 3 or less, chroma 2 or less). Anything above that is distinct or prominent, and an indicator that
 * asks for distinct or prominent features does not count the faint ones (so "not faint" is the test).
 */
export function contrast(matrix: Color, feature: Color): Contrast {
  const steps = hueSteps(matrix, feature)
  const dv = Math.abs(matrix.value - feature.value)
  const dc = Math.abs(matrix.chroma - feature.chroma)
  const faint =
    (steps === 0 && dv <= 2 && dc <= 1) ||
    (steps === 1 && dv <= 1 && dc <= 1) ||
    (steps === 2 && dv === 0 && dc === 0) ||
    (matrix.value <= 3 && matrix.chroma <= 2 && feature.value <= 3 && feature.chroma <= 2)
  return faint ? "faint" : "distinct or prominent"
}

/** 10YR or yellower: from 10YR on toward yellow and green (a neutral color is not redder). */
export const isYellowerThan = (color: Color, hue: string): boolean => {
  const limit = huePosition(hue)
  return color.hue === null || (limit !== null && color.hue >= limit && color.hue < 50)
}
