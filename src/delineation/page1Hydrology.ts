// Where the Hydrology section's values are drawn on page 1: ticks as an X on each blank, depths on
// their rules, and the lines of free text. Part of page 1's one list of placed values (page1.ts), which
// the PDF and the on-screen preview both draw from.
import { fit, widthOf } from "./text"
import { regionOf } from "./regions"
import { OBSERVATIONS, type TickBlank } from "./regions/types"
import type { Form } from "./formFor"
import type { Placement } from "./soilPage"
import type { Project } from "./model"

export function hydrologyPlacements(project: Project, form: Form): Placement[] {
  const { page1 } = regionOf(project.region)
  const { hydrology: geometry } = page1
  const placements: Placement[] = []
  const value = (name: string) => form.fields[`page1.hydrology.${name}`] ?? ""

  /** An X centered on a blank, standing just above its rule. */
  const tick = (name: string, blank: TickBlank) => {
    if (value(name) !== "X") return
    const [left, right] = blank.column
    placements.push({
      id: `page1.hydrology.${name}`,
      text: "X",
      x: (left + right) / 2 - widthOf("X", page1.tickSize) / 2,
      baseline: blank.rule - 1.5,
      size: page1.tickSize,
      maxWidth: right - left,
    })
  }
  const text = (name: string, x: number, baseline: number, maxWidth: number) => {
    const t = value(name)
    if (!t) return
    const { text: fitted, size } = fit(t, maxWidth, page1.fontSize)
    placements.push({ id: `page1.hydrology.${name}`, text: fitted, x, baseline, size, maxWidth })
  }

  for (const [id, blank] of Object.entries(geometry.ticks)) tick(`tick.${id}`, blank)

  const { rows, yes, no, depth } = geometry.observations
  for (const o of OBSERVATIONS) {
    tick(`${o}.yes`, { column: yes, rule: rows[o] })
    tick(`${o}.no`, { column: no, rule: rows[o] })
    text(`${o}.depth`, depth[0] + page1.inset, rows[o] - page1.aboveRule, depth[1] - depth[0] - 2 * page1.inset)
  }
  tick("present.yes", { column: geometry.present.yes, rule: geometry.present.rule })
  tick("present.no", { column: geometry.present.no, rule: geometry.present.rule })

  for (const name of ["describe", "remarks"] as const) {
    const box = geometry[name]
    box.baselines.forEach((baseline, i) => text(`${name}.${i}`, box.column[0], baseline, box.column[1] - box.column[0]))
  }
  return placements
}
