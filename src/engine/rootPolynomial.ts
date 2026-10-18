// Root-polynomial color correction (Finlayson, MacKiewicz and Hurlbert 2015).
//
// Ported to TypeScript from colour-science's `colour/characterisation/correction.py`
// (`polynomial_expansion_Finlayson2015`, `matrix_colour_correction_Finlayson2015`) and
// `colour/algebra` (`spow`, `least_square_mapping_MoorePenrose`). The terms and their order
// are colour-science's. The least-squares solve is Householder QR here, where colour-science
// uses the Moore-Penrose pseudo-inverse; the two agree for a full-rank fit.
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

/** Root-polynomial degrees colour-science defines. Degree 1 is the plain RGB (3x3) set. */
export type RootPolynomialDegree = 1 | 2 | 3 | 4

/** Safe power: sign(a) * |a|^p, so a fractional root of a negative number is not NaN. */
const spow = (a: number, p: number): number => Math.sign(a) * Math.abs(a) ** p

/**
 * The root-polynomial terms of an RGB color, in colour-science's order. Every term is
 * homogeneous of degree 1 (scale the color and every term scales with it), which is why
 * the fit does not care about exposure.
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

/**
 * Least squares by Householder QR: the n x 3 coefficients that map each row of `A` (m x n,
 * m >= n) onto the matching row of `B`. A column that carries no information gets a zero
 * coefficient.
 */
function leastSquares(A: number[][], B: Vec3[]): number[][] {
  const m = A.length
  const n = A[0].length
  if (m < n) throw new Error(`Need at least ${n} references for this correction, got ${m}.`)
  const W = A.map((row, i) => [...row, ...B[i]]) // [A | B], reduced in place
  for (let k = 0; k < n; k++) {
    let norm = 0
    for (let i = k; i < m; i++) norm += W[i][k] ** 2
    norm = Math.sqrt(norm)
    if (norm === 0) continue
    const v = W.slice(k).map((row) => row[k])
    v[0] -= W[k][k] > 0 ? -norm : norm
    const vv = v.reduce((s, x) => s + x * x, 0)
    if (vv === 0) continue
    for (let j = k; j < n + 3; j++) {
      let dot = 0
      for (let i = 0; i < v.length; i++) dot += v[i] * W[k + i][j]
      const scale = (2 * dot) / vv
      for (let i = 0; i < v.length; i++) W[k + i][j] -= scale * v[i]
    }
  }
  const X: number[][] = Array.from({ length: n }, () => [0, 0, 0])
  for (let c = 0; c < 3; c++) {
    for (let i = n - 1; i >= 0; i--) {
      let rest = W[i][n + c]
      for (let j = i + 1; j < n; j++) rest -= W[i][j] * X[j][c]
      X[i][c] = Math.abs(W[i][i]) > 1e-12 ? rest / W[i][i] : 0
    }
  }
  return X
}

/** Fit a root-polynomial correction of the given degree mapping `measured` onto `target`. */
export function fitRootPolynomial(
  measured: Vec3[],
  target: Vec3[],
  degree: RootPolynomialDegree,
): (lin: Vec3) => Vec3 {
  const X = leastSquares(
    measured.map((m) => expandRootPolynomial(m, degree)),
    target,
  )
  return (lin) => {
    const terms = expandRootPolynomial(lin, degree)
    const out = [0, 0, 0]
    for (let c = 0; c < 3; c++) for (let i = 0; i < terms.length; i++) out[c] += terms[i] * X[i][c]
    return out as Vec3
  }
}
