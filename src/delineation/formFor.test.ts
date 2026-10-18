import { describe, expect, test } from "vitest"
import { formFor, fieldId } from "./formFor"
import { JF1_POINT, JF1_PROJECT, JF1_ROWS } from "./fixtures/jf1"
import { newPoint, newProject, notationOf, type Layer } from "./model"
import { regionOf } from "./regions"
import { PROFILE_COLUMNS } from "./regions/types"
import { soilPlacements } from "./soilPage"

const COLUMNS = ["depth", "matrixColor", "matrixPercent", "redoxColor", "redoxPercent"] as const

const layer = (top: number, bottom: number, extra: Partial<Layer> = {}): Layer => ({
  id: `${top}-${bottom}`,
  top,
  bottom,
  matrix: { notation: "10YR 4/2", percent: 100 },
  redox: [],
  remarks: "",
  ...extra,
})

describe("JF-1 through the form engine", () => {
  const form = formFor(JF1_PROJECT, JF1_POINT)

  test("the profile rows are exactly as transcribed", () => {
    JF1_ROWS.forEach((expected, row) => {
      expect(COLUMNS.map((column) => form.fields[fieldId(row, column)])).toEqual([...expected])
    })
  })

  test("every other field of the table is blank, and there is nothing to suggest, conclude or warn about", () => {
    const rows = regionOf("NCNE").soil.rowRules.length
    expect(rows).toBe(11)
    const filled = Object.entries(form.fields).filter(([, text]) => text !== "")
    expect(filled).toHaveLength(16)
    for (let row = 0; row < rows; row++) {
      for (const column of PROFILE_COLUMNS) {
        if (row < 4 && (COLUMNS as readonly string[]).includes(column)) continue
        expect(form.fields[fieldId(row, column)], `${row} ${column}`).toBe("")
      }
    }
    expect(form.suggestions).toEqual([])
    expect(form.conclusions).toEqual([])
    expect(form.warnings).toEqual([])
  })

  test("placements are the filled values in row order, each on its column and above its rule", () => {
    const { soil } = regionOf("NCNE")
    const placements = soilPlacements(JF1_PROJECT, form)
    expect(placements.map((p) => p.text)).toEqual(JF1_ROWS.flatMap((row) => row.filter((text) => text !== "")))
    const inRow = (baseline: number) => soil.rowRules.findIndex((rule) => rule - soil.aboveRule === baseline)
    for (const p of placements) {
      const [, , row, column] = p.id.split(".")
      expect(inRow(p.baseline)).toBe(Number(row))
      const [left, right] = soil.columns[column as keyof typeof soil.columns]
      expect(p.x).toBeGreaterThanOrEqual(left)
      expect(p.x).toBeLessThan(right)
      expect(p.size).toBe(soil.fontSize)
    }
  })
})

describe("layers in any order, with problems, still make a form", () => {
  const project = newProject("Pond", "NCNE")

  test("a layer with no matrix gives a warning, not a crash, and keeps its depth", () => {
    const point = { ...newPoint("SP-1"), layers: [layer(0, 6), layer(6, 12, { matrix: null })] }
    const form = formFor(project, point)
    expect(form.warnings.map((w) => [w.kind, w.layer])).toEqual([["no-matrix", 1]])
    expect(form.warnings[0].text).toContain("6-12 in")
    expect(form.fields[fieldId(1, "depth")]).toBe("6-12")
    expect(form.fields[fieldId(1, "matrixColor")]).toBe("")
    expect(form.fields[fieldId(0, "matrixColor")]).toBe("10YR 4/2")
  })

  test("layers are listed from the surface down however they were added", () => {
    const point = { ...newPoint("SP-1"), layers: [layer(12, 20), layer(0, 12)] }
    const form = formFor(project, point)
    expect([form.fields[fieldId(0, "depth")], form.fields[fieldId(1, "depth")]]).toEqual(["0-12", "12-20"])
  })

  test("a point with no layers is a blank table", () => {
    const form = formFor(project, newPoint("SP-1"))
    expect(Object.values(form.fields).every((text) => text === "")).toBe(true)
    expect(form.warnings).toEqual([])
  })

  test("a second redox feature goes on the row below, under the same layer", () => {
    const point = {
      ...newPoint("SP-1"),
      layers: [
        layer(0, 8, { redox: [{ notation: "7.5YR 4/6", percent: 5 }, { notation: "10YR 5/8", percent: 2.5 }] }),
        layer(8, 16),
      ],
    }
    const form = formFor(project, point)
    expect(form.fields[fieldId(0, "redoxColor")]).toBe("7.5YR 4/6")
    expect(form.fields[fieldId(1, "redoxColor")]).toBe("10YR 5/8")
    expect(form.fields[fieldId(1, "redoxPercent")]).toBe("2.5")
    expect(form.fields[fieldId(1, "depth")]).toBe("")
    expect(form.fields[fieldId(2, "depth")]).toBe("8-16")
  })

  test("gaps, overlaps and a bottom above the top are warned about", () => {
    const point = { ...newPoint("SP-1"), layers: [layer(0, 6), layer(8, 12), layer(10, 20), layer(30, 25)] }
    const kinds = formFor(project, point).warnings.map((w) => w.kind)
    expect(kinds).toContain("gap")
    expect(kinds).toContain("overlap")
    expect(kinds).toContain("bad-depth")
  })

  test("more rows than the form has are warned about, and the rest is left off", () => {
    const layers = Array.from({ length: 13 }, (_, i) => layer(i * 2, i * 2 + 2))
    const form = formFor(project, { ...newPoint("SP-1"), layers })
    expect(form.warnings.map((w) => w.kind)).toEqual(["too-many-rows"])
    expect(Object.keys(form.fields)).toHaveLength(11 * PROFILE_COLUMNS.length)
  })
})

describe("a typed-in color", () => {
  test.each([
    ["10YR 4/2", "10YR 4/2"],
    ["10yr 4/2", "10YR 4/2"],
    ["7.5YR 4/6", "7.5YR 4/6"],
    ["2.5Y5/3", "2.5Y 5/3"],
    ["5GY 5/1", "5GY 5/1"],
    ["N 2.5/", "N 2.5/"],
    ["n 2.5", "N 2.5/"],
    ["Gley1 3/10Y", "GLEY1 3/10Y"],
  ])("%j is read as %j", (typed, notation) => {
    expect(notationOf(typed)).toBe(notation)
  })

  test.each(["", "brown", "10YR", "10YR 4", "4/2", "10XX 4/2", "10YR 4/2 moist"])("%j is not a notation", (typed) => {
    expect(notationOf(typed)).toBeNull()
  })
})
