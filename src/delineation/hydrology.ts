// The Hydrology section of page 1: the rule that says when ticked indicators show wetland hydrology,
// and the values of the section's fields. Pure. The form engine calls `hydrologyFor`; the page's
// drawing is in page1Hydrology.ts.
import type { FormWarning } from "./formFor"
import { emptyHydrology, type Hydrology } from "./model"
import { OBSERVATIONS, type Observation, type Region } from "./regions/types"
import { printable, truncate, wrap, written } from "./text"

export interface HydrologySuggestion {
  /** Wetland Hydrology Present? */
  answer: boolean
  /** The ticked indicators of each kind. "Other" is not counted. */
  primary: string[]
  secondary: string[]
  /** The answer and why, in plain words. */
  text: string
  citation: string
}

const list = (ids: string[]) => ids.join(", ")
const some = (n: number, word: string) => `${n} ${word} indicator${n === 1 ? "" : "s"}`

/**
 * Wetland Hydrology Present? by the supplement's rule: one primary indicator, or two secondary ones.
 * The delineator's own "Other (Explain in Remarks)" is not an indicator of the rule, so it is not counted.
 */
export function suggestWetlandHydrology(region: Region, ticked: readonly string[]): HydrologySuggestion {
  const { indicators, rule } = region.hydrology
  const of = (kind: "primary" | "secondary") => indicators.filter((i) => i.kind === kind && ticked.includes(i.id)).map((i) => i.id)
  const primary = of("primary")
  const secondary = of("secondary")
  const byPrimary = primary.length >= rule.primaryNeeded
  const bySecondary = secondary.length >= rule.secondaryNeeded
  const answer = byPrimary || bySecondary
  const need = `One primary or two secondary indicators are needed.`
  let text: string
  if (byPrimary) text = `Yes: ${some(primary.length, "primary")} ticked (${list(primary)}). One is enough.`
  else if (bySecondary) text = `Yes: ${some(secondary.length, "secondary")} ticked (${list(secondary)}), and no primary indicator. Two are needed then.`
  else if (secondary.length > 0) text = `No: only ${some(secondary.length, "secondary")} ticked (${list(secondary)}). ${need}`
  else text = `No: no indicator is ticked. ${need}`
  return { answer, primary, secondary, text, citation: rule.citation }
}

/** What the section prints, and what is wrong with it. */
export interface HydrologyForm {
  fields: Record<string, string>
  warnings: FormWarning[]
  suggestion: HydrologySuggestion | null
}

const OBSERVATION_NAMES: Record<Observation, string> = {
  surfaceWater: "Surface Water",
  waterTable: "Water Table",
  saturation: "Saturation",
}

const field = (name: string) => `page1.hydrology.${name}`

export function hydrologyFor(region: Region, hydrology: Hydrology | undefined): HydrologyForm {
  const h = hydrology ?? emptyHydrology
  const { page1 } = region
  const fields: Record<string, string> = {}
  const warnings: FormWarning[] = []

  for (const { id } of region.hydrology.indicators) fields[field(`tick.${id}`)] = h.ticked.includes(id) ? "X" : ""
  fields[field("tick.other")] = h.ticked.includes("other") ? "X" : ""

  for (const o of OBSERVATIONS) {
    const { present, depth } = h[o]
    fields[field(`${o}.yes`)] = present === true ? "X" : ""
    fields[field(`${o}.no`)] = present === false ? "X" : ""
    fields[field(`${o}.depth`)] = present === true && depth !== null ? written(depth) : ""
  }
  fields[field("present.yes")] = h.present === true ? "X" : ""
  fields[field("present.no")] = h.present === false ? "X" : ""

  // The two boxes of free text, wrapped to their lines. What does not fit is cut, with a warning.
  for (const [name, label, box] of [
    ["describe", "Describe Recorded Data", page1.hydrology.describe],
    ["remarks", "Hydrology remarks", page1.hydrology.remarks],
  ] as const) {
    const room = box.column[1] - box.column[0]
    const clean = printable(h[name])
    if (clean.replaced) warnings.push({ kind: "text-changed", text: `${label}: some characters cannot be printed on the form, so they were replaced.` })
    const lines = wrap(clean.text, room, page1.fontSize)
    if (lines.length > box.baselines.length) {
      lines.length = box.baselines.length
      lines[lines.length - 1] = truncate(`${lines[lines.length - 1]} ...`, room, page1.fontSize)
      warnings.push({ kind: "remarks-cut", text: `${label} is longer than its box, so it is cut.` })
    }
    box.baselines.forEach((_, i) => (fields[field(`${name}.${i}`)] = lines[i] ?? ""))
  }

  // Ticks that need an observation to match, from the depths the supplement gives.
  const ticked = (id: string) => h.ticked.includes(id)
  const needs = (id: string, label: string, o: Observation, page: number, test: (depth: number) => boolean, rule: string) => {
    if (!ticked(id)) return
    const { present, depth } = h[o]
    if (present !== true) {
      warnings.push({ kind: "hydrology-observation", text: `${label} (${id}) is ticked, but ${OBSERVATION_NAMES[o]} Present? is not Yes (supplement p. ${page}).` })
    } else if (depth === null) {
      if (o === "surfaceWater") return // standing water has no depth to meet
      warnings.push({ kind: "hydrology-observation", text: `${label} (${id}) is ticked, but the ${OBSERVATION_NAMES[o].toLowerCase()} depth is blank (supplement p. ${page}).` })
    } else if (!test(depth)) {
      warnings.push({ kind: "hydrology-observation", text: `${label} (${id}) is ticked, but ${rule} (supplement p. ${page}); it is at ${written(depth)} in.` })
    }
  }
  needs("A1", "Surface Water", "surfaceWater", 83, () => true, "")
  needs("A2", "High Water Table", "waterTable", 84, (d) => d <= 12, "the water table must be 12 in. or less below the surface")
  needs("A3", "Saturation", "saturation", 85, (d) => d <= 12, "saturated soil must be 12 in. or less from the surface")
  needs("C2", "Dry-Season Water Table", "waterTable", 106, (d) => d >= 12 && d <= 24, "the water table must be between 12 and 24 in.")
  for (const o of ["waterTable", "saturation"] as const) {
    if (h[o].present === true && h[o].depth === null && !ticked(o === "waterTable" ? "A2" : "A3")) {
      warnings.push({ kind: "hydrology-observation", text: `${OBSERVATION_NAMES[o]} Present? is Yes, but its depth is blank.` })
    }
  }

  const suggestion = h.ticked.length > 0 ? suggestWetlandHydrology(region, h.ticked) : null
  if (suggestion && h.present !== null && h.present !== suggestion.answer) {
    warnings.push({
      kind: "hydrology-answer",
      text: `Wetland Hydrology Present? is ${h.present ? "Yes" : "No"}, but the ticked indicators give a different answer. ${suggestion.text} Your answer is printed.`,
    })
  }
  return { fields, warnings, suggestion }
}
