// The values of the Vegetation pages' fields, from a sampling point's plants. Part of the form engine
// (formFor.ts): pure, and the preview and the PDF both draw from what it returns.
//
// Rows are counted over the whole stratum, not the page: row 0 is the first plant of the stratum, and
// the Vegetation page takes as many rows as it has, the Continued page the rest. The Dominant Species?
// column, the dominance and prevalence worksheets and the indicators are blank here: they are the
// arithmetic of #34, which fills `veg.<stratum>.<row>.dominant` and adds its own fields.
import { regionOf } from "../regions"
import type { VegColumn } from "../regions/types"
import { vegetationOf, type Project, type SamplingPoint } from "../model"
import { STRATA, STRATUM_LABEL, SUGGESTED_PLOT, type Stratum } from "./strata"

export type VegFieldId =
  | "veg.samplingPoint"
  | "veg.remarks"
  | `veg.${Stratum}.plotSize`
  | `veg.${Stratum}.total`
  | `veg.${Stratum}.${number}.${VegColumn}`

export const vegFieldId = (stratum: Stratum, row: number, column: VegColumn): VegFieldId => `veg.${stratum}.${row}.${column}`

export interface VegWarning {
  kind: "veg-overflow" | "veg-not-identified" | "veg-genus" | "veg-left-out"
  text: string
}

/** A number as it is written on a form: 20, 2.5, not 20.0. */
const written = (n: number): string => String(Math.round(n * 100) / 100)

/** How many plants of a stratum the form holds: the Vegetation page and the Continued page. */
export const strataCapacity = (project: Project, stratum: Stratum): number => regionOf(project.region).vegetation.strata[stratum].rowRules.length * 2

export function vegetationFields(project: Project, point: SamplingPoint): { fields: Record<VegFieldId, string>; warnings: VegWarning[] } {
  const vegetation = vegetationOf(point)
  const fields = { "veg.samplingPoint": point.name, "veg.remarks": vegetation.remarks.trim() } as Record<VegFieldId, string>
  const warnings: VegWarning[] = []
  for (const stratum of STRATA) {
    const plants = vegetation.plants.filter((p) => p.stratum === stratum)
    const capacity = strataCapacity(project, stratum)
    fields[`veg.${stratum}.plotSize`] = vegetation.plotSizes[stratum] ?? (plants.length > 0 ? SUGGESTED_PLOT[stratum] : "")
    fields[`veg.${stratum}.total`] = plants.length > 0 ? written(plants.reduce((sum, p) => sum + p.cover, 0)) : ""
    for (let row = 0; row < capacity; row++) {
      const plant = plants[row]
      fields[vegFieldId(stratum, row, "name")] = plant?.name ?? ""
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
  return { fields, warnings }
}

