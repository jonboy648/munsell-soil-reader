// Where each filled-in value of the Soil page is drawn. The PDF and the on-screen preview both
// take this list, so they cannot disagree.
import { regionOf } from "./regions"
import { PROFILE_COLUMNS } from "./regions/types"
import { fieldId, type Form } from "./formFor"
import type { Project } from "./model"

export interface Placement {
  id: string
  text: string
  /** Points from the left of the page to the start of the text. */
  x: number
  /** Points from the top of the page to the baseline of the text. */
  baseline: number
  /** Points. */
  size: number
}

/** The non-blank values of the profile table, row by row, left to right. */
export function soilPlacements(project: Project, form: Form): Placement[] {
  const { soil } = regionOf(project.region)
  const placements: Placement[] = []
  soil.rowRules.forEach((rule, row) => {
    for (const column of PROFILE_COLUMNS) {
      const id = fieldId(row, column)
      const text = form.fields[id]
      if (!text) continue
      placements.push({
        id,
        text,
        x: soil.columns[column][0] + soil.inset,
        baseline: rule - soil.aboveRule,
        size: soil.fontSize,
      })
    }
  })
  return placements
}
