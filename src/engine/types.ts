// Public shapes of the reading engine. No DOM, no React: the engine is plain numbers in,
// plain numbers out. The shapes come from the prototype's `readSample`.
import type { Fit } from "./correction"

/** A point in Photo pixels, origin at the top left. */
export type XY = { x: number; y: number }

/** Centres of the Card's corner patches: top left, top right, bottom right, bottom left. */
export type Corners = [XY, XY, XY, XY]

/**
 * 8-bit RGBA pixels, row by row. The browser's `ImageData` fits this shape, and so does
 * a plain object, which is how the tests build simulated Photos without a DOM.
 */
export interface Pixels {
  readonly width: number
  readonly height: number
  readonly data: ArrayLike<number>
}

export type Card =
  | { kind: "colorchecker"; corners: Corners }
  | { kind: "page"; hue: string; corners: Corners } // hue like '10YR'; not supported yet (ticket 8)
  | { kind: "none" }

/** The Pages of the soil book (2009 Revision) that hold the Chips the engine knows. */
export type ChipPage =
  | "10R" | "2.5YR" | "5YR" | "7.5YR" | "10YR" | "2.5Y" | "5Y"
  | "10Y-5GY" | "GLEY1" | "GLEY2" | "WHITE"

export interface Chip {
  notation: string // '10YR 4/3'; a neutral Chip has no chroma: 'N 5/'
  name: string // 'brown'
  hue: string // '10YR', '5GY', or 'N' for the neutral Chips
  value: number
  chroma: number // 0 for a neutral Chip
  pages: readonly ChipPage[] // the Pages of the soil book the Chip is printed on; N 8/ is on two
}

export type RgbTriple = [number, number, number]

export interface ChipReading {
  exact: string // e.g. '9.6YR 4.1/2.8'
  chip: Chip // nearest Chip
  chipDE: number // CIEDE2000 to that Chip
  top3: { chip: Chip; de: number }[]
  rgb: RgbTriple // display sRGB (0-255) of the color that was read
  chipRgb: RgbTriple // display sRGB (0-255) of the nearest Chip
}

export interface Reading {
  spot: XY
  raw: ChipReading
  corrected?: ChipReading // absent when the Card is 'none'
}

export type QualityWarning = {
  kind: "glare" | "clipped" | "uneven-light" | "card-too-small"
  where: "card" | number
  advice: string
}

export interface CardCheck {
  meanDE: number // mean CIEDE2000 between each Card reference and its true color, corrected by a fit made without it
  ok: boolean // good when meanDE is below CARD_CHECK_GOOD
}

export interface ReadPhotoInput {
  pixels: Pixels
  card: Card
  spots: XY[]
  /** The fit used to correct against the Card. For comparing corrections in tests; the app leaves it out. */
  correction?: Fit
}

export interface ReadPhotoResult {
  cardCheck?: CardCheck // absent when the Card is 'none'
  offCard?: true // present when the grays on the Card came out in the wrong order: the corners are probably off the Card
  quality: QualityWarning[] // problems with the Photo; empty when it is good
  readings: Reading[]
}
