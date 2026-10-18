// The indicator records against the official Soil page itself: the rule records are exactly the
// indicators the page prints, with the scopes it prints, and each box is where the page draws its blank.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { pdfRules, pdfText, type DrawnText } from "../../testing/pdfText"
import { regionOf } from ".."
import type { Indicator } from "../types"

const region = regionOf("NCNE")
const blank = new Uint8Array(readFileSync(new URL("./soil-page.pdf", import.meta.url)))
const COLUMN_STARTS = [38.3, 193.3, 386.3] as const

describe("the records", () => {
  test("34 of them, one per blank before an indicator's label, each with its own id", () => {
    expect(region.indicators).toHaveLength(34)
    expect(new Set(region.indicators.map((i) => i.id)).size).toBe(34)
  })

  test("the indicators the 2024 form added are in, and the one it dropped is not", () => {
    const codes = region.indicators.map((i) => i.code)
    for (const added of ["A17", "F22", "A18", "S11", "F10"]) expect(codes, added).toContain(added)
    expect(codes).not.toContain("A16")
    expect(codes).not.toContain("TA6")
    expect(codes).not.toContain("TF12")
    expect(codes).not.toContain("F13")
  })

  test("F21 is two records, in MLRA 145 and outside it", () => {
    const f21 = region.indicators.filter((i) => i.code === "F21")
    expect(f21.map((i) => [i.id, i.list, i.scope])).toEqual([
      ["F21-MLRA-145", "hydric", { mlra: ["145"] }],
      ["F21-outside-MLRA-145", "problematic", { outsideMlra: ["145"] }],
    ])
  })

  test("each carries the rule in the document's words and where it is published", () => {
    for (const i of region.indicators) {
      expect(i.quote.length, i.id).toBeGreaterThan(10)
      expect(i.citations.length, i.id).toBeGreaterThan(0)
      for (const c of i.citations) {
        expect(c.document, i.id).not.toBe("")
        expect(c.page, i.id).not.toBe("")
      }
    }
  })

  test("what each needs agrees with how it is decided", () => {
    for (const i of region.indicators) {
      const kinds = i.needs.map((n) => n.kind)
      if (i.criteria.kind === "field") expect(i.needs.length, i.id).toBeGreaterThan(0)
      else if (i.criteria.kind === "mucky" || i.criteria.kind === "organic") expect(kinds, i.id).toContain("texture")
      else expect(i.needs, `${i.id} is decided from colors and depths`).toEqual([])
    }
  })

  test("the color-and-depth indicators are the ones the ticket names", () => {
    const decided = region.indicators.filter((i) => ["gleyed", "depleted", "sandyRedox", "darkRedox", "belowDark"].includes(i.criteria.kind))
    expect(decided.map((i) => i.id)).toEqual(["A11", "A12", "S4", "S5", "F2", "F3", "F6", "F7"])
  })

  test("the problematic list is the right-hand column and the hydric list the other two", () => {
    for (const i of region.indicators) {
      expect(i.box.x[0] > 380 ? "problematic" : "hydric", i.id).toBe(i.list)
    }
  })
})

describe("the subregions", () => {
  test("the form's LRRs, with the MLRAs the NCNE scopes name", () => {
    expect(region.subregions.map((l) => l.id)).toEqual(["K", "L", "M", "R", "S"])
    expect(region.subregions.find((l) => l.id === "R")!.mlras).toEqual(["144A", "145"])
    expect(region.subregions.find((l) => l.id === "S")!.mlras).toEqual(["149B"])
  })

  test("every LRR and MLRA a scope names is one of them", () => {
    const lrrs = region.subregions.map((l) => l.id)
    const mlras = region.subregions.flatMap((l) => l.mlras)
    for (const i of region.indicators) {
      for (const l of i.scope?.lrr ?? []) expect(lrrs, `${i.id} LRR ${l}`).toContain(l)
      for (const m of [...(i.scope?.mlra ?? []), ...(i.scope?.outsideMlra ?? [])]) expect(mlras, `${i.id} MLRA ${m}`).toContain(m)
    }
  })

  test("each scope is what the form prints beside the indicator", () => {
    const words = (s: string, pattern: RegExp) => pattern.exec(s)?.[1].split(", ")
    for (const i of region.indicators) {
      const lrr = words(i.printed, /LRR ([A-Z](?:, [A-Z](?![A-Za-z]))*)/)
      const mlra = words(i.printed, /(?<!outside )MLRA ([0-9A-Z]+(?:, [0-9]+[A-Z]*)*)/)
      const outside = words(i.printed, /outside MLRA ([0-9A-Z]+)/)
      expect(i.scope?.lrr, `${i.id} LRR`).toEqual(lrr)
      expect(i.scope?.mlra, `${i.id} MLRA`).toEqual(mlra)
      expect(i.scope?.outsideMlra, `${i.id} outside`).toEqual(outside)
    }
  })
})

/** The labels the official page prints, one per blank: the text after each blank up to the next one in its column. */
async function printedLabels(): Promise<Map<string, string>> {
  const items = await pdfText(blank)
  const rules = (await pdfRules(blank)).filter((r) => COLUMN_STARTS.some((x) => Math.abs(r.x[0] - x) < 0.1) && r.top > 330)
  const labels = new Map<string, string>()
  COLUMN_STARTS.forEach((start, column) => {
    const tops = rules.filter((r) => Math.abs(r.x[0] - start) < 0.1).map((r) => r.top).sort((a, b) => a - b)
    const next = COLUMN_STARTS[column + 1] ?? 700
    const inColumn = (t: DrawnText) => t.x >= start && t.x < next - 1
    tops.forEach((top, n) => {
      const upTo = tops[n + 1] ?? top + 14
      const lines = items.filter((t) => inColumn(t) && t.baseline > top - 4 && t.baseline < Math.min(upTo - 4, top + 14))
      lines.sort((a, b) => Math.round(a.baseline) - Math.round(b.baseline) || a.x - b.x)
      labels.set(`${start}@${top.toFixed(1)}`, lines.map((t) => t.text).join(" ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/\s+/g, " ").trim())
    })
  })
  return labels
}

describe("against the official page", () => {
  test("the blanks are where the records say, to a tenth of a point", async () => {
    const drawn = (await pdfRules(blank)).filter((r) => r.top > 330 && r.top < 505 && COLUMN_STARTS.some((x) => Math.abs(r.x[0] - x) < 0.1))
    expect(drawn).toHaveLength(34)
    for (const i of region.indicators) {
      const match = drawn.filter((r) => Math.abs(r.x[0] - i.box.x[0]) < 0.06 && Math.abs(r.x[1] - i.box.x[1]) < 0.06 && Math.abs(r.top - i.box.rule) < 0.06)
      expect(match, `${i.id} at x ${i.box.x}, top ${i.box.rule}`).toHaveLength(1)
    }
  })

  test("the records are in the order the form prints them: three columns, top to bottom", () => {
    const keys = region.indicators.map((i) => [COLUMN_STARTS.findIndex((x) => Math.abs(x - i.box.x[0]) < 0.1), i.box.rule])
    expect(keys.every(([column]) => column >= 0)).toBe(true)
    expect(keys).toEqual([...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]))
  })

  test("the set of records is the set of labels the page prints", async () => {
    const labels = await printedLabels()
    // The page prints "Thin" at the end of the line above the blank of "Dark Surface (S9)": the label is "Thin Dark Surface".
    const printed = [...labels.values()] // the three columns in turn, each top to bottom
    const fixed = printed.map((text, n) => (text.endsWith(" Thin") ? text.slice(0, -5) : printed[n - 1]?.endsWith(" Thin") ? `Thin ${text}` : text))
    const expected = (list: readonly Indicator[]) => list.map((i) => i.printed)
    const byColumn = (x: number) => region.indicators.filter((i) => Math.abs(i.box.x[0] - x) < 0.1)
    expect(fixed).toEqual([...expected(byColumn(38.3)), ...expected(byColumn(193.3)), ...expected(byColumn(386.3))])
  })

  test("Hydric Soil Present: the Yes and No blanks are where the records say", async () => {
    const { yes, no } = region.soil.hydricPresent
    const drawn = (await pdfRules(blank)).filter((r) => r.top > 540 && r.top < 560)
    for (const box of [yes, no]) {
      const match = drawn.filter((r) => Math.abs(r.x[0] - box.x[0]) < 0.06 && Math.abs(r.x[1] - box.x[1]) < 0.06 && Math.abs(r.top - box.rule) < 0.06)
      expect(match, `x ${box.x}, top ${box.rule}`).toHaveLength(1)
    }
    const labels = (await pdfText(blank)).filter((t) => t.baseline > 540 && t.baseline < 560 && t.x > 470)
    expect(labels.map((t) => t.text)).toEqual(["Yes", "No"])
    expect(labels[0].x).toBeGreaterThan(yes.x[1] - 40)
  })
})
