// readPhoto: Photo + Card + Spots in, Readings out. The engine's one main call.
import * as munsell from "munsell"
import { linearToLab, linearToRgb255, type Vec3 } from "./color"
import { nearestChips } from "./chips"
import { NEUTRAL_PATCHES, PATCH_LINEAR, patchSites } from "./colorchecker"
import { fitCorrection, heldOutError, type Correction, type Fit, type Reference } from "./correction"
import { leftOut } from "./leftOut"
import { isPageHue, pageModel, pageSites, pageSpotRadius, type PageHue } from "./page"
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

function fitCard(pixels: Pixels, corners: Corners, fit: Fit): CardFit {
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
 * out first: a few smudged Chips must not drag the correction. The Card check names them.
 */
function fitPage(pixels: Pixels, hue: PageHue, taps: Corners, fit: Fit): CardFit {
  const { chips } = pageModel(hue)
  const sites = pageSites(hue, taps)
  const references: Reference[] = chips.map(({ linear, col }, i) => ({
    measured: medianLinear(pixels, sites[i].center, sites[i].radius),
    truth: linear,
    ladder: col === 0, // the /1 column runs from the lightest row to the darkest
  }))
  const out = leftOut(references, fit)
  const kept = references.filter((_, i) => !out.includes(i))
  const meanDE = heldOutError(kept, fit)
  const check: CardCheck = {
    meanDE,
    ok: meanDE < CARD_CHECK_GOOD,
    leftOut: out.map((i) => chips[i].chip.notation),
  }
  return {
    correct: fit(kept),
    check,
    spotRadius: (spot: XY, radius: number) => pageSpotRadius(sites, spot, radius),
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
    const pages = reading.corrected?.chip.pages
    if (hue && pages && !pages.includes(hue)) reading.betterPage = pages[0]
    return reading
  })
  // The quality checks (#5) go here. On a Page, `pagePaperSites(hue, card.taps)` is the white paper
  // between Chips, one color under one light, for the uneven-light check.
  return { ...(fit ? { cardCheck: fit.check } : {}), quality: [], readings }
}
