// Where each filled-in value of the Vegetation and Vegetation Continued pages is drawn. The PDF and
// the on-screen preview both take this list, so they cannot disagree.
import type { Form } from "../formFor"
import type { Project } from "../model"
import { regionOf } from "../regions"
import { VEG_COLUMNS, type Box } from "../regions/types"
import { tickPlacement, type Placement } from "../soilPage"
import { fit } from "../text"
import { VEG_INDICATORS } from "./hydrophytic"
import { STATUSES } from "./status"
import { STRATA } from "./strata"
import { remarkLines, vegFieldId } from "./vegetationFields"

export interface VegetationPlacements {
  /** The Vegetation page: always made. */
  vegetation: Placement[]
  /** The Continued page: only when a stratum has more plants than the first page holds. Null otherwise. */
  continued: Placement[] | null
}

export function vegetationPlacements(project: Project, form: Form): VegetationPlacements {
  const page = regionOf(project.region).vegetation
  const field = (id: keyof Form["fields"]) => form.fields[id] ?? ""
  // A value shrinks to fit the width of its rule, as the Soil page's do.
  const onRule = (id: string, text: string, [left, right]: readonly [number, number], rule: number): Placement => {
    const maxWidth = right - left - 2 * page.inset
    const fitted = fit(text, maxWidth, page.fontSize)
    return { id, text: fitted.text, x: left + page.inset, baseline: rule - page.aboveRule, size: fitted.size, maxWidth }
  }

  const firstPage: Placement[] = []
  const continued: Placement[] = []
  const point = field("veg.samplingPoint")
  const pointPlacement = (): Placement => onRule("veg.samplingPoint", point, page.samplingPoint.span, page.samplingPoint.rule)

  for (const stratum of STRATA) {
    const { rowRules, totalRule, plotSize } = page.strata[stratum]
    const plotText = field(`veg.${stratum}.plotSize`)
    if (plotText) firstPage.push(onRule(`veg.${stratum}.plotSize`, plotText, plotSize.span, plotSize.rule))
    const total = field(`veg.${stratum}.total`)
    let overflowed = false
    for (let row = 0; row < rowRules.length * 2; row++) {
      const onContinued = row >= rowRules.length
      for (const column of VEG_COLUMNS) {
        const id = vegFieldId(stratum, row, column)
        const text = field(id)
        if (!text) continue
        overflowed ||= onContinued
        ;(onContinued ? continued : firstPage).push(onRule(id, text, page.columns[column], rowRules[row % rowRules.length]))
      }
    }
    if (total) {
      firstPage.push(onRule(`veg.${stratum}.total`, total, page.columns.cover, totalRule))
      // The Continued page repeats the stratum's total, as the official automated data sheet does.
      if (overflowed) continued.push(onRule(`veg.${stratum}.total`, total, page.columns.cover, totalRule))
    }
  }

  const { lines, room } = remarkLines(project, field("veg.remarks"))
  const maxWidth = page.remarks.right - page.remarks.left
  lines.slice(0, room).forEach((text, i) => {
    if (text) firstPage.push({ id: `veg.remarks.${i}`, text, x: page.remarks.left, baseline: page.remarks.firstBaseline + i * page.remarks.leading, size: page.fontSize, maxWidth })
  })

  // The worksheets, the indicators' ticks and the answer are on the Vegetation page only.
  const { worksheets } = page
  const worksheet = (id: keyof Form["fields"], box: Box) => {
    const text = field(id)
    if (text) firstPage.push(onRule(id, text, box.x, box.rule))
  }
  worksheet("veg.dominance.a", worksheets.dominance.a)
  worksheet("veg.dominance.b", worksheets.dominance.b)
  worksheet("veg.dominance.percent", worksheets.dominance.percent)
  for (const status of STATUSES) {
    worksheet(`veg.prevalence.${status}.cover`, worksheets.prevalence.rows[status].cover)
    worksheet(`veg.prevalence.${status}.product`, worksheets.prevalence.rows[status].product)
  }
  worksheet("veg.prevalence.total.a", worksheets.prevalence.totals.a)
  worksheet("veg.prevalence.total.b", worksheets.prevalence.totals.b)
  worksheet("veg.prevalence.index", worksheets.prevalence.index)
  const tick = (id: keyof Form["fields"], box: Box) => {
    if (field(id)) firstPage.push(tickPlacement(id, box, worksheets.tick.size, worksheets.tick.aboveRule))
  }
  for (const id of VEG_INDICATORS) tick(`veg.indicator.${id}`, worksheets.indicators[id])
  tick("veg.present.yes", worksheets.present.yes)
  tick("veg.present.no", worksheets.present.no)

  const needsContinued = continued.length > 0
  return {
    vegetation: point ? [pointPlacement(), ...firstPage] : firstPage,
    continued: needsContinued ? (point ? [pointPlacement(), ...continued] : continued) : null,
  }
}
