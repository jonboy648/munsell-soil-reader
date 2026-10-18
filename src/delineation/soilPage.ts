// Where each filled-in value of the Soil page is drawn. The PDF and the on-screen preview both
// take this list, so they cannot disagree.
import { regionOf } from "./regions"
import { PROFILE_COLUMNS } from "./regions/types"
import { columnRoom, fieldId, type Form } from "./formFor"
import type { Project } from "./model"
import { fit } from "./text"

export interface Placement {
  id: string
  text: string
  /** Points from the left of the page to the start of the text. */
  x: number
  /** Points from the top of the page to the baseline of the text. */
  baseline: number
  /** Points. The form's own size, or smaller when the text would not fit its column otherwise. */
  size: number
  /** The most the text may take, in points, so that it stays inside its column. */
  maxWidth: number
}

/** The non-blank values of the page, top to bottom, left to right. */
export function soilPlacements(project: Project, form: Form): Placement[] {
  const { soil } = regionOf(project.region)
  const placements: Placement[] = []
  const place = (id: string, value: string, x: number, rule: number, maxWidth: number) => {
    if (!value) return
    const { text, size } = fit(value, maxWidth, soil.fontSize)
    placements.push({ id, text, x, baseline: rule - soil.aboveRule, size, maxWidth })
  }

  const [pointLeft, pointRight] = soil.samplingPoint.column
  place("soil.samplingPoint", form.fields["soil.samplingPoint"], pointLeft + soil.inset, soil.samplingPoint.rule, pointRight - pointLeft - 2 * soil.inset)
  soil.rowRules.forEach((rule, row) => {
    for (const column of PROFILE_COLUMNS) {
      const id = fieldId(row, column)
      place(id, form.fields[id], soil.columns[column][0] + soil.inset, rule, columnRoom(soil, column))
    }
  })
  return placements
}
