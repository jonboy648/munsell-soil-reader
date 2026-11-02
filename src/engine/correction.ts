// Color correction fitted on the Card: linearize each channel along a ladder of grays, then
// fit a 3x3 matrix by least squares.
//
// A phone's tone curve bends every channel, and a matrix cannot undo a bend. The ladder is a
// run of references whose true color is known in each channel, from dark to light. It gives
// the curve the camera applied, and inverting it first leaves the matrix a linear problem.
//
// Nothing here knows which Card it is. A Card is a list of references (what the camera
// measured and what the color really is), so the ColorChecker's patches and a Page's Chips
// go through the same fit and the same Card check.
import { decode, deltaE2000, encode, linearToLab, type Vec3 } from "./color"
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
   * channel. The ladder is what each channel's curve is drawn through, so it needs at least
   * two references of different brightness (with fewer, the channels are left as they are).
   */
  ladder?: boolean
}

/** Fits a correction to a Card's references. */
export type Fit = (references: Reference[]) => Correction

// ---- the curve through the ladder ----
export interface Point {
  x: number
  y: number
}
export type Curve = (x: number) => number
/** Draws a curve through points. Past the first and last point the curve carries on straight. */
export type CurveFit = (points: Point[]) => Curve

/** Sorted by x, with points of the same x merged (their y averaged). */
function distinct(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const merged: Point[] = []
  let run: Point[] = []
  const flush = () => {
    if (run.length) merged.push({ x: run[0].x, y: run.reduce((s, p) => s + p.y, 0) / run.length })
    run = []
  }
  for (const p of sorted) {
    if (run.length && p.x - run[0].x > 1e-9) flush()
    run.push(p)
  }
  flush()
  return merged
}

/** Slope at an end of the curve (Fritsch-Carlson as in SciPy's PchipInterpolator). */
function endSlope(h0: number, h1: number, d0: number, d1: number): number {
  const d = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
  if (Math.sign(d) !== Math.sign(d0)) return 0
  if (Math.sign(d0) !== Math.sign(d1) && Math.abs(d) > 3 * Math.abs(d0)) return 3 * d0
  return d
}

/**
 * Monotone cubic through the points (Fritsch and Carlson 1980): smooth, and it never
 * overshoots between two ladder steps the way an ordinary cubic can.
 */
export const pchip: CurveFit = (points) => {
  const p = distinct(points)
  const n = p.length
  if (n < 2) return (x) => x
  const h = p.slice(1).map((q, k) => q.x - p[k].x)
  const delta = p.slice(1).map((q, k) => (q.y - p[k].y) / h[k])
  const d: number[] = Array.from({ length: n }, () => 0)
  if (n === 2) {
    d[0] = d[1] = delta[0]
  } else {
    for (let k = 1; k < n - 1; k++) {
      if (delta[k - 1] * delta[k] <= 0) continue
      const w1 = 2 * h[k] + h[k - 1]
      const w2 = h[k] + 2 * h[k - 1]
      d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k])
    }
    d[0] = endSlope(h[0], h[1], delta[0], delta[1])
    d[n - 1] = endSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3])
  }
  return (x) => {
    if (x <= p[0].x) return p[0].y + d[0] * (x - p[0].x)
    if (x >= p[n - 1].x) return p[n - 1].y + d[n - 1] * (x - p[n - 1].x)
    let k = 0
    while (x >= p[k + 1].x) k++
    const t = (x - p[k].x) / h[k]
    return (
      (2 * t ** 3 - 3 * t ** 2 + 1) * p[k].y +
      (t ** 3 - 2 * t ** 2 + t) * h[k] * d[k] +
      (-2 * t ** 3 + 3 * t ** 2) * p[k + 1].y +
      (t ** 3 - t ** 2) * h[k] * d[k + 1]
    )
  }
}

// ---- the fits ----
// The curve is drawn in sRGB-encoded values, where a phone's tone curve is smooth and the
// ladder steps are spread evenly. Encoding is extended to negative values as an odd function.
const enc = (v: number): number => (v < 0 ? -encode(-v) : encode(v))
const dec = (v: number): number => (v < 0 ? -decode(-v) : decode(v))

/** A 3x3 matrix fitted to all the references by least squares. */
export const fitMatrix: Fit = (references) => {
  const X = leastSquares(
    references.map((r) => r.measured),
    references.map((r) => r.truth),
  )
  return (lin) => [0, 1, 2].map((c) => lin[0] * X[0][c] + lin[1] * X[1][c] + lin[2] * X[2][c]) as Vec3
}

/**
 * Linearize each channel along the ladder, then fit `then` (a 3x3 matrix unless told
 * otherwise) on the linearized references. The curves are fitted inside this fit, so the
 * Card check refits them without the reference it holds out.
 */
export const linearizeThen =
  (curveFit: CurveFit, then: Fit = fitMatrix): Fit =>
  (references) => {
    const ladder = references.filter((r) => r.ladder)
    const curves = [0, 1, 2].map((c) =>
      curveFit(ladder.map((r) => ({ x: enc(r.measured[c]), y: enc(r.truth[c]) }))),
    )
    const linearize = (lin: Vec3): Vec3 => [0, 1, 2].map((c) => dec(curves[c](enc(lin[c])))) as Vec3
    const matrix = then(references.map((r) => ({ ...r, measured: linearize(r.measured) })))
    return (lin) => matrix(linearize(lin))
  }

// ---- one tone curve for all three channels (the ColorChecker) ----
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
export const linearizeShared =
  (then: Fit = fitMatrix): Fit =>
  (references) => {
    const linearize = fitToneCurve(references)
    const matrix = then(references.map((r) => ({ ...r, measured: linearize(r.measured) })))
    return (lin) => matrix(linearize(lin))
  }

/**
 * The fit the engine uses for the ColorChecker: one tone curve shared by the three channels, drawn
 * through its six truly neutral grays, then a 3x3. Simulation favours it over a curve per channel
 * (one dirty gray cannot bend it alone, and a real sensor's channels agree on it). No real
 * ColorChecker Photo has been run yet (#15).
 */
export const fitCorrection: Fit = linearizeShared()

/**
 * A 3x3 matrix fitted by least squares with a ridge on its off-diagonal terms, which pulls it
 * toward one gain per channel. `strength` is relative: 1 puts a penalty on each off-diagonal term
 * as heavy as the references' mean squared channel value. Where the references say a lot about how
 * the channels mix (the ColorChecker's patches), the data win; where they say little (a Page's
 * Chips, which all have one hue and lie along one line of color space) the matrix stays near diagonal.
 */
export const fitRidgeMatrix =
  (strength: number): Fit =>
  (references) => {
    const A = references.map((r) => [...r.measured])
    const lambda = (strength * A.reduce((sum, row) => sum + row[0] ** 2 + row[1] ** 2 + row[2] ** 2, 0)) / 3
    // X[from][to]: each output channel is fitted on its own, with its off-diagonal inputs penalised.
    const X = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    for (let to = 0; to < 3; to++) {
      const rows = [...A]
      const targets: Vec3[] = references.map((r) => [r.truth[to], 0, 0])
      for (let from = 0; from < 3; from++) {
        if (from === to) continue
        rows.push([0, 1, 2].map((k) => (k === from ? Math.sqrt(lambda) : 0)))
        targets.push([0, 0, 0])
      }
      const solved = leastSquares(rows, targets)
      for (let from = 0; from < 3; from++) X[from][to] = solved[from][0]
    }
    return (lin) => [0, 1, 2].map((c) => lin[0] * X[0][c] + lin[1] * X[1][c] + lin[2] * X[2][c]) as Vec3
  }

/** How strongly a Page's matrix is pulled toward diagonal: chosen on real Photos, see docs/correction-comparison.md. */
export const PAGE_MATRIX_RIDGE = 1

/**
 * A PCHIP curve per channel through the ladder, exactly through every gray, then a plain 3x3. The
 * Page builds on it. Measurement mode uses it as is: it reads swatches to a CIEDE2000 of about 1,
 * and on a clean simulated camera the exact curve is up to 1 closer on the lightest and darkest
 * swatches than the shared one.
 */
export const fitChannelCurves: Fit = linearizeThen(pchip)

/**
 * The fit the engine uses for a Page: a PCHIP curve per channel through the ladder, then a 3x3 pulled
 * toward one gain per channel. A Page's ladder is the /1 column, slightly tinted, so its channels do
 * not share one curve (on Jon's real Pages a shared curve fits the ladder worse and misses the
 * smudged steps). With the full 3x3 after the curves, a Page pulled every color it was not made of toward
 * its own hue (the same wood behind the holes of four Pages came out 11.8 CIEDE2000 apart, 2.4 raw).
 * A Page's Chips cannot say how the camera mixes the channels, so the matrix is held near diagonal.
 */
export const fitPageCorrection: Fit = linearizeThen(pchip, fitRidgeMatrix(PAGE_MATRIX_RIDGE))

// ---- the Card check ----
const colorDifference = (a: Vec3, b: Vec3): number => deltaE2000(linearToLab(a), linearToLab(b))

/**
 * How well the correction predicts each reference it was not fitted to. Each reference in
 * turn is left out, the correction is fitted on the rest, and the left-out reference is
 * corrected and compared with its true color (CIEDE2000). Judged on the references it was
 * fitted to, a more flexible fit would look better just by memorising the Card. The result
 * is in the order of `references`, so a caller can see which one is off. The one place the
 * Card's per-reference held-out errors are made.
 *
 * To leave a dirty reference out of the check altogether, drop it from `references` first.
 */
export function heldOutErrors(references: Reference[], fit: Fit): number[] {
  return references.map((held, i) => {
    const rest = references.filter((_, j) => j !== i)
    return colorDifference(fit(rest)(held.measured), held.truth)
  })
}
