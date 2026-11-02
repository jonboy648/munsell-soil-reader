// The Vegetation pages from a sampling point's plants: the form engine's fields, where each value is
// drawn, and the PDF read back. JF-1's herb stratum, typed as Jon wrote it, is the case.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { formFor } from "../formFor"
import { JF1_PLANTS_TYPED, JF1_POINT, JF1_PROJECT, JF1_REMARKS } from "../fixtures/jf1"
import { withVegetation, type SamplingPoint } from "../model"
import { regionOf } from "../regions"
import { pdfText } from "../testing/pdfText"
import { emptyVegetation, plantEntryOf, type PlantEntry } from "./entry"
import { loadPlantList } from "./loadPlantList"
import { resolvePlant } from "./plantList"
import type { Stratum } from "./strata"
import { widthOf } from "../text"
import { vegetationPlacements } from "./vegetationPage"
import { vegetationPdf } from "./vegetationPdf"

const read = (name: string) => readFileSync(new URL(`../regions/ncne/${name}`, import.meta.url))
const blank = { vegetation: read("vegetation-page.pdf"), continued: read("vegetation-continued-page.pdf") }

const list = await loadPlantList("NCNE")

/** A plant as the Vegetation entry makes it: the name typed, resolved against the real list. */
const plant = (typed: string, cover: number, stratum: Stratum = "herb", id = `${stratum}-${typed}`): PlantEntry =>
  plantEntryOf(resolvePlant(list, typed), id, stratum, typed, cover)!

const withPlants = (plants: PlantEntry[], remarks = "", point: SamplingPoint = JF1_POINT): SamplingPoint =>
  withVegetation(point, () => ({ ...emptyVegetation, plants, remarks }))

const jf1 = () => withPlants(JF1_PLANTS_TYPED.map(([name, cover]) => plant(name, cover)), JF1_REMARKS)

describe("JF-1's herb stratum on the form", () => {
  const form = formFor(JF1_PROJECT, jf1())

  test("each plant is a row of the herb stratum: scientific name, cover, whether it is dominant, status", () => {
    const row = (n: number) => (["name", "cover", "dominant", "status"] as const).map((c) => form.fields[`veg.herb.${n}.${c}`])
    // Fall panicgrass is 50 of 85, over the 42.5 line; nothing else reaches 17.
    expect(row(0)).toEqual(["Panicum dichotomiflorum", "50", "Yes", "FACW"])
    expect(row(1)).toEqual(["Setaria pumila", "10", "No", "FAC"])
    expect(row(2)).toEqual(["Phalaris arundinacea", "3", "No", "FACW"])
    expect(row(6)).toEqual(["Sonchus spp.", "2", "No", "FACU"])
    expect(row(8)).toEqual(["Stiff greenthread", "1", "No", "UPL"])
    expect(row(9)).toEqual(["", "", "", ""])
  })

  test("the stratum has its plot size and total cover, the others are blank, and the page says whose it is", () => {
    expect(form.fields["veg.herb.plotSize"]).toBe("5 ft radius")
    expect(form.fields["veg.herb.total"]).toBe("85")
    for (const stratum of ["tree", "saplingShrub", "woodyVine"] as const) {
      expect(form.fields[`veg.${stratum}.plotSize`]).toBe("")
      expect(form.fields[`veg.${stratum}.total`]).toBe("")
      expect(form.fields[`veg.${stratum}.0.name`]).toBe("")
    }
    expect(form.fields["veg.samplingPoint"]).toBe("JF-1")
    expect(form.fields["veg.remarks"]).toBe("Bare ground - 10%")
  })

  test("the plants that need a word are warned about: one not on the list, one identified to the genus only", () => {
    const veg = form.warnings.filter((w) => w.kind.startsWith("veg-"))
    expect(veg.map((w) => w.kind).sort()).toEqual(["veg-genus", "veg-unlisted"])
    expect(veg.find((w) => w.kind === "veg-unlisted")!.text).toBe("Stiff greenthread: not on the plant list, so it is counted as UPL (supplement pp. 22-23).")
    expect(veg.find((w) => w.kind === "veg-genus")!.text).toContain("Sonchus spp.")
  })

  test("a plot size the user wrote is kept, and a stratum without plants prints no plot size of its own accord", () => {
    const written = withVegetation(jf1(), (v) => ({ ...v, plotSizes: { herb: "1 m radius", tree: "9 m radius" } }))
    const f = formFor(JF1_PROJECT, written)
    expect(f.fields["veg.herb.plotSize"]).toBe("1 m radius")
    expect(f.fields["veg.tree.plotSize"]).toBe("9 m radius")
    expect(f.fields["veg.saplingShrub.plotSize"]).toBe("")
  })

  test("a plant left out of the arithmetic (NI or NO, nothing adjacent) prints what the list says as its status", () => {
    const left = { ...plant("Phalaris arundinacea", 5), status: null, listed: "NI" } as PlantEntry
    const f = formFor(JF1_PROJECT, withPlants([left]))
    expect(f.fields["veg.herb.0.status"]).toBe("NI")
    expect(f.warnings.some((w) => w.kind === "veg-left-out")).toBe(true)
  })

  test("a point with no plants and no remarks has only its name on the Vegetation page", () => {
    const f = formFor(JF1_PROJECT, JF1_POINT)
    const filled = Object.entries(f.fields).filter(([id, text]) => id.startsWith("veg.") && text !== "")
    expect(filled).toEqual([["veg.samplingPoint", "JF-1"]])
    expect(f.warnings).toEqual([])
  })
})

describe("where the values are drawn", () => {
  const page = regionOf("NCNE").vegetation
  const placements = vegetationPlacements(JF1_PROJECT, formFor(JF1_PROJECT, jf1()))
  const at = (id: string) => placements.vegetation.find((p) => p.id === id)!

  test("a value sits in its column, just above its row's rule, in the form's text size", () => {
    const rule = page.strata.herb.rowRules[0]
    expect(at("veg.herb.0.name")).toMatchObject({ text: "Panicum dichotomiflorum", x: page.columns.name[0] + page.inset, baseline: rule - page.aboveRule, size: 8 })
    expect(at("veg.herb.0.cover").x).toBeCloseTo(page.columns.cover[0] + page.inset)
    expect(at("veg.herb.0.status").x).toBeCloseTo(page.columns.status[0] + page.inset)
    expect(placements.vegetation.some((p) => p.id.startsWith("veg.herb.9."))).toBe(false) // a blank row prints nothing
  })

  test("the total is on the stratum's total rule under the cover column, the plot size on its own rule", () => {
    expect(at("veg.herb.total")).toMatchObject({ text: "85", x: page.columns.cover[0] + page.inset, baseline: page.strata.herb.totalRule - page.aboveRule })
    expect(at("veg.herb.plotSize")).toMatchObject({ text: "5 ft radius", x: page.strata.herb.plotSize.span[0] + page.inset, baseline: page.strata.herb.plotSize.rule - page.aboveRule })
    expect(at("veg.samplingPoint")).toMatchObject({ text: "JF-1", baseline: page.samplingPoint.rule - page.aboveRule })
  })

  test("a name too wide for its column is drawn smaller, to fit, and never wider", () => {
    const wide = `Carex ${"w".repeat(60)}`
    const p = vegetationPlacements(JF1_PROJECT, formFor(JF1_PROJECT, withPlants([plant(wide, 5, "herb", "w")]))).vegetation.find((q) => q.id === "veg.herb.0.name")!
    expect(p.size).toBeLessThan(page.fontSize)
    expect(widthOf(p.text, p.size)).toBeLessThanOrEqual(p.maxWidth + 0.01)
  })

  test("nine plants fit on the first page: there is no Continued page", () => {
    expect(placements.continued).toBeNull()
  })

  test("more plants than a stratum's rows go to the Continued page, in the same rows, with the total repeated", () => {
    const many = Array.from({ length: 15 }, (_, i) => plant("Carex nonexistentus", i + 1, "herb", `h${i}`))
    const form = formFor(JF1_PROJECT, withPlants(many))
    const split = vegetationPlacements(JF1_PROJECT, form)
    const rows = page.strata.herb.rowRules
    expect(rows).toHaveLength(12)
    // Plant 13 is the first row of the Continued page, at the first row's place.
    expect(split.continued!.find((p) => p.id === "veg.herb.12.cover")).toMatchObject({ text: "13", baseline: rows[0] - page.aboveRule })
    expect(split.continued!.find((p) => p.id === "veg.herb.14.cover")).toMatchObject({ text: "15", baseline: rows[2] - page.aboveRule })
    expect(split.vegetation.some((p) => p.id === "veg.herb.12.cover")).toBe(false)
    expect(split.vegetation.find((p) => p.id === "veg.herb.total")!.text).toBe("120")
    expect(split.continued!.find((p) => p.id === "veg.herb.total")!.text).toBe("120")
    expect(split.continued!.find((p) => p.id === "veg.samplingPoint")!.text).toBe("JF-1")
  })

  test("more plants than the two pages hold are warned about, and the rest are left off", () => {
    const many = Array.from({ length: 26 }, (_, i) => plant("Carex nonexistentus", 1, "herb", `h${i}`))
    const form = formFor(JF1_PROJECT, withPlants(many))
    expect(form.warnings.find((w) => w.kind === "veg-overflow")!.text).toContain("26 plants and the form holds 24")
    expect(form.fields["veg.herb.23.cover"]).toBe("1")
    expect(form.fields["veg.herb.24.cover" as keyof typeof form.fields]).toBeUndefined()
    expect(form.fields["veg.herb.total"]).toBe("26") // every plant counts toward the total, on the page or not
  })
})

describe("the Remarks", () => {
  const remarkLines = (text: string) =>
    vegetationPlacements(JF1_PROJECT, formFor(JF1_PROJECT, withPlants([], text))).vegetation.filter((p) => p.id.startsWith("veg.remarks."))

  test("short remarks are one line at the left of the box, below its label", () => {
    const [line] = remarkLines("Bare ground - 10%")
    expect(line).toMatchObject({ text: "Bare ground - 10%", x: 40, baseline: 668, size: 8 })
  })

  test("long remarks wrap inside the box, line breaks are kept, and what does not fit is left off", () => {
    const { remarks } = regionOf("NCNE").vegetation
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ")
    const lines = remarkLines(`First line\nSecond line\n${long}`)
    expect(lines.map((l) => l.text).slice(0, 2)).toEqual(["First line", "Second line"])
    expect(lines).toHaveLength(8)
    for (const line of lines) expect(widthOf(line.text, 8)).toBeLessThanOrEqual(remarks.right - remarks.left + 0.01)
    expect(lines[7].baseline).toBeLessThanOrEqual(remarks.lastBaseline)
  })

  test("remarks longer than the box are warned about, and what the form cannot print is replaced, with a warning", () => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ")
    expect(formFor(JF1_PROJECT, withPlants([], long)).warnings.map((w) => w.kind)).toEqual(["veg-remarks-cut"])
    const f = formFor(JF1_PROJECT, withPlants([], "Lady’s thumb 中"))
    expect(f.fields["veg.remarks"]).toBe("Lady’s thumb ?")
    expect(f.warnings.map((w) => w.kind)).toEqual(["text-changed"])
  })
})

describe("the Vegetation PDF", () => {
  const form = formFor(JF1_PROJECT, jf1())
  const point = jf1()

  test("the official page is still there, with the plants drawn after it, in drawing order, where they were placed", async () => {
    const bytes = await vegetationPdf(blank, JF1_PROJECT, point, form)
    const drawn = await pdfText(bytes, 1)
    expect(drawn.some((d) => d.text.includes("VEGETATION"))).toBe(true)
    expect(drawn.some((d) => d.text.includes("ENG FORM 6116-8"))).toBe(true)
    const placed = vegetationPlacements(JF1_PROJECT, form).vegetation
    const mine = drawn.slice(-placed.length)
    placed.forEach((p, i) => {
      expect(mine[i].text).toBe(p.text)
      expect(mine[i].x).toBeCloseTo(p.x, 1)
      expect(mine[i].baseline).toBeCloseTo(p.baseline, 1)
    })
    expect(placed.map((p) => p.text)).toEqual(expect.arrayContaining(["Panicum dichotomiflorum", "50", "FACW", "Phalaris arundinacea", "85", "5 ft radius", "Bare ground - 10%", "JF-1"]))
  })

  test("vegetation and continued pages are followed by a note for the pending parameter", async () => {
    // Confirmed indicators do not confirm the parameter answer.
    const confirmed = withVegetation(point, (v) => ({ ...v, indicators: { rapid: { state: "confirmed" }, dominance: { state: "confirmed" } } }))
    const confirmedBytes = await vegetationPdf(blank, JF1_PROJECT, confirmed, formFor(JF1_PROJECT, confirmed))
    expect(await pageCount(confirmedBytes)).toBe(2)
    expect((await pdfText(confirmedBytes, 2)).map((t) => t.text).join(" ")).toContain("Hydrophytic Vegetation Present?")
    const many = withPlants(Array.from({ length: 14 }, (_, i) => plant("Carex nonexistentus", 2, "herb", `h${i}`)))
    const bytes = await vegetationPdf(blank, JF1_PROJECT, many, formFor(JF1_PROJECT, many))
    expect(await pageCount(bytes)).toBe(3)
    const second = await pdfText(bytes, 2)
    expect(second.some((d) => d.text.includes("VEGETATION Continued"))).toBe(true)
    expect(second.filter((d) => d.text === "Carex nonexistentus")).toHaveLength(2) // plants 13 and 14
    expect(second.some((d) => d.text === "28")).toBe(true) // the herb total, repeated
    expect((await pdfText(bytes, 3)).map((t) => t.text).join(" ")).toContain("Hydrophytic Vegetation Present?")
  })

  test("a point with no plants is the blank page with its name on it", async () => {
    const bytes = await vegetationPdf(blank, JF1_PROJECT, JF1_POINT, formFor(JF1_PROJECT, JF1_POINT))
    const drawn = await pdfText(bytes, 1)
    const original = await pdfText(new Uint8Array(blank.vegetation), 1)
    expect(drawn.map((d) => d.text)).toEqual([...original.map((d) => d.text), "JF-1"])
  })
})

async function pageCount(bytes: Uint8Array): Promise<number> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  return (await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise).numPages
}
