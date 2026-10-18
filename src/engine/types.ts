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

export interface Chip {
  notation: string // '10YR 4/3'
  name: string // 'brown'; blank until the real Chip list lands
  hue: string // '10YR', or 'N' for neutrals
  value: number
  chroma: number
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
  quality: QualityWarning[] // empty until the quality checks land
  readings: Reading[]
}
