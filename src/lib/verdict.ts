// Which of a Spot's two Readings to trust, and the plain words that say why.
import type { CardCheck, ChipReading, QualityWarning, Reading } from "@/engine"

export type Verdict = "good" | "caution" | "failed" | "uncorrected"

export interface Shown {
  verdict: Verdict
  /** The Reading to show as the answer. */
  main: ChipReading
  /** The raw Reading, to show beside the answer when the correction is only cautiously trusted. */
  beside?: ChipReading
  why: string
}

const fmt = (n: number) => n.toFixed(1)

/**
 * The corrected Reading when the Card check is good, and when it is caution (with the raw
 * Reading beside it). Otherwise the raw Reading, flagged: a failed correction must never be
 * shown as the answer.
 */
export function shownReading(
  reading: Reading,
  cardCheck: CardCheck | undefined,
  cardWarnings: QualityWarning[] = [],
  offCard = false,
): Shown {
  // A problem with the Card is flagged, and it explains a caution or a failure better than a
  // guess, unless the grays say the corners are off the Card: then the warnings were read from
  // the wrong places, and the corner order is the likelier cause.
  const flagged = cardWarnings.length > 0 && !offCard
  if (reading.corrected && cardCheck?.verdict === "good") {
    return {
      verdict: "good",
      main: reading.corrected,
      why: `Each of the 24 Card patches, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, so the correction can be trusted.`,
    }
  }
  if (reading.corrected && cardCheck?.verdict === "caution") {
    const dirty = cardCheck.dirtyGrays?.[0]
    const cause = dirty
      ? `The ${dirty} gray step looks dirty or tinted, so it was left out of the correction.`
      : flagged
        ? `Each Card patch, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, more than usual. The problem flagged below is the likely cause.`
        : `Each Card patch, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, more than usual. Uneven light across the Card or a dirty gray step can do that.`
    return {
      verdict: "caution",
      main: reading.corrected,
      beside: reading.raw,
      why: `${cause} The corrected Reading is shown with the raw one beside it; if they differ by a Chip or more, wipe the Card or retake in even light.`,
    }
  }
  if (reading.corrected && cardCheck && flagged) {
    return {
      verdict: "failed",
      main: reading.raw,
      why: `Each Card patch, corrected by a fit that left it out, is still off by ${fmt(cardCheck.meanDE)} on average. The problem flagged below is the likely cause. Showing the uncorrected Reading. Fix it and take the Photo again.`,
    }
  }
  if (reading.corrected && cardCheck) {
    const grays = cardCheck.dirtyGrays
    const cause =
      grays && grays.length > 1
        ? `More than one gray step looks dirty or tinted (${grays.join(", ")}). Wipe the Card or try another.`
        : "The corners were probably tapped out of order, or there is glare or shade on the Card. Tap Start over and begin at the brown patch."
    return {
      verdict: "failed",
      main: reading.raw,
      why: `Each Card patch, corrected by a fit that left it out, is still off by ${fmt(cardCheck.meanDE)} on average. ${cause} Showing the uncorrected Reading.`,
    }
  }
  return {
    verdict: "uncorrected",
    main: reading.raw,
    why: "No Card was marked, so this is straight from the Photo. The light and the camera shift it, often by a whole Chip.",
  }
}
