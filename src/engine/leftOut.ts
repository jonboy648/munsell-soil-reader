// Leaving dirty references out of the fit. A Page that has been handled for years has smudged or
// blotchy Chips; a few of them must not drag the whole correction. This picks the references to
// leave out, and the Card check names them.
//
// A reference is dirty when the fit disagrees with it far more than with the rest. Two kinds:
//
//  - A reference off the ladder is judged by its held-out error: the fit made without it, applied
//    to it. Dropped worst first, while it stands out from the crowd of references off the ladder.
//  - A ladder reference cannot be judged that way. The curves go exactly through the ladder, so
//    a dirty step looks fine to its own fit, and two dirty steps side by side vouch for each other
//    (Jon's 10YR 8/1 and 7/1 are both smudged). The references off the ladder are independent
//    witnesses to the curves, so the ladder is judged by them: the dirty steps are the ones whose
//    removal makes the curves agree with those references.
//
// The per-reference held-out error here is a stand-in for `heldOutErrors` in correction.ts (#28),
// which replaces `heldOutErrors` below when it lands. All the limits are provisional, derived
// from a simulated camera, until Jon's real Photos are run (#15).
import { deltaE2000, linearToLab, type Vec3 } from "./color"
import type { Fit, Reference } from "./correction"

/** Most references left out: a few dirty Chips, not a Page that is dirty all over. */
export const MAX_LEFT_OUT = 4
/** Most steps of the ladder left out. A ladder always keeps enough steps to draw its curves. */
const MAX_LADDER_LEFT_OUT = 2

/** An off-ladder reference is dirty when its held-out error is above this CIEDE2000 ... */
const DIRTY_FLOOR = 4
/** ... and above this many times the median held-out error. */
const DIRTY_FACTOR = 3

/** The ladder is judged only when the references off it are fitted worse than this (CIEDE2000, 80th percentile) ... */
const LADDER_FLOOR = 1
/** ... and steps are left out only if that brings the error to under this share of what it was ... */
const LADDER_GAIN = 0.75
/** ... and each of them is a miss, to the fit made without them, of at least DIRTY_FLOOR. Each step left out costs this much in the comparison, so the fewest are left out. */
const LADDER_STEP_COST = 0.1

const colorDifference = (a: Vec3, b: Vec3): number => deltaE2000(linearToLab(a), linearToLab(b))

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** The held-out error of the references at `which`: fitted without each, corrected, against its true color. */
function heldOutErrors(references: Reference[], fit: Fit, which: number[]): number[] {
  return which.map((i) => colorDifference(fit(references.filter((_, j) => j !== i))(references[i].measured), references[i].truth))
}

/** How well a fit agrees with the references off the ladder: the 80th percentile, ignoring the worst fifth. */
function offLadderError(references: Reference[], fit: Fit): number {
  const correct = fit(references)
  const errors = references
    .filter((r) => !r.ladder)
    .map((r) => colorDifference(correct(r.measured), r.truth))
    .sort((a, b) => a - b)
  return errors[Math.floor(errors.length * 0.8)] ?? 0
}

/** Subsets of up to `size` of the items, smallest first. */
function subsets(items: number[], size: number): number[][] {
  const found: number[][] = []
  const grow = (from: number, chosen: number[]) => {
    if (chosen.length > 0) found.push(chosen)
    if (chosen.length === size) return
    for (let i = from; i < items.length; i++) grow(i + 1, [...chosen, items[i]])
  }
  grow(0, [])
  return found.sort((a, b) => a.length - b.length)
}

/** The ladder steps to leave out, as indices into `references`. */
function dirtyLadderSteps(references: Reference[], fit: Fit): number[] {
  const steps = references.flatMap((r, i) => (r.ladder ? [i] : []))
  const baseline = offLadderError(references, fit)
  if (baseline <= LADDER_FLOOR) return []
  const without = (out: number[]) => references.filter((_, i) => !out.includes(i))
  const candidates = subsets(steps, Math.max(0, Math.min(MAX_LADDER_LEFT_OUT, steps.length - 4)))
    .map((out) => ({ out, cost: offLadderError(without(out), fit) + LADDER_STEP_COST * out.length }))
    .sort((a, b) => a.cost - b.cost)
  for (const { out, cost } of candidates) {
    if (cost > LADDER_GAIN * baseline) break
    // The curves, drawn without these steps, must miss every one of them: a clean step that
    // merely helps the comparison by chance is predicted well, a dirty one is not.
    const correct = fit(without(out))
    if (out.every((i) => colorDifference(correct(references[i].measured), references[i].truth) >= DIRTY_FLOOR)) {
      return out
    }
  }
  return []
}

/**
 * Which references to leave out of the fit, as sorted indices into `references`: none for a
 * clean Card, at most `MAX_LEFT_OUT` for a worn one. A Card that is wrong all over (corners tapped
 * out of order) has no outliers to find, so nothing is left out and the Card check fails.
 */
export function leftOut(references: Reference[], fit: Fit): number[] {
  const out = dirtyLadderSteps(references, fit)
  const kept = references.map((_, i) => i).filter((i) => !out.includes(i))
  while (out.length < MAX_LEFT_OUT) {
    // Only references off the ladder: a step's own held-out error is large at the ends of the ladder
    // whether it is dirty or not, and leaving more steps out would leave curves too thin to draw.
    const rest = kept.map((i) => references[i])
    const off = rest.flatMap((r, k) => (r.ladder ? [] : [k]))
    const errors = heldOutErrors(rest, fit, off)
    const worst = errors.indexOf(Math.max(...errors))
    if (errors[worst] < Math.max(DIRTY_FLOOR, DIRTY_FACTOR * median(errors))) break
    out.push(kept[off[worst]])
    kept.splice(off[worst], 1)
  }
  return out.sort((a, b) => a - b)
}
