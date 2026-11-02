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
import type { Vec3 } from "./color"
import type { CurveFit, Fit } from "./correction"
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
