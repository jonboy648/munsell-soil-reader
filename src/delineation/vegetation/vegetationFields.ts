// The values of the Vegetation pages' fields, from a sampling point's plants. Part of the form engine
// (formFor.ts): pure, and the preview and the PDF both draw from what it returns.
//
// Rows are counted over the whole stratum, not the page: row 0 is the first plant of the stratum, and
// the Vegetation page takes as many rows as it has, the Continued page the rest. The Dominant Species?
// column, the dominance and prevalence worksheets and the indicators are blank here: they are the
// arithmetic of #34, which fills `veg.<stratum>.<row>.dominant` and adds its own fields. Every value is
// text the PDF's font can print (../text.ts), as the Soil page's are.
import { regionOf } from "../regions"
import type { VegColumn } from "../regions/types"
import { vegetationOf, type Project, type SamplingPoint } from "../model"
import { printable, wrap, written } from "../text"
import { STRATA, STRATUM_LABEL, SUGGESTED_PLOT, type Stratum } from "./strata"

export type VegFieldId =
  | "veg.samplingPoint"
  | "veg.remarks"
  | `veg.${Stratum}.plotSize`
  | `veg.${Stratum}.total`
  | `veg.${Stratum}.${number}.${VegColumn}`

export const vegFieldId = (stratum: Stratum, row: number, column: VegColumn): VegFieldId => `veg.${stratum}.${row}.${column}`

export interface VegWarning {
  kind: "veg-overflow" | "veg-not-identified" | "veg-genus" | "veg-left-out" | "veg-remarks-cut" | "text-changed"
  text: string
}

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

/** `samplingPoint` is the point's name as the form prints it, which formFor has already made printable. */
export function vegetationFields(
  project: Project,
  point: SamplingPoint,
  samplingPoint: string,
): { fields: Record<VegFieldId, string>; warnings: VegWarning[] } {
  const vegetation = vegetationOf(point)
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
      fields[vegFieldId(stratum, row, "dominant")] = ""
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
  if (changed) warnings.push({ kind: "text-changed", text: "Some vegetation text has characters the form cannot print; they were replaced." })
  return { fields, warnings }
}

