// Color correction fitted on the Card: white balance, then a 3x3 least-squares matrix.
import { deltaE2000, linearToLab, mul, type Mat3, type Vec3 } from "./color"
import { NEUTRAL_PATCHES, PATCH_LINEAR } from "./colorchecker"

export type Correction = (lin: Vec3) => Vec3

/** White balance: one gain per channel, fitted on the six gray patches. */
export function fitWhiteBalance(measured: Vec3[]): Correction {
  const gains = [0, 1, 2].map((ch) => {
    let num = 0
    let den = 0
    for (const i of NEUTRAL_PATCHES) {
      num += measured[i][ch] * PATCH_LINEAR[i][ch]
      den += measured[i][ch] ** 2
    }
    return den > 0 ? num / den : 1
  })
  return (lin) => [lin[0] * gains[0], lin[1] * gains[1], lin[2] * gains[2]]
}

const det3 = (m: Mat3): number =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
  m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
  m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])

/** Solve A x = b for 3x3 A by Cramer's rule. */
function solve3(A: Mat3, b: Vec3): Vec3 {
  const D = det3(A)
  const col = (k: number) =>
    det3(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)) as Vec3) as Mat3) / D
  return [col(0), col(1), col(2)]
}

/** Full Card: a 3x3 matrix fitted to all 24 patches by least squares. */
export function fitMatrix(measured: Vec3[]): Correction {
  const idx = [0, 1, 2] as const
  const AtA = idx.map((i) =>
    idx.map((j) => measured.reduce((s, m) => s + m[i] * m[j], 0)) as Vec3,
  ) as Mat3
  const rows = idx.map((ch) => {
    const Atb = idx.map((i) =>
      measured.reduce((s, m, p) => s + m[i] * PATCH_LINEAR[p][ch], 0),
    ) as Vec3
    return solve3(AtA, Atb)
  }) as Mat3
  return (lin) => mul(rows, lin)
}

/**
 * The correction the engine applies: white balance first, then the 3x3 fitted on the
 * white-balanced patches. (For a plain 3x3 the two steps compose to the same matrix as
 * fitting the raw patches directly; the order matters once the fit is not linear.)
 */
export function fitCardCorrection(measured: Vec3[]): Correction {
  const wb = fitWhiteBalance(measured)
  const matrix = fitMatrix(measured.map(wb))
  return (lin) => matrix(wb(lin))
}

/** How well a correction reproduces the Card itself: mean CIEDE2000 over the 24 patches. */
export function cardFitError(measured: Vec3[], correct: Correction): number {
  const total = measured.reduce(
    (s, m, i) => s + deltaE2000(linearToLab(correct(m)), linearToLab(PATCH_LINEAR[i])),
    0,
  )
  return total / measured.length
}
