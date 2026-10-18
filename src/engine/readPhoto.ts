// readPhoto: Photo + Card + Spots in, Readings out. The engine's one main call.
import * as munsell from "munsell"
import { linearToLab, linearToRgb255, type Vec3 } from "./color"
import { nearestChips } from "./chips"
import { NEUTRAL_PATCHES, PATCH_LINEAR, patchCenters } from "./colorchecker"
import { fitCorrection, heldOutError, type Reference } from "./correction"
import type { RootPolynomialDegree } from "./rootPolynomial"
import { medianLinear, patchRadius, spotRadius } from "./sampling"
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
export const CARD_CHECK_GOOD = 3

/** The degree of the root-polynomial correction the engine applies. */
export const CORRECTION_DEGREE: RootPolynomialDegree = 1

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

function fitCard(pixels: Pixels, corners: Corners, degree: RootPolynomialDegree) {
  const radius = patchRadius(corners)
  const references: Reference[] = patchCenters(corners).map((p, i) => ({
    measured: medianLinear(pixels, p, radius),
    truth: PATCH_LINEAR[i],
    neutral: NEUTRAL_PATCHES.includes(i),
  }))
  const fit = fitCorrection(degree)
  const meanDE = heldOutError(references, fit)
  const check: CardCheck = { meanDE, ok: meanDE < CARD_CHECK_GOOD }
  return { correct: fit(references), check }
}

export function readPhoto({
  pixels,
  card,
  spots,
  correctionDegree = CORRECTION_DEGREE,
}: ReadPhotoInput): ReadPhotoResult {
  if (card.kind === "page") throw new UnsupportedCardError("Page")
  const fit = card.kind === "colorchecker" ? fitCard(pixels, card.corners, correctionDegree) : null
  const radius = spotRadius(pixels)
  const readings = spots.map((spot): Reading => {
    const lin = medianLinear(pixels, spot, radius)
    const reading: Reading = { spot, raw: readColor(lin) }
    if (fit) reading.corrected = readColor(fit.correct(lin))
    return reading
  })
  return { ...(fit ? { cardCheck: fit.check } : {}), quality: [], readings }
}
