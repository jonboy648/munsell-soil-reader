import { readFileSync } from "node:fs"
import { PDFDocument } from "pdf-lib"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { expect, test } from "vitest"
import { CONCLUSIONS, PARAMETERS, confirmConclusion } from "./determination"
import { formFor } from "./formFor"
import { JF1_DETERMINATION_POINT as fixture, JF1_DETERMINATION_PROJECT as project } from "./fixtures/jf1Determination"
import type { SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { formsPdf, page1Pdf, soilPagePdf, type Blanks } from "./pdf"
import { regionOf } from "./regions"
import { pdfRules } from "./testing/pdfRules"
import { pdfText } from "./testing/pdfText"
import { vegetationPdf } from "./vegetation/vegetationPdf"

const read = (name: string) => readFileSync(new URL(`./regions/ncne/${name}.pdf`, import.meta.url))
const blanks: Blanks = { page1: read("page1"), vegetation: read("vegetation-page"), soil: read("soil-page"), continued: read("vegetation-continued-page"), privacy: read("privacy-page") }
const allText = async (bytes: Uint8Array) => {
  const count = (await PDFDocument.load(bytes)).getPageCount()
  const pages = await Promise.all(Array.from({ length: count }, (_, i) => pdfText(bytes, i + 1)))
  return pages.map((p) => p.map((t) => t.text).join(" ")).join(" ")
}

function confirmed(): SamplingPoint {
  let point = fixture
  for (const id of CONCLUSIONS) point = confirmConclusion(point, formFor(project, point).determination, id, "yes")
  return point
}

test("all eight summary blanks match actual rules and labels on the official PDF", async () => {
  const rules = await pdfRules(new Uint8Array(blanks.page1))
  const text = await pdfText(new Uint8Array(blanks.page1))
  const geometry = regionOf("NCNE").page1.summary
  for (const id of CONCLUSIONS) for (const answer of ["yes", "no"] as const) {
    const { column: [left, right], rule } = geometry[id][answer]
    expect(rules.find((r) => Math.abs(r.left - left) < 0.05 && Math.abs(r.right - right) < 0.05 && Math.abs(r.top - rule) < 0.05), `${id} ${answer}`).toBeDefined()
    expect(text.find((t) => t.text === (answer === "yes" ? "Yes" : "No") && t.x < left && left - t.x < 20 && Math.abs(t.baseline - (rule - 2.42)) < 0.1)).toBeDefined()
  }
})

test.each(["yes", "no"] as const)("full PDF prints confirmed %s ticks beside the correct summary labels", async (answer) => {
  let point = confirmed()
  if (answer === "no") for (const id of CONCLUSIONS) point = confirmConclusion(point, formFor(project, point).determination, id, "no", `Synthetic ${id} override`)
  const bytes = await formsPdf(blanks, project, [point])
  const drawn = await pdfText(bytes)
  const ticks = drawn.filter((t) => t.text === "X" && t.baseline > 250 && t.baseline < 290)
  expect(ticks).toHaveLength(4)
  // Literals measured from the source PDF, independent of placements.
  const x = answer === "yes" ? [224.485, 224.485, 224.485, 451.285] : [265.525, 265.525, 265.525, 497.125]
  const baselines = [260.22, 272.58, 284.94, 272.58]
  ticks.forEach((tick, i) => {
    expect(tick.x).toBeCloseTo(x[i], 2)
    expect(tick.baseline).toBeCloseTo(baselines[i], 2)
  })
  const form = formFor(project, point)
  for (const id of PARAMETERS) expect(form.determination.conclusions[id].confirmed).toBe(answer)
  const placed = page1Placements(project, form).filter((p) => p.id.startsWith("page1.summary."))
  expect(placed.map((p) => p.text)).toEqual(["X", "X", "X", "X"])
  if (answer === "yes") {
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(4)
    expect(await allText(bytes)).not.toContain("Unconfirmed conclusions")
  }
})

test("pending conclusions are blank, and full and page 1 exports list each unresolved conclusion by page", async () => {
  const form = formFor(project, fixture)
  const exports = [await formsPdf(blanks, project, [fixture]), await page1Pdf(blanks.page1, project, fixture, form)]
  for (const bytes of exports) {
    expect((await pdfText(bytes)).filter((t) => t.text === "X" && t.baseline > 250 && t.baseline < 290)).toHaveLength(0)
    const text = await allText(bytes)
    for (const words of ["Unconfirmed conclusions by page", "Page 2 - Vegetation", "Page 3 - Soil", "Page 1 - Hydrology", "Page 1 - Summary of findings"]) expect(text).toContain(words)
    for (const id of CONCLUSIONS) expect(text).toContain(form.determination.conclusions[id].question)
  }
})

test("long override remarks wrap inside the measured box, preserve the pair and continue in full on the cover", async () => {
  const base = confirmed()
  const remark = "Synthetic review explanation. ".repeat(100) + "END OF EXPLANATION"
  const point = { ...confirmConclusion(base, formFor(project, base).determination, "wetland", "no", remark), pair: { with: "upland", role: "wetland" as const } }
  const p = { ...project, points: [point, { ...fixture, id: "upland", name: "JF-2" }] }
  const form = formFor(p, point)
  const remarks = page1Placements(p, form).filter((t) => t.id === "page1.summaryRemarks")
  expect(remarks).toHaveLength(6)
  expect(remarks[0].text).toContain("paired with")
  expect(remarks.at(-1)!.baseline).toBeLessThan(375.84)
  expect(remarks.at(-1)!.text).toContain("See cover note.")
  const text = await allText(await formsPdf(blanks, p, [point]))
  expect(text).toContain("Summary Remarks")
  expect(text).toContain("END OF EXPLANATION")
})

test("a retained overall confirmation still prints, with a review explanation in the export", async () => {
  const point = { ...confirmed(), layers: [] }
  const bytes = await formsPdf(blanks, project, [point])
  expect((await pdfText(bytes)).find((t) => t.text === "X" && Math.abs(t.x - 451.285) < 0.01 && Math.abs(t.baseline - 272.58) < 0.01)).toBeDefined()
  expect(await allText(bytes)).toContain("Recorded evidence or conditions changed after confirmation")
})

test.each(["soil", "vegetation"] as const)("the standalone %s PDF reports its pending parameter after indicators are confirmed", async (parameter) => {
  const make = (point: SamplingPoint) => parameter === "soil"
    ? soilPagePdf(blanks.soil, project, point, formFor(project, point))
    : vegetationPdf(blanks, project, point, formFor(project, point))
  const bytes = await make(fixture)
  expect((await pdfText(bytes)).filter((t) => t.text === "X")).toHaveLength(parameter === "soil" ? 1 : 2)
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2)
  const note = (await pdfText(bytes, 2)).map((t) => t.text).join(" ")
  expect(note).toContain("Unconfirmed parameter conclusion")
  expect(note).toContain(parameter === "soil" ? "Hydric Soil Present?" : "Hydrophytic Vegetation Present?")
  expect(note).not.toContain("Is the Sampled Area within a Wetland?")
  expect(note).not.toContain(parameter === "soil" ? "Hydrophytic Vegetation Present?" : "Hydric Soil Present?")
  const answered = confirmConclusion(fixture, formFor(project, fixture).determination, parameter, "yes")
  // Other parameters and the overall determination are still pending, but do not belong on this sheet.
  expect((await PDFDocument.load(await make(answered))).getPageCount()).toBe(1)
})

test("long lowercase-l summary remarks stay within actual PDF cover-note bounds and remain complete", async () => {
  const point = confirmed()
  const remark = "l".repeat(1400)
  const overridden = confirmConclusion(point, formFor(project, point).determination, "wetland", "no", remark)
  const bytes = await formsPdf(blanks, project, [overridden])
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise
  const coverText: string[] = []
  for (let pageNumber = 4; pageNumber < doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const { items } = await page.getTextContent()
    for (const item of items) {
      if (!("str" in item) || !item.str.trim()) continue
      coverText.push(item.str)
      expect(item.transform[4]).toBeGreaterThanOrEqual(54 - 0.1)
      expect(item.transform[4] + item.width, `cover page ${pageNumber} right edge`).toBeLessThanOrEqual(558 + 0.1)
    }
  }
  expect(coverText.join("").replace(/\s/g, "")).toContain(remark)
})
