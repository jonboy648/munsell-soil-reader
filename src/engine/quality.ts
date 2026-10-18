// Photo quality: is this Photo good enough to trust a Reading from? Four problems are
// flagged: glare, clipping (crushed blacks or blown highlights), uneven light across the Card,
// and a Card too small in the Photo. Why each threshold is what it is: docs/quality-thresholds.md.
//
// Nothing here knows about the ColorChecker. The caller describes the Card with two lists:
//  - references: where the Card's patches are, each with a read radius and the luminance it has
//    in even light. They show glare, clipping and the Card's spacing. References marked
//    `neutral` are the Card's tonal ladder: the brightest shows whether the exposure blows out
//    the highlights, the darkest whether it crushes the shadows.
//  - evenness: places on the Card that should come out equally bright in even light, with the
//    limit that suits them. The ColorChecker passes its black frame; a Page of the soil book
//    will pass its white paper, with a much tighter limit.
import { decode, luminance } from "./color"
import { medianLinear } from "./sampling"
import type { Pixels, QualityWarning, XY } from "./types"

/** A channel at least this (8-bit) is at the top of the range, give or take noise. */
export const BLOWN_LEVEL = 253
/** A pixel is blown when this many of its channels are at BLOWN_LEVEL or more. Two, so a white that touches the top in one channel, as a white does under warm light, is not clipped. */
export const BLOWN_CHANNELS = 2
/** A pixel is crushed when every channel is at most this (8-bit). */
export const CRUSHED_LEVEL = 5
/** Share of an area's pixels that blown must reach to count as glare. A stray speck is not. */
export const GLARE_SHARE = 0.05
/** Share of an area that must be blown (or crushed) for it to count as clipped. */
export const CLIP_SHARE = 0.5
/**
 * A Spot's own level, from its darker quarter of unblown pixels (strongest channel, 8-bit), at
 * or above which it is at the top of the range: blown pixels on it are exposure, not glare.
 */
export const NEAR_CLIP_LEVEL = 245
/** Fewest readable grays that can still show whether the corners are on the Card. */
export const MIN_NEUTRALS = 3
/** Pairs of readable grays measured in the wrong order at which the references are off the Card. */
export const OFF_CARD_INVERSIONS = 3
/** Reference spacing, in Photo pixels, below which the Card is too small to read. */
export const MIN_SPACING_PX = 24
/** Fewest evenness samples that can still show whether the light is even. */
export const MIN_EVEN_SAMPLES = 6
/** Evenness samples read this share of the way up from their darkest pixel (0 darkest, 1 brightest). */
export const EVEN_PERCENTILE = 0.15
/** Evenness samples closer than this many reference spacings to glare are left out. */
export const GLARE_REACH = 1

export interface QualityReference {
  at: XY
  /** Read radius, in Photo pixels. */
  radius: number
  /** Relative luminance (white is 1) the reference has in even light. */
  y: number
  /** Part of the Card's tonal ladder. */
  neutral?: boolean
}

/** A place that should come out as bright as its siblings in even light, up to `y`. */
export interface EvennessSample {
  at: XY
  radius: number
  /** Relative luminance it has in even light; only the ratios between samples matter. */
  y: number
}

export interface Evenness {
  samples: EvennessSample[]
  /** Spread of brightness across the samples, in stops, above which the light is uneven. */
  limitStops: number
  /** Spread above which it is not the light: the samples are not on what they should be. */
  offCardStops: number
}

export interface QualityInput {
  pixels: Pixels
  spots: XY[]
  spotRadius: number
  /** Empty when there is no Card. */
  references: QualityReference[]
  /**
   * Distance between neighbouring patches, in Photo pixels, as the tapped corners give it (the
   * smallest, where the Card is seen at an angle). Not read off `references`: with the corners
   * in the wrong order those bunch together and would say the Card is small when it is not.
   */
  spacing?: number
  evenness?: Evenness
}

const LINEAR = Array.from({ length: 256 }, (_, v) => decode(v / 255))

interface Scan {
  /** Share of the circle's pixels that are blown. */
  blown: number
  /** Share that are crushed. */
  crushed: number
  /** Strongest channel of every unblown pixel, 8-bit, darkest first. */
  unblown: number[]
  /** Relative luminance of every pixel, darkest first. */
  luminances: number[]
}

/** Every pixel in the circle, clipped to the Photo, tallied. */
function scan({ width, height, data }: Pixels, center: XY, radius: number, wantLuminance = false): Scan {
  let total = 0
  let blown = 0
  let crushed = 0
  const unblown: number[] = []
  const luminances: number[] = []
  const y0 = Math.max(0, Math.round(center.y - radius))
  const y1 = Math.min(height - 1, Math.round(center.y + radius))
  const x0 = Math.max(0, Math.round(center.x - radius))
  const x1 = Math.min(width - 1, Math.round(center.x + radius))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius * radius) continue
      const i = (y * width + x) * 4
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const high = Math.max(r, g, b)
      total++
      if (high <= CRUSHED_LEVEL) crushed++
      if ((r >= BLOWN_LEVEL ? 1 : 0) + (g >= BLOWN_LEVEL ? 1 : 0) + (b >= BLOWN_LEVEL ? 1 : 0) >= BLOWN_CHANNELS) blown++
      else unblown.push(high)
      if (wantLuminance) luminances.push(0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b])
    }
  }
  unblown.sort((a, b) => a - b)
  luminances.sort((a, b) => a - b)
  const share = (n: number) => (total === 0 ? 0 : n / total)
  return { blown: share(blown), crushed: share(crushed), unblown, luminances }
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Pairs of grays whose brightness runs the wrong way: a gray that should be darker came out
 * brighter than one that should be lighter. The ladder is sorted white to black. Light and
 * tone curves keep the order (a shadow or a curve only squeezes it), so only grays read from
 * the wrong places break it.
 */
function inversions(ladder: { seen: number }[]): number {
  let count = 0
  ladder.forEach((a, i) => {
    for (const b of ladder.slice(i + 1)) if (a.seen < b.seen) count++
  })
  return count
}

/**
 * Spread, in stops, of the samples' brightness (each relative to what it should be): the
 * brightest and darkest tenth are trimmed so a stray speck does not count. Null when too few
 * samples are left to say.
 */
function evennessSpread(
  pixels: Pixels,
  { samples }: Evenness,
  keep: (s: EvennessSample, scan: Scan) => boolean,
): number | null {
  const stops: number[] = []
  for (const s of samples) {
    const seen = scan(pixels, s.at, s.radius, true)
    if (!keep(s, seen) || seen.luminances.length === 0) continue
    const level = seen.luminances[Math.floor(EVEN_PERCENTILE * (seen.luminances.length - 1))]
    if (level > 0) stops.push(Math.log2(level / s.y))
  }
  if (stops.length < MIN_EVEN_SAMPLES) return null
  stops.sort((a, b) => a - b)
  const trim = Math.floor(0.1 * (stops.length - 1))
  return stops[stops.length - 1 - trim] - stops[trim]
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

export function checkQuality({ pixels, spots, spotRadius, references, spacing, evenness }: QualityInput): QualityWarning[] {
  const out: QualityWarning[] = []
  const warn = (kind: QualityWarning["kind"], where: QualityWarning["where"], advice: string) =>
    out.push({ kind, where, advice })

  // The Card's tonal ladder, white to black, with the grays that are neither blown nor crushed
  // measured. If those come out in the wrong order the references are not on the Card (the
  // corners were tapped in the wrong order), and nothing read from them says much. With too
  // few readable grays to tell, the references are taken as placed.
  const seen = references.map((r) => scan(pixels, r.at, r.radius))
  const ladder = references
    .flatMap((r, i) => (r.neutral ? [{ r, s: seen[i] }] : []))
    .sort((a, b) => b.r.y - a.r.y)
  const readable = ladder
    .filter(({ s }) => s.blown < GLARE_SHARE && s.crushed < GLARE_SHARE)
    .map(({ r }) => ({ seen: luminance(medianLinear(pixels, r.at, r.radius)) }))
  const checkable = readable.length >= MIN_NEUTRALS
  const offCard = checkable && inversions(readable) >= OFF_CARD_INVERSIONS
  const useLadder = !offCard && ladder.length > 0

  // Glare against exposure. On the Card, its white is the brightest thing the exposure can put
  // there, so a reference with more blown pixels than the white is a reflection; if the white
  // is blown, the exposure is the cause, and likewise a crushed black. Off the Card, or with no
  // ladder, there is no white to compare to: partly blown is glare, mostly blown exposure.
  const whiteBlown = useLadder ? ladder[0].s.blown : 0
  const blown = seen.map((s) => s.blown)
  const highClipped = useLadder ? whiteBlown >= CLIP_SHARE : blown.some((b) => b >= CLIP_SHARE)
  const glared = useLadder
    ? blown.map((b) => b - whiteBlown >= GLARE_SHARE)
    : blown.map((b) => !highClipped && b >= GLARE_SHARE && b < CLIP_SHARE)
  const lowClipped = useLadder
    ? ladder[ladder.length - 1].s.crushed >= CLIP_SHARE
    : seen.some((s) => s.crushed >= CLIP_SHARE)
  if (glared.some(Boolean)) warn("glare", "card", ADVICE.cardGlare)
  if (highClipped || lowClipped) {
    warn("clipped", "card", highClipped && lowClipped ? ADVICE.cardBoth : highClipped ? ADVICE.cardBlown : ADVICE.cardCrushed)
  }

  if (!offCard && evenness && spacing !== undefined) {
    const reach = GLARE_REACH * spacing
    const glareAt = references.filter((_, i) => glared[i]).map((r) => r.at)
    const spread = evennessSpread(
      pixels,
      evenness,
      (sample, s) =>
        s.blown < GLARE_SHARE && s.crushed < GLARE_SHARE && glareAt.every((g) => dist(g, sample.at) >= reach),
    )
    if (spread !== null && spread > evenness.limitStops && spread <= evenness.offCardStops) {
      warn("uneven-light", "card", ADVICE.uneven)
    }
  }
  if (!offCard && spacing !== undefined && spacing < MIN_SPACING_PX) {
    warn("card-too-small", "card", ADVICE.small)
  }

  // Then each Spot, by its own level. Blown pixels on a Spot that is otherwise well below the
  // top of the range are glare; on a Spot that sits at the top, exposure. A Spot blown through
  // has no level of its own: the Card's white says which, and with no Card it is exposure.
  spots.forEach((spot, i) => {
    const s = scan(pixels, spot, spotRadius)
    if (s.blown >= GLARE_SHARE) {
      const own = s.unblown.length > 0 ? s.unblown[Math.floor(0.25 * (s.unblown.length - 1))] : null
      const glare = own !== null ? own < NEAR_CLIP_LEVEL : useLadder && whiteBlown < CLIP_SHARE
      if (glare) warn("glare", i, ADVICE.spotGlare)
      else warn("clipped", i, ADVICE.spotBlown)
    } else if (s.crushed >= CLIP_SHARE) {
      warn("clipped", i, ADVICE.spotCrushed)
    }
  })
  return out
}
