// The Soil page PDF for JF-1, read back: the values are on the official page, in row order, at the
// measured positions.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { formFor } from "./formFor"
import { JF1_POINT, JF1_PROJECT, JF1_ROWS } from "./fixtures/jf1"
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
