// Page 1 of the form: the one list of placed values the PDF and the on-screen preview draw from.
// Each section of the page makes its own placements in its own module; this joins them in the order
// they sit on the page, top to bottom.
import type { Form } from "./formFor"
import type { Project } from "./model"
import { hydrologyPlacements } from "./page1Hydrology"
import type { Placement } from "./soilPage"

export function page1Placements(project: Project, form: Form): Placement[] {
  return [...hydrologyPlacements(project, form)]
}
