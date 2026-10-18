// The forms as one PDF: every Sampling point's pages in order, drawn on the official pages, read back.
// A point's form is page 1, the Vegetation page and the Soil page (and the cover note after it, when
// something is not ticked there, and the Vegetation Continued page when a stratum overflows); the Privacy
// Act page is printed once, at the end of the whole PDF.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { formFor } from "./formFor"
import { JF1_POINT, JF1_PROJECT } from "./fixtures/jf1"
import { newPoint, withVegetation, type Project, type SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { formsPdf, type Blanks } from "./pdf"
import { regionOf } from "./regions"
import { pdfRules } from "./testing/pdfRules"
import { pdfText } from "./testing/pdfText"

const read = (name: string) => readFileSync(new URL(`./regions/ncne/${name}`, import.meta.url))
const blanks: Blanks = {
  page1: read("page1.pdf"),
  vegetation: read("vegetation-page.pdf"),
  soil: read("soil-page.pdf"),
  continued: read("vegetation-continued-page.pdf"),
  privacy: read("privacy-page.pdf"),
}

const second: SamplingPoint = { ...newPoint("JF-2"), id: "jf-2" }
const project: Project = {
  ...JF1_PROJECT,
  header: { ...JF1_PROJECT.header, site: "Cedar Creek crossing", county: "Story", state: "IA", date: "2026-10-18" },
  subregion: { lrr: "R", mlra: "144A" },
  points: [{ ...JF1_POINT, pair: { with: "jf-2", role: "wetland" } }, second],
}

const pageCount = async (bytes: Uint8Array) => {
  const { PDFDocument } = await import("pdf-lib")
  return (await PDFDocument.load(bytes)).getPageCount()
}
/** The text of every page of the PDF. */
const allPages = async (bytes: Uint8Array) =>
  Promise.all(Array.from({ length: await pageCount(bytes) }, async (_, i) => (await pdfText(bytes, i + 1)).map((d) => d.text)))
/** How many cover note pages a point's form has: the engine's own say on whether there is anything for one. */
const covers = (p: Project, points: readonly SamplingPoint[]) =>
  points.filter((pt) => {
    const { cover } = formFor(p, pt).hydric
    return cover.unconfirmed.length > 0 || cover.ticked.length > 0
  }).length

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
  test("has every point's page 1, Vegetation page and Soil page in order, and the Privacy Act page once, at the end", async () => {
    const bytes = await formsPdf(blanks, project, project.points)
    const pages = await allPages(bytes)
    // For JF-1 and JF-2: page 1, the Vegetation page and the Soil page; the cover notes there are; the Privacy Act page.
    expect(pages).toHaveLength(6 + covers(project, project.points) + 1)

    expect(pages[0]).toContain("Cedar Creek crossing")
    expect(pages[0]).toContain("JF-1")
    expect(pages[0]).not.toContain("JF-2")
    expect(pages[1].join(" ")).toContain("VEGETATION") // the Vegetation page, with the point's name
    expect(pages[1]).toContain("JF-1")
    expect(pages[2]).toContain("0-20") // the Soil page, with JF-1's layers
    expect(pages[3].join(" ")).toContain("Cover note: hydric soil indicators") // JF-1 has a suggestion not ticked
    const secondPage1 = pages.findIndex((texts, i) => i > 2 && texts.includes("JF-2") && texts.includes("Cedar Creek crossing"))
    expect(secondPage1).toBeGreaterThan(2) // the header is copied to every point
    expect(pages[secondPage1]).not.toContain("JF-1")
    expect(pages[secondPage1 + 1]).toContain("JF-2") // JF-2's Vegetation page
    expect(pages[secondPage1 + 2]).not.toContain("0-20") // JF-2 has no layers

    const privacy = pages.flatMap((texts, i) => (texts.join(" ").includes("PRIVACY ACT STATEMENT") ? [i] : []))
    expect(privacy).toEqual([pages.length - 1])
    expect(pages.filter((texts) => texts.join(" ").includes("AGENCY DISCLOSURE NOTIFICATION"))).toHaveLength(1)
  })

  test("one point's PDF is its page 1, Vegetation page and Soil page, then the Privacy Act page", async () => {
    const bytes = await formsPdf(blanks, project, [project.points[1]])
    const pages = await allPages(bytes)
    expect(pages).toHaveLength(3 + covers(project, [project.points[1]]) + 1)
    expect(pages[0]).toContain("JF-2")
    expect(pages[0]).toContain("Cedar Creek crossing")
    expect(pages.at(-1)!.join(" ")).toContain("PRIVACY ACT STATEMENT")
    expect(pages.flat()).not.toContain("JF-1")
  })

  test("a point's plants are on its Vegetation page, and an overflowing stratum adds the Continued page after the Soil page", async () => {
    const herbs = Array.from({ length: 14 }, (_, i) => ({
      id: `h${i}`,
      stratum: "herb" as const,
      typed: `Carex ${i}`,
      name: `Carex plant${i}`,
      status: "FAC" as const,
      listed: "FAC",
      note: "",
      identified: "species" as const,
      symbol: "",
      cover: i + 1,
    }))
    const planted: Project = { ...project, points: [withVegetation(project.points[1], (v) => ({ ...v, plants: herbs }))] }
    const pages = await allPages(await formsPdf(blanks, planted, planted.points))
    // Page 1, the Vegetation page, the Soil page, the Continued page, the vegetation cover note (the dominance test
    // is satisfied and not confirmed), the Privacy Act page. JF-2 has no layers, so there is no Soil cover note.
    expect(pages).toHaveLength(6)
    expect(pages[1]).toContain("Carex plant0")
    expect(pages[1]).toContain("Carex plant11") // the 12th, the last row of the Vegetation page
    expect(pages[1]).not.toContain("Carex plant12")
    expect(pages[3]).toContain("Carex plant12") // the Continued page, its first rows
    expect(pages[3]).toContain("Carex plant13")
    expect(pages[3].join(" ")).toContain("Continued")
    expect(pages[4].join(" ")).toContain("Cover note: hydrophytic vegetation")
    expect(pages[5].join(" ")).toContain("PRIVACY ACT STATEMENT")
  })

  test("with the vegetation indicators confirmed there is no vegetation cover note", async () => {
    const herbs = Array.from({ length: 14 }, (_, i) => ({
      id: `h${i}`,
      stratum: "herb" as const,
      typed: `Carex ${i}`,
      name: `Carex plant${i}`,
      status: "FAC" as const,
      listed: "FAC",
      note: "",
      identified: "species" as const,
      symbol: "",
      cover: i + 1,
    }))
    const confirmed: Project = { ...project, points: [withVegetation(project.points[1], (v) => ({ ...v, plants: herbs, indicators: { dominance: { state: "confirmed" } } }))] }
    const pages = await allPages(await formsPdf(blanks, confirmed, confirmed.points))
    expect(pages).toHaveLength(5)
    expect(pages.flat().join(" ")).not.toContain("Cover note: hydrophytic vegetation")
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
    expect(all).toContain("LRR R, MLRA 144A") // the subregion the project picked
  })

  test("the pair is printed on both forms", async () => {
    const pages = await allPages(await formsPdf(blanks, project, project.points))
    expect(pages[0]).toContain("Wetland point, paired with the upland point JF-2.")
    const secondPage1 = pages.findIndex((texts, i) => i > 1 && texts.includes("JF-2"))
    expect(pages[secondPage1]).toContain("Upland point, paired with the wetland point JF-1.")
  })

  test("the official pages are embedded once, so ten points are not ten forms", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...second, id: `p${i}`, name: `P-${i}` }))
    const one = await formsPdf(blanks, project, [project.points[0]])
    const many = await formsPdf(blanks, project, ten)
    expect(await pageCount(many)).toBe(30 + covers(project, ten) + 1)
    expect(many.length).toBeLessThan(one.length * 2)
  })

  test("a Project with nothing filled in draws only the point's name on page 1", async () => {
    const bare = { ...JF1_PROJECT, points: [{ ...JF1_POINT, layers: [] }] }
    const bytes = await formsPdf(blanks, bare, bare.points)
    const original = (await pdfText(new Uint8Array(blanks.page1 as Buffer))).map((d) => d.text)
    expect((await pdfText(bytes, 1)).map((d) => d.text)).toEqual([...original, "JF-1"])
  })
})
