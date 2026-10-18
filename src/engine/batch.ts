// A frame batch: the measured colors of the patches of one print batch of the frame.
//
// Printed filament colors vary between batches (ADR 0003), so each batch's patches are measured
// once and the measurements travel in a file named for the batch code printed on the frame. The
// file is a CSV with one row per patch, the format the measurement mode (#54) exports:
//
//   patch,L,a,b,sd,n,method,date
//   G1,94.8,-0.4,1.9,0.21,5,camera vs ColorChecker,2026-11-02
//
//  - patch: a patch ID from the frame's layout, G1 to G6 and S01 to S12.
//  - L, a, b: the measured CIELAB color, illuminant D50 (the ColorChecker's reference values
//    are D50 too). Left blank on a patch that is listed but not measured yet.
//  - sd: how far the measurements of that patch spread, as a CIEDE2000 distance from their mean.
//  - n: how many measurements went into it.
//  - method: how it was measured, in words ("camera vs ColorChecker", "spectrophotometer").
//  - date: when, as YYYY-MM-DD.
//
// Until every patch has a measured row, the frame is refused as a Card.
import type { Vec3 } from "./color"
import { REFERENCE_PATCHES } from "./frameLayout"

export interface BatchPatch {
  id: string
  /** CIELAB, illuminant D50. */
  lab: Vec3
  /** The spread of the measurements, as a CIEDE2000 distance from their mean. */
  sd: number
  /** How many measurements it is the mean of. */
  n: number
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

export const BATCH_COLUMNS = ["patch", "L", "a", "b", "sd", "n", "method", "date"] as const

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
 * Read a batch file. Rows with a blank L, a and b are patches that are listed but not measured
 * yet; they are left out of the batch. Throws BatchFormatError, with the line, for anything else
 * that is wrong, so a bad file is never half used.
 */
export function parseBatch(code: string, csv: string): Batch {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).map((text, i) => ({ text, n: i + 1 })).filter((l) => l.text.trim() !== "")
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
    const [id, L, a, b, sd, count, method, date] = row
    if (!known.has(id)) fail(n, `"${id}" is not a patch on this frame (G1 to G6, S01 to S12).`)
    if (patches.some((p) => p.id === id)) fail(n, `patch ${id} is listed twice.`)
    if ([L, a, b].every((v) => v === "")) continue // listed, not measured
    const lab = [L, a, b].map(Number)
    if ([L, a, b].some((v) => v === "") || lab.some((v) => !Number.isFinite(v))) fail(n, `L, a and b of ${id} must be numbers, or all blank.`)
    if (lab[0] < 0 || lab[0] > 100 || Math.abs(lab[1]) > 128 || Math.abs(lab[2]) > 128) fail(n, `the color of ${id} is not a CIELAB color (L 0 to 100, a and b within 128).`)
    const spread = Number(sd)
    if (sd === "" || !Number.isFinite(spread) || spread < 0) fail(n, `sd of ${id} must be a number, 0 or more.`)
    const shots = Number(count)
    if (!Number.isInteger(shots) || shots < 1) fail(n, `n of ${id} must be a whole number, 1 or more.`)
    if (method === "") fail(n, `say how ${id} was measured, in the method column.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(n, `the date of ${id} must be YYYY-MM-DD.`)
    patches.push({ id, lab: lab as Vec3, sd: spread, n: shots, method, date })
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
