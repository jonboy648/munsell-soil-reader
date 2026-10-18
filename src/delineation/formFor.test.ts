import { describe, expect, test } from "vitest"
import { formFor, fieldId, columnRoom, indicatorFieldId, type FieldId } from "./formFor"
import { JF1_POINT, JF1_PROJECT, JF1_ROWS } from "./fixtures/jf1"
import { newPoint, newProject, notationOf, type Layer, type SamplingPoint } from "./model"
import { regionOf } from "./regions"
import { PROFILE_COLUMNS } from "./regions/types"
import { soilPlacements } from "./soilPage"
import { widthOf } from "./text"

const COLUMNS = ["depth", "matrixColor", "matrixPercent", "redoxColor", "redoxPercent"] as const
const { soil } = regionOf("NCNE")

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

  test("the profile rows are exactly as transcribed, and the Sampling Point box has the point's name", () => {
    JF1_ROWS.forEach((expected, row) => {
      expect(COLUMNS.map((column) => form.fields[fieldId(row, column)])).toEqual([...expected])
    })
    expect(form.fields["soil.samplingPoint"]).toBe("JF-1")
  })

  test("every other field is blank, and the only things the form says are one suggestion and the question it leaves open", () => {
    const rows = soil.rowRules.length
    expect(rows).toBe(11)
    const filled = Object.entries(form.fields).filter(([id, text]) => id.startsWith("soil.") && text !== "")
    expect(filled).toHaveLength(17)
    for (let row = 0; row < rows; row++) {
      for (const column of PROFILE_COLUMNS) {
        if (row < 4 && (COLUMNS as readonly string[]).includes(column)) continue
        expect(form.fields[fieldId(row, column)], `${row} ${column}`).toBe("")
      }
    }
    expect(form.hydric.suggestions.map((s) => s.indicator)).toEqual(["A12"])
    expect(form.hydric.conclusion).toEqual({ id: "hydricSoilPresent", question: "Hydric Soil Present?", suggested: null, because: "No indicator is confirmed yet." })
    expect(form.warnings).toEqual([])
  })

  test("placements are the point's name, then the filled values in row order, each on its column and above its rule", () => {
    const placements = soilPlacements(JF1_PROJECT, form)
    expect(placements.map((p) => p.text)).toEqual(["JF-1", ...JF1_ROWS.flatMap((row) => row.filter((text) => text !== ""))])
    const inRow = (baseline: number) => soil.rowRules.findIndex((rule) => rule - soil.aboveRule === baseline)
    for (const p of placements.slice(1)) {
      const [, , row, column] = p.id.split(".")
      expect(inRow(p.baseline)).toBe(Number(row))
      const [left, right] = soil.columns[column as keyof typeof soil.columns]
      expect(p.x).toBeGreaterThanOrEqual(left)
      expect(p.x).toBeLessThan(right)
      expect(p.size).toBe(soil.fontSize)
    }
    const [name] = placements
    expect(name.baseline).toBe(soil.samplingPoint.rule - soil.aboveRule)
    expect(name.x).toBeGreaterThanOrEqual(soil.samplingPoint.column[0])
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

  test("a point with no layers is a blank table with its name on the page", () => {
    const form = formFor(project, newPoint("SP-1"))
    const filled = Object.entries(form.fields).filter(([id, text]) => id.startsWith("soil.") && text !== "")
    expect(filled).toEqual([["soil.samplingPoint", "SP-1"]])
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

  test("a layer inside another is an overlap, not a gap, and the deepest bottom is what a gap is measured from", () => {
    const nested = { ...newPoint("SP-1"), layers: [layer(0, 30), layer(10, 20), layer(25, 28)] }
    expect(formFor(project, nested).warnings.map((w) => [w.kind, w.layer])).toEqual([
      ["overlap", 1],
      ["overlap", 2],
    ])
    const gapAfterNested = { ...newPoint("SP-1"), layers: [layer(0, 30), layer(10, 20), layer(32, 40)] }
    expect(formFor(project, gapAfterNested).warnings.map((w) => [w.kind, w.layer])).toEqual([
      ["overlap", 1],
      ["gap", 2],
    ])
  })
})

describe("what does not fit the form", () => {
  const project = newProject("Pond", "NCNE")
  const room = columnRoom(soil, "remarks")
  const printed = (form: ReturnType<typeof formFor>, column: (typeof PROFILE_COLUMNS)[number], rows = soil.rowRules.length) =>
    Array.from({ length: rows }, (_, r) => form.fields[fieldId(r, column)])

  test("remarks wider than the column wrap onto the layer's own following rows, each line inside the column", () => {
    const remarks = "dark organic surface with many fine roots and a few stones"
    const point = {
      ...newPoint("SP-1"),
      layers: [layer(0, 6, { remarks, redox: [{ notation: "7.5YR 4/6", percent: 5 }, { notation: "7.5YR 5/8", percent: 2 }] }), layer(6, 12)],
    }
    const form = formFor(project, point)
    const lines = printed(form, "remarks").filter(Boolean)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(" ")).toBe(remarks)
    for (const line of lines) expect(widthOf(line, soil.fontSize)).toBeLessThanOrEqual(room)
    // The layer has two rows (two redox colors), so two lines of remarks go there and the next layer is below them.
    expect(form.fields[fieldId(2, "depth")]).toBe("6-12")
  })

  test("remarks the layer has no rows for are cut with an ellipsis, with a warning", () => {
    const remarks = "word ".repeat(60).trim()
    const point = { ...newPoint("SP-1"), layers: [layer(0, 6, { remarks }), layer(6, 12)] }
    const form = formFor(project, point)
    expect(form.fields[fieldId(0, "remarks")]).toMatch(/\.\.\.$/)
    expect(widthOf(form.fields[fieldId(0, "remarks")], soil.fontSize)).toBeLessThanOrEqual(room)
    expect(form.fields[fieldId(1, "depth")]).toBe("6-12")
    expect(form.warnings.map((w) => [w.kind, w.layer])).toEqual([["remarks-cut", 0]])
  })

  test("the last layer may use the rows below it for its remarks", () => {
    const remarks = "word ".repeat(40).trim()
    const form = formFor(project, { ...newPoint("SP-1"), layers: [layer(0, 6, { remarks })] })
    expect(printed(form, "remarks").filter(Boolean).length).toBeGreaterThan(2)
    expect(printed(form, "remarks").filter(Boolean).join(" ")).toBe(remarks)
    expect(form.warnings).toEqual([])
  })

  test("a word wider than the column is broken inside, not run off the page", () => {
    const form = formFor(project, { ...newPoint("SP-1"), layers: [layer(0, 6, { remarks: "x".repeat(113) })] })
    for (const line of printed(form, "remarks").filter(Boolean)) expect(widthOf(line, soil.fontSize)).toBeLessThanOrEqual(room)
    expect(printed(form, "remarks").join("")).toBe("x".repeat(113))
  })

  test("characters the form's font cannot print are replaced, with a warning naming the layer", () => {
    const form = formFor(project, { ...newPoint("SP-1"), layers: [layer(0, 6, { remarks: "pH ≤ 5, → clay ½, café \u{1f600}" })] })
    expect(form.fields[fieldId(0, "remarks")]).toBe("pH <= 5, -> clay ½, café ?")
    expect(form.warnings.map((w) => [w.kind, w.layer])).toEqual([["text-changed", 0]])
  })

  test("a layer that would be cut by the end of the page is left off whole, and the last row says so", () => {
    // Ten one-row layers, then one with three redox colors that needs rows 10 to 12 of 11.
    const tall = layer(20, 24, { redox: ["10YR 5/8", "10YR 4/6", "7.5YR 4/6"].map((notation) => ({ notation, percent: 5 })) })
    const layers = [...Array.from({ length: 10 }, (_, i) => layer(i * 2, i * 2 + 2)), tall, layer(24, 30)]
    const form = formFor(project, { ...newPoint("SP-1"), layers })
    expect(printed(form, "depth")).toEqual([...Array.from({ length: 10 }, (_, i) => `${i * 2}-${i * 2 + 2}`), ""])
    expect(printed(form, "redoxColor")[10]).toBe("")
    expect(form.fields[fieldId(9, "remarks")]).toBe("continued: 2 more layers")
    expect(form.warnings.map((w) => w.kind)).toEqual(["too-many-rows"])
  })

  test("the note keeps its place when the last printed row already has remarks", () => {
    const layers = Array.from({ length: 13 }, (_, i) => layer(i * 2, i * 2 + 2, { remarks: i === 10 ? "very dark and sticky, with many roots to depth" : "" }))
    const form = formFor(project, { ...newPoint("SP-1"), layers })
    const last = form.fields[fieldId(10, "remarks")]
    expect(last).toMatch(/continued: 2 more layers$/)
    expect(last).toMatch(/^very dark/)
    expect(widthOf(last, soil.fontSize)).toBeLessThanOrEqual(room)
  })

  test("a long sampling point name is kept whole in the form's values", () => {
    const form = formFor(project, newPoint("Upland pit north of the culvert"))
    expect(form.fields["soil.samplingPoint"]).toBe("Upland pit north of the culvert")
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

describe("the indicators on the form", () => {
  const withChoices = (indicators: SamplingPoint["indicators"], hydricSoilPresent?: "yes" | "no"): SamplingPoint => ({
    ...JF1_POINT,
    ...(indicators ? { indicators } : {}),
    ...(hydricSoilPresent ? { hydricSoilPresent } : {}),
  })
  const ticks = (form: ReturnType<typeof formFor>) =>
    Object.entries(form.fields).filter(([id, text]) => id.startsWith("soil.indicator.") && text !== "").map(([id]) => id)

  test("every record of the region has a field, and so do Yes and No", () => {
    const form = formFor(JF1_PROJECT, JF1_POINT)
    const ids = Object.keys(form.fields).filter((id) => id.startsWith("soil.indicator."))
    expect(ids.sort()).toEqual(regionOf("NCNE").indicators.map((i) => indicatorFieldId(i.id)).sort())
    expect(ids).toHaveLength(34)
    expect(form.fields["soil.hydric.yes"]).toBe("")
    expect(form.fields["soil.hydric.no"]).toBe("")
  })

  test("a suggestion is not ticked, and goes on the cover note until the user confirms it", () => {
    const form = formFor(JF1_PROJECT, JF1_POINT)
    expect(ticks(form)).toEqual([])
    expect(form.hydric.cover.unconfirmed.map((s) => s.indicator)).toEqual(["A12"])
    expect(form.hydric.cover.unconfirmed[0].rule).toBe(regionOf("NCNE").indicators.find((i) => i.id === "A12")!.quote)
    expect(form.hydric.cover.ticked).toEqual([])
  })

  test("a confirmed suggestion is ticked, comes off the cover note, and makes Yes the suggested answer", () => {
    const form = formFor(JF1_PROJECT, withChoices({ A12: { state: "confirmed" } }))
    expect(ticks(form)).toEqual([indicatorFieldId("A12")])
    expect(form.fields[indicatorFieldId("A12")]).toBe("X")
    expect(form.hydric.cover).toEqual({ unconfirmed: [], ticked: [] })
    expect(form.hydric.conclusion).toMatchObject({ suggested: "yes", because: "Yes: A12 Thick Dark Surface is confirmed." })
    expect(form.hydric.conclusion.confirmed).toBeUndefined()
    // Suggested is not answered: nothing is printed in Yes or No.
    expect(form.fields["soil.hydric.yes"]).toBe("")
  })

  test("a rejected suggestion is not ticked and is not on the cover note", () => {
    const form = formFor(JF1_PROJECT, withChoices({ A12: { state: "rejected" } }))
    expect(ticks(form)).toEqual([])
    expect(form.hydric.cover).toEqual({ unconfirmed: [], ticked: [] })
    expect(form.hydric.conclusion.suggested).toBeNull()
  })

  test("an indicator the user ticks that the app did not suggest is ticked and goes on the cover note with the remark", () => {
    const form = formFor(JF1_PROJECT, withChoices({ A4: { state: "confirmed", manual: true, remark: "Rotten egg smell at 8 in" } }))
    expect(ticks(form)).toEqual([indicatorFieldId("A4")])
    expect(form.hydric.cover.ticked).toEqual([{ indicator: "A4", code: "A4", name: "Hydrogen Sulfide", remark: "Rotten egg smell at 8 in" }])
    expect(form.hydric.cover.unconfirmed.map((s) => s.indicator)).toEqual(["A12"])
    expect(form.hydric.conclusion.suggested).toBe("yes")
  })

  test("a remark with a character the font cannot print is warned about, because the cover note replaces it", () => {
    const form = formFor(JF1_PROJECT, withChoices({ A4: { state: "confirmed", manual: true, remark: "Smell at <= 8 in ≤ or so" } }))
    expect(form.warnings.map((w) => [w.kind, w.text])).toEqual([["text-changed", "The remark on A4 Hydrogen Sulfide has characters the form cannot print; they were replaced on the cover note."]])
    expect(formFor(JF1_PROJECT, withChoices({ A4: { state: "confirmed", manual: true, remark: "Plain ASCII" } })).warnings).toEqual([])
  })

  test("Other is ticked like any other, with its remark", () => {
    const form = formFor(JF1_PROJECT, withChoices({ other: { state: "confirmed", manual: true, remark: "Field-observed" } }))
    expect(form.fields[indicatorFieldId("other")]).toBe("X")
    expect(form.hydric.conclusion.because).toBe("Yes: Other (Explain in Remarks) is confirmed.")
  })

  test("Hydric Soil Present prints the user's answer and only that", () => {
    expect(formFor(JF1_PROJECT, withChoices(undefined, "yes")).fields).toMatchObject({ "soil.hydric.yes": "X", "soil.hydric.no": "" })
    expect(formFor(JF1_PROJECT, withChoices(undefined, "no")).fields).toMatchObject({ "soil.hydric.yes": "", "soil.hydric.no": "X" })
    expect(formFor(JF1_PROJECT, withChoices(undefined, "no")).hydric.conclusion.confirmed).toBe("no")
  })

  test("the printed profile does not change with the choices", () => {
    const plain = formFor(JF1_PROJECT, JF1_POINT).fields
    const chosen = formFor(JF1_PROJECT, withChoices({ A12: { state: "confirmed" } }, "yes")).fields
    for (const id of Object.keys(plain).filter((id) => id.startsWith("soil.profile."))) expect(chosen[id as FieldId], id).toBe(plain[id as FieldId])
  })
})
