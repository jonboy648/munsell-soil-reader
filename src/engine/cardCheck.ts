// The Card check: whether the correction fitted on the Card can be trusted.
//
// Two numbers decide it, both provisional until a real Photo has been run through (issue #15):
// they come from simulated Photos only. docs/correction-comparison.md has the sweeps behind them.
import { heldOutErrors, type Correction, type Fit, type Reference } from "./correction"
import { dirtyLadderSteps } from "./leftOut"
import type { CardCheck, CardVerdict } from "./types"

/**
 * The mean held-out CIEDE2000 below which the Card check is good. Provisional.
 *
 * A Photo of a clean Card from an ideal camera scores 1.6 or less, and one from a real sensor's
 * spectral response 1.6 to 2.9 (daylight about 2, tungsten about 3). Below 2 no real-sensor
 * Reading was more than a Chip off.
 */
export const CARD_CHECK_GOOD = 2

/**
 * The mean above which the Card check has failed. From GOOD up to this is caution: the corrected
 * Reading is still the answer, with the raw one beside it. Provisional.
 *
 * Honest Photos reach 3.4 (a real sensor under a 20% light gradient). A Card that spoils the
 * Reading by more than a Chip (a dirty patch, a shadow, glare, corners out of order) scores
 * 3.3 or more, and nearly always well over.
 */
export const CARD_CHECK_CAUTION = 3.5

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** The ladder steps of a Card that look dirty, as indices into `references`. */
export const dirtyGrays = (references: Reference[], fit: Fit): number[] => dirtyLadderSteps(references, fit)

/**
 * Fit the correction on a Card's references, leaving out the ones at `out` (dirty or smudged
 * ones; see leftOut.ts), and check it. The check is the mean held-out error of the references
 * that remain. Leaving anything out caps it at caution: the Card is not clean, and the user
 * should look at the raw Reading beside the corrected one.
 */
export function checkCard(references: Reference[], fit: Fit, out: number[]): { correct: Correction; check: CardCheck } {
  const kept = references.filter((_, i) => !out.includes(i))
  const meanDE = mean(heldOutErrors(kept, fit))
  let verdict: CardVerdict = meanDE < CARD_CHECK_GOOD ? "good" : meanDE < CARD_CHECK_CAUTION ? "caution" : "failed"
  if (out.length > 0 && verdict === "good") verdict = "caution"
  const names = out.map((i) => references[i].name ?? "a reference")
  const check: CardCheck = { meanDE, verdict, ok: verdict === "good", ...(out.length ? { leftOut: names } : {}) }
  return { correct: fit(kept), check }
}
