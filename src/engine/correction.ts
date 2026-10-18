// Color correction fitted on the Card: white balance, then a root-polynomial fit.
//
// Nothing here knows which Card it is. A Card is a list of references (what the camera
// measured and what the color really is), so the ColorChecker's patches and a Page's Chips
// go through the same fit and the same Card check.
import { deltaE2000, linearToLab, type Vec3 } from "./color"
import { fitRootPolynomial, type RootPolynomialDegree } from "./rootPolynomial"

export type Correction = (lin: Vec3) => Vec3

/** One place on the Card: the linear color the camera measured there, and its true color. */
export interface Reference {
  measured: Vec3
  truth: Vec3
  /** A gray reference, used to fit the white balance. */
  neutral?: boolean
}

/** Fits a correction to a Card's references. */
export type Fit = (references: Reference[]) => Correction

/** White balance: one gain per channel, fitted on the neutral references (none: no change). */
export function fitWhiteBalance(references: Reference[]): Correction {
  const neutrals = references.filter((r) => r.neutral)
  const gains = [0, 1, 2].map((ch) => {
    let num = 0
    let den = 0
    for (const { measured, truth } of neutrals) {
      num += measured[ch] * truth[ch]
      den += measured[ch] ** 2
    }
    return den > 0 ? num / den : 1
  })
  return (lin) => [lin[0] * gains[0], lin[1] * gains[1], lin[2] * gains[2]]
}

/**
 * The fit the engine uses: white balance first, then a root-polynomial correction of the
 * given degree fitted on the white-balanced references. Degree 1 is the plain 3x3 matrix.
 */
export const fitCorrection =
  (degree: RootPolynomialDegree): Fit =>
  (references) => {
    const wb = fitWhiteBalance(references)
    const poly = fitRootPolynomial(
      references.map((r) => wb(r.measured)),
      references.map((r) => r.truth),
      degree,
    )
    return (lin) => poly(wb(lin))
  }

const colorDifference = (a: Vec3, b: Vec3): number => deltaE2000(linearToLab(a), linearToLab(b))

/**
 * The Card check: how well the correction predicts references it was not fitted to. Each
 * reference in turn is left out, the correction is fitted on the rest, and the left-out
 * reference is corrected and compared with its true color. The mean CIEDE2000 over all of
 * them is the result. Judged on the references it was fitted to, a more flexible fit would
 * look better just by memorising the Card.
 *
 * To leave a dirty reference out of the check altogether, drop it from `references` first.
 */
export function heldOutError(references: Reference[], fit: Fit): number {
  const total = references.reduce((sum, held, i) => {
    const rest = references.filter((_, j) => j !== i)
    return sum + colorDifference(fit(rest)(held.measured), held.truth)
  }, 0)
  return total / references.length
}
