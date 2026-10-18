// The frame's batch files: one CSV per print batch, named for the batch code printed on the
// frame, in src/data/batches/ (the format is in src/engine/batch.ts and docs/frame-batches.md).
// Each is its own small chunk, so the app carries a batch only when it is looked up, and the
// service worker still precaches them all for the field.
//
// No batch has been measured yet, so the folder is empty and every code is refused as not
// measured. A measured batch is a file added there.
import { batchCodeOf, batchProblem, parseBatch, type Batch } from "@/engine"

const files = import.meta.glob("../data/batches/*.csv", { query: "?raw", import: "default" }) as Record<
  string,
  () => Promise<string>
>

const byCode = new Map(
  Object.entries(files).map(([path, load]) => [batchCodeOf(path.replace(/^.*\//, "").replace(/\.csv$/i, "")), load]),
)

export type BatchLookup = { state: "ready"; batch: Batch } | { state: "refused"; message: string }

/** The batch for a code the user typed: measured and ready, or why it cannot be a Card, in plain words. */
export async function lookupBatch(typed: string): Promise<BatchLookup> {
  const code = batchCodeOf(typed)
  const load = byCode.get(code)
  if (!load) return { state: "refused", message: batchProblem({ code, patches: [] })! }
  try {
    const batch = parseBatch(code, await load())
    const problem = batchProblem(batch)
    return problem ? { state: "refused", message: problem } : { state: "ready", batch }
  } catch (error) {
    return { state: "refused", message: error instanceof Error ? error.message : "That batch file could not be read." }
  }
}
