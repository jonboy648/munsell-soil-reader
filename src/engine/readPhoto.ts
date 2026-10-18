// readPhoto: Photo + Card + Spots in, Readings out. The engine's one main call.
import * as munsell from "munsell"
import { linearToLab, linearToRgb255, luminance, type Vec3 } from "./color"
import { nearestChips } from "./chips"
import { NEUTRAL_PATCHES, PATCH_COLUMNS, PATCH_LINEAR, PATCH_ROWS, patchCenters } from "./colorchecker"
import { cardFitError, fitCardCorrection } from "./correction"
import { checkQuality, type Evenness, type QualityReference } from "./quality"
import { medianLinear, patchRadius, spotRadius } from "./sampling"
import type {
  CardCheck,
  ChipReading,
  Corners,
  Pixels,
  ReadPhotoInput,
  ReadPhotoResult,
  Reading,
  XY,
} from "./types"

/** The Card check is good when the mean CIEDE2000 of the corrected patches is below this. */
export const CARD_CHECK_GOOD = 3

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

function fitCard(pixels: Pixels, corners: Corners) {
  const radius = patchRadius(corners)
  const measured = patchCenters(corners).map((p) => medianLinear(pixels, p, radius))
  const correct = fitCardCorrection(measured)
  const meanDE = cardFitError(measured, correct)
  const check: CardCheck = { meanDE, ok: meanDE < CARD_CHECK_GOOD }
  return { correct, check }
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
 * the tonal ladder) and the black frame where four patches meet, read in a circle a quarter of
 * the way across the diagonal between the patches (the darkest pixels there are the frame, even
 * when a tap is a few pixels off).
 */
function cardQuality(corners: Corners): { references: QualityReference[]; spacing: number; evenness: Evenness } {
  const centers = patchCenters(corners)
  const radius = patchRadius(corners)
  const references = centers.map((at, i) => ({
    at,
    radius,
    y: luminance(PATCH_LINEAR[i]),
    neutral: NEUTRAL_PATCHES.includes(i),
  }))
  const samples = []
  for (let row = 0; row < PATCH_ROWS - 1; row++) {
    for (let col = 0; col < PATCH_COLUMNS - 1; col++) {
      const a = centers[row * PATCH_COLUMNS + col]
      const b = centers[(row + 1) * PATCH_COLUMNS + col + 1]
      samples.push({ at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, radius: 0.25 * Math.hypot(a.x - b.x, a.y - b.y), y: 1 })
    }
  }
  const [tl, tr, br, bl] = corners
  const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)
  const spacing = Math.min(
    dist(tl, tr) / (PATCH_COLUMNS - 1),
    dist(bl, br) / (PATCH_COLUMNS - 1),
    dist(tl, bl) / (PATCH_ROWS - 1),
    dist(tr, br) / (PATCH_ROWS - 1),
  )
  return { references, spacing, evenness: { samples, limitStops: FRAME_UNEVEN_STOPS, offCardStops: FRAME_OFF_CARD_STOPS } }
}

export function readPhoto({ pixels, card, spots }: ReadPhotoInput): ReadPhotoResult {
  if (card.kind === "page") throw new UnsupportedCardError("Page")
  const fit = card.kind === "colorchecker" ? fitCard(pixels, card.corners) : null
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
