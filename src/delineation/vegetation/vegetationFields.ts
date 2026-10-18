// The values of the Vegetation pages' fields, from a sampling point's plants. Part of the form engine
// (formFor.ts): pure, and the preview and the PDF both draw from what it returns.
//
// Rows are counted over the whole stratum, not the page: row 0 is the first plant of the stratum, and
// the Vegetation page takes as many rows as it has, the Continued page the rest. The Dominant Species?
// column and the worksheets are the arithmetic of the supplement (dominance.ts): `veg.dominance.*` and
// `veg.prevalence.*`. The ticks of the indicators (`veg.indicator.<id>`) and Yes or No of "Hydrophytic
// Vegetation Present?" (`veg.present.yes` and `.no`) are printed only when the user has confirmed them
// (hydrophytic.ts suggests them). Every value is text the PDF's font can print (../text.ts), as the Soil
// page's are.
import { regionOf } from "../regions"
import type { VegColumn } from "../regions/types"
import { vegetationOf, type Project, type SamplingPoint } from "../model"
import { printable, wrap } from "../text"
import { hydrophyticVegetation, VEG_INDICATORS, type HydrophyticVegetation, type VegContext, type VegIndicatorId } from "./hydrophytic"
import { STATUSES, type Status } from "./status"
import { STRATA, STRATUM_LABEL, SUGGESTED_PLOT, type Stratum } from "./strata"

export type VegFieldId =
  | "veg.samplingPoint"
  | "veg.remarks"
  | `veg.${Stratum}.plotSize`
  | `veg.${Stratum}.total`
  | `veg.${Stratum}.${number}.${VegColumn}`
  | "veg.dominance.a"
  | "veg.dominance.b"
  | "veg.dominance.percent"
  | `veg.prevalence.${Status}.cover`
  | `veg.prevalence.${Status}.product`
  | "veg.prevalence.total.a"
  | "veg.prevalence.total.b"
  | "veg.prevalence.index"
  | `veg.indicator.${VegIndicatorId}`
  | "veg.present.yes"
  | "veg.present.no"

export const vegFieldId = (stratum: Stratum, row: number, column: VegColumn): VegFieldId => `veg.${stratum}.${row}.${column}`

export interface VegWarning {
  kind: "veg-overflow" | "veg-not-identified" | "veg-genus" | "veg-left-out" | "veg-remarks-cut" | "veg-dominant-identity" | "veg-prevalence-invalid" | "text-changed"
  text: string
}

/** A number as it is written on a form: 20, 2.5, not 20.0. */
const written = (n: number): string => String(Math.round(n * 100) / 100)

/** How many plants of a stratum the form holds: the Vegetation page and the Continued page. */
export const strataCapacity = (project: Project, stratum: Stratum): number => regionOf(project.region).vegetation.strata[stratum].rowRules.length * 2

const NEWLINE = "\n"
const LINE_BREAK = /\r?\n/
const TRAILING_BREAKS = /\n+$/

/** The remarks as lines of the Remarks box: its paragraphs kept, each wrapped to the box, and how many lines the box holds. */
export function remarkLines(project: Project, remarks: string): { lines: string[]; room: number } {
  const { remarks: box, fontSize } = regionOf(project.region).vegetation
  const lines = remarks.split(NEWLINE).flatMap((paragraph) => (paragraph === "" ? [""] : wrap(paragraph, box.right - box.left, fontSize)))
  return { lines, room: Math.floor((box.lastBaseline - box.firstBaseline) / box.leading) + 1 }
}

/** A percentage as it is written on a form: 100%, 66.7%. */
const writtenPercent = (n: number): string => `${Math.round(n * 10) / 10}%`

/**
 * `samplingPoint` is the point's name as the form prints it, which formFor has already made printable.
 * `context` says whether the sampling point has hydric soil and wetland hydrology indicators, which decides
 * whether the prevalence index is applied.
 */
export function vegetationFields(
  project: Project,
  point: SamplingPoint,
  samplingPoint: string,
  context: VegContext,
): { fields: Record<VegFieldId, string>; warnings: VegWarning[]; analysis: HydrophyticVegetation } {
  const vegetation = vegetationOf(point)
  const analysis = hydrophyticVegetation(vegetation, context)
  const dominant = new Set(analysis.dominance.dominants.map((d) => d.id))
  const warnings: VegWarning[] = []
  // Text the user typed, made printable; one warning for the page if any of it had to change.
  let changed = false
  const clean = (text: string): string => {
    const { text: out, replaced } = printable(text)
    changed ||= replaced
    return out
  }
  const remarks = vegetation.remarks.trim().split(LINE_BREAK).map((line) => clean(line)).join(NEWLINE).replace(TRAILING_BREAKS, "")
  const fields = { "veg.samplingPoint": samplingPoint, "veg.remarks": remarks } as Record<VegFieldId, string>
  const cut = remarkLines(project, remarks)
  if (cut.lines.length > cut.room) {
    warnings.push({ kind: "veg-remarks-cut", text: `The vegetation remarks are longer than the ${cut.room} lines of the Remarks box, so the end is left off the page.` })
  }
  for (const stratum of STRATA) {
    const plants = vegetation.plants.filter((p) => p.stratum === stratum)
    const capacity = strataCapacity(project, stratum)
    fields[`veg.${stratum}.plotSize`] = clean(vegetation.plotSizes[stratum] ?? (plants.length > 0 ? SUGGESTED_PLOT[stratum] : ""))
    fields[`veg.${stratum}.total`] = plants.length > 0 ? written(plants.reduce((sum, p) => sum + p.cover, 0)) : ""
    for (let row = 0; row < capacity; row++) {
      const plant = plants[row]
      fields[vegFieldId(stratum, row, "name")] = plant ? clean(plant.name) : ""
      fields[vegFieldId(stratum, row, "cover")] = plant ? written(plant.cover) : ""
      // A plant with no status to use was not part of the test: its box is left blank, not marked No.
      fields[vegFieldId(stratum, row, "dominant")] = plant && plant.status !== null ? (dominant.has(plant.id) ? "Yes" : "No") : ""
      fields[vegFieldId(stratum, row, "status")] = plant ? (plant.status ?? plant.listed) : ""
    }
    if (plants.length > capacity) {
      warnings.push({
        kind: "veg-overflow",
        text: `The ${STRATUM_LABEL[stratum].toLowerCase()} stratum has ${plants.length} plants and the form holds ${capacity}. The rest are left off the pages: put them on a separate sheet.`,
      })
    }
    for (const plant of plants) {
      if (plant.identified === "none") {
        warnings.push({ kind: "veg-not-identified", text: `${plant.name}: not found on the plant list, so it is recorded as UPL and as not identified.` })
      } else if (plant.identified === "genus") {
        warnings.push({ kind: "veg-genus", text: `${plant.name}: identified to genus only. A dominant must be identified to species.` })
      }
      if (plant.status === null) {
        warnings.push({ kind: "veg-left-out", text: `${plant.name}: no status to use, so it is left out of the dominance test and the prevalence index.` })
      }
    }
  }
  for (const name of analysis.notIdentified) {
    warnings.push({ kind: "veg-dominant-identity", text: `${name} is a dominant species but is not identified to species. A dominant must be (supplement p. 26): identify it before relying on the dominance test.` })
  }

  // The Dominance Test worksheet: A, B and A/B. Blank while there is no dominant to count.
  const { dominance, prevalence } = analysis
  fields["veg.dominance.a"] = dominance.b > 0 ? written(dominance.a) : ""
  fields["veg.dominance.b"] = dominance.b > 0 ? written(dominance.b) : ""
  fields["veg.dominance.percent"] = dominance.percent !== null ? writtenPercent(dominance.percent) : ""
  // The Prevalence Index worksheet: every status's total and product once any plant is counted, the column totals, and B/A when the index is valid.
  const any = prevalence.a > 0
  for (const status of STATUSES) {
    const row = prevalence.rows.find((r) => r.status === status)!
    fields[`veg.prevalence.${status}.cover`] = any ? written(row.cover) : ""
    fields[`veg.prevalence.${status}.product`] = any ? written(row.product) : ""
  }
  fields["veg.prevalence.total.a"] = any ? written(prevalence.a) : ""
  fields["veg.prevalence.total.b"] = any ? written(prevalence.b) : ""
  fields["veg.prevalence.index"] = prevalence.index !== null ? prevalence.index.toFixed(2) : ""
  if (vegetation.plants.length > 0 && !prevalence.valid) {
    warnings.push({
      kind: "veg-prevalence-invalid",
      text: `Only ${writtenPercent(prevalence.identified)} of the vegetation cover is identified and rated. The prevalence index needs 80%, so it is left blank (supplement pp. 27-28).`,
    })
  }

  // Ticks and the answer are the user's: nothing is drawn that has not been confirmed.
  const choices = vegetation.indicators ?? {}
  for (const id of VEG_INDICATORS) fields[`veg.indicator.${id}`] = choices[id]?.state === "confirmed" ? "X" : ""
  fields["veg.present.yes"] = vegetation.present === "yes" ? "X" : ""
  fields["veg.present.no"] = vegetation.present === "no" ? "X" : ""

  if (changed) warnings.push({ kind: "text-changed", text: "Some vegetation text has characters the form cannot print; they were replaced." })
  return { fields, warnings, analysis }
}

