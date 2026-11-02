import { CONCLUSIONS } from "./determination"
import type { Form } from "./formFor"
import type { Project } from "./model"
import { regionOf } from "./regions"
import type { Placement } from "./soilPage"
import { widthOf } from "./text"

/** Confirmed summary answers, centered on the official page's measured blanks. */
export function summaryPlacements(project: Project, form: Form): Placement[] {
  const { page1 } = regionOf(project.region)
  return CONCLUSIONS.flatMap((conclusion) => (["yes", "no"] as const).flatMap((answer) => {
    const id = `page1.summary.${conclusion}.${answer}` as const
    if (form.fields[id] !== "X") return []
    const { column: [left, right], rule } = page1.summary[conclusion][answer]
    return [{ id, text: "X", x: (left + right - widthOf("X", page1.tickSize)) / 2,
      baseline: rule - 1.5, size: page1.tickSize, maxWidth: right - left }]
  }))
}
