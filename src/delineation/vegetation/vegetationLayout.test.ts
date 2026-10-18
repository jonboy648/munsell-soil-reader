// The measured layout of the Vegetation pages, checked against the official PDFs it was measured from:
// every rule a value sits on is really drawn on the page, at the place the region package says.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { regionOf } from "../regions"
import { VEG_COLUMNS } from "../regions/types"
import { pdfRules, type DrawnRule } from "../testing/pdfRules"
import { pdfText } from "../testing/pdfText"
import { STRATA } from "./strata"

const page = regionOf("NCNE").vegetation
const read = (name: string) => new Uint8Array(readFileSync(new URL(`../regions/ncne/${name}`, import.meta.url)))
const NEAR = 0.3

/** Whether the page draws a rule at this height that runs exactly this far. */
const has = (rules: DrawnRule[], top: number, span: readonly [number, number]) =>
  rules.some((r) => Math.abs(r.top - top) < NEAR && Math.abs(r.left - span[0]) < NEAR && Math.abs(r.right - span[1]) < NEAR)

describe.each([
  ["the Vegetation page", "vegetation-page.pdf", page.pageNumber, true],
  ["the Vegetation Continued page", "vegetation-continued-page.pdf", page.continuedPageNumber, false],
] as const)("%s", (_name, file, _number, hasPlotSize) => {
  test("every row of every stratum has its rule under each of the four columns, and its total under the cover column", async () => {
    const rules = await pdfRules(read(file))
    for (const stratum of STRATA) {
      const { rowRules, totalRule } = page.strata[stratum]
      rowRules.forEach((top, row) => {
        for (const column of VEG_COLUMNS) expect(has(rules, top, page.columns[column]), `${stratum} row ${row + 1} ${column}`).toBe(true)
      })
      expect(has(rules, totalRule, page.columns.cover), `${stratum} total`).toBe(true)
    }
  })

  test("the Sampling Point rule is there, and the Plot size rules on the page that has them", async () => {
    const rules = await pdfRules(read(file))
    expect(has(rules, page.samplingPoint.rule, page.samplingPoint.span)).toBe(true)
    for (const stratum of STRATA) {
      const { rule, span } = page.strata[stratum].plotSize
      expect(has(rules, rule, span), `${stratum} plot size`).toBe(hasPlotSize)
    }
  })

  test("the rows are the ones the form numbers: the strata hold as many rows as the official page prints", async () => {
    const numbers = (await pdfText(read(file))).map((d) => d.text).filter((t) => /^\d+\.$/.test(t))
    const rows = STRATA.reduce((sum, s) => sum + page.strata[s].rowRules.length, 0)
    expect(numbers).toHaveLength(rows)
  })

  test("the Remarks box is below the strata and holds the lines the region package says", async () => {
    const rules = await pdfRules(read(file))
    const edges = rules.filter((r) => r.left < 36 && r.right > 575).map((r) => r.top)
    const [top, bottom] = [Math.min(...edges.filter((t) => t > 600)), Math.max(...edges)]
    const { firstBaseline, lastBaseline } = page.remarks
    expect(firstBaseline).toBeGreaterThan(top)
    expect(lastBaseline).toBeLessThan(bottom)
  })
})
