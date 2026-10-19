// The hydrophytic vegetation indicators of the Vegetation page, in the order the supplement applies them
// (ERDC/EL TR-12-1, Version 2.0, p. 24), and the suggestion for "Hydrophytic Vegetation Present?". Pure.
//
// Indicators 1 to 3 are decided from the plants. The prevalence index is applied only when the dominance
// test fails and hydric soil and wetland hydrology indicators are both present, or when the user applies it
// anyway and says why. Morphological adaptations and Problematic Hydrophytic Vegetation rest on what the
// delineator saw: the app lists them and takes the user's tick and reason, and does not recalculate.
// Nothing here ticks anything: a suggestion counts when the user confirms it.
import type { IndicatorChoice } from "../model"
import { dominanceTest, prevalenceIndex, type DominanceResult, type PrevalenceResult } from "./dominance"
import type { Vegetation } from "./entry"

export const VEG_INDICATORS = ["rapid", "dominance", "prevalence", "morphological", "problematic"] as const
export type VegIndicatorId = (typeof VEG_INDICATORS)[number]

/** What the hydric soil and the hydrology of the sampling point say, as far as the prevalence index is concerned. */
export interface VegContext {
  /** At least one hydric soil indicator is confirmed. */
  hydricSoil: boolean
  /** The hydrology indicators ticked meet the supplement's rule (one primary or two secondary). */
  hydrology: boolean
}

export type VegIndicatorState = "satisfied" | "not met" | "not applied" | "yours"

export interface VegIndicator {
  id: VegIndicatorId
  /** The label the form prints beside its blank, as the app says it. */
  printed: string
  state: VegIndicatorState
  /** Why, in words, with the numbers. */
  reason: string
  /** The supplement's rule for it. */
  rule: string
  citation: string
  /** What the user decided. An indicator that is not satisfied and not the user's is never confirmed. */
  decision: "pending" | "confirmed" | "rejected"
  remark?: string
  /**
   * Whether the form ticks it: indicators 1 to 3 while they are confirmed and still satisfied, the user's own
   * (4 and Problematic) while they are confirmed.
   */
  ticked: boolean
  /** Confirmed earlier, and the plants or the soil and hydrology no longer satisfy it: not ticked. */
  stale: boolean
}

export interface VegConclusion {
  /** Yes when an indicator is satisfied. The app never suggests No: a vegetation that meets nothing is for the user to judge (chapter 5). */
  suggested: "yes" | null
  because: string
  /** What the user answered. Only a confirmed answer is printed. */
  confirmed?: "yes" | "no"
}

export interface HydrophyticVegetation {
  dominance: DominanceResult
  prevalence: PrevalenceResult
  /** In the supplement's order: rapid test, dominance test, prevalence index, morphological adaptations, then problematic. */
  indicators: VegIndicator[]
  /** Whether the prevalence index is applied: by the supplement's order, or by the user's choice. */
  prevalenceApplied: boolean
  conclusion: VegConclusion
  /** Dominants that are not identified to species, by name: a dominant must be (p. 26). */
  notIdentified: string[]
}

const SUPPLEMENT = "Northcentral and Northeast Regional Supplement, ERDC/EL TR-12-1, Version 2.0 (2012)"
const cite = (pages: string) => `${SUPPLEMENT}, ${pages}`

const RULES: Record<VegIndicatorId, { printed: string; rule: string; citation: string }> = {
  rapid: {
    printed: "1 - Rapid Test for Hydrophytic Vegetation",
    rule: "All dominant species across all strata are rated OBL or FACW, or a combination of these two categories, based on a visual assessment.",
    citation: cite("p. 25"),
  },
  dominance: {
    printed: "2 - Dominance Test is >50%",
    rule: "More than 50 percent of the dominant plant species across all strata are rated OBL, FACW, or FAC.",
    citation: cite("p. 25"),
  },
  prevalence: {
    printed: "3 - Prevalence Index is 3.0 or less",
    rule: "The prevalence index is 3.0 or less.",
    citation: cite("p. 27"),
  },
  morphological: {
    printed: "4 - Morphological Adaptations",
    rule: "The plant community passes either the dominance test (Indicator 2) or the prevalence index (Indicator 3) after reconsideration of the indicator status of certain plant species that exhibit morphological adaptations for life in wetlands.",
    citation: cite("p. 30"),
  },
  problematic: {
    printed: "Problematic Hydrophytic Vegetation",
    rule: "Chapter 5 applies when FACU, NI, NO or unlisted species seem to be functioning as hydrophytes: explain it in Remarks.",
    citation: cite("pp. 118-127"),
  },
}

const percent = (n: number): string => `${Math.round(n * 10) / 10}`
const number = (n: number): string => `${Math.round(n * 1000) / 1000}`

/** The Dominance Test worksheet's words: what A and B are. */
function dominanceReason(d: DominanceResult): string {
  if (d.b === 0) {
    return d.strata.length === 0
      ? "No plants are recorded."
      : "No stratum has 5 percent cover or more, and there is more than one, so none is used and there are no dominant species (supplement p. 18)."
  }
  return `${d.a} of ${d.b} dominant species ${d.a === 1 ? "is" : "are"} OBL, FACW or FAC: ${percent(d.percent!)} percent. It must be more than 50.`
}

export function hydrophyticVegetation(vegetation: Vegetation, context: VegContext): HydrophyticVegetation {
  const dominance = dominanceTest(vegetation.plants)
  const prevalence = prevalenceIndex(vegetation.plants)
  const choices = vegetation.indicators ?? {}
  const decision = (id: VegIndicatorId): Pick<VegIndicator, "decision" | "remark"> => {
    const choice: IndicatorChoice | undefined = choices[id]
    return { decision: choice?.state ?? "pending", ...(choice?.remark ? { remark: choice.remark } : {}) }
  }
  const indicator = (id: VegIndicatorId, state: VegIndicatorState, reason: string): VegIndicator => {
    const decided = decision(id)
    const confirmed = decided.decision === "confirmed"
    const holds = state === "satisfied" || state === "yours"
    return {
      id,
      printed: RULES[id].printed,
      state,
      reason,
      rule: RULES[id].rule,
      citation: RULES[id].citation,
      ...decided,
      ticked: confirmed && holds,
      stale: confirmed && !holds,
    }
  }

  const statusOf = (id: string) => vegetation.plants.find((p) => p.id === id)!
  const rapidMet = dominance.b > 0 && dominance.dominants.every((d) => ["OBL", "FACW"].includes(statusOf(d.id).status!))
  const dominanceMet = dominance.passes === true
  const reason = (vegetation.prevalenceReason ?? "").trim()
  const applied = reason !== "" || (!dominanceMet && context.hydricSoil && context.hydrology)

  const wet = dominance.dominants.filter((d) => ["OBL", "FACW"].includes(statusOf(d.id).status!)).length
  const rapid = indicator(
    "rapid",
    rapidMet ? "satisfied" : "not met",
    dominance.b === 0
      ? dominanceReason(dominance)
      : rapidMet
        ? `All ${dominance.b} dominant species ${dominance.b === 1 ? "is" : "are"} OBL or FACW.`
        : `${dominance.b - wet} of ${dominance.b} dominant species ${dominance.b - wet === 1 ? "is" : "are"} FAC, FACU or UPL.`,
  )
  const dominanceIndicator = indicator("dominance", dominanceMet ? "satisfied" : "not met", dominanceReason(dominance))

  const index = prevalence.index
  const indexWords =
    index !== null
      ? `The prevalence index is ${index.toFixed(2)} (${number(prevalence.b)} / ${number(prevalence.a)}), ${index <= 3 ? "3.0 or less" : "over 3.0"}.`
      : prevalence.a === 0 && prevalence.identified === 0
        ? "No plants are recorded."
        : `Only ${percent(prevalence.identified)} percent of the cover is identified and rated, and 80 percent is needed, so the index is not valid (supplement pp. 27-28).`
  const missing = [context.hydricSoil ? "" : "a hydric soil indicator", context.hydrology ? "" : "wetland hydrology indicators"].filter(Boolean)
  const prevalenceIndicator = applied
    ? indicator("prevalence", prevalence.passes === true ? "satisfied" : "not met", `${reason !== "" ? `Applied at your request: ${reason}. ` : ""}${indexWords}`)
    : dominanceMet
      ? indicator("prevalence", "not applied", `Not needed: the dominance test is satisfied. ${indexWords}`)
      : indicator(
          "prevalence",
          "not applied",
          `The dominance test is not met, so the supplement goes on to the prevalence index, but only where hydric soil and wetland hydrology indicators are both present. Missing: ${missing.join(" and ")}. Confirm them, or apply the index anyway with your reason. ${indexWords}`,
        )

  const morphological = indicator(
    "morphological",
    "yours",
    "Your observation: the features are seen on more than 50 percent of the individuals of a FACU species where hydric soil and wetland hydrology indicators are present (adventitious roots, hypertrophied lenticels, multi-stemmed trunks, shallow root systems). The species then counts as FAC and the tests are run again. The app does not recalculate: say what you saw.",
  )
  const problematic = indicator(
    "problematic",
    "yours",
    "Your observation: FACU, NI, NO or unlisted species seem to be functioning as hydrophytes. Explain it.",
  )
  const indicators = [rapid, dominanceIndicator, prevalenceIndicator, morphological, problematic]

  const satisfied = indicators.filter((i) => i.state === "satisfied" || (i.id === "morphological" && i.decision === "confirmed"))
  const suggested = satisfied.length > 0
  const conclusion: VegConclusion = {
    suggested: suggested ? "yes" : null,
    because: suggested
      ? `Yes: ${satisfied.map((i) => i.printed.replace(/^\d - /, "")).join(" and ")} ${satisfied.length === 1 ? "is" : "are"} satisfied. Any one is enough (supplement p. 22).`
      : vegetation.plants.length === 0
        ? "No plants are recorded yet."
        : `No indicator is satisfied. ${dominanceReason(dominance)} ${applied ? indexWords : "The prevalence index is not applied yet."} Chapter 5 may still apply (problematic vegetation).`,
    ...(vegetation.present ? { confirmed: vegetation.present } : {}),
  }

  const notIdentified = dominance.dominants.map((d) => statusOf(d.id)).filter((p) => p.identified !== "species").map((p) => p.name)
  return { dominance, prevalence, indicators, prevalenceApplied: applied, conclusion, notIdentified }
}
