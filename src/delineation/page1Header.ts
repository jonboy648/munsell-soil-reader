// Where the header of page 1 is drawn: the lines at the top, the Y, N and tick blanks, and the first
// line of the Summary of Findings' Remarks, where a pair is noted. Part of page 1's one list of placed
// values (page1.ts), which the PDF and the on-screen preview both draw from.
import { ruleRoom, type FieldId, type Form } from "./formFor"
import type { Project } from "./model"
import { regionOf } from "./regions"
import { PAGE1_MARK_FIELDS, PAGE1_TEXT_FIELDS } from "./regions/types"
import type { Placement } from "./soilPage"
import { fit, widthOf } from "./text"

/** The non-blank values of page 1's header, top to bottom, left to right. */
export function headerPlacements(project: Project, form: Form): Placement[] {
  const { page1 } = regionOf(project.region)
  const placements: Placement[] = []
  const value = (id: FieldId) => form.fields[id]

  for (const field of PAGE1_TEXT_FIELDS) {
    const id = `page1.${field}` as const
    if (!value(id)) continue
    const { left, rule } = page1.fields[field]
    const maxWidth = ruleRoom(page1, field)
    const { text, size } = fit(value(id), maxWidth, page1.fontSize)
    placements.push({ id, text, x: left + page1.inset, baseline: rule - page1.aboveRule, size, maxWidth })
  }
  // A Y, N or tick sits in the middle of its short blank.
  for (const field of PAGE1_MARK_FIELDS) {
    const id = `page1.${field}` as const
    if (!value(id)) continue
    const { left, right, rule } = page1.fields[field]
    const maxWidth = right - left
    placements.push({
      id,
      text: value(id),
      x: left + (maxWidth - widthOf(value(id), page1.fontSize)) / 2,
      baseline: rule - page1.aboveRule,
      size: page1.fontSize,
      maxWidth,
    })
  }
  if (value("page1.summaryRemarks")) {
    const { left, right, baseline } = page1.summaryRemarks
    const maxWidth = right - left
    const { text, size } = fit(value("page1.summaryRemarks"), maxWidth, page1.fontSize)
    placements.push({ id: "page1.summaryRemarks", text, x: left, baseline, size, maxWidth })
  }
  return placements
}
