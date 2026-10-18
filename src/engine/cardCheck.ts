// The Card check: whether the correction fitted on the Card can be trusted.
//
// Three numbers decide it, all of them provisional until a real Photo has been run through
// (issue #15): they come from simulated Photos only. See docs/correction-comparison.md for
// the sweeps behind them.
import { heldOutErrors, type Correction, type Fit, type Reference } from "./correction"
import type { CardCheck, CardVerdict } from "./types"

/** The mean held-out CIEDE2000 below which the Card check is good. Provisional. */
export const CARD_CHECK_GOOD = 2

/** The mean above which it has failed. Between GOOD and this is caution. Provisional. */
export const CARD_CHECK_CAUTION = 3.5

/**
 * A gray step whose own held-out error is above this looks dirty or tinted. The mean hides it
 * (a gray is one of 24 references) but it bends the curve of every channel. Provisional.
 */
export const LADDER_LIMIT = 6

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

/** The ladder reference with the highest held-out error, and that error. */
function worstGray(references: Reference[], errors: number[]) {
  let worst: { index: number; error: number } | null = null
  references.forEach((r, i) => {
    if (r.ladder && (worst === null || errors[i] > worst.error)) worst = { index: i, error: errors[i] }
  })
  return worst as { index: number; error: number } | null
}

/**
 * Fit the correction on a Card's references and check it. A gray step that looks dirty is
 * named, left out, and the correction refitted without it; the check is then scored on the
 * references that remain, and can be no better than caution. A second dirty gray fails it.
 */
export function checkCard(references: Reference[], fit: Fit): { correct: Correction; check: CardCheck } {
  let used = references
  let errors = heldOutErrors(used, fit)
  const dirty: string[] = []
  const first = worstGray(used, errors)
  if (first && first.error > LADDER_LIMIT) {
    dirty.push(used[first.index].name ?? "a gray step")
    used = used.filter((_, i) => i !== first.index)
    errors = heldOutErrors(used, fit)
    const second = worstGray(used, errors)
    if (second && second.error > LADDER_LIMIT) dirty.push(used[second.index].name ?? "a gray step")
  }
  const meanDE = mean(errors)
  let verdict: CardVerdict = meanDE < CARD_CHECK_GOOD ? "good" : meanDE < CARD_CHECK_CAUTION ? "caution" : "failed"
  if (dirty.length === 1 && verdict === "good") verdict = "caution"
  if (dirty.length > 1) verdict = "failed"
  const check: CardCheck = { meanDE, verdict, ok: verdict === "good", ...(dirty.length ? { dirtyGrays: dirty } : {}) }
  return { correct: fit(used), check }
}
