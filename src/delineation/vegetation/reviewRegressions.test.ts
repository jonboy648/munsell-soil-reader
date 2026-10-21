// PR74 review regressions through the form engine and the exported official Vegetation page.
import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import { formFor } from "../formFor"
import { JF1_POINT, JF1_PROJECT } from "../fixtures/jf1"
import { withVegetation } from "../model"
import { pdfText } from "../testing/pdfText"
import { emptyVegetation, type PlantEntry } from "./entry"
import type { Status } from "./status"
import { vegetationPdf } from "./vegetationPdf"

const plant = (id: string, name: string, status: Status, cover: number, extra: Partial<PlantEntry> = {}): PlantEntry => ({
  id, name, typed: name, status, listed: status, note: "", identified: "species", symbol: "", stratum: "herb", cover, ...extra,
})

const pointWith = (plants: PlantEntry[]) => withVegetation(JF1_POINT, () => ({ ...emptyVegetation, plants }))

test("duplicate rows of one species cannot turn a failed dominance test into a pass", () => {
  const point = pointWith([
    plant("setaria-1", "Setaria pumila", "FAC", 10),
    plant("setaria-2", "Setaria pumila", "FAC", 10),
    plant("zea", "Zea mays", "UPL", 30),
  ])
  const form = formFor(JF1_PROJECT, point)
  expect(form.vegetation.dominance).toMatchObject({ a: 1, b: 2, passes: false, percent: 50 })
  expect(form.vegetation.conclusion.suggested).toBeNull()
  expect(form.fields["veg.dominance.a"]).toBe("1")
  expect(form.fields["veg.dominance.b"]).toBe("2")
  // Both entered rows describe the same dominant species; neither may be falsely printed as No.
  expect(form.fields["veg.herb.0.dominant"]).toBe("Yes")
  expect(form.fields["veg.herb.1.dominant"]).toBe("Yes")
  expect(form.vegetation.dominance.dominants.find((d) => d.id === "setaria-1")?.cover).toBe(20)
})

test("duplicate species names are matched despite case and spacing differences", () => {
  const form = formFor(JF1_PROJECT, pointWith([
    plant("setaria-1", "Setaria pumila", "FAC", 10),
    plant("setaria-2", " setaria   PUMILA ", "FAC", 10),
    plant("zea", "Zea mays", "UPL", 30),
  ]))
  expect(form.vegetation.dominance).toMatchObject({ a: 1, b: 2, passes: false })
})

test("one species dominant in two strata is still counted once in each stratum", () => {
  const form = formFor(JF1_PROJECT, pointWith([
    plant("setaria-herb", "Setaria pumila", "FAC", 10),
    plant("setaria-tree", "Setaria pumila", "FAC", 10, { stratum: "tree" }),
    plant("zea", "Zea mays", "UPL", 30),
  ]))
  expect(form.vegetation.dominance).toMatchObject({ a: 2, b: 3, passes: true })
})

test("different species sharing a list symbol are not combined", () => {
  const form = formFor(JF1_PROJECT, pointWith([
    plant("one", "Species one", "FAC", 10, { symbol: "SHARED" }),
    plant("two", "Species two", "FAC", 10, { symbol: "SHARED" }),
    plant("zea", "Zea mays", "UPL", 30),
  ]))
  expect(form.vegetation.dominance).toMatchObject({ a: 2, b: 3, passes: true })
})

test("unidentified rows with the same description are not assumed to be one species", () => {
  const form = formFor(JF1_PROJECT, pointWith([
    plant("unknown-1", "Unknown forb", "UPL", 10, { identified: "none" }),
    plant("unknown-2", "Unknown forb", "UPL", 10, { identified: "none" }),
    plant("carex", "Carex stricta", "OBL", 30),
  ]))
  expect(form.vegetation.dominance).toMatchObject({ a: 1, b: 3, passes: false })
})

test("genus-only rows are not assumed to describe the same species", () => {
  const form = formFor(JF1_PROJECT, pointWith([
    plant("sonchus-1", "Sonchus spp.", "FACU", 10, { identified: "genus" }),
    plant("sonchus-2", "Sonchus spp.", "FACU", 10, { identified: "genus" }),
    plant("carex", "Carex stricta", "OBL", 30),
  ]))
  expect(form.vegetation.dominance).toMatchObject({ a: 1, b: 3, passes: false })
  expect(form.vegetation.prevalence).toMatchObject({ a: 50, b: 110, identified: 100 })
})

const precisionPoint = () => pointWith([
  plant("setaria", "Setaria pumila", "FAC", 99.999),
  plant("cirsium", "Cirsium arvense", "FACU", 0.001),
])

test.each([
  [10.0006, 20.0006, "30.002"],
  [10.0004, 20.0004, "30"],
  [0.0006, 0.0006, "0.002"],
  [10.001, 20.002, "30.003"],
])("stratum total uses the printed row precision for %s and %s", (first, second, total) => {
  const form = formFor(JF1_PROJECT, pointWith([
    plant("first", "Species one", "FAC", first),
    plant("second", "Species two", "FAC", second),
  ]))
  expect(form.fields["veg.herb.total"]).toBe(total)
  const printedRows = Number(form.fields["veg.herb.0.cover"]) + Number(form.fields["veg.herb.1.cover"])
  expect(Number(form.fields["veg.herb.total"])).toBeCloseTo(printedRows, 10)
  expect(form.vegetation.dominance.strata.find((stratum) => stratum.stratum === "herb")?.total).toBe(Number(total))
  expect(form.fields["veg.prevalence.total.a"]).toBe(total)
})

test("the worksheet preserves the operands behind an index just over three", () => {
  const form = formFor(JF1_PROJECT, precisionPoint())
  expect(form.fields).toMatchObject({
    "veg.herb.0.cover": "99.999",
    "veg.herb.1.cover": "0.001",
    "veg.prevalence.FAC.cover": "99.999",
    "veg.prevalence.FAC.product": "299.997",
    "veg.prevalence.FACU.cover": "0.001",
    "veg.prevalence.FACU.product": "0.004",
    "veg.prevalence.total.a": "100",
    "veg.prevalence.total.b": "300.001",
    "veg.prevalence.index": "3.00001",
  })
  expect(form.vegetation.prevalence.passes).toBe(false)
})

test("the official PDF keeps the worksheet operands and index at the same precision", async () => {
  const point = precisionPoint()
  const read = (name: string) => new Uint8Array(readFileSync(new URL(`../regions/ncne/${name}`, import.meta.url)))
  const bytes = await vegetationPdf(
    { vegetation: read("vegetation-page.pdf"), continued: read("vegetation-continued-page.pdf") },
    JF1_PROJECT, point, formFor(JF1_PROJECT, point),
  )
  const texts = (await pdfText(bytes)).map((item) => item.text)
  for (const value of ["99.999", "0.001", "299.997", "0.004", "300.001", "3.00001"]) expect(texts).toContain(value)
})
