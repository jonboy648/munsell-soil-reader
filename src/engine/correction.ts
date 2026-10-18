// Color correction fitted on the Card: undo the camera's tone curve along a ladder of grays,
// then fit a 3x3 matrix by least squares.
//
// A phone's tone curve bends every channel, and a matrix cannot undo a bend. The ladder is a
// run of references whose true color is known in each channel, from dark to light. It gives
// the curve the camera applied, and inverting it first leaves the matrix a linear problem.
//
// Nothing here knows which Card it is. A Card is a list of references (what the camera
// measured and what the color really is), so the ColorChecker's patches and a Page's Chips
// go through the same fit and the same Card check.
import { deltaE2000, linearToLab, type Vec3 } from "./color"
import { leastSquares } from "./leastSquares"

export type Correction = (lin: Vec3) => Vec3

/** One place on the Card: the linear color the camera measured there, and its true color. */
export interface Reference {
  measured: Vec3
  truth: Vec3
  /** What to call it when telling the user about it: "neutral 5", or a Chip's notation. */
  name?: string
  /**
   * Part of the tone ladder: a gray, or close to one, whose true color is known in each
   * channel. The ladder is what the tone curve is drawn through, so it needs at least four
   * references of different brightness (with fewer, the channels are left as they are).
   */
  ladder?: boolean
}

/** Fits a correction to a Card's references. */
export type Fit = (references: Reference[]) => Correction

/** A 3x3 matrix fitted to all the references by least squares. */
export const fitMatrix: Fit = (references) => {
  const X = leastSquares(
    references.map((r) => r.measured),
    references.map((r) => r.truth),
  )
  return (lin) => [0, 1, 2].map((c) => lin[0] * X[0][c] + lin[1] * X[1][c] + lin[2] * X[2][c]) as Vec3
}

// ---- the tone curve ----
// One curve for all three channels. A camera applies one tone curve to the image, and its
// white balance only scales each channel before that, so in log space the three channels'
// curves are one shape, one vertical shift apart. Fitting that shape to all the grays' three
// channels at once is 3 times the data per parameter, which has two effects. A gray that is off
// in a way no tone curve explains (a tint, a smudge, a hazy black) cannot bend the curve by
// itself, so it stands out instead of being drawn through. And on a real sensor, whose channels
// disagree a little, the shape averages the disagreement out.

/** Degree of the polynomial that is the curve's shape (log of the true value against log of the measured). */
const SHAPE_DEGREE = 3
/** The fewest ladder steps a curve is drawn through: 12 numbers for the 6 it has. */
const MIN_LADDER = 4
/** The smallest value the log is taken of: a channel that reads black. */
const FLOOR = 1e-4
const ln = (v: number) => Math.log(Math.max(v, FLOOR))
/** Robust-fit passes, and the Huber limit in units of the (scaled) median residual. */
const PASSES = 8
const HUBER = 1.345

/**
 * Fit the curve to the ladder: the three channels' offsets and the shape's coefficients, by
 * least squares that gives less weight to a gray far from the curve (Huber), so one dirty gray
 * pulls it less. Returns the identity if the ladder is too short to draw a curve.
 */
function fitToneCurve(references: Reference[]): Correction {
  const ladder = references.filter((r) => r.ladder)
  if (ladder.length < MIN_LADDER) return (lin) => lin
  const rows: number[][] = []
  const targets: Vec3[] = []
  for (const r of ladder) {
    for (let c = 0; c < 3; c++) {
      const u = ln(r.measured[c])
      rows.push([
        c === 0 ? 1 : 0,
        c === 1 ? 1 : 0,
        c === 2 ? 1 : 0,
        ...Array.from({ length: SHAPE_DEGREE }, (_, k) => u ** (k + 1)),
      ])
      targets.push([ln(r.truth[c]), 0, 0])
    }
  }
  let weights = rows.map(() => 1)
  let coef: number[] = []
  for (let pass = 0; pass < PASSES; pass++) {
    const root = weights.map(Math.sqrt)
    coef = leastSquares(
      rows.map((row, i) => row.map((v) => v * root[i])),
      targets.map((t, i) => [t[0] * root[i], 0, 0] as Vec3),
    ).map((row) => row[0])
    const resid = rows.map((row, i) => Math.abs(targets[i][0] - row.reduce((s, v, k) => s + v * coef[k], 0)))
    const scale = Math.max(1e-3, 1.4826 * [...resid].sort((a, b) => a - b)[Math.floor(resid.length / 2)])
    weights = resid.map((r) => (r <= HUBER * scale ? 1 : (HUBER * scale) / r))
  }
  const shape = (u: number) => coef.slice(3).reduce((s, b, k) => s + b * u ** (k + 1), 0)
  // Past the darkest and lightest gray the curve goes straight on, at the slope it ends with.
  const us = ladder.flatMap((r) => [0, 1, 2].map((c) => ln(r.measured[c])))
  const lo = Math.min(...us)
  const hi = Math.max(...us)
  const h = 1e-6
  const bent = (u: number) => {
    if (u < lo) return shape(lo) + ((shape(lo + h) - shape(lo)) / h) * (u - lo)
    if (u > hi) return shape(hi) + ((shape(hi) - shape(hi - h)) / h) * (u - hi)
    return shape(u)
  }
  return (lin) => [0, 1, 2].map((c) => Math.exp(coef[c] + bent(ln(lin[c])))) as Vec3
}

/**
 * Undo the tone curve along the ladder, then fit `then` (a 3x3 matrix unless told otherwise) on
 * the corrected references. The curve is fitted inside this fit, so the Card check refits it
 * without the reference it holds out.
 */
export const linearizeThen =
  (then: Fit = fitMatrix): Fit =>
  (references) => {
    const linearize = fitToneCurve(references)
    const matrix = then(references.map((r) => ({ ...r, measured: linearize(r.measured) })))
    return (lin) => matrix(linearize(lin))
  }

/** The fit the engine uses. */
export const fitCorrection: Fit = linearizeThen()

// ---- the Card check ----
const colorDifference = (a: Vec3, b: Vec3): number => deltaE2000(linearToLab(a), linearToLab(b))

/**
 * How well the correction predicts each reference it was not fitted to. Each reference in
 * turn is left out, the correction is fitted on the rest, and the left-out reference is
 * corrected and compared with its true color (CIEDE2000). Judged on the references it was
 * fitted to, a more flexible fit would look better just by memorising the Card. The result
 * is in the order of `references`, so a caller can see which one is off.
 *
 * To leave a dirty reference out of the check altogether, drop it from `references` first.
 */
export function heldOutErrors(references: Reference[], fit: Fit): number[] {
  return references.map((held, i) => {
    const rest = references.filter((_, j) => j !== i)
    return colorDifference(fit(rest)(held.measured), held.truth)
  })
}
