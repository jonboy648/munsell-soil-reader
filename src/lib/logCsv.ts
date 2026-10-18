// The Log as a CSV spreadsheet (RFC 4180): a header row, then one row per Reading with the
// Sample's fields repeated on each row.
import type { Sample, SavedReading } from "@/lib/log"
import { downloadBlob } from "@/lib/download"
import { shownReading } from "@/lib/verdict"

export const CSV_HEADER = [
  "Sample",
  "Depth top (in)",
  "Depth bottom (in)",
  "Condition",
  "Notes",
  "Latitude",
  "Longitude",
  "Location accuracy (m)",
  "Sample created",
  "Saved",
  "UTC offset",
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

// Excel and similar tools run a cell that starts with = + - @ (or a tab or a carriage return) as
// a formula, and turn other text into a number, a time, a date or TRUE/FALSE: 001, 1-2, 3/4,
// 1 A (1:00 AM), 3 p, (5), $5, Mar 5, Sep-12, true. A leading apostrophe stops all of it (OWASP's
// advice). Used for what the user typed: the Sample name and the notes.
const FORMULA = /^[=+\-@\t\r]/
// Starts with a digit (numbers, times, dates, "5 March"), a sign, or a currency sign or bracket
// followed by a digit.
const NUMBER_LIKE = /^(?:[-+]|\.?\d|\(\s*[$€£¥]?\s*\.?\d|[$€£¥]\s*\.?\d)/
// A month and a day or year: Mar 5, Oct 3, Sep-12, March 5, 2026. Not "Marsh 5".
const MONTH =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
const MONTH_DAY = new RegExp(`^(?:${MONTH})\\.?[\\s\\-/]*\\d{1,4}(?:[\\s,\\-/]+\\d{1,4})?$`, "i")
const BOOLEAN = /^(?:true|false)$/i

/** The text with a leading apostrophe when Excel would read it as anything but text. */
export function asText(text: string): string {
  const trimmed = text.trim()
  const risky = FORMULA.test(text) || NUMBER_LIKE.test(trimmed) || MONTH_DAY.test(trimmed) || BOOLEAN.test(trimmed)
  return risky ? `'${text}` : text
}

// Dates are in the user's own time, the way they read their watch, with the offset beside them.
// "2026-10-18 19:30" is something Excel reads as a date.
const pad = (n: number) => String(n).padStart(2, "0")
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localDateTime = (d: Date) => `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
const utcOffset = (d: Date) => {
  const minutes = -d.getTimezoneOffset()
  const abs = Math.abs(minutes)
  return `UTC${minutes < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** A field in quotes when it holds a comma, a quote or a line break; quotes inside are doubled. */
const field = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function row(sample: Sample, saved: SavedReading): string {
  const { verdict, main } = shownReading(saved.reading, saved.cardCheck)
  const { location } = sample
  const savedAt = new Date(saved.savedAt)
  return [
    asText(sample.name),
    sample.depthTop,
    sample.depthBottom,
    sample.condition,
    asText(sample.notes),
    location?.lat.toFixed(6),
    location?.lon.toFixed(6),
    location && Math.round(location.accuracy),
    localDateTime(new Date(sample.createdAt)),
    localDateTime(savedAt),
    utcOffset(savedAt),
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

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

/**
 * Hands the CSV to the browser as a file download. The byte-order mark goes on here and not in
 * `logToCsv`: Excel needs it to read the file as UTF-8 (otherwise "Café" comes out as "CafÃ©").
 */
export function downloadCsv(samples: Sample[], now = new Date()): void {
  const blob = new Blob([BYTE_ORDER_MARK, logToCsv(samples)], { type: "text/csv;charset=utf-8" })
  downloadBlob(blob, `soil-log-${localDate(now)}.csv`)
}
