// readPhoto: Photo + Card + Spots in, Readings out. The engine's one main call.
import * as munsell from "munsell"
import { linearToLab, linearToRgb255, luminance, type Vec3 } from "./color"
import { nearestChips } from "./chips"
import { NEUTRAL_PATCHES, PATCH_COLUMNS, PATCH_LINEAR, PATCH_ROWS, frameSites, patchSites } from "./colorchecker"
import { fitCorrection, heldOutError, type Correction, type Fit, type Reference } from "./correction"
import { leftOut } from "./leftOut"
import {
  isPageHue,
  pageModel,
  pagePaperSites,
  pageSites,
  pageSpacing,
  pageSpotRadius,
  suggestedPage,
  type PageHue,
} from "./page"
import { checkQuality, type Evenness, type QualityReference } from "./quality"
import { medianLinear, spotRadius } from "./sampling"
import type {
  CardCheck,
  ChipPage,
  ChipReading,
  Corners,
  Pixels,
  ReadPhotoInput,
  ReadPhotoResult,
  Reading,
  XY,
} from "./types"

/** The Card check is good when the mean held-out CIEDE2000 of the Card is below this. */
export const CARD_CHECK_GOOD = 2

export class UnsupportedCardError extends Error {
  constructor(kind: string) {
    super(`A ${kind} Card is not supported yet.`)
    this.name = "UnsupportedCardError"
  }
}

/** A Page that is not one hue (Gley, 10Y-5GY, WHITE), or one whose layout is unchecked (10R), is not a Card yet. */
function pageHueOf(page: ChipPage): PageHue {
  if (!isPageHue(page)) throw new UnsupportedCardError(`${page} Page`)
  return page
}

/** Munsell notation of a color, one decimal, or a note when the inversion gives no answer. */
function exactMunsell(lin: Vec3): string {
  try {
    return munsell.linearRgbToMunsell(
      Math.max(0, lin[0]),
      Math.max(0, lin[1]),
      Math.max(0, lin[2]),
      undefined,
      1,
      1e-6,
      200,
      "last",
    )
  } catch {
    return "(no answer)"
  }
}

function readColor(lin: Vec3): ChipReading {
  const lab = linearToLab(lin)
  const [best, ...rest] = nearestChips(lab)
  return {
    exact: exactMunsell(lin),
    chip: best.chip.chip,
    chipDE: best.de,
    top3: [best, ...rest].map(({ chip, de }) => ({ chip: chip.chip, de })),
    rgb: linearToRgb255(lin),
    chipRgb: best.chip.rgb,
  }
}

/** A Card's correction and its Card check, and how wide to read a Spot when the Card knows better than the Photo. */
interface CardFit {
  correct: Correction
  check: CardCheck
  spotRadius?: (spot: XY, radius: number) => number
}

/** Fits the correction to a ColorChecker in the Photo and runs the Card check on it. */
export function fitCard(pixels: Pixels, corners: Corners, fit: Fit): CardFit {
  const references: Reference[] = patchSites(corners).map(({ center, radius }, i) => ({
    measured: medianLinear(pixels, center, radius),
    truth: PATCH_LINEAR[i],
    ladder: NEUTRAL_PATCHES.includes(i),
  }))
  const meanDE = heldOutError(references, fit)
  const check: CardCheck = { meanDE, ok: meanDE < CARD_CHECK_GOOD }
  return { correct: fit(references), check }
}

/**
 * The same fit and Card check on a Page's Chips, with the ones that disagree with the rest left
 * out first: a few smudged Chips must not drag the correction. The Card check names them. If two
 * or more Chips off the ladder in one value row had to go, the fit is not to be trusted, however
 * well the rest fit: that row's ladder step is probably dirty, or its Chips are beyond the ladder.
 */
function fitPage(pixels: Pixels, hue: PageHue, taps: Corners, fit: Fit): CardFit {
  const { chips, values } = pageModel(hue)
  const sites = pageSites(hue, taps)
  const references: Reference[] = chips.map(({ linear, col }, i) => ({
    measured: medianLinear(pixels, sites[i].center, sites[i].radius),
    truth: linear,
    ladder: col === 0, // the /1 column runs from the lightest row to the darkest
  }))
  const { indices, suspectRow } = leftOut(references, chips.map((c) => c.row), fit)
  const kept = references.filter((_, i) => !indices.includes(i))
  const meanDE = heldOutError(kept, fit)
  const check: CardCheck = {
    meanDE,
    ok: meanDE < CARD_CHECK_GOOD && suspectRow === undefined,
    leftOut: indices.map((i) => chips[i].chip.notation),
    ...(suspectRow === undefined ? {} : { suspectRow: values[suspectRow] }),
  }
  return { correct: fit(kept), check, spotRadius: pageSpotRadius(hue, taps) }
}

/**
 * Spread of the Card's black frame, in stops, above which the light is uneven, and above which
 * it is the corners rather than the light. The frame is one black surface, so in even light
 * every part of it is equally bright whatever the camera's tone curve does.
 */
export const FRAME_UNEVEN_STOPS = 0.3
export const FRAME_OFF_CARD_STOPS = 3
/**
 * A Page's white paper is as even as the frame, but the Page is big in the Photo, so the light
 * falls off across it: on Jon's four real Pages the paper's plane fit reads 0.11, 0.16, 0.27 and
 * 0.33 stops, over the frame's 0.3. Provisional, until real Photos are run (#15).
 */
export const PAGE_UNEVEN_STOPS = 0.45
export const PAGE_OFF_CARD_STOPS = 3

/**
 * What the quality checks need from a ColorChecker: its patches as references (the grays are
 * the tonal ladder), the black frame where four patches meet as the evenness samples, and the
 * spacing of the patches in the Photo.
 */
function cardQuality(corners: Corners): { references: QualityReference[]; spacing: number; evenness: Evenness } {
  const references = patchSites(corners).map(({ center, radius }, i) => ({
    at: center,
    radius,
    y: luminance(PATCH_LINEAR[i]),
    ladder: NEUTRAL_PATCHES.includes(i),
  }))
  const samples = frameSites(corners).map(({ center, radius }) => ({ at: center, radius, y: 1 }))
  // The patch spacing, from the Card's diagonals: the two longest distances between taps are
  // the diagonals whatever order the corners were tapped in, and the shorter is the one a
  // tilted Card shortens. (Edges over their patch counts would call a good Card small when the
  // corners are in the wrong order.)
  const taps = corners.flatMap((p, i) => corners.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y)))
  const spacing = taps.sort((a, b) => b - a)[1] / Math.hypot(PATCH_COLUMNS - 1, PATCH_ROWS - 1)
  return { references, spacing, evenness: { samples, limitStops: FRAME_UNEVEN_STOPS, offCardStops: FRAME_OFF_CARD_STOPS } }
}

/**
 * The same for a Page: its Chips as references (the /1 column is the tonal ladder), the bare
 * paper over the whole Page as the evenness samples, and the column pitch as the spacing.
 */
function pageQuality(hue: PageHue, taps: Corners): { references: QualityReference[]; spacing: number; evenness: Evenness } {
  const { chips } = pageModel(hue)
  const references = pageSites(hue, taps).map(({ center, radius }, i) => ({
    at: center,
    radius,
    y: luminance(chips[i].linear),
    ladder: chips[i].col === 0,
  }))
  const samples = pagePaperSites(hue, taps).map(({ center, radius }) => ({ at: center, radius, y: 1 }))
  return {
    references,
    spacing: pageSpacing(hue, taps),
    evenness: { samples, limitStops: PAGE_UNEVEN_STOPS, offCardStops: PAGE_OFF_CARD_STOPS },
  }
}

export function readPhoto({
  pixels,
  card,
  spots,
  correction = fitCorrection,
}: ReadPhotoInput): ReadPhotoResult {
  const hue = card.kind === "page" ? pageHueOf(card.hue) : null
  const fit: CardFit | null =
    card.kind === "colorchecker"
      ? fitCard(pixels, card.corners, correction)
      : card.kind === "page"
        ? fitPage(pixels, hue!, card.taps, correction)
        : null
  const radius = spotRadius(pixels)
  const readings = spots.map((spot): Reading => {
    const read = fit?.spotRadius?.(spot, radius) ?? radius
    const lin = medianLinear(pixels, spot, read)
    const reading: Reading = { spot, radius: read, raw: readColor(lin) }
    if (fit) reading.corrected = readColor(fit.correct(lin))
    // The correction is strongest near the Page's own hue: point to the Page the soil belongs on.
    const better = hue && reading.corrected ? suggestedPage(hue, reading.corrected.chip) : undefined
    if (better) reading.betterPage = better
    return reading
  })
  const cardParts =
    card.kind === "colorchecker"
      ? cardQuality(card.corners)
      : card.kind === "page"
        ? pageQuality(hue!, card.taps)
        : { references: [] }
  const { warnings: quality, offCard } = checkQuality({
    pixels,
    spots: readings.map((r) => ({ at: r.spot, radius: r.radius })),
    ...cardParts,
  })
  return { ...(fit ? { cardCheck: fit.check } : {}), ...(offCard ? { offCard } : {}), quality, readings }
}
