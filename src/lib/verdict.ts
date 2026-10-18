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
 * shown as the answer. A failure is only blamed on the corner order when nothing else
 * explains it: not a Card quality warning, and not a dirty gray step.
 */
export function shownReading(
  reading: Reading,
  cardCheck: CardCheck | undefined,
  quality: QualityWarning[] = [],
): Shown {
  if (reading.corrected && cardCheck?.verdict === "good") {
    return {
      verdict: "good",
      main: reading.corrected,
      why: `Each of the 24 Card patches, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, so the correction can be trusted.`,
    }
  }
  if (reading.corrected && cardCheck?.verdict === "caution") {
    const dirty = cardCheck.dirtyGrays?.[0]
    return {
      verdict: "caution",
      main: reading.corrected,
      beside: reading.raw,
      why: dirty
        ? `The ${dirty} gray step looks dirty or tinted, so it was left out of the correction. The corrected Reading is shown with the raw one beside it. Wipe the Card or try another.`
        : `Each Card patch, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, more than usual. Uneven light across the Card or a dirty gray step can do that. The corrected Reading is shown with the raw one beside it; if they differ by a Chip or more, retake in even light.`,
    }
  }
  if (reading.corrected && cardCheck) {
    const cardWarnings = quality.filter((w) => w.where === "card")
    const grays = cardCheck.dirtyGrays
    const cause = cardWarnings.length
      ? cardWarnings.map((w) => w.advice).join(" ")
      : grays && grays.length > 1
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
