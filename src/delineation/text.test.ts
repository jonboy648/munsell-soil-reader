import { readFileSync } from "node:fs"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { describe, expect, test } from "vitest"
import { formFor } from "./formFor"
import { JF1_POINT, JF1_PROJECT } from "./fixtures/jf1"
import { newPoint, newProject, type Layer } from "./model"
import { soilPagePdf } from "./pdf"
import { soilPlacements } from "./soilPage"
import { fit, printable, truncate, widthOf, wrap } from "./text"
import { pdfText } from "./testing/pdfText"

const blank = readFileSync(new URL("./regions/ncne/soil-page.pdf", import.meta.url))

async function helvetica() {
  const doc = await PDFDocument.create()
  return doc.embedFont(StandardFonts.Helvetica)
}

describe("text widths", () => {
  test("the table measures text as the PDF draws it: each character's width, with no kerning", async () => {
    const font = await helvetica()
    for (const text of ["10YR 4/2", "7.5YR 4/6", "0-20", "JF-1", "very dark, sticky; roots to 12 in.", "café ½ ° … €"]) {
      for (const size of [5, 8, 12]) {
        const drawn = [...text].reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size), 0)
        expect(widthOf(text, size)).toBeCloseTo(drawn, 6)
        // The library's whole-string width takes kerning off, which a PDF's plain text does not.
        expect(widthOf(text, size)).toBeGreaterThanOrEqual(font.widthOfTextAtSize(text, size) - 1e-6)
      }
    }
  })

  test("wrap, truncate and fit keep text within the room they are given", () => {
    const text = "a long remark that has to be kept inside the column of the form"
    for (const line of wrap(text, 100, 8)) expect(widthOf(line, 8)).toBeLessThanOrEqual(100)
    expect(wrap(text, 100, 8).join(" ")).toBe(text)
    expect(widthOf(truncate(text, 100, 8), 8)).toBeLessThanOrEqual(100)
    expect(truncate(text, 100, 8)).toMatch(/\.\.\.$/)
    expect(truncate("short", 100, 8)).toBe("short")
    const small = fit("0123456789012", 40, 8)
    expect(small.size).toBeLessThan(8)
    expect(widthOf(small.text, small.size)).toBeLessThanOrEqual(40)
    expect(fit("JF-1", 40, 8)).toEqual({ text: "JF-1", size: 8 })
  })
})

describe("text the form's font cannot print", () => {
  test.each([
    ["pH ≤ 5", "pH <= 5", true],
    ["≥ 10 cm → clay", ">= 10 cm -> clay", true],
    ["½ inch, 5°, ± 2", "½ inch, 5°, ± 2", false],
    ["café", "café", false],
    ["ā č", "a c", true],
    ["fine \u{1f600} indeed", "fine ? indeed", true],
    ["tab\tand\nnewline", "tab and newline", false],
  ])("%j is printed as %j", (text, expected, replaced) => {
    expect(printable(text)).toEqual({ text: expected, replaced })
  })

  test("what comes out can always be drawn: the PDF library encodes all of it", async () => {
    const font = await helvetica()
    for (const text of ["≤ ≥ → ½ \u{1f600} ā € 中文", "\u0000\u0001 control"]) {
      expect(() => font.encodeText(printable(text).text)).not.toThrow()
    }
  })

  test("a PDF is still made for remarks with such characters, with the same text as the preview", async () => {
    const layer: Layer = {
      id: "l",
      top: 0,
      bottom: 6,
      matrix: { notation: "10YR 4/2", percent: 100 },
      redox: [],
      remarks: "pH ≤ 5 \u{1f600}",
    }
    const point = { ...JF1_POINT, layers: [layer] }
    const form = formFor(JF1_PROJECT, point)
    const drawn = await pdfText(await soilPagePdf(blank, JF1_PROJECT, point, form))
    const placed = soilPlacements(JF1_PROJECT, form).map((p) => p.text)
    expect(drawn.slice(-placed.length).map((d) => d.text)).toEqual(placed)
    expect(drawn.at(-1)?.text).toBe("pH <= 5 ?")
  })
})

describe("every placement fits its column", () => {
  test("measured with the PDF library's own font, however much is typed", async () => {
    const font = await helvetica()
    const long = (n: number) => "w".repeat(n)
    const layers: Layer[] = [
      {
        id: "a",
        top: 100.25,
        bottom: 1234.5,
        matrix: { notation: "10YR 4/2", percent: 100.25 },
        redox: [{ notation: "7.5YR 4/6", percent: 12.345 }],
        remarks: `${long(113)} and a few ordinary words after it`,
      },
      { id: "b", top: 1300, bottom: 1400, matrix: { notation: "GLEY1 2.5/10BG", percent: 99.5 }, redox: [], remarks: long(500) },
    ]
    const project = newProject("Pond", "NCNE")
    const point = { ...newPoint(`Sampling point ${long(80)}`), layers }
    const form = formFor(project, point)
    const placements = soilPlacements(project, form)
    expect(placements.length).toBeGreaterThan(5)
    for (const p of placements) {
      expect(font.widthOfTextAtSize(p.text, p.size), p.id).toBeLessThanOrEqual(p.maxWidth + 1e-6)
    }
    // And on the page: nothing is drawn past the table's right rule.
    const drawn = await pdfText(await soilPagePdf(blank, project, point, form))
    for (const d of drawn.slice(-placements.length)) expect(d.x).toBeLessThan(571.2)
  })
})
