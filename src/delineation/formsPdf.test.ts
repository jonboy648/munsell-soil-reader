// The forms as one PDF: every Sampling point's pages in order, drawn on the official pages, read back.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { formFor } from "./formFor"
import { JF1_POINT, JF1_PROJECT } from "./fixtures/jf1"
import { newPoint, type Project, type SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { formsPdf, type Blanks } from "./pdf"
import { regionOf } from "./regions"
import { pdfRules } from "./testing/pdfRules"
import { pdfText } from "./testing/pdfText"

const read = (name: string) => readFileSync(new URL(`./regions/ncne/${name}`, import.meta.url))
const blanks: Blanks = { page1: read("page1.pdf"), soil: read("soil-page.pdf"), privacy: read("privacy-page.pdf") }

const second: SamplingPoint = { ...newPoint("JF-2"), id: "jf-2" }
const project: Project = {
  ...JF1_PROJECT,
  header: { ...JF1_PROJECT.header, site: "Cedar Creek crossing", county: "Story", state: "IA", date: "2026-10-18" },
  points: [{ ...JF1_POINT, pair: { with: "jf-2", role: "wetland" } }, second],
}

const pageCount = async (bytes: Uint8Array) => {
  const { PDFDocument } = await import("pdf-lib")
  return (await PDFDocument.load(bytes)).getPageCount()
}

describe("the official page 1 and the measured header", () => {
  test("every line of the header is a rule on the official page, where the region package says", async () => {
    const rules = await pdfRules(new Uint8Array(blanks.page1 as Buffer))
    const { page1 } = regionOf("NCNE")
    for (const [field, rule] of Object.entries(page1.fields)) {
      const drawn = rules.find((r) => Math.abs(r.left - rule.left) < 0.2 && Math.abs(r.right - rule.right) < 0.2 && Math.abs(r.top - rule.rule) < 0.2)
      expect(drawn, field).toBeDefined()
    }
  })
})

describe("a project's PDF", () => {
  test("has every point's pages in order: page 1, the Soil page and the Privacy Act page, then the next point's", async () => {
    const bytes = await formsPdf(blanks, project, project.points)
    expect(await pageCount(bytes)).toBe(6)
    const names = async (page: number) => (await pdfText(bytes, page)).map((d) => d.text)

    expect(await names(1)).toContain("Cedar Creek crossing")
    expect(await names(1)).toContain("JF-1")
    expect(await names(2)).toContain("0-20") // the Soil page, with JF-1's layers
    expect((await names(3)).join(" ")).toContain("AGENCY DISCLOSURE NOTIFICATION")
    expect(await names(4)).toContain("Cedar Creek crossing") // the header is copied to every point
    expect(await names(4)).toContain("JF-2")
    expect(await names(4)).not.toContain("JF-1")
    expect(await names(5)).not.toContain("0-20") // JF-2 has no layers
    expect((await names(6)).join(" ")).toContain("PRIVACY ACT STATEMENT")
  })

  test("draws each header value at the place it was given, on the official page", async () => {
    const bytes = await formsPdf(blanks, project, [project.points[0]])
    const form = formFor(project, project.points[0])
    const placed = page1Placements(project, form)
    const drawn = (await pdfText(bytes, 1)).slice(-placed.length)
    placed.forEach((p, i) => {
      expect(drawn[i].text).toBe(p.text)
      expect(drawn[i].x).toBeCloseTo(p.x, 1)
      expect(drawn[i].baseline).toBeCloseTo(p.baseline, 1)
    })
    const all = (await pdfText(bytes, 1)).map((d) => d.text).join(" ")
    expect(all).toContain("Project/Site:") // the official page is still there
    expect(all).toContain("Wetland point, paired with the upland point JF-2.")
  })

  test("the pair is printed on both forms", async () => {
    const bytes = await formsPdf(blanks, project, project.points)
    expect((await pdfText(bytes, 1)).map((d) => d.text)).toContain("Wetland point, paired with the upland point JF-2.")
    expect((await pdfText(bytes, 4)).map((d) => d.text)).toContain("Upland point, paired with the wetland point JF-1.")
  })

  test("the official pages are embedded once, so ten points are not ten forms", async () => {
    const one = await formsPdf(blanks, project, [project.points[0]])
    const many = await formsPdf(blanks, project, Array.from({ length: 10 }, (_, i) => ({ ...second, id: `p${i}`, name: `P-${i}` })))
    expect(await pageCount(many)).toBe(30)
    expect(many.length).toBeLessThan(one.length * 2)
  })

  test("a Project with nothing filled in draws only the point's name on page 1", async () => {
    const bare = { ...JF1_PROJECT, points: [{ ...JF1_POINT, layers: [] }] }
    const bytes = await formsPdf(blanks, bare, bare.points)
    const original = (await pdfText(new Uint8Array(blanks.page1 as Buffer))).map((d) => d.text)
    expect((await pdfText(bytes, 1)).map((d) => d.text)).toEqual([...original, "JF-1"])
  })
})
