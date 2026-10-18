// The tests the indicators go through, one per family. Each reads the numbers from an indicator's
// criteria (regions/*/indicators.ts), so a threshold is data, and returns what satisfies it: the
// layers, the evidence in words, what the user should check, and what the app still needs.
// Every test is over the profile as recorded; nothing is rounded (a chroma between 2 and 3 is more
// than 2) and value is read as the nearest chip, which is what the Log holds.
import type { Criteria, TextureGroup } from "../regions/types"
import { isYellowerThan } from "./munsell"
import {
  concentrationShare,
  depletionShare,
  depth,
  fits,
  gleyedShare,
  isLowChromaMatrix,
  lowChromaShare,
  runs,
  type Profile,
  type Seg,
  type Surface,
} from "./profile"
import { isOrganic } from "./texture"

export interface Finding {
  /** The layers that satisfy it. */
  segs: Seg[]
  evidence: string[]
  /** Things to look at before confirming. */
  checks: string[]
  /** Observations that decide it and are not recorded: any here means the app cannot suggest it yet. */
  needs: string[]
}

export const written = (n: number): string => String(Math.round(n * 100) / 100)
export const inches = (n: number): string => `${written(n)} in`

/** "Layer 3 (25-29 in)" or "Layers 3 and 4 (25-34 in)". */
export function layerWords(segs: readonly Seg[]): string {
  const span = `${written(segs[0].top)}-${written(segs[segs.length - 1].bottom)} in`
  const ns = segs.map((s) => s.n)
  const list = ns.length === 1 ? `${ns[0]}` : ns.length === 2 ? `${ns[0]} and ${ns[1]}` : `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`
  return `${segs.length === 1 ? "Layer" : "Layers"} ${list} (${span})`
}

const GROUP_WORDS: Record<Exclude<TextureGroup, "any">, string> = {
  sandy: "sandy soil (loamy fine sand or coarser)",
  loamy: "loamy or clayey soil (loamy very fine sand and finer)",
}

/** Whether the group fits every layer, and the note to carry when the texture is not recorded. */
function groupFits(group: TextureGroup, segs: readonly Seg[]): { ok: boolean; check?: string } {
  if (group === "any") return { ok: true }
  const answers = segs.map((s) => fits(group, s.texture))
  if (answers.includes("no")) return { ok: false }
  return answers.includes("maybe")
    ? { ok: true, check: `Texture is not recorded for ${layerWords(segs).toLowerCase()}. This indicator is for ${GROUP_WORDS[group]}; confirm it only if that is what the layer is.` }
    : { ok: true }
}

/**
 * Mineral layers above a layer that meets an indicator must have a dominant chroma of 2 or less; chroma
 * above 2 is allowed only in a zone thinner than 6 in directly above it (Field Indicators p. 6, as
 * corrected by the Feb 2026 errata p. 3). Layers with no matrix color are skipped, and noted.
 */
export function aboveChroma(profile: Profile, first: Seg): { ok: boolean; note?: string } {
  const above = profile.segs.filter((s) => s.top < first.top && !isOrganic(s.texture)).reverse()
  let zone = 0
  let inZone = true
  for (const seg of above) {
    if (!seg.matrix) continue
    if (seg.matrix.chroma > 2) {
      if (!inZone) return { ok: false, note: `${layerWords([seg])} has a matrix chroma above 2 (${seg.matrix.notation}) above a layer with chroma 2 or less.` }
      zone += seg.thickness
    } else inZone = false
  }
  return zone < 6 ? { ok: true } : { ok: false, note: `The layers above with chroma more than 2 are ${inches(zone)} thick; they must be less than 6 in.` }
}

export const start = (profile: Profile, surface: Surface, seg: Seg) => depth(profile, surface, seg.top)

export const matrixWords = (seg: Seg) => (seg.matrix ? `${seg.matrix.notation}, ${seg.matrixPercent}%` : "no matrix color")

/** A gleyed matrix that fills 60 percent or more of a layer starting within a depth (S4, F2). */
function gleyed(c: Extract<Criteria, { kind: "gleyed" }>, profile: Profile): Finding | null {
  for (const seg of profile.segs) {
    if (isOrganic(seg.texture) || start(profile, "muckOrMineral", seg) > c.startsWithin) continue
    if (gleyedShare(seg) < c.share) continue
    const group = groupFits(c.texture, [seg])
    const above = aboveChroma(profile, seg)
    if (!group.ok || !above.ok) continue
    return {
      segs: [seg],
      evidence: [
        `${layerWords([seg])}: the matrix ${seg.matrix!.notation} is a gleyed color, ${seg.matrixPercent}% of the layer (${c.share}% or more is needed).`,
        `It starts ${inches(start(profile, "muckOrMineral", seg))} down (${inches(c.startsWithin)} or less is needed).`,
      ],
      checks: group.check ? [group.check] : [],
      needs: [],
    }
  }
  return null
}

/** A layer with a depleted matrix and 60 percent or more chroma of 2 or less, before thickness (F3). */
export const depletedLayer = (c: Extract<Criteria, { kind: "depleted" }>, s: Seg): boolean =>
  !isOrganic(s.texture) && fits(c.texture, s.texture) !== "no" && isLowChromaMatrix(s, c.share)

/** A depleted matrix with 60 percent or more chroma of 2 or less, thick enough, starting shallow enough (F3). */
function depleted(c: Extract<Criteria, { kind: "depleted" }>, profile: Profile): Finding | null {
  for (const run of runs(profile.segs, (s) => depletedLayer(c, s))) {
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = start(profile, "muckOrMineral", run[0])
    const variant = c.variants.find((v) => thickness >= v.thickness && at <= v.startsWithin)
    const above = aboveChroma(profile, run[0])
    const group = groupFits(c.texture, run)
    if (!variant || !above.ok || !group.ok) continue
    return {
      segs: run,
      evidence: [
        `${layerWords(run)}: a depleted matrix with ${c.share}% or more chroma of 2 or less (${run.map(matrixWords).join("; ")}).`,
        `${inches(thickness)} thick, starting ${inches(at)} down: ${inches(variant.thickness)} thick starting within ${inches(variant.startsWithin)} is needed.`,
      ],
      checks: ["The low chroma must be caused by wetness, not be a relict or parent material feature.", ...(group.check ? [group.check] : [])],
      needs: [],
    }
  }
  return null
}

/** A layer with a low-chroma matrix and 2 percent distinct or prominent concentrations, before thickness (S5). */
export const sandyRedoxLayer = (c: Extract<Criteria, { kind: "sandyRedox" }>, s: Seg): boolean =>
  !isOrganic(s.texture) &&
  fits(c.texture, s.texture) !== "no" &&
  s.matrix !== null &&
  s.matrix.chroma <= 2 &&
  s.matrixPercent >= c.share &&
  concentrationShare(s) >= c.redox

/** A sandy layer 4 in thick starting within 6 in with a low-chroma matrix and 2 percent distinct or prominent concentrations (S5). */
function sandyRedox(c: Extract<Criteria, { kind: "sandyRedox" }>, profile: Profile): Finding | null {
  for (const run of runs(profile.segs, (s) => sandyRedoxLayer(c, s))) {
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = start(profile, "muckOrMineral", run[0])
    const above = aboveChroma(profile, run[0])
    const group = groupFits(c.texture, run)
    if (thickness < c.thickness || at > c.startsWithin || !above.ok || !group.ok) continue
    return {
      segs: run,
      evidence: [
        `${layerWords(run)}: matrix ${run.map(matrixWords).join("; ")}, chroma 2 or less, with ${run.map((s) => written(concentrationShare(s))).join("% and ")}% distinct or prominent redox concentrations (${c.redox}% or more is needed).`,
        `${inches(thickness)} thick (${inches(c.thickness)} is needed), starting ${inches(at)} down (${inches(c.startsWithin)} or less).`,
      ],
      checks: [...(group.check ? [group.check] : []), "The concentrations must be soft masses or pore linings, not nodules or concretions."],
      needs: [],
    }
  }
  return null
}

/** A layer with a dark matrix and enough redox concentrations or depletions, before thickness (F6, F7). */
export function darkRedoxLayer(c: Extract<Criteria, { kind: "darkRedox" }>, s: Seg): boolean {
  if (isOrganic(s.texture) || fits(c.texture, s.texture) === "no" || !s.matrix || s.matrix.value > c.valueMax) return false
  const share = c.feature === "concentration" ? concentrationShare(s) : depletionShare(s)
  return c.variants.some((v) => s.matrix!.chroma <= v.chromaMax && share >= v.redox)
}

/** A dark surface layer with 2 or 5 percent redox concentrations (F6) or 10 or 20 percent depletions (F7). */
function darkRedox(c: Extract<Criteria, { kind: "darkRedox" }>, profile: Profile): Finding | null {
  const share = (s: Seg) => (c.feature === "concentration" ? concentrationShare(s) : depletionShare(s))
  for (const run of runs(profile.segs, (s) => darkRedoxLayer(c, s))) {
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = start(profile, "mineral", run[0])
    const above = aboveChroma(profile, run[0])
    const group = groupFits(c.texture, run)
    if (thickness < c.thickness || at > c.startsWithin || !above.ok || !group.ok) continue
    const what = c.feature === "concentration" ? "distinct or prominent redox concentrations" : "redox depletions (value 5 or more, chroma 2 or less)"
    return {
      segs: run,
      evidence: [
        `${layerWords(run)}: matrix ${run.map(matrixWords).join("; ")} (value ${c.valueMax} or less), with ${run.map((s) => `${written(share(s))}%`).join(" and ")} ${what}.`,
        `${inches(thickness)} thick (${inches(c.thickness)} or more), starting ${inches(at)} below the mineral surface (${inches(c.startsWithin)} or less).`,
      ],
      checks: [
        ...(c.feature === "concentration" ? ["The concentrations must be soft masses or pore linings."] : ["Do not mistake pieces of an E or calcic horizon mixed into the surface for depletions."]),
        ...(group.check ? [group.check] : []),
      ],
      needs: [],
    }
  }
  return null
}

/** Depleted or gleyed layers below a dark surface (A11 within 12 in, A12 deeper). */
function belowDark(c: Extract<Criteria, { kind: "belowDark" }>, profile: Profile): Finding | null {
  for (const run of runs(profile.segs, (s) => !isOrganic(s.texture) && isLowChromaMatrix(s, c.share))) {
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = start(profile, "muckOrMineral", run[0])
    const deepEnough = "within" in c.starts ? at <= c.starts.within : at > c.starts.below
    if (!deepEnough || thickness < c.thickness) continue
    // The dark layers above, from the surface down to this one, with no gap between them, each with a color.
    const above = profile.segs.filter((s) => s.top < run[0].top)
    if (above.length === 0 || above.some((s) => s.matrix === null)) continue
    if (start(profile, "muckOrMineral", above[0]) >= c.darkStartsWithin) continue
    let covered = start(profile, "muckOrMineral", above[0])
    let gap = false
    for (const s of above) {
      if (start(profile, "muckOrMineral", s) > covered + 1e-9) gap = true
      covered = Math.max(covered, depth(profile, "muckOrMineral", s.bottom))
    }
    if (gap || covered + 1e-9 < at) continue
    const sandy = above.filter((s) => s.texture.group === "sandy" && !isOrganic(s.texture))
    const unknown = above.filter((s) => s.texture.group === "unknown" && !isOrganic(s.texture))
    const darkEnough = above.every((s) => {
      const d = start(profile, "muckOrMineral", s)
      const rule = c.above.find((r) => d < r.startsWithin) ?? c.aboveRest
      const chromaMax = s.texture.group === "sandy" ? Math.min(rule.chromaMax, 1) : rule.chromaMax
      return s.matrix!.value <= rule.valueMax && s.matrix!.chroma <= chromaMax
    })
    if (!darkEnough) continue
    const rules = c.above.map((r) => `value ${r.valueMax} or less and chroma ${r.chromaMax} or less above ${inches(r.startsWithin)}`)
    return {
      segs: [...above, ...run],
      evidence: [
        `${layerWords(run)}: a depleted or gleyed matrix with ${c.share}% or more chroma of 2 or less (${run.map(matrixWords).join("; ")}), ${inches(thickness)} thick (${inches(c.thickness)} or more), starting ${inches(at)} down.`,
        `${layerWords(above)} above it are dark all the way down (${[...rules, `value ${c.aboveRest.valueMax} or less and chroma ${c.aboveRest.chromaMax} or less below`].join("; ")}), starting ${inches(start(profile, "muckOrMineral", above[0]))} from the surface.`,
      ],
      checks: unknown.length > 0 ? [`Texture is not recorded for ${layerWords(unknown).toLowerCase()}. Any sandy material (loamy fine sand or coarser) above must have 70 percent of its grains masked with organic material, seen with a hand lens.`] : [],
      needs: sandy.map((s) => `${layerWords([s])} is sandy: at least 70 percent of its visible grains must be masked with organic material, seen with a 10x or 15x hand lens.`),
    }
  }
  return null
}

/** A layer of mucky modified mineral material (S1, F1): decided by the texture term alone. */
function mucky(c: Extract<Criteria, { kind: "mucky" }>, profile: Profile): Finding | null {
  for (const run of runs(profile.segs, (s) => s.texture.mucky === true && fits(c.texture, s.texture) === "yes")) {
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = start(profile, "muckOrMineral", run[0])
    if (thickness < c.thickness || at > c.startsWithin) continue
    return {
      segs: run,
      evidence: [
        `${layerWords(run)}: mucky modified ${c.texture === "sandy" ? "sandy" : "loamy or clayey"} material (texture "${run[0].term}"), ${inches(thickness)} thick (${inches(c.thickness)} or more), starting ${inches(at)} down (${inches(c.startsWithin)} or less).`,
      ],
      checks: ["Mucky means an organic carbon content of 5 to 12 percent; loamy mucky material is hard to tell apart without a laboratory test."],
      needs: [],
    }
  }
  return null
}

/** A layer of muck, mucky peat or peat with a color (A3, A10, S3). */
function organic(c: Extract<Criteria, { kind: "organic" }>, profile: Profile): Finding | null {
  const matches = (s: Seg) =>
    s.texture.organic !== undefined &&
    c.terms.includes(s.texture.organic) &&
    s.matrix !== null &&
    s.matrix.value <= c.valueMax &&
    s.matrix.chroma <= c.chromaMax &&
    (!c.hueYellowerThan || isYellowerThan(s.matrix, c.hueYellowerThan))
  for (const run of runs(profile.segs, matches)) {
    const thickness = run[run.length - 1].bottom - run[0].top
    const at = run[0].top // measured from the actual soil surface
    if (thickness < c.thickness || at > c.startsWithin) continue
    const next = profile.segs.find((s) => s.top >= run[run.length - 1].bottom - 1e-9)
    if (c.below && "mineralChromaMax" in c.below && !(next && !isOrganic(next.texture) && next.matrix && next.matrix.chroma <= c.below.mineralChromaMax)) continue
    if (c.below && "sandy" in c.below && !(next && next.texture.group === "sandy")) continue
    return {
      segs: next && c.below ? [...run, next] : run,
      evidence: [
        `${layerWords(run)}: ${run[0].texture.organic} (${run.map(matrixWords).join("; ")}), ${inches(thickness)} thick (${inches(c.thickness)} or more), starting ${inches(at)} from the soil surface (${inches(c.startsWithin)} or less).`,
        ...(c.below && next ? [`${layerWords([next])} below it is ${"mineralChromaMax" in c.below ? `mineral soil with chroma ${next.matrix!.chroma} (${c.below.mineralChromaMax} or less is needed)` : "sandy"}.`] : []),
      ],
      checks: [],
      needs: [],
    }
  }
  return null
}

/** Run the test an indicator's criteria name, or null when the profile does not satisfy it. */
export function evaluate(criteria: Criteria, profile: Profile): Finding | null {
  switch (criteria.kind) {
    case "gleyed":
      return gleyed(criteria, profile)
    case "depleted":
      return depleted(criteria, profile)
    case "sandyRedox":
      return sandyRedox(criteria, profile)
    case "darkRedox":
      return darkRedox(criteria, profile)
    case "belowDark":
      return belowDark(criteria, profile)
    case "mucky":
      return mucky(criteria, profile)
    case "organic":
      return organic(criteria, profile)
    case "field":
      return null
  }
}

export { lowChromaShare }
