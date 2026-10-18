// The Soil page PDF for JF-1, read back: the values are on the official page, in row order, at the
// measured positions.
import { readFileSync } from "node:fs"
import { PDFDocument } from "pdf-lib"
import { describe, expect, test } from "vitest"
import { formFor } from "./formFor"
import { JF1_POINT, JF1_PROJECT, JF1_ROWS } from "./fixtures/jf1"
import type { SamplingPoint } from "./model"
import { soilPagePdf } from "./pdf"
import { regionOf } from "./regions"
import { soilPlacements } from "./soilPage"
import { pdfText } from "./testing/pdfText"

const blank = readFileSync(new URL("./regions/ncne/soil-page.pdf", import.meta.url))

describe("the Soil page PDF", () => {
  const form = formFor(JF1_PROJECT, JF1_POINT)

  test("the official page is still there, with the profile values drawn after it, in row order", async () => {
    const drawn = await pdfText(await soilPagePdf(blank, JF1_PROJECT, JF1_POINT, form))
    const values = JF1_ROWS.flatMap((row) => row.filter((text) => text !== ""))
    // The official page's own text comes first; what was drawn on it follows in drawing order.
    expect(drawn.slice(-values.length).map((d) => d.text)).toEqual(values)
    expect(drawn.some((d) => d.text.includes("Profile Description"))).toBe(true)
    expect(drawn.some((d) => d.text.includes("ENG FORM 6116-8"))).toBe(true)
  })

  test("each value is where it was placed: on its column, just above its rule", async () => {
    const { soil } = regionOf("NCNE")
    const drawn = (await pdfText(await soilPagePdf(blank, JF1_PROJECT, JF1_POINT, form))).slice(-16)
    soilPlacements(JF1_PROJECT, form).forEach((placed, i) => {
      expect(drawn[i].text).toBe(placed.text)
      expect(drawn[i].x).toBeCloseTo(placed.x, 1)
      expect(drawn[i].baseline).toBeCloseTo(placed.baseline, 1)
    })
    expect(soil.fontSize).toBe(8)
  })

  test("a point with no layers is the blank page, unchanged", async () => {
    const empty = { ...JF1_POINT, layers: [] }
    const drawn = await pdfText(await soilPagePdf(blank, JF1_PROJECT, empty, formFor(JF1_PROJECT, empty)))
    const original = await pdfText(new Uint8Array(blank))
    expect(drawn.map((d) => d.text)).toEqual(original.map((d) => d.text))
  })
})

describe("ticks and the cover note", () => {
  const { soil, indicators } = regionOf("NCNE")
  const box = (id: string) => indicators.find((i) => i.id === id)!.box
  const choose = (indicators: SamplingPoint["indicators"], hydricSoilPresent?: "yes" | "no"): SamplingPoint => ({
    ...JF1_POINT,
    ...(indicators ? { indicators } : {}),
    ...(hydricSoilPresent ? { hydricSoilPresent } : {}),
  })
  const made = (point: SamplingPoint) => soilPagePdf(blank, JF1_PROJECT, point, formFor(JF1_PROJECT, point))
  const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount()
  const ticksOf = async (bytes: Uint8Array) => (await pdfText(bytes)).filter((d) => d.text === "X")

  test("a confirmed indicator and a confirmed Yes are Xs on their printed blanks", async () => {
    const bytes = await made(choose({ A12: { state: "confirmed" } }, "yes"))
    const ticks = await ticksOf(bytes)
    const width = 0.667 * soil.tick.size
    const onBlank = (b: { x: readonly [number, number]; rule: number }) =>
      ticks.filter((t) => Math.abs(t.x + width / 2 - (b.x[0] + b.x[1]) / 2) < 0.1 && Math.abs(t.baseline - (b.rule - soil.tick.aboveRule)) < 0.1)
    expect(ticks).toHaveLength(2)
    expect(onBlank(box("A12"))).toHaveLength(1)
    expect(onBlank(soil.hydricPresent.yes)).toHaveLength(1)
  })

  test("with nothing confirmed no X is drawn and the suggestion goes on a cover note, a second page", async () => {
    const bytes = await made(JF1_POINT)
    expect(await ticksOf(bytes)).toEqual([])
    expect(await pages(bytes)).toBe(2)
    const note = (await pdfText(bytes, 2)).map((d) => d.text).join(" ")
    expect(note).toContain("Cover note: hydric soil indicators")
    expect(note).toContain("Suggested by the app, not confirmed")
    expect(note).toContain("A12 Thick Dark Surface")
    expect(note).toContain("Layers 3 and 4 (25-34 in)")
    expect(note).toContain("Rule: A layer 15 cm (6 inches) or more thick")
    expect(note).toContain("Source: NRCS Field Indicators of Hydric Soils")
    expect(note).not.toContain("Ticked by the user")
  })

  test("a confirmed suggestion is on the page and off the cover note: one page", async () => {
    const bytes = await made(choose({ A12: { state: "confirmed" } }))
    expect(await pages(bytes)).toBe(1)
  })

  test("a tick the app did not suggest is drawn, and the cover note carries the user's remark", async () => {
    const bytes = await made(choose({ A12: { state: "confirmed" }, A4: { state: "confirmed", manual: true, remark: "Rotten egg smell at 8 in" } }))
    expect(await ticksOf(bytes)).toHaveLength(2)
    expect(await pages(bytes)).toBe(2)
    const note = (await pdfText(bytes, 2)).map((d) => d.text).join(" ")
    expect(note).toContain("Ticked by the user, not suggested by the app")
    expect(note).toContain("A4 Hydrogen Sulfide: Rotten egg smell at 8 in")
    expect(note).not.toContain("Suggested by the app, not confirmed")
  })

  test("a rejected suggestion leaves no tick and no cover note", async () => {
    const bytes = await made(choose({ A12: { state: "rejected" } }))
    expect(await ticksOf(bytes)).toEqual([])
    expect(await pages(bytes)).toBe(1)
  })

  test("No is ticked on its own blank", async () => {
    const [tick] = await ticksOf(await made(choose({ A12: { state: "rejected" } }, "no")))
    expect(tick.x + (0.667 * soil.tick.size) / 2).toBeCloseTo((soil.hydricPresent.no.x[0] + soil.hydricPresent.no.x[1]) / 2, 1)
  })

  test("a long remark wraps and stays on the page, with no character outside the standard font", async () => {
    const remark = "Smell of rotten eggs \u2013 \u201cstrong\u201d at 8 in, and again at 14 in, in the wet pocket by the old fence line, which is why I ticked it by hand. ".repeat(4)
    const bytes = await made(choose({ A4: { state: "confirmed", manual: true, remark } }))
    const note = await pdfText(bytes, 2)
    expect(note.every((d) => d.x >= 54 - 0.1 && d.x < 558)).toBe(true)
    expect(note.map((d) => d.text).join(" ")).toContain("Smell of rotten eggs - \"strong\" at 8 in")
  })
})
