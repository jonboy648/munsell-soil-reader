// readPhoto: Photo + Card + Spots in, Readings out. The engine's one main call.
import * as munsell from "munsell"
import { linearToLab, linearToRgb255, luminance, type Vec3 } from "./color"
import { nearestChips } from "./chips"
import { NEUTRAL_PATCHES, PATCH_COLUMNS, PATCH_LINEAR, PATCH_ROWS, frameSites, patchSites } from "./colorchecker"
import { fitCorrection, heldOutError, type Fit, type Reference } from "./correction"
import { checkQuality, type Evenness, type QualityReference } from "./quality"
import { medianLinear, spotRadius } from "./sampling"
import type {
  CardCheck,
  ChipReading,
  Corners,
  Pixels,
  ReadPhotoInput,
  ReadPhotoResult,
  Reading,
} from "./types"

/** The Card check is good when the mean held-out CIEDE2000 of the Card is below this. */
export const CARD_CHECK_GOOD = 2

export class UnsupportedCardError extends Error {
  constructor(kind: string) {
    super(`A ${kind} Card is not supported yet.`)
    this.name = "UnsupportedCardError"
  }
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

function fitCard(pixels: Pixels, corners: Corners, fit: Fit) {
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
 * Spread of the Card's black frame, in stops, above which the light is uneven, and above which
 * it is the corners rather than the light. The frame is one black surface, so in even light
 * every part of it is equally bright whatever the camera's tone curve does.
 */
const FRAME_UNEVEN_STOPS = 0.2
const FRAME_OFF_CARD_STOPS = 2

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

export function readPhoto({
  pixels,
  card,
  spots,
  correction = fitCorrection,
}: ReadPhotoInput): ReadPhotoResult {
  if (card.kind === "page") throw new UnsupportedCardError("Page")
  const fit = card.kind === "colorchecker" ? fitCard(pixels, card.corners, correction) : null
  const radius = spotRadius(pixels)
  const readings = spots.map((spot): Reading => {
    const lin = medianLinear(pixels, spot, radius)
    const reading: Reading = { spot, raw: readColor(lin) }
    if (fit) reading.corrected = readColor(fit.correct(lin))
    return reading
  })
  const cardParts = card.kind === "colorchecker" ? cardQuality(card.corners) : { references: [] }
  const quality = checkQuality({ pixels, spots, spotRadius: radius, ...cardParts })
  return { ...(fit ? { cardCheck: fit.check } : {}), quality, readings }
}
