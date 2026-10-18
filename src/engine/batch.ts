// A frame batch: the measured colors of the patches of one print batch of the frame.
//
// Printed filament colors vary between batches (ADR 0003), so each batch's patches are measured
// once and the measurements travel in a file named for the batch code printed on the frame. The
// file is a CSV with one row per patch, the format the measurement mode (#54) exports:
//
//   patch,L,a,b,sd_L,sd_a,sd_b,n,method,date
//   G1,94.8,-0.4,1.9,0.21,0.08,0.11,5,camera vs ColorChecker,2026-11-02
//
//  - patch: a patch ID from the frame's layout, G1 to G6 and S01 to S12.
//  - L, a, b: the measured CIELAB color, illuminant D50 (the ColorChecker's reference values
//    are D50 too).
//  - sd_L, sd_a, sd_b: the standard deviation of each channel across the measurements. All three
//    or none: an instrument's single reading has none.
//  - n: how many measurements went into it; empty for an instrument's single reading.
//  - method: how it was measured, in words ("camera vs ColorChecker", "spectrophotometer").
//  - date: when, as YYYY-MM-DD.
//
// A patch with no row is not measured. Until every patch has a row, the frame is refused as a Card.
import type { Vec3 } from "./color"
import { REFERENCE_PATCHES } from "./frameLayout"

export interface BatchPatch {
  id: string
  /** CIELAB, illuminant D50. */
  lab: Vec3
  /** The standard deviation of L, a and b across the measurements; absent when there is one reading. */
  sd?: Vec3
  /** How many measurements it is the mean of; absent for an instrument's single reading. */
  n?: number
  method: string
  /** YYYY-MM-DD. */
  date: string
}

export interface Batch {
  /** The batch code printed on the frame, in capitals. */
  code: string
  /** The patches that have measured values. */
  patches: BatchPatch[]
}

export const BATCH_COLUMNS = ["patch", "L", "a", "b", "sd_L", "sd_a", "sd_b", "n", "method", "date"] as const

/** A batch code as the file is named and as the user types it: no spaces, in capitals. */
export const batchCodeOf = (typed: string): string => typed.trim().toUpperCase()

/** The batch file could not be read. The message says where and why, in plain words. */
export class BatchFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BatchFormatError"
  }
}

/** The frame was given as a Card before its batch was measured. The message says what is missing. */
export class UnmeasuredBatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnmeasuredBatchError"
  }
}

/** One CSV line into its fields. A field may be in double quotes, with "" for a quote inside. */
function fields(line: string): string[] {
  const out: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted && c === '"' && line[i + 1] === '"') {
      field += '"'
      i++
    } else if (c === '"') {
      quoted = !quoted
    } else if (c === "," && !quoted) {
      out.push(field.trim())
      field = ""
    } else {
      field += c
    }
  }
  out.push(field.trim())
  return out
}

/**
 * Read a batch file. Throws BatchFormatError, with the line, for anything that is wrong, so a bad
 * file is never half used.
 */
export function parseBatch(code: string, csv: string): Batch {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((text, i) => ({ text, n: i + 1 })).filter((l) => l.text.trim() !== "")
  const fail = (n: number, why: string): never => {
    throw new BatchFormatError(`Batch file ${code}, line ${n}: ${why}`)
  }
  if (lines.length === 0) return fail(1, `it is empty. The first line is ${BATCH_COLUMNS.join(",")}.`)
  const header = fields(lines[0].text)
  if (header.length !== BATCH_COLUMNS.length || header.some((h, i) => h.toLowerCase() !== BATCH_COLUMNS[i].toLowerCase())) {
    fail(lines[0].n, `the first line must be ${BATCH_COLUMNS.join(",")}.`)
  }
  const known = new Set(REFERENCE_PATCHES.map((p) => p.id))
  const patches: BatchPatch[] = []
  for (const { text, n } of lines.slice(1)) {
    const row = fields(text)
    if (row.length !== BATCH_COLUMNS.length) fail(n, `expected ${BATCH_COLUMNS.length} columns, found ${row.length}.`)
    const [id, L, a, b, sdL, sdA, sdB, count, method, date] = row
    if (!known.has(id)) fail(n, `"${id}" is not a patch on this frame (G1 to G6, S01 to S12).`)
    if (patches.some((p) => p.id === id)) fail(n, `patch ${id} is listed twice.`)
    const lab = [L, a, b].map(Number)
    if ([L, a, b].some((v) => v === "") || lab.some((v) => !Number.isFinite(v))) fail(n, `L, a and b of ${id} must be numbers.`)
    if (lab[0] < 0 || lab[0] > 100 || Math.abs(lab[1]) > 128 || Math.abs(lab[2]) > 128) fail(n, `the color of ${id} is not a CIELAB color (L 0 to 100, a and b within 128).`)
    const spread = [sdL, sdA, sdB].map(Number)
    const someSpread = [sdL, sdA, sdB].some((v) => v !== "")
    if (someSpread && ([sdL, sdA, sdB].some((v) => v === "") || spread.some((v) => !Number.isFinite(v) || v < 0))) {
      fail(n, `sd_L, sd_a and sd_b of ${id} must be numbers, 0 or more, or all blank.`)
    }
    const shots = Number(count)
    if (count !== "" && (!Number.isInteger(shots) || shots < 1)) fail(n, `n of ${id} must be a whole number, 1 or more, or blank.`)
    if (method === "") fail(n, `say how ${id} was measured, in the method column.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(n, `the date of ${id} must be YYYY-MM-DD.`)
    patches.push({ id, lab: lab as Vec3, ...(someSpread ? { sd: spread as Vec3 } : {}), ...(count !== "" ? { n: shots } : {}), method, date })
  }
  return { code: batchCodeOf(code), patches }
}

/**
 * Why a batch cannot be used as a Card, in plain words, or null when every patch is measured.
 * A batch with nothing measured is the usual case until the first one is done.
 */
export function batchProblem(batch: Batch): string | null {
  const have = new Set(batch.patches.map((p) => p.id))
  const missing = REFERENCE_PATCHES.filter((p) => !have.has(p.id)).map((p) => p.id)
  if (missing.length === 0) return null
  if (have.size === 0) {
    return `This frame's batch (${batch.code}) has not been measured yet, so the colors of its patches are not known and it can't be used as a Card.`
  }
  return `This frame's batch (${batch.code}) is only partly measured (not yet: ${missing.join(", ")}), so it can't be used as a Card.`
}
