// Where each filled-in value of the Soil page is drawn. The PDF and the on-screen preview both
// take this list, so they cannot disagree.
import { regionOf } from "./regions"
import { PROFILE_COLUMNS } from "./regions/types"
import { fieldId, indicatorFieldId, type Form } from "./formFor"
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

/** The non-blank values of the profile table, row by row, left to right, then the ticks. */
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
  // A tick is an X drawn on the printed blank, centered on it and sitting just above its line.
  const tick = (id: Placement["id"], box: { x: readonly [number, number]; rule: number }) => {
    if (!form.fields[id as keyof typeof form.fields]) return
    const width = X_WIDTH * soil.tick.size
    placements.push({
      id,
      text: "X",
      x: (box.x[0] + box.x[1]) / 2 - width / 2,
      baseline: box.rule - soil.tick.aboveRule,
      size: soil.tick.size,
    })
  }
  for (const indicator of regionOf(project.region).indicators) tick(indicatorFieldId(indicator.id), indicator.box)
  tick("soil.hydric.yes", soil.hydricPresent.yes)
  tick("soil.hydric.no", soil.hydricPresent.no)
  return placements
}

/** The width of a capital X in Helvetica, in ems. */
const X_WIDTH = 0.667
