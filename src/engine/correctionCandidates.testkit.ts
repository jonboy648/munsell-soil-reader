// Corrections the engine does not ship, kept to compare the shipped one against. Only the
// tests import this file, so none of it reaches the built app.
//
// `fitRootPolynomial` is root-polynomial color correction (Finlayson, MacKiewicz and Hurlbert
// 2015), ported to TypeScript from colour-science's `colour/characterisation/correction.py`
// (`polynomial_expansion_Finlayson2015`, `matrix_colour_correction_Finlayson2015`) and
// `colour/algebra` (`spow`). The terms and their order are colour-science's. The least-squares
// solve is ours (leastSquares.ts); colour-science uses the Moore-Penrose pseudo-inverse, and
// the two agree for a full-rank fit. rootPolynomialGolden.json pins the port to colour-science.
//
// Copyright 2013 Colour Developers
//
// BSD 3-Clause License. Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//    conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of
//    conditions and the following disclaimer in the documentation and/or other materials
//    provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be used
//    to endorse or promote products derived from this software without specific prior
//    written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT
// OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
import { decode, encode, type Vec3 } from "./color"
import { fitMatrix, type Fit, type Reference } from "./correction"
import { leastSquares } from "./leastSquares"

/** Root-polynomial degrees colour-science defines. Degree 1 is the plain RGB (3x3) set. */
export type RootPolynomialDegree = 1 | 2 | 3 | 4

/** Safe power: sign(a) * |a|^p, so a fractional root of a negative number is not NaN. */
const spow = (a: number, p: number): number => Math.sign(a) * Math.abs(a) ** p

/**
 * The root-polynomial terms of an RGB color, in colour-science's order. Every term is
 * homogeneous of degree 1 (scale the color and every term scales with it).
 */
export function expandRootPolynomial([R, G, B]: Vec3, degree: RootPolynomialDegree): number[] {
  const terms = [R, G, B]
  if (degree >= 2) terms.push(spow(R * G, 1 / 2), spow(G * B, 1 / 2), spow(R * B, 1 / 2))
  if (degree >= 3) {
    terms.push(
      spow(R * G ** 2, 1 / 3), spow(G * B ** 2, 1 / 3), spow(R * B ** 2, 1 / 3),
      spow(G * R ** 2, 1 / 3), spow(B * G ** 2, 1 / 3), spow(B * R ** 2, 1 / 3),
      spow(R * G * B, 1 / 3),
    )
  }
  if (degree >= 4) {
    terms.push(
      spow(R ** 3 * G, 1 / 4), spow(R ** 3 * B, 1 / 4), spow(G ** 3 * R, 1 / 4),
      spow(G ** 3 * B, 1 / 4), spow(B ** 3 * R, 1 / 4), spow(B ** 3 * G, 1 / 4),
      spow(R ** 2 * G * B, 1 / 4), spow(G ** 2 * R * B, 1 / 4), spow(B ** 2 * R * G, 1 / 4),
    )
  }
  return terms
}

/** Root-polynomial correction of the given degree, fitted on all the references. */
export const fitRootPolynomial =
  (degree: RootPolynomialDegree): Fit =>
  (references) => {
    const X = leastSquares(
      references.map((r) => expandRootPolynomial(r.measured, degree)),
      references.map((r) => r.truth),
    )
    return (lin) => {
      const terms = expandRootPolynomial(lin, degree)
      const out = [0, 0, 0]
      for (let c = 0; c < 3; c++) for (let i = 0; i < terms.length; i++) out[c] += terms[i] * X[i][c]
      return out as Vec3
    }
  }

/** Straight lines between the points, and straight on past the ends. */
export const piecewiseLinear: CurveFit = (points) => {
  const p = [...points].sort((a, b) => a.x - b.x).filter((q, i, all) => i === 0 || q.x > all[i - 1].x)
  if (p.length < 2) return (x) => x
  return (x) => {
    let k = 0
    while (k < p.length - 2 && x >= p[k + 1].x) k++
    const slope = (p[k + 1].y - p[k].y) / (p[k + 1].x - p[k].x)
    return p[k].y + slope * (x - p[k].x)
  }
}

// ---- other ways to draw the curve through the ladder ----
// The shipped curve is PCHIP, which passes exactly through every gray. These fit a smooth
// curve to the grays instead, so no single gray can own a stretch of the curve.

const straightOn = (f: (x: number) => number, lo: number, hi: number): ((x: number) => number) => {
  const h = 1e-6
  return (x) => {
    if (x < lo) return f(lo) + ((f(lo + h) - f(lo)) / h) * (x - lo)
    if (x > hi) return f(hi) + ((f(hi) - f(hi - h)) / h) * (x - hi)
    return f(x)
  }
}

/** Least-squares polynomial of the given degree, straight on past the first and last gray. */
export const leastSquaresPolynomial =
  (degree: number): CurveFit =>
  (points) => {
    if (points.length <= degree) return (x) => x
    const A = points.map((p) => Array.from({ length: degree + 1 }, (_, k) => p.x ** k))
    const coef = leastSquares(A, points.map((p) => [p.y, 0, 0] as Vec3)).map((row) => row[0])
    const xs = points.map((p) => p.x)
    return straightOn((x) => coef.reduce((s, c, k) => s + c * x ** k, 0), Math.min(...xs), Math.max(...xs))
  }

/** As above, but a gray far from the curve loses weight (Huber), so one dirty gray bends it less. */
export const robustPolynomial =
  (degree: number): CurveFit =>
  (points) => {
    if (points.length <= degree) return (x) => x
    const A = points.map((p) => Array.from({ length: degree + 1 }, (_, k) => p.x ** k))
    let weights = points.map(() => 1)
    let coef: number[] = []
    for (let pass = 0; pass < 8; pass++) {
      const W = A.map((row, i) => row.map((v) => v * Math.sqrt(weights[i])))
      const B = points.map((p, i) => [p.y * Math.sqrt(weights[i]), 0, 0] as Vec3)
      coef = leastSquares(W, B).map((row) => row[0])
      const resid = points.map((p, i) => Math.abs(p.y - A[i].reduce((s, v, k) => s + v * coef[k], 0)))
      const scale = Math.max(1e-4, 1.4826 * [...resid].sort((a, b) => a - b)[Math.floor(resid.length / 2)])
      weights = resid.map((r) => (r <= 1.345 * scale ? 1 : (1.345 * scale) / r))
    }
    const xs = points.map((p) => p.x)
    return straightOn((x) => coef.reduce((s, c, k) => s + c * x ** k, 0), Math.min(...xs), Math.max(...xs))
  }

/** A gamma curve with a gain and an offset, y = a * x^g + b: three numbers per channel. */
export const gammaCurve: CurveFit = (points) => {
  if (points.length < 3) return (x) => x
  let best = { sse: Infinity, g: 1, a: 1, b: 0 }
  for (let g = 0.3; g <= 4; g += 0.02) {
    const A = points.map((p) => [Math.max(p.x, 0) ** g, 1])
    const [[a], [b]] = leastSquares(A, points.map((p) => [p.y, 0, 0] as Vec3)).map((row) => [row[0]])
    const sse = points.reduce((s, p) => s + (p.y - (a * Math.max(p.x, 0) ** g + b)) ** 2, 0)
    if (sse < best.sse) best = { sse, g, a, b }
  }
  const xs = points.map((p) => p.x)
  return straightOn((x) => best.a * Math.max(x, 0) ** best.g + best.b, Math.min(...xs), Math.max(...xs))
}

// ---- a curve per channel, through the ladder ----
// The correction the engine shipped before the shared curve: each channel's curve drawn on its
// own, in sRGB-encoded values, and inverted before the 3x3. PCHIP passes exactly through every
// gray; the polynomial and gamma fits above smooth instead.
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

// The curve is drawn in sRGB-encoded values, where a phone's tone curve is smooth and the
// ladder steps are spread evenly. Encoding is extended to negative values as an odd function.
const enc = (v: number): number => (v < 0 ? -encode(-v) : encode(v))
const dec = (v: number): number => (v < 0 ? -decode(-v) : decode(v))

/** Linearize each channel with its own curve through the ladder, then fit `then` (a 3x3 matrix by default). */
export const linearizePerChannel =
  (curveFit: CurveFit, then: Fit = fitMatrix): Fit =>
  (references: Reference[]) => {
    const ladder = references.filter((r) => r.ladder)
    const curves = [0, 1, 2].map((c) =>
      curveFit(ladder.map((r) => ({ x: enc(r.measured[c]), y: enc(r.truth[c]) }))),
    )
    const linearize = (lin: Vec3): Vec3 => [0, 1, 2].map((c) => dec(curves[c](enc(lin[c])))) as Vec3
    const matrix = then(references.map((r) => ({ ...r, measured: linearize(r.measured) })))
    return (lin) => matrix(linearize(lin))
  }
