// Which hydric soil indicators a sampling point's layers satisfy, with the rule quoted and the layers
// named, for the user to confirm. Pure. An indicator is suggested only when everything it needs is
// recorded; otherwise it is listed under what it needs, and one that does not apply in the project's
// subregion is not offered at all. Nothing here decides: confirming is the user's.
import type { IndicatorChoice, Project, SamplingPoint } from "../model"
import { regionOf } from "../regions"
import type { Citation, Indicator, Region, Scope } from "../regions/types"
import { combined } from "./combine"
import { evaluate, layerWords, type Finding } from "./families"
import { buildProfile, type Profile } from "./profile"

export type Decision = "pending" | "confirmed" | "rejected"

export interface Suggestion {
  /** The indicator's id on the form. */
  indicator: string
  code: string
  name: string
  /** The criteria in the document's words. */
  rule: string
  citations: readonly Citation[]
  /** What in the layers satisfies it, in words. */
  evidence: string[]
  /** The layers that satisfy it, counting down from the surface from 1. */
  layers: { n: number; top: number; bottom: number }[]
  /** Things to look at before confirming. */
  checks: string[]
  /** Set when it is met only together with other indicators, by the combined thickness. */
  combinedWith?: string
  decision: Decision
  remark?: string
}

/** An indicator that is not suggested, and what it is waiting for. */
export interface Unmet {
  indicator: string
  code: string
  name: string
  /** What the app cannot see yet, in words. */
  needs: string[]
  /** The colors and depths fit and only an observation is missing. */
  colorsFit: boolean
  evidence: string[]
}

/** An indicator the user ticked that the app did not suggest. */
export interface Ticked {
  indicator: string
  code: string
  name: string
  remark: string
}

export interface Suggestions {
  suggestions: Suggestion[]
  needs: Unmet[]
  ticked: Ticked[]
  /** Indicators of the form that do not apply in the project's subregion, by id. */
  notHere: string[]
}

type Scoped = "in" | "out" | "unknown"

/** Whether an indicator's printed scope covers the project's subregion. */
export function scopeState(scope: Scope | undefined, project: Project, region: Region): Scoped {
  if (!scope) return "in"
  const sub = project.subregion
  if (!sub) return "unknown"
  const lrrOf = (mlra: string) => region.subregions.find((l) => l.mlras.includes(mlra))?.id
  if (scope.outsideMlra) {
    // Outside the MLRA: in unless the project is in it; with the MLRA not picked in a region that has it, unknown.
    if (sub.mlra) return scope.outsideMlra.includes(sub.mlra) ? "out" : "in"
    return scope.outsideMlra.some((m) => lrrOf(m) === sub.lrr) ? "unknown" : "in"
  }
  if (scope.lrr?.includes(sub.lrr)) return "in"
  if (sub.mlra && scope.mlra?.includes(sub.mlra)) return "in"
  // The MLRAs the scope names that are in the project's LRR: if the MLRA is not picked, it might be one.
  if (!sub.mlra && scope.mlra?.some((m) => lrrOf(m) === sub.lrr)) return "unknown"
  return "out"
}

/** An indicator as the user reads it: "A12 Thick Dark Surface", or just the name for Other, which has no code. */
export const indicatorLabel = (i: { code: string; name: string }): string => (i.code ? `${i.code} ${i.name}` : i.name)

const TEXTURE_KINDS = new Set(["mucky", "organic"])

const asSuggestion = (indicator: Indicator, finding: Finding, choice: IndicatorChoice | undefined, combinedWith?: string): Suggestion => ({
  indicator: indicator.id,
  code: indicator.code,
  name: indicator.name,
  rule: indicator.quote,
  citations: indicator.citations,
  evidence: finding.evidence,
  layers: finding.segs.map((s) => ({ n: s.n, top: s.top, bottom: s.bottom })),
  checks: finding.checks,
  ...(combinedWith ? { combinedWith } : {}),
  decision: choice?.state ?? "pending",
  ...(choice?.remark ? { remark: choice.remark } : {}),
})

/** The indicators the layers satisfy, and what the others still need. */
export function suggest(project: Project, point: SamplingPoint, profile: Profile = buildProfile(point.layers)): Suggestions {
  const region = regionOf(project.region)
  const choices = point.indicators ?? {}
  const suggestions: Suggestion[] = []
  const needs: Unmet[] = []
  const notHere: string[] = []
  const unmet = (i: Indicator, texts: string[], colorsFit = false, evidence: string[] = []) =>
    needs.push({ indicator: i.id, code: i.code, name: i.name, needs: texts, colorsFit, evidence })

  const decided = new Map<string, Suggestion>()
  for (const indicator of region.indicators) {
    if (indicator.id === "other") continue
    const scoped = scopeState(indicator.scope, project, region)
    if (scoped === "out") {
      notHere.push(indicator.id)
      continue
    }
    if (scoped === "unknown") {
      unmet(indicator, ["The project's subregion, which decides whether this indicator applies. Pick it on the project."])
      continue
    }
    const { criteria } = indicator
    if (criteria.kind === "field") {
      unmet(indicator, indicator.needs.map((n) => n.text))
      continue
    }
    if (TEXTURE_KINDS.has(criteria.kind) && !profile.textured) {
      unmet(indicator, indicator.needs.map((n) => n.text))
      continue
    }
    const finding = evaluate(criteria, profile)
    if (!finding) continue
    if (finding.needs.length > 0) unmet(indicator, finding.needs, true, finding.evidence)
    else {
      const s = asSuggestion(indicator, finding, choices[indicator.id])
      suggestions.push(s)
      decided.set(indicator.id, s)
    }
  }

  // Layers that meet different indicators except for thickness, and together meet the most restrictive one.
  for (const c of combined(profile, region, (id) => decided.has(id) || needs.some((n) => n.indicator === id))) {
    const indicator = region.indicators.find((i) => i.id === c.indicator)!
    if (scopeState(indicator.scope, project, region) !== "in" || decided.has(indicator.id)) continue
    const s = asSuggestion(indicator, c.finding, choices[indicator.id], c.together)
    suggestions.push(s)
    decided.set(indicator.id, s)
  }

  const ticked = region.indicators.flatMap((i): Ticked[] => {
    const choice = choices[i.id]
    return choice?.state === "confirmed" && !decided.has(i.id) ? [{ indicator: i.id, code: i.code, name: i.name, remark: choice.remark ?? "" }] : []
  })
  const order = new Map(region.indicators.map((i, n) => [i.id, n]))
  suggestions.sort((a, b) => order.get(a.indicator)! - order.get(b.indicator)!)
  return { suggestions, needs, ticked, notHere }
}

export { layerWords }
