// Layers that meet the color and depth tests of different indicators except for thickness may be
// combined, and the most restrictive thickness of the indicators used must be met (NCNE supplement
// p. 42-43, Table 7; Field Indicators p. 7). Only the indicators that are decided from colors alone
// are combined here: S5, F3, F6 and F7.
import type { Criteria, Region } from "../regions/types"
import {
  aboveChroma,
  darkRedoxLayer,
  depletedLayer,
  inches,
  layerWords,
  matrixWords,
  sandyRedoxLayer,
  start,
  type Finding,
} from "./families"
import { runs, type Profile, type Seg } from "./profile"

const COMBINABLE = ["S5", "F3", "F6", "F7"] as const

/** The thickness and starting depth each indicator asks for: the strictest of its variants (Table 7). */
function requirement(c: Criteria): { thickness: number; startsWithin: number } | null {
  if (c.kind === "sandyRedox" || c.kind === "darkRedox") return { thickness: c.thickness, startsWithin: c.startsWithin }
  if (c.kind === "depleted") {
    const strict = c.variants.reduce((a, b) => (b.thickness > a.thickness ? b : a))
    return { thickness: strict.thickness, startsWithin: strict.startsWithin }
  }
  return null
}

function meets(c: Criteria, seg: Seg): boolean {
  if (c.kind === "sandyRedox") return sandyRedoxLayer(c, seg)
  if (c.kind === "darkRedox") return darkRedoxLayer(c, seg)
  if (c.kind === "depleted") return depletedLayer(c, seg)
  return false
}

export interface Combined {
  indicator: string
  finding: Finding
  /** What the layers meet together, in words. */
  together: string
}

/** The indicators met by runs of layers together. `taken` says whether an indicator is already decided or waiting on something. */
export function combined(profile: Profile, region: Region, taken: (id: string) => boolean): Combined[] {
  const found = COMBINABLE.flatMap((id) => {
    const indicator = region.indicators.find((i) => i.id === id)
    return indicator && requirement(indicator.criteria) ? [{ id, criteria: indicator.criteria, need: requirement(indicator.criteria)! }] : []
  })
  const metBy = (seg: Seg) => found.filter((f) => meets(f.criteria, seg))
  const out: Combined[] = []
  for (const run of runs(profile.segs, (s) => metBy(s).length > 0)) {
    const involved = found.filter((f) => run.some((s) => meets(f.criteria, s)))
    if (involved.length < 2) continue
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = start(profile, "muckOrMineral", run[0])
    const thickest = Math.max(...involved.map((f) => f.need.thickness))
    const shallowest = Math.min(...involved.map((f) => f.need.startsWithin))
    if (thickness < thickest || at > shallowest || !aboveChroma(profile, run[0]).ok) continue
    const codes = involved.map((f) => f.id)
    const together = `${codes.join(" and ")} combined: ${layerWords(run).toLowerCase()} together are ${inches(thickness)} thick starting ${inches(at)} down, which meets the most restrictive thickness of the indicators used (${inches(thickest)} starting within ${inches(shallowest)}), as the supplement allows (Table 7, p. 43).`
    const evidence = run.map((s) => `${layerWords([s])}: ${matrixWords(s)} meets ${metBy(s).map((f) => f.id).join(" and ")} apart from thickness.`)
    for (const f of involved) {
      if (!taken(f.id)) out.push({ indicator: f.id, finding: { segs: run, evidence: [...evidence, together], checks: [], needs: [] }, together })
    }
  }
  return out
}
