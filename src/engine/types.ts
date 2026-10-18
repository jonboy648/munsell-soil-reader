// Public shapes of the reading engine. No DOM, no React: the engine is plain numbers in,
// plain numbers out. The shapes come from the prototype's `readSample`.
import type { Fit } from "./correction"
import type { PageHue } from "./page"

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
  // The four Chips the user tapped, in the order of `pageModel(hue).taps`. Only the one-hue Pages
  // (`PAGE_HUES`) work as a Card; any other Page throws UnsupportedCardError.
  | { kind: "page"; hue: ChipPage; taps: Corners }
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
  /** The radius of the circle the Spot was read from, in Photo pixels. */
  radius: number
  raw: ChipReading
  corrected?: ChipReading // absent when the Card is 'none'
  /**
   * Set when the Card is a Page and the corrected Reading's nearest Chip is not printed on it:
   * a hue Page to retake with, one that works as a Card (see `suggestedPage`). The correction is
   * strongest near the Page's own hue, so retaking with this Page would give a better Reading.
   */
  betterPage?: PageHue
}

export type QualityWarning = {
  kind: "glare" | "clipped" | "uneven-light" | "card-too-small"
  where: "card" | number
  advice: string
}

export type CardVerdict = "good" | "caution" | "failed"

export interface CardCheck {
  meanDE: number // mean CIEDE2000 between each Card reference and its true color, corrected by a fit made without it
  /**
   * Good: below CARD_CHECK_GOOD, nothing left out. Caution: below CARD_CHECK_CAUTION, or a gray
   * step or a Chip was left out. Failed: above that, or a row of the Page had to lose two Chips.
   */
  verdict: CardVerdict
  ok: boolean // verdict is good
  /** The references that looked dirty and were left out of the correction, by name (none for a clean Card). */
  leftOut: string[]
  /**
   * Page only: the value (8, 3, 2.5) of a row where two or more Chips off the /1 column had to be
   * left out. Then the check has failed whatever the mean says: the row's /1 Chip is probably
   * dirty, or the row's Chips are darker or stronger than the /1 column can describe.
   */
  suspectRow?: number
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
