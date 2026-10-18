// A frame batch: the measured colors of the patches of one print batch of the frame.
//
// Printed filament colors vary between batches (ADR 0003), so each batch's patches are measured
// once and the measurements travel in a file named for the batch code printed on the frame. The
// file is the CSV the measurement mode (#60) exports, read by batchFile.ts: one row per patch,
//
//   patch,L,a,b,sd_L,sd_a,sd_b,n,method,date
//
// (the columns are explained in docs/frame-batches.md). A patch with no row is not measured.
// This file adds what only the frame knows: the patch IDs are the frame's, and until every
// patch has a row the frame is refused as a Card.
import { parseBatchCsv, type BatchRow } from "./batchFile"
import { REFERENCE_PATCHES } from "./frameLayout"

export interface Batch {
  /** The batch code printed on the frame, in capitals. */
  code: string
  /** The patches that have measured values. */
  patches: BatchRow[]
}

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

/**
 * Read a batch file for the frame. Throws BatchFormatError, naming the line, for anything that
 * is wrong, so a bad file is never half used: the file itself (batchFile.ts), a patch the frame
 * does not have, or a patch listed twice.
 */
export function parseBatch(code: string, csv: string): Batch {
  const fail = (why: string): never => {
    throw new BatchFormatError(`Batch file ${code}: ${why}`)
  }
  let patches: BatchRow[] = []
  try {
    patches = parseBatchCsv(csv)
  } catch (error) {
    fail(error instanceof Error ? error.message : "it could not be read.")
  }
  const known = new Set(REFERENCE_PATCHES.map((p) => p.id))
  patches.forEach(({ patch }, i) => {
    if (!known.has(patch)) fail(`"${patch}" is not a patch on this frame (G1 to G6, S01 to S12).`)
    if (patches.findIndex((p) => p.patch === patch) !== i) fail(`patch ${patch} is listed twice.`)
  })
  return { code: batchCodeOf(code), patches }
}

/**
 * Why a batch cannot be used as a Card, in plain words, or null when every patch is measured.
 * A batch with nothing measured is the usual case until the first one is done.
 */
export function batchProblem(batch: Batch): string | null {
  const have = new Set(batch.patches.map((p) => p.patch))
  const missing = REFERENCE_PATCHES.filter((p) => !have.has(p.id)).map((p) => p.id)
  if (missing.length === 0) return null
  if (have.size === 0) {
    return `This frame's batch (${batch.code}) has not been measured yet, so the colors of its patches are not known and it can't be used as a Card.`
  }
  return `This frame's batch (${batch.code}) is only partly measured (not yet: ${missing.join(", ")}), so it can't be used as a Card.`
}
