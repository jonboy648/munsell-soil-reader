// Which of a Spot's two Readings to trust, and the plain words that say why.
import { pageModel, type CardCheck, type ChipReading, type PageHue, type QualityWarning, type Reading } from "@/engine"

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

/** The first Chip to tap on a Page, as the book prints it: `8/1`. */
const firstChip = (hue: PageHue): string => {
  const { value, chroma } = pageModel(hue).taps[0].chip
  return `${value}/${chroma}`
}

/** Which Card the Reading was made against; the words differ between a ColorChecker and a Page. */
export type CardInfo = { kind: "colorchecker" } | { kind: "page"; hue: PageHue }

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
  card: CardInfo = { kind: "colorchecker" },
): Shown {
  const each = card.kind === "page" ? "Chip on the Page" : "Card patch"
  // A problem with the Card is flagged, and it explains a caution or a failure better than a
  // guess, unless the grays say the corners are off the Card: then the warnings were read from
  // the wrong places, and the corner order is the likelier cause.
  const flagged = cardWarnings.length > 0 && !offCard
  if (reading.corrected && cardCheck?.verdict === "good") {
    return {
      verdict: "good",
      main: reading.corrected,
      why: `Each ${card.kind === "page" ? each : "of the 24 Card patches"}, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, so the correction can be trusted.`,
    }
  }
  if (reading.corrected && cardCheck?.suspectRow !== undefined) {
    // The Chips that disagree sit in one row of the Page, which the mean of the rest hides.
    return {
      verdict: "failed",
      main: reading.raw,
      why: `Two or more Chips in the ${cardCheck.suspectRow}/ row disagreed with the fit and were left out. Either the ${cardCheck.suspectRow}/1 Chip is dirty or worn, or those Chips are darker or stronger than the gray /1 column can describe. Showing the uncorrected Reading. Wipe the Page, take the Photo in even light, or use a different Card.`,
    }
  }
  if (reading.corrected && cardCheck?.verdict === "caution") {
    const left = cardCheck.leftOut
    const cause = left?.length
      ? `${left.join(" and ")} looked dirty or tinted, so ${left.length > 1 ? "they were" : "it was"} left out of the correction.`
      : flagged
        ? `Each ${each}, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, more than usual. The problem flagged below is the likely cause.`
        : `Each ${each}, corrected by a fit that left it out, is off by ${fmt(cardCheck.meanDE)} on average, more than usual. Uneven light across the Card or a dirty gray step can do that.`
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
      why: `Each ${each}, corrected by a fit that left it out, is still off by ${fmt(cardCheck.meanDE)} on average. The problem flagged below is the likely cause. Showing the uncorrected Reading. Fix it and take the Photo again.`,
    }
  }
  if (reading.corrected && cardCheck) {
    return {
      verdict: "failed",
      main: reading.raw,
      why:
        card.kind === "page"
          ? `Each ${each}, corrected by a fit that left it out, is still off by ${fmt(cardCheck.meanDE)} on average. The four Chips were probably tapped out of order, the wrong hue was chosen, the Page is worn all over, or there is glare or shade on it. Showing the uncorrected Reading. Tap Start over and begin at the ${firstChip(card.hue)} Chip, top left.`
          : `Each ${each}, corrected by a fit that left it out, is still off by ${fmt(cardCheck.meanDE)} on average. The corners were probably tapped out of order, or there is glare or shade on the Card. Showing the uncorrected Reading. Tap Start over and begin at the brown patch.`,
    }
  }
  return {
    verdict: "uncorrected",
    main: reading.raw,
    why: "No Card was marked, so this is straight from the Photo. The light and the camera shift it, often by a whole Chip.",
  }
}
