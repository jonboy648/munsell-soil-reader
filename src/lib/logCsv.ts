// The Log as a CSV spreadsheet (RFC 4180): a header row, then one row per Reading with the
// Sample's fields repeated on each row.
import type { Sample, SavedReading } from "@/lib/log"
import { shownReading } from "@/lib/verdict"

export const CSV_HEADER = [
  "Sample",
  "Depth top (cm)",
  "Depth bottom (cm)",
  "Condition",
  "Notes",
  "Latitude",
  "Longitude",
  "Location accuracy (m)",
  "Saved",
  "Spot x",
  "Spot y",
  "Chip",
  "Chip name",
  "Exact",
  "Top 3",
  "Card",
  "Page hue",
  "Card check",
  "Card check mean DE",
  "Warnings",
]

const CARD_CHECK_TEXT = { good: "good", failed: "failed", uncorrected: "not corrected" }

/** A field in quotes when it holds a comma, a quote or a line break; quotes inside are doubled. */
const field = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function row(sample: Sample, saved: SavedReading): string {
  const { verdict, main } = shownReading(saved.reading, saved.cardCheck)
  const { location } = sample
  return [
    sample.name,
    sample.depthTop,
    sample.depthBottom,
    sample.condition,
    sample.notes,
    location?.lat.toFixed(6),
    location?.lon.toFixed(6),
    location && Math.round(location.accuracy),
    new Date(sample.createdAt).toISOString(),
    Math.round(saved.reading.spot.x),
    Math.round(saved.reading.spot.y),
    main.chip.notation,
    main.chip.name,
    main.exact,
    main.top3.map(({ chip, de }) => `${chip.notation} (${de.toFixed(1)})`).join("; "),
    saved.card.kind,
    saved.card.hue,
    CARD_CHECK_TEXT[verdict],
    saved.cardCheck?.meanDE.toFixed(2),
    saved.quality.map((w) => w.kind).join("; "),
  ]
    .map(field)
    .join(",")
}

/** Samples oldest first, each Sample's Readings in the order they were saved. */
export function logToCsv(samples: Sample[]): string {
  const rows = [...samples]
    .sort((a, b) => a.createdAt - b.createdAt)
    .flatMap((sample) => sample.readings.map((saved) => row(sample, saved)))
  return [CSV_HEADER.map(field).join(","), ...rows].map((line) => `${line}\r\n`).join("")
}

/** Hands the CSV to the browser as a file download. */
export function downloadCsv(samples: Sample[], now = new Date()): void {
  const url = URL.createObjectURL(new Blob([logToCsv(samples)], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `soil-log-${now.toISOString().slice(0, 10)}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000) // not at once: some browsers still need it
}
