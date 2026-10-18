// Photo quality: is this Photo good enough to trust a Reading from? Four problems are
// flagged: glare, clipping (crushed blacks or blown highlights), uneven light across the Card,
// and a Card too small in the Photo. Why each threshold is what it is: docs/quality-thresholds.md.
//
// Nothing here knows about the ColorChecker. It works on Card references (a position, a read
// radius and the luminance each should have in even light), so a Page of the soil book can
// supply its own list. References marked `neutral` are the Card's tonal ladder: the brightest
// shows whether the exposure blows out the highlights, the darkest whether it crushes the
// shadows, and all of them together show whether the light is even.
import { luminance } from "./color"
import { medianLinear } from "./sampling"
import type { Pixels, QualityWarning, XY } from "./types"

/** A pixel is blown when every channel is at least this (8-bit). */
export const BLOWN_LEVEL = 250
/** A pixel is crushed when every channel is at most this (8-bit). */
export const CRUSHED_LEVEL = 5
/** Share of an area's pixels that blown must reach to count as glare. A stray speck is not. */
export const GLARE_SHARE = 0.05
/** Share of an area that must be blown (or crushed) for it to count as clipped. */
export const CLIP_SHARE = 0.5
/** Spread of neutral brightness, in stops, above which the light across the Card is uneven. */
export const UNEVEN_STOPS = 0.8
/** Fewest neutral references that can still show whether the light is even. */
export const MIN_NEUTRALS = 3
/** Reference spacing, in Photo pixels, below which the Card is too small to read. */
export const MIN_SPACING_PX = 24
/**
 * Card check (mean CIEDE2000) at which the references are taken to be off the Card, as when
 * the corners are tapped in the wrong order. What they show then says nothing about the Photo.
 */
export const OFF_CARD_DE = 20

export interface QualityReference {
  at: XY
  /** Read radius, in Photo pixels. */
  radius: number
  /** Relative luminance (white is 1) the reference has in even light. */
  y: number
  /** Part of the Card's tonal ladder. */
  neutral?: boolean
}

export interface QualityInput {
  pixels: Pixels
  spots: XY[]
  spotRadius: number
  /** Empty when there is no Card. */
  references: QualityReference[]
}

interface Shares {
  blown: number
  crushed: number
}

/** Share of the circle's pixels that are blown and that are crushed. */
function shares({ width, height, data }: Pixels, center: XY, radius: number): Shares {
  let total = 0
  let blown = 0
  let crushed = 0
  const y0 = Math.max(0, Math.round(center.y - radius))
  const y1 = Math.min(height - 1, Math.round(center.y + radius))
  const x0 = Math.max(0, Math.round(center.x - radius))
  const x1 = Math.min(width - 1, Math.round(center.x + radius))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius * radius) continue
      const i = (y * width + x) * 4
      const low = Math.min(data[i], data[i + 1], data[i + 2])
      const high = Math.max(data[i], data[i + 1], data[i + 2])
      total++
      if (low >= BLOWN_LEVEL) blown++
      if (high <= CRUSHED_LEVEL) crushed++
    }
  }
  return total === 0 ? { blown: 0, crushed: 0 } : { blown: blown / total, crushed: crushed / total }
}

/** Closest pair of reference centers, in Photo pixels. */
function spacing(references: QualityReference[]): number {
  let closest = Infinity
  references.forEach((a, i) => {
    for (const b of references.slice(i + 1)) closest = Math.min(closest, Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y))
  })
  return closest
}

/**
 * Spread, in stops, of how much brighter than it should be each readable neutral came out.
 * In even light every neutral is off by the same factor (the camera's exposure), so the
 * spread is small. A shadow over part of the Card pulls some neutrals down and not others.
 * Neutrals that are blown or crushed say nothing about the light, so they are left out.
 * Null when fewer than MIN_NEUTRALS are readable.
 */
function neutralSpread(pixels: Pixels, neutrals: QualityReference[], shared: Shares[]): number | null {
  const ratios = neutrals
    .filter((_, i) => shared[i].blown < GLARE_SHARE && shared[i].crushed < GLARE_SHARE)
    .map(({ at, radius, y }) => luminance(medianLinear(pixels, at, radius)) / y)
  if (ratios.length < MIN_NEUTRALS) return null
  return Math.log2(Math.max(...ratios) / Math.min(...ratios))
}

const ADVICE = {
  cardGlare: "Glare on the Card. Tilt the Card or move into shade to lose the reflection, then take the Photo again.",
  spotGlare: "Glare on this Spot. Tilt the sample or move into shade to lose the reflection, or tap a Spot away from the shine.",
  cardBlown: "The brightest part of the Card is washed out to pure white. Use less light or lower the exposure, then take the Photo again.",
  cardCrushed: "The darkest part of the Card is lost in pure black. Add light or raise the exposure, then take the Photo again.",
  cardBoth: "The Card has parts washed out to white and parts lost in black. Move out of harsh sun into even light, then take the Photo again.",
  spotBlown: "This Spot is washed out to pure white. Use less light or lower the exposure, then take the Photo again.",
  spotCrushed: "This Spot is lost in pure black. Add light or raise the exposure, then take the Photo again.",
  uneven: "The light across the Card is uneven, for example a shadow over part of it. Move into even light, or shade the Card and the soil together, then take the Photo again.",
  small: "The Card is small in the Photo. Move closer so the Card fills more of the Photo, then take it again.",
}

export function checkQuality({ pixels, spots, spotRadius, references }: QualityInput): QualityWarning[] {
  const out: QualityWarning[] = []
  const warn = (kind: QualityWarning["kind"], where: QualityWarning["where"], advice: string) =>
    out.push({ kind, where, advice })

  // The Card first. Its white is the brightest thing the exposure can put on it, so a
  // reference with more blown pixels than the white has is glare. If the white itself is
  // blown, the exposure is the problem, and the same goes for the black being crushed.
  const refShares = references.map((r) => shares(pixels, r.at, r.radius))
  const ladder = references.flatMap((r, i) => (r.neutral ? [{ r, s: refShares[i] }] : []))
  ladder.sort((a, b) => b.r.y - a.r.y)
  const hasLadder = ladder.length > 0
  const whiteBlown = hasLadder ? ladder[0].s.blown : 0
  const blackCrushed = hasLadder && ladder[ladder.length - 1].s.crushed >= CLIP_SHARE
  const whiteClipped = whiteBlown >= CLIP_SHARE

  if (refShares.some((s) => s.blown - whiteBlown >= GLARE_SHARE)) warn("glare", "card", ADVICE.cardGlare)
  if (whiteClipped || blackCrushed) {
    warn("clipped", "card", whiteClipped && blackCrushed ? ADVICE.cardBoth : whiteClipped ? ADVICE.cardBlown : ADVICE.cardCrushed)
  }
  const spread = neutralSpread(pixels, ladder.map((l) => l.r), ladder.map((l) => l.s))
  if (spread !== null && spread > UNEVEN_STOPS) warn("uneven-light", "card", ADVICE.uneven)
  if (references.length > 1 && spacing(references) < MIN_SPACING_PX) warn("card-too-small", "card", ADVICE.small)

  // Then each Spot, by the same rule. With no Card to compare to, a Spot that is mostly blown
  // is taken as exposure and a partly blown one as glare.
  spots.forEach((spot, i) => {
    const s = shares(pixels, spot, spotRadius)
    if (s.blown >= GLARE_SHARE) {
      const glare = hasLadder ? s.blown - whiteBlown >= GLARE_SHARE : s.blown < CLIP_SHARE
      if (glare) warn("glare", i, ADVICE.spotGlare)
      else warn("clipped", i, ADVICE.spotBlown)
    } else if (s.crushed >= CLIP_SHARE) {
      warn("clipped", i, ADVICE.spotCrushed)
    }
  })
  return out
}
