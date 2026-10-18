// Where each filled-in value of the Vegetation and Vegetation Continued pages is drawn. The PDF and
// the on-screen preview both take this list, so they cannot disagree.
import type { Form } from "../formFor"
import type { Project } from "../model"
import { regionOf } from "../regions"
import { VEG_COLUMNS } from "../regions/types"
import type { Placement } from "../soilPage"
import { STRATA } from "./strata"
import { vegFieldId } from "./vegetationFields"

export interface VegetationPlacements {
  /** The Vegetation page: always made. */
  vegetation: Placement[]
  /** The Continued page: only when a stratum has more plants than the first page holds. Null otherwise. */
  continued: Placement[] | null
}

/** Helvetica's advance widths for the characters from space (32) to tilde (126), in 1/1000 of the font size. */
// prettier-ignore
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]

const REPLACEMENTS: [RegExp, string][] = [
  [/[‘’‚]/g, "'"],
  [/[“”„]/g, '"'],
  [/[‐-―−]/g, "-"],
  [/…/g, "..."],
  [/×/g, "x"],
  [/≤/g, "<="],
  [/≥/g, ">="],
]

/**
 * Text as the form's Helvetica can print it: the Latin-1 characters it has, with the typographic quotes
 * and dashes a phone's keyboard makes changed to plain ones, and anything else a question mark.
 */
export function printable(text: string): string {
  let out = text.replace(/\s+/g, " ")
  for (const [pattern, to] of REPLACEMENTS) out = out.replace(pattern, to)
  return [...out].map((c) => (/[ -~ -ÿ]/.test(c) ? c : "?")).join("")
}

/** The width of text at a size, in points. A character outside ASCII counts as 556, a wide one. */
export const textWidth = (text: string, size: number): number =>
  ([...text].reduce((sum, c) => sum + (c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 ? WIDTHS[c.charCodeAt(0) - 32] : 556), 0) * size) / 1000

/** Text broken into lines no wider than `width` points, at the spaces; a word wider than a line is broken where it must be. Line breaks in the text are kept. */
export function wrapText(text: string, width: number, size: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    let line = ""
    for (const word of printable(paragraph).split(" ").filter(Boolean)) {
      const attempt = line === "" ? word : `${line} ${word}`
      if (textWidth(attempt, size) <= width) {
        line = attempt
        continue
      }
      if (line !== "") lines.push(line)
      line = ""
      let rest = word
      while (textWidth(rest, size) > width) {
        let cut = rest.length - 1
        while (cut > 1 && textWidth(rest.slice(0, cut), size) > width) cut--
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  return lines
}

export function vegetationPlacements(project: Project, form: Form): VegetationPlacements {
  const page = regionOf(project.region).vegetation
  const field = (id: keyof Form["fields"]) => form.fields[id] ?? ""
  const onRule = (id: string, text: string, left: number, rule: number): Placement => ({
    id,
    text: printable(text),
    x: left + page.inset,
    baseline: rule - page.aboveRule,
    size: page.fontSize,
  })

  const firstPage: Placement[] = []
  const continued: Placement[] = []
  const point = field("veg.samplingPoint")
  const pointPlacement = (): Placement => onRule("veg.samplingPoint", point, page.samplingPoint.span[0], page.samplingPoint.rule)

  for (const stratum of STRATA) {
    const { rowRules, totalRule, plotSize } = page.strata[stratum]
    const plotText = field(`veg.${stratum}.plotSize`)
    if (plotText) firstPage.push(onRule(`veg.${stratum}.plotSize`, plotText, plotSize.span[0], plotSize.rule))
    const total = field(`veg.${stratum}.total`)
    let overflowed = false
    for (let row = 0; row < rowRules.length * 2; row++) {
      const onContinued = row >= rowRules.length
      for (const column of VEG_COLUMNS) {
        const id = vegFieldId(stratum, row, column)
        const text = field(id)
        if (!text) continue
        overflowed ||= onContinued
        ;(onContinued ? continued : firstPage).push(onRule(id, text, page.columns[column][0], rowRules[row % rowRules.length]))
      }
    }
    if (total) {
      firstPage.push(onRule(`veg.${stratum}.total`, total, page.columns.cover[0], totalRule))
      // The Continued page repeats the stratum's total, as the official automated data sheet does.
      if (overflowed) continued.push(onRule(`veg.${stratum}.total`, total, page.columns.cover[0], totalRule))
    }
  }

  const remarks = wrapText(field("veg.remarks"), page.remarks.right - page.remarks.left, page.fontSize)
  const room = Math.floor((page.remarks.lastBaseline - page.remarks.firstBaseline) / page.remarks.leading) + 1
  remarks.slice(0, room).forEach((text, i) => {
    firstPage.push({ id: `veg.remarks.${i}`, text, x: page.remarks.left, baseline: page.remarks.firstBaseline + i * page.remarks.leading, size: page.fontSize })
  })

  const needsContinued = continued.length > 0
  return {
    vegetation: point ? [pointPlacement(), ...firstPage] : firstPage,
    continued: needsContinued ? (point ? [pointPlacement(), ...continued] : continued) : null,
  }
}
