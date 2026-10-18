// The batch file: the measured colors of one print batch's patches, as a CSV. Measurement mode
// (#54) writes it and the frame card (#49) reads it, both through this module, so the two cannot
// drift apart. Pure text in, text out; it does not know what a batch is or whether it is
// complete.
//
//   patch,L,a,b,sd_L,sd_a,sd_b,n,method,date
//   G1,95.12,-0.41,1.20,0.31,0.05,0.12,6,camera vs ColorChecker,2026-10-18
//
// patch is a frame slot (G1 to G6, S01 to S12). L, a, b are CIELAB under D50. The sd columns are
// the sample standard deviation across the shots used and n counts them; both are empty for a
// value that did not come from shots (an instrument's). method says how it was measured and date
// is ISO. A file is UTF-8, LF line ends, one row per patch, a fixed header, and the batch code is
// the file's name. The reader is forgiving about what a spreadsheet does to a file (CRLF, a byte
// order mark, blank lines, the header's case) and strict about the values: it refuses numbers
// out of range, so a bad file is refused for every reader. What it does not know is which patch
// ids a frame has, or whether the file is complete; the frame card checks those.
import type { Vec3 } from "./color"

export const BATCH_COLUMNS = ["patch", "L", "a", "b", "sd_L", "sd_a", "sd_b", "n", "method", "date"] as const

/** How measurement mode says it measured. */
export const BATCH_METHOD_CAMERA = "camera vs ColorChecker"

export interface BatchRow {
  /** The frame slot: G1 to G6, S01 to S12. */
  patch: string
  /** CIELAB under D50. */
  lab: Vec3
  /** Sample standard deviation of each channel across the shots; absent when there were none to compare. */
  sd?: Vec3
  /** How many shots the value is the mean of. */
  n?: number
  method: string
  /** ISO date, YYYY-MM-DD. */
  date: string
}

// ---- swatches and slots ----
/** The swatch card's 18 candidate tiles, as debossed on their backs. */
export const SWATCH_IDS = Array.from({ length: 18 }, (_, i) => `swatch_${String(i + 1).padStart(2, "0")}`)

/** The frame's 18 slots in layout order: six grays, then twelve soil colors. */
export const FRAME_SLOTS = [
  ...Array.from({ length: 6 }, (_, i) => `G${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`),
]

/** The frame slot a swatch is measured for: swatch_01 to _06 for G1 to G6, swatch_07 to _18 for S01 to S12. */
export function swatchSlot(swatch: string): string {
  const at = SWATCH_IDS.indexOf(swatch)
  if (at < 0) throw new Error(`"${swatch}" is not one of the swatch card's tiles (swatch_01 to swatch_18).`)
  return FRAME_SLOTS[at]
}

// ---- writing ----
const field = (text: string) => (/[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text)

export function formatBatchCsv(rows: BatchRow[]): string {
  const lines = rows.map(({ patch, lab, sd, n, method, date }) =>
    [
      patch,
      ...lab.map((v) => v.toFixed(2)),
      ...(sd ? sd.map((v) => v.toFixed(2)) : ["", "", ""]),
      n === undefined ? "" : String(n),
      method,
      date,
    ]
      .map(field)
      .join(","),
  )
  return [BATCH_COLUMNS.join(","), ...lines].join("\n") + "\n"
}

// ---- reading ----
/** The text's records, each a list of fields, with quotes undone. Blank lines are skipped. */
function records(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const endCell = () => {
    row.push(cell)
    cell = ""
  }
  const endRow = () => {
    endCell()
    if (row.length > 1 || row[0] !== "") out.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') {
        cell += c
      } else if (text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        quoted = false
      }
    } else if (c === '"' && cell === "") quoted = true
    else if (c === ",") endCell()
    else if (c === "\n") endRow()
    else if (c !== "\r") cell += c
  }
  if (quoted) throw new Error("The file ends inside a quoted field.")
  if (cell !== "" || row.length > 0) endRow()
  return out
}

/** True for a real calendar date written YYYY-MM-DD. */
function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text)
}

/** Parses a batch file. Throws an Error that names the line and column when the file is wrong. */
export function parseBatchCsv(text: string): BatchRow[] {
  const [header, ...body] = records(text.replace(/^\uFEFF/, ""))
  // A spreadsheet may change the case of the header; the columns and their order may not change.
  if (!header || header.map((c) => c.trim().toLowerCase()).join(",") !== BATCH_COLUMNS.join(",").toLowerCase()) {
    throw new Error(`Line 1: the first line must be the header: ${BATCH_COLUMNS.join(",")}.`)
  }
  return body.map((cells, i) => {
    const line = i + 2
    const bad = (column: string, why: string) => new Error(`Line ${line}, ${column}: ${why}.`)
    if (cells.length !== BATCH_COLUMNS.length) {
      throw new Error(`Line ${line}: expected ${BATCH_COLUMNS.length} columns, found ${cells.length}.`)
    }
    const [patch, L, a, b, sdL, sdA, sdB, n, method, date] = cells
    const number = (column: string, value: string, low: number, high: number) => {
      if (value.trim() === "" || !Number.isFinite(Number(value))) throw bad(column, `"${value}" is not a number`)
      if (Number(value) < low || Number(value) > high) {
        throw bad(column, `${value} is outside ${low} to ${high === Infinity ? "any size" : high}`)
      }
      return Number(value)
    }
    if (patch.trim() === "") throw bad("patch", "is empty")
    if (method.trim() === "") throw bad("method", "is empty")
    if (!isIsoDate(date)) throw bad("date", `"${date}" is not a YYYY-MM-DD date`)
    const row: BatchRow = {
      patch: patch.trim(),
      lab: [number("L", L, 0, 100), number("a", a, -128, 128), number("b", b, -128, 128)],
      method,
      date,
    }
    // All three spreads or none.
    if ([sdL, sdA, sdB].some((v) => v !== "")) {
      row.sd = [number("sd_L", sdL, 0, Infinity), number("sd_a", sdA, 0, Infinity), number("sd_b", sdB, 0, Infinity)]
    }
    if (n !== "") {
      row.n = number("n", n, 1, Infinity)
      if (!Number.isInteger(row.n)) throw bad("n", `"${n}" is not a whole number of shots`)
    }
    return row
  })
}
