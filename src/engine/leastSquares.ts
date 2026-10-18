// Least squares by Householder QR.
import type { Vec3 } from "./color"

/**
 * The n x 3 coefficients that map each row of `A` (m x n, m >= n) onto the matching row of
 * `B`, minimising the squared error. A column that carries no information gets a zero
 * coefficient.
 */
export function leastSquares(A: number[][], B: Vec3[]): number[][] {
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
