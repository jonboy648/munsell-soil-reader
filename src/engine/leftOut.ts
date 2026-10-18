// Leaving dirty references out of the fit. A Page that has been handled for years has smudged or
// blotchy Chips; a few of them must not drag the whole correction. This picks the references to
// leave out, and the Card check names them.
//
// A reference is dirty when the fit disagrees with it far more than with the rest. Two kinds:
//
//  - A reference off the ladder is judged by its held-out error: the fit made without it, applied
//    to it. Dropped worst first, while it stands out from the crowd of references off the ladder.
//  - A ladder step cannot be judged that way. The curves go exactly through the ladder, so a dirty
//    step looks fine to its own fit, a dark step bends the curve a lot for a small miss, and two
//    dirty steps side by side vouch for each other (Jon's 10YR 8/1 and 7/1 are both smudged). The
//    Chips beside a step, in its value row and the rows above and below it, are independent
//    witnesses to the curve there, so a step is judged by them: it is dirty when leaving it out
//    makes the curves agree with its row-mates.
//
// When two or more Chips off the ladder in one value row are left out, the fit is not trusted (see
// `suspectRow`): either that row's ladder step is dirty by too little for the steps above to
// catch, or the Chips are beyond what the ladder can describe. Leaving them out must not make the
// Card check look better than it is.
//
// All the limits are provisional, derived from a simulated camera and four of Jon's real Pages,
// until real Photos are run (#15).
import { deltaE2000, linearToLab, type Vec3 } from "./color"
import { heldOutErrors, type Fit, type Reference } from "./correction"

/** Most references left out: a few dirty Chips, not a Page that is dirty all over. */
export const MAX_LEFT_OUT = 4
/** Most steps of the ladder left out. A ladder always keeps enough steps to draw its curves. */
const MAX_LADDER_LEFT_OUT = 2
const MIN_LADDER_STEPS = 5

/** An off-ladder reference is dirty when its held-out error is above this CIEDE2000 ... */
const DIRTY_FLOOR = 4
/** ... and above this many times the median held-out error of the references off the ladder. */
const DIRTY_FACTOR = 3

/** Leaving ladder steps out must bring their row-mates' typical error down to under this share of what it was ... */
const LADDER_GAIN = 0.5
/** ... and by at least this much (CIEDE2000). */
const LADDER_MIN_GAIN = 1.5
/** ... and each step left out must be missed by the curves drawn without it by at least this much. */
const LADDER_OWN_MISS = 3
/**
 * A step is also left out, whether or not it moves its row-mates, when the curves drawn without it
 * miss it by this much and those curves already fit its row-mates to within LADDER_ROW_FIT. A
 * curve that goes through every step is bent by a dirty one, which shows in the row-mates; a curve
 * that gives a far-off step less weight is not, and the step is only seen in how badly it misses.
 */
const LADDER_CLEAR_MISS = 6
const LADDER_ROW_FIT = 1.5
/** A step is judged only if it has at least this many row-mates. */
const MIN_ROW_MATES = 2
/** Each ladder step left out costs this much in the comparison, so the fewest are left out. */
const LADDER_STEP_COST = 0.1

const colorDifference = (a: Vec3, b: Vec3): number => deltaE2000(linearToLab(a), linearToLab(b))

const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** What the fit does to the references at `which`: its mean error on them, the worst one counting for little. */
function typicalError(references: Reference[], which: number[], fit: Fit): number {
  const correct = fit(references)
  const errors = which.map((i) => colorDifference(correct(references[i].measured), references[i].truth))
  return median(errors)
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

/**
 * The ladder steps to leave out next, as indices into `references`, or none. Of the sets of steps
 * (up to `budget`, from those still kept) that leaving out would make the curves agree with
 * their row-mates, the one that does it best.
 */
function nextDirtyLadderSteps(references: Reference[], rows: number[], fit: Fit, kept: number[], budget: number): number[] {
  const rest = kept.map((i) => references[i])
  const steps = kept.flatMap((i, k) => (references[i].ladder ? [k] : []))
  let best: { out: number[]; cost: number } | null = null
  for (const out of subsets(steps, Math.max(0, Math.min(budget, steps.length - MIN_LADDER_STEPS)))) {
    const near = new Set(out.flatMap((k) => [rows[kept[k]] - 1, rows[kept[k]], rows[kept[k]] + 1]))
    const mates = rest.flatMap((r, k) => (!r.ladder && near.has(rows[kept[k]]) ? [k] : []))
    if (mates.length < MIN_ROW_MATES) continue
    const without = rest.filter((_, k) => !out.includes(k))
    const before = typicalError(rest, mates, fit)
    const after = typicalError(without, mates.map((k) => k - out.filter((o) => o < k).length), fit)
    // Each step must also be a real miss to the curves drawn without it: a clean step that merely
    // helps the comparison, by taking a model that cannot describe a row's Chips out of the ladder,
    // is predicted well.
    const correct = fit(without)
    const misses = out.map((k) => colorDifference(correct(rest[k].measured), rest[k].truth))
    const helpsRowMates = after <= LADDER_GAIN * before && before - after >= LADDER_MIN_GAIN
    const clearlyDirty = after <= LADDER_ROW_FIT && misses.every((miss) => miss >= LADDER_CLEAR_MISS)
    if (!((helpsRowMates && misses.every((miss) => miss >= LADDER_OWN_MISS)) || clearlyDirty)) continue
    const cost = after + LADDER_STEP_COST * out.length
    if (!best || cost < best.cost) best = { out, cost }
  }
  return best ? best.out.map((k) => kept[k]) : []
}

/**
 * The ladder steps to leave out, as indices into `references`. The one ladder rule, for the
 * ColorChecker's grays and a Page's /1 column alike.
 */
export function dirtyLadderSteps(references: Reference[], rows: number[], fit: Fit): number[] {
  const out: number[] = []
  for (;;) {
    const kept = references.map((_, i) => i).filter((i) => !out.includes(i))
    const next = nextDirtyLadderSteps(references, rows, fit, kept, MAX_LADDER_LEFT_OUT - out.length)
    if (next.length === 0) return out
    out.push(...next)
  }
}

export interface LeftOut {
  /** Indices into the references, sorted. */
  indices: number[]
  /** Two or more references off the ladder in this value row were left out: the fit is not to be trusted. */
  suspectRow?: number
}

/**
 * Which references to leave out of the fit: none for a clean Card, at most `MAX_LEFT_OUT` for a
 * worn one. A Card that is wrong all over (corners tapped out of order) has no outliers to find,
 * so nothing is left out and the Card check fails. `rows` gives the value row of each reference.
 */
export function leftOut(references: Reference[], rows: number[], fit: Fit): LeftOut {
  const out = dirtyLadderSteps(references, rows, fit)
  const kept = references.map((_, i) => i).filter((i) => !out.includes(i))
  const dropped: number[] = []
  while (out.length < MAX_LEFT_OUT) {
    // Only references off the ladder: a step's own held-out error is large at the ends of the ladder
    // whether it is dirty or not, and leaving more steps out would leave curves too thin to draw.
    const rest = kept.map((i) => references[i])
    const errors = heldOutErrors(rest, fit)
    const off = rest.flatMap((r, k) => (r.ladder ? [] : [k]))
    const worst = off.reduce((a, b) => (errors[b] > errors[a] ? b : a))
    if (errors[worst] < Math.max(DIRTY_FLOOR, DIRTY_FACTOR * median(off.map((k) => errors[k])))) break
    out.push(kept[worst])
    dropped.push(kept[worst])
    kept.splice(worst, 1)
  }
  const suspect = dropped.find((i) => dropped.some((j) => j !== i && rows[j] === rows[i]))
  return {
    indices: out.sort((a, b) => a - b),
    ...(suspect === undefined ? {} : { suspectRow: rows[suspect] }),
  }
}
