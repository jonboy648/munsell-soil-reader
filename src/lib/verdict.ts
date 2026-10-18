// Which of a Spot's two Readings to trust, and the plain words that say why.
import type { CardCheck, ChipReading, QualityWarning, Reading } from "@/engine"

export type Verdict = "good" | "failed" | "uncorrected"

export interface Shown {
  verdict: Verdict
  /** The Reading to show as the answer. */
  main: ChipReading
  why: string
}

const fmt = (n: number) => n.toFixed(1)

/**
 * The corrected Reading when the Card check is good. Otherwise the raw Reading, flagged: a
 * failed correction must never be shown as the answer.
 */
export function shownReading(
  reading: Reading,
  cardCheck: CardCheck | undefined,
  cardWarnings: QualityWarning[] = [],
): Shown {
  if (reading.corrected && cardCheck?.ok) {
    return {
      verdict: "good",
      main: reading.corrected,
      why: `After correction the 24 Card patches are off by ${fmt(cardCheck.meanDE)} on average, so the correction can be trusted.`,
    }
  }
  if (reading.corrected && cardCheck && cardWarnings.length > 0) {
    // A problem with the Card is flagged, and it explains the failure better than a guess.
    return {
      verdict: "failed",
      main: reading.raw,
      why: `The Card patches are still off by ${fmt(cardCheck.meanDE)} after correction. The problem flagged below is the likely cause. Showing the uncorrected Reading. Fix it and take the Photo again.`,
    }
  }
  if (reading.corrected && cardCheck) {
    return {
      verdict: "failed",
      main: reading.raw,
      why: `The Card patches are still off by ${fmt(cardCheck.meanDE)} after correction. The corners were probably tapped out of order, or there is glare or shade on the Card. Showing the uncorrected Reading. Tap Start over and begin at the brown patch.`,
    }
  }
  return {
    verdict: "uncorrected",
    main: reading.raw,
    why: "No Card was marked, so this is straight from the Photo. The light and the camera shift it, often by a whole Chip.",
  }
}
