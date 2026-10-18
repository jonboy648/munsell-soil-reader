// readPhoto: Photo + Card + Spots in, Readings out. The engine's one main call.
import * as munsell from "munsell"
import { linearToLab, linearToRgb255, type Vec3 } from "./color"
import { nearestChips } from "./chips"
import { checkCard } from "./cardCheck"
import { NEUTRAL_PATCHES, PATCH_LINEAR, PATCH_NAMES, patchCenters } from "./colorchecker"
import { fitCorrection, type Fit, type Reference } from "./correction"
import { medianLinear, patchRadius, spotRadius } from "./sampling"
import type {
  ChipReading,
  Corners,
  Pixels,
  ReadPhotoInput,
  ReadPhotoResult,
  Reading,
} from "./types"

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
  const radius = patchRadius(corners)
  const references: Reference[] = patchCenters(corners).map((p, i) => ({
    measured: medianLinear(pixels, p, radius),
    truth: PATCH_LINEAR[i],
    ladder: NEUTRAL_PATCHES.includes(i),
    name: PATCH_NAMES[i],
  }))
  return checkCard(references, fit)
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
  return { ...(fit ? { cardCheck: fit.check } : {}), quality: [], readings }
}
