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

/** The fit the engine uses. */
export const fitCorrection: Fit = linearizeThen(pchip)

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
