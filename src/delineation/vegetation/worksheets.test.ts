// The worksheets, the indicators and the answer on the Vegetation page: where the page draws their blanks,
// what the form engine puts in them for JF-1 and for the supplement's worked example, and what the PDF holds.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { formFor } from "../formFor"
import { JF1_PLANTS_TYPED, JF1_POINT, JF1_PROJECT } from "../fixtures/jf1"
import { emptyHydrology, withVegetation, type SamplingPoint } from "../model"
import { regionOf } from "../regions"
import { pdfRules, type DrawnRule } from "../testing/pdfRules"
import { pdfText } from "../testing/pdfText"
import { emptyVegetation, plantEntryOf, type PlantEntry, type Vegetation } from "./entry"
import { loadPlantList } from "./loadPlantList"
import { resolvePlant } from "./plantList"
import type { Status } from "./status"
import type { Stratum } from "./strata"
import { vegetationPlacements } from "./vegetationPage"
import { vegetationPdf } from "./vegetationPdf"

const page = regionOf("NCNE").vegetation
const read = (name: string) => new Uint8Array(readFileSync(new URL(`../regions/ncne/${name}`, import.meta.url)))
const blank = { vegetation: read("vegetation-page.pdf"), continued: read("vegetation-continued-page.pdf") }
const list = await loadPlantList("NCNE")

const typed = (name: string, cover: number, stratum: Stratum = "herb", id = `${stratum}-${name}`): PlantEntry =>
  plantEntryOf(resolvePlant(list, name), id, stratum, name, cover)!

/** A plant with the status the supplement's example gives it, whatever the list says. */
const rated = (stratum: Stratum, name: string, status: Status, cover: number): PlantEntry => ({
  id: `${stratum}-${name}`,
  stratum,
  typed: name,
  name,
  status,
  listed: status,
  note: "",
  identified: "species",
  symbol: "",
  cover,
})

const pointWith = (change: (v: Vegetation) => Vegetation): SamplingPoint => withVegetation(JF1_POINT, (v) => change({ ...emptyVegetation, ...v }))
const jf1 = () => pointWith((v) => ({ ...v, plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)) }))

/** NCNE Table 3 (p. 27) and Table 4 (p. 29). */
const table3 = () =>
  pointWith((v) => ({
    ...v,
    plants: [
      rated("herb", "Impatiens capensis", "FACW", 15),
      rated("herb", "Geranium carolinianum", "UPL", 7),
      rated("herb", "Toxicodendron radicans", "FAC", 5),
      rated("herb", "Lonicera tatarica", "FACU", 2),
      rated("herb", "Glyceria striata", "OBL", 2),
      rated("herb", "Parthenocissus quinquefolia", "FACU", 1),
      rated("herb", "Arisaema triphyllum", "FACW", 0.5),
      rated("herb", "Carex laxiflora", "FACU", 0.5),
      rated("saplingShrub", "Carpinus caroliniana", "FAC", 35),
      rated("saplingShrub", "Carya ovata", "FACU", 10),
      rated("saplingShrub", "Acer saccharum", "FACU", 5),
      rated("saplingShrub", "Quercus rubra", "FACU", 5),
      rated("tree", "Quercus bicolor", "FACW", 40),
      rated("tree", "Fraxinus pennsylvanica", "FACW", 17),
      rated("tree", "Ulmus americana", "FACW", 10),
      rated("tree", "Carya ovata", "FACU", 8),
      rated("woodyVine", "Toxicodendron radicans", "FAC", 1),
    ],
  }))

const WORKSHEET_IDS = [
  "veg.dominance.a",
  "veg.dominance.b",
  "veg.dominance.percent",
  ...(["OBL", "FACW", "FAC", "FACU", "UPL"] as const).flatMap((s) => [`veg.prevalence.${s}.cover`, `veg.prevalence.${s}.product`]),
  "veg.prevalence.total.a",
  "veg.prevalence.total.b",
  "veg.prevalence.index",
] as const

const worksheet = (point: SamplingPoint) => {
  const { fields } = formFor(JF1_PROJECT, point)
  return Object.fromEntries(WORKSHEET_IDS.map((id) => [id, fields[id as keyof typeof fields]]))
}

describe("the blanks are where the page draws them", () => {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.3
  const drawn = (rules: DrawnRule[], box: { x: readonly [number, number]; rule: number }) => rules.some((r) => near(r.top, box.rule) && near(r.left, box.x[0]) && near(r.right, box.x[1]))

  test("every worksheet, indicator and answer box is a rule on the official page", async () => {
    const rules = await pdfRules(blank.vegetation)
    const { worksheets } = page
    const boxes = {
      "A": worksheets.dominance.a,
      "B": worksheets.dominance.b,
      "A/B": worksheets.dominance.percent,
      "totals A": worksheets.prevalence.totals.a,
      "totals B": worksheets.prevalence.totals.b,
      "index": worksheets.prevalence.index,
      "yes": worksheets.present.yes,
      "no": worksheets.present.no,
      ...Object.fromEntries(Object.entries(worksheets.prevalence.rows).flatMap(([status, row]) => [[`${status} cover`, row.cover], [`${status} product`, row.product]])),
      ...Object.fromEntries(Object.entries(worksheets.indicators).map(([id, box]) => [`indicator ${id}`, box])),
    }
    expect(Object.keys(boxes)).toHaveLength(8 + 10 + 5)
    for (const [name, box] of Object.entries(boxes)) expect(drawn(rules, box), name).toBe(true)
  })

  test("the labels beside them are the ones the form prints", async () => {
    const text = (await pdfText(blank.vegetation)).map((d) => d.text).join(" ")
    for (const label of ["Dominance Test worksheet:", "Prevalence Index worksheet:", "Rapid Test for Hydrophytic Vegetation", "Dominance Test is >50%", "Morphological Adaptations", "Problematic Hydrophytic Vegetation", "Hydrophytic", "Present?"]) {
      expect(text, label).toContain(label)
    }
  })
})

describe("JF-1", () => {
  const form = formFor(JF1_PROJECT, jf1())

  test("fall panicgrass is the only dominant: the Dominant Species? column and the Dominance Test worksheet", () => {
    const dominant = Array.from({ length: 9 }, (_, row) => form.fields[`veg.herb.${row}.dominant`])
    expect(dominant).toEqual(["Yes", "No", "No", "No", "No", "No", "No", "No", "No"])
    expect(worksheet(jf1())).toMatchObject({ "veg.dominance.a": "1", "veg.dominance.b": "1", "veg.dominance.percent": "100%" })
  })

  test("the Prevalence Index worksheet, with the FACW total 53 and stiff greenthread, not on the list, as UPL", () => {
    expect(worksheet(jf1())).toMatchObject({
      "veg.prevalence.OBL.cover": "0",
      "veg.prevalence.OBL.product": "0",
      "veg.prevalence.FACW.cover": "53",
      "veg.prevalence.FACW.product": "106",
      "veg.prevalence.FAC.cover": "18",
      "veg.prevalence.FAC.product": "54",
      "veg.prevalence.FACU.cover": "13",
      "veg.prevalence.FACU.product": "52",
      "veg.prevalence.UPL.cover": "1",
      "veg.prevalence.UPL.product": "5",
      "veg.prevalence.total.a": "85",
      "veg.prevalence.total.b": "217",
      "veg.prevalence.index": "2.55",
    })
  })

  test("stiff greenthread marked not identified is left out of the worksheet", () => {
    const marked = pointWith((v) => ({
      ...v,
      plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)).map((p) => (p.name === "Stiff greenthread" ? { ...p, identified: "none" as const } : p)),
    }))
    expect(worksheet(marked)).toMatchObject({
      "veg.prevalence.UPL.cover": "0",
      "veg.prevalence.total.a": "84",
      "veg.prevalence.total.b": "212",
      "veg.prevalence.index": "2.52",
    })
  })

  test("the rapid test and the dominance test are satisfied and suggested, and nothing is ticked until they are confirmed", () => {
    expect(form.vegetation.indicators.map((i) => [i.id, i.state, i.decision])).toEqual([
      ["rapid", "satisfied", "pending"],
      ["dominance", "satisfied", "pending"],
      ["prevalence", "not applied", "pending"],
      ["morphological", "yours", "pending"],
      ["problematic", "yours", "pending"],
    ])
    expect(Object.entries(form.fields).filter(([id, text]) => (id.startsWith("veg.indicator.") || id.startsWith("veg.present.")) && text !== "")).toEqual([])
    expect(form.vegetation.conclusion.suggested).toBe("yes")
    expect(form.vegetation.cover.unconfirmed.map((i) => i.id)).toEqual(["rapid", "dominance"])
  })

  test("the prevalence index is not applied, because the dominance test is satisfied", () => {
    const prevalence = form.vegetation.indicators.find((i) => i.id === "prevalence")!
    expect(prevalence.reason).toContain("Not needed: the dominance test is satisfied.")
    expect(form.vegetation.prevalenceApplied).toBe(false)
  })

  test("a point with no plants has nothing on the worksheets", () => {
    expect(Object.values(worksheet(JF1_POINT)).every((text) => text === "")).toBe(true)
  })
})

describe("the supplement's worked example", () => {
  test("5 dominants, 80 percent, A = 164, B = 451, 2.75, on the worksheets", () => {
    expect(worksheet(table3())).toEqual({
      "veg.dominance.a": "4",
      "veg.dominance.b": "5",
      "veg.dominance.percent": "80%",
      "veg.prevalence.OBL.cover": "2",
      "veg.prevalence.OBL.product": "2",
      "veg.prevalence.FACW.cover": "82.5",
      "veg.prevalence.FACW.product": "165",
      "veg.prevalence.FAC.cover": "41",
      "veg.prevalence.FAC.product": "123",
      "veg.prevalence.FACU.cover": "31.5",
      "veg.prevalence.FACU.product": "126",
      "veg.prevalence.UPL.cover": "7",
      "veg.prevalence.UPL.product": "35",
      "veg.prevalence.total.a": "164",
      "veg.prevalence.total.b": "451",
      "veg.prevalence.index": "2.75",
    })
  })

  test("the dominant column marks them, and the stratum under 5 percent is recorded and not used", () => {
    const form = formFor(JF1_PROJECT, table3())
    const column = (stratum: Stratum, rows: number) => Array.from({ length: rows }, (_, row) => form.fields[`veg.${stratum}.${row}.dominant`])
    expect(column("herb", 8)).toEqual(["Yes", "Yes", "No", "No", "No", "No", "No", "No"])
    expect(column("saplingShrub", 4)).toEqual(["Yes", "No", "No", "No"])
    expect(column("tree", 4)).toEqual(["Yes", "Yes", "No", "No"])
    expect(column("woodyVine", 1)).toEqual(["No"])
    expect(form.fields["veg.woodyVine.total"]).toBe("1")
  })

  test("a prevalence index that is not valid is left blank and warned about", () => {
    const point = pointWith((v) => ({ ...v, plants: [typed("Carex stricta", 20), typed("Unknown forb", 80)] }))
    const form = formFor(JF1_PROJECT, point)
    expect(form.fields["veg.prevalence.index"]).toBe("")
    expect(form.fields["veg.prevalence.total.a"]).toBe("20")
    expect(form.warnings.find((w) => w.kind === "veg-prevalence-invalid")!.text).toContain("Only 20% of the vegetation cover is identified and rated")
  })

  test("an index just over 3.0 is written with the digits that show it: A 250, B 751 is 3.004, not 3.00", () => {
    const point = pointWith((v) => ({ ...v, plants: [rated("herb", "F1", "FAC", 99), rated("herb", "F2", "FAC", 100), rated("herb", "F3", "FAC", 50), rated("herb", "U", "FACU", 1)] }))
    expect(worksheet(point)).toMatchObject({ "veg.prevalence.total.a": "250", "veg.prevalence.total.b": "751", "veg.prevalence.index": "3.004" })
    const exactly = pointWith((v) => ({ ...v, plants: [rated("herb", "F", "FAC", 100)] }))
    expect(worksheet(exactly)["veg.prevalence.index"]).toBe("3.00")
  })

  test("a dominant that is only identified to its genus is warned about", () => {
    const point = pointWith((v) => ({ ...v, plants: [typed("Sow thistle", 50), typed("Carex stricta", 5)] }))
    expect(formFor(JF1_PROJECT, point).warnings.find((w) => w.kind === "veg-dominant-identity")!.text).toContain("Sonchus spp. is a dominant species but is not identified to species")
  })
})

describe("confirming", () => {
  const confirmed = () =>
    pointWith((v) => ({
      ...v,
      plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)),
      indicators: { rapid: { state: "confirmed" }, dominance: { state: "confirmed" } },
      present: "yes",
    }))

  test("a confirmed indicator is ticked, comes off the cover note, and the user's Yes is printed", () => {
    const form = formFor(JF1_PROJECT, confirmed())
    expect(form.fields["veg.indicator.rapid"]).toBe("X")
    expect(form.fields["veg.indicator.dominance"]).toBe("X")
    expect(form.fields["veg.indicator.prevalence"]).toBe("")
    expect(form.fields["veg.present.yes"]).toBe("X")
    expect(form.fields["veg.present.no"]).toBe("")
    expect(form.vegetation.cover).toEqual({ unconfirmed: [], ticked: [], stale: [], prevalenceReason: "" })
  })

  test("the suggestion is not an answer: with no answer, neither Yes nor No is printed", () => {
    const form = formFor(JF1_PROJECT, pointWith((v) => ({ ...v, plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)) })))
    expect(form.vegetation.conclusion.suggested).toBe("yes")
    expect(form.fields["veg.present.yes"]).toBe("")
    expect(form.fields["veg.present.no"]).toBe("")
  })

  test("a rejected indicator is not ticked and is not on the cover note", () => {
    const form = formFor(JF1_PROJECT, pointWith((v) => ({ ...v, plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)), indicators: { rapid: { state: "rejected" }, dominance: { state: "confirmed" } } })))
    expect(form.fields["veg.indicator.rapid"]).toBe("")
    expect(form.vegetation.cover.unconfirmed).toEqual([])
  })
})

describe("the prevalence index is applied by the supplement's order, or by the user", () => {
  const failing = () => [rated("tree", "T1", "UPL", 10), rated("tree", "T2", "FACU", 10), rated("tree", "T3", "FACU", 10), rated("herb", "H", "OBL", 70)]
  const withIndicators = (extra: Partial<Vegetation>, soil = false, hydrology = false) => {
    const point = pointWith((v) => ({ ...v, plants: failing(), ...extra }))
    return { ...point, ...(soil ? { indicators: { A12: { state: "confirmed" as const } } } : {}), ...(hydrology ? { hydrology: { ...emptyHydrology, ticked: ["A1"] } } : {}) } as SamplingPoint
  }

  test("a failing dominance test with no hydric soil indicator and no hydrology: the index is not applied", () => {
    const form = formFor(JF1_PROJECT, withIndicators({}))
    expect(form.vegetation.prevalenceApplied).toBe(false)
    expect(form.vegetation.indicators.find((i) => i.id === "prevalence")!.state).toBe("not applied")
    expect(form.vegetation.conclusion.suggested).toBeNull()
  })

  test("with a confirmed hydric soil indicator and a primary hydrology indicator ticked: applied, satisfied, and Yes suggested", () => {
    const form = formFor(JF1_PROJECT, withIndicators({}, true, true))
    expect(form.vegetation.prevalenceApplied).toBe(true)
    expect(form.vegetation.indicators.find((i) => i.id === "prevalence")).toMatchObject({ state: "satisfied" })
    expect(form.vegetation.conclusion.suggested).toBe("yes")
  })

  test("a hydric soil indicator the user typed as Other does not count", () => {
    const point = { ...withIndicators({}, false, true), indicators: { other: { state: "confirmed" as const, manual: true, remark: "x" } } }
    expect(formFor(JF1_PROJECT, point).vegetation.prevalenceApplied).toBe(false)
  })

  test("a problematic-soil indicator does not open the gate, and is offered as the user's reason instead", () => {
    for (const id of ["A10", "S3"]) {
      const point = { ...withIndicators({}, false, true), indicators: { [id]: { state: "confirmed" as const } } }
      const form = formFor(JF1_PROJECT, point)
      expect(form.vegetation.prevalenceApplied, id).toBe(false)
      expect(form.vegetation.indicators.find((i) => i.id === "prevalence")!.reason).toContain("Missing: a hydric soil indicator (a problematic-soil indicator does not count).")
      expect(form.vegetation.offeredReason).toContain(`Problematic hydric soil indicator confirmed: ${id} `)
    }
    expect(formFor(JF1_PROJECT, withIndicators({}, true, true)).vegetation.offeredReason).toBe("")
    expect(formFor(JF1_PROJECT, withIndicators({}, false, true)).vegetation.offeredReason).toBe("")
  })

  test("a problematic-soil indicator does not let a morphological tick count towards Yes either", () => {
    const morph = { indicators: { morphological: { state: "confirmed" as const, manual: true, remark: "Adventitious roots" } } }
    const failingDry = [rated("herb", "U", "UPL", 60), rated("herb", "F", "FACU", 40)]
    const base = pointWith((v) => ({ ...v, plants: failingDry, ...morph }))
    const point = { ...base, indicators: { A10: { state: "confirmed" as const } }, hydrology: { ...emptyHydrology, ticked: ["A1"] } } as SamplingPoint
    expect(formFor(JF1_PROJECT, point).vegetation.conclusion.suggested).toBeNull()
    const hydric = { ...point, indicators: { A12: { state: "confirmed" as const } } } as SamplingPoint
    expect(formFor(JF1_PROJECT, hydric).vegetation.conclusion.suggested).toBe("yes")
  })

  test("the user can apply it anyway with a reason, and the reason is on the cover note", () => {
    const form = formFor(JF1_PROJECT, withIndicators({ prevalenceReason: "  Hydric soil confirmed on the next point  " }))
    expect(form.vegetation.prevalenceApplied).toBe(true)
    expect(form.vegetation.overridden).toBe(true)
    expect(form.vegetation.cover.prevalenceReason).toBe("Hydric soil confirmed on the next point")
  })

  test("a reason kept where the supplement's own order applies the index is no override, and is not on the cover note", () => {
    const form = formFor(JF1_PROJECT, withIndicators({ prevalenceReason: "Soil and hydrology on the next point" }, true, true))
    expect(form.vegetation.prevalenceApplied).toBe(true)
    expect(form.vegetation.overridden).toBe(false)
    expect(form.vegetation.cover.prevalenceReason).toBe("")
    expect(form.vegetation.indicators.find((i) => i.id === "prevalence")!.reason).not.toContain("Applied at your request")
  })

  test("a reason where the dominance test passes is an override: the order would not apply the index", () => {
    const passing = pointWith((v) => ({ ...v, plants: [rated("herb", "H", "OBL", 70)], prevalenceReason: "Check the index" }))
    const point = { ...passing, indicators: { A12: { state: "confirmed" as const } }, hydrology: { ...emptyHydrology, ticked: ["A1"] } } as SamplingPoint
    const form = formFor(JF1_PROJECT, point)
    expect(form.vegetation.overridden).toBe(true)
    expect(form.vegetation.cover.prevalenceReason).toBe("Check the index")
  })
})

describe("the Vegetation page's drawing", () => {
  test("worksheet values sit on their rules, and a blank value draws nothing", () => {
    const form = formFor(JF1_PROJECT, jf1())
    const { vegetation } = vegetationPlacements(JF1_PROJECT, form)
    const at = (id: string) => vegetation.find((p) => p.id === id)
    const { worksheets } = page
    expect(at("veg.dominance.percent")).toMatchObject({ text: "100%", x: worksheets.dominance.percent.x[0] + page.inset, baseline: worksheets.dominance.percent.rule - page.aboveRule })
    expect(at("veg.prevalence.index")).toMatchObject({ text: "2.55", baseline: worksheets.prevalence.index.rule - page.aboveRule })
    expect(at("veg.prevalence.FACW.cover")).toMatchObject({ text: "53", x: worksheets.prevalence.rows.FACW.cover.x[0] + page.inset })
    expect(at("veg.herb.0.dominant")).toMatchObject({ text: "Yes", x: page.columns.dominant[0] + page.inset })
    const empty = vegetationPlacements(JF1_PROJECT, formFor(JF1_PROJECT, JF1_POINT)).vegetation
    expect(empty.map((p) => p.id)).toEqual(["veg.samplingPoint"])
  })

  test("a tick is an X centered on its blank, just above its line, drawn only when confirmed", () => {
    const point = pointWith((v) => ({ ...v, plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)), indicators: { dominance: { state: "confirmed" } }, present: "no" }))
    const { vegetation } = vegetationPlacements(JF1_PROJECT, formFor(JF1_PROJECT, point))
    const ticks = vegetation.filter((p) => p.text === "X")
    expect(ticks.map((t) => t.id)).toEqual(["veg.indicator.dominance", "veg.present.no"])
    const [dominance, no] = ticks
    const { dominance: box } = page.worksheets.indicators
    expect(dominance.x + 3.0015).toBeCloseTo((box.x[0] + box.x[1]) / 2, 2)
    expect(dominance.baseline).toBeCloseTo(box.rule - page.worksheets.tick.aboveRule, 2)
    expect(no.x + 3.0015).toBeCloseTo((page.worksheets.present.no.x[0] + page.worksheets.present.no.x[1]) / 2, 2)
  })
})

describe("the PDF and its cover note", () => {
  const pdf = async (point: SamplingPoint) => vegetationPdf(blank, JF1_PROJECT, point, formFor(JF1_PROJECT, point))
  const pages = async (bytes: Uint8Array) => (await (await import("pdf-lib")).PDFDocument.load(bytes)).getPageCount()
  const confirmedJf1 = (extra: Partial<Vegetation> = {}) =>
    pointWith((v) => ({ ...v, plants: JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)), indicators: { rapid: { state: "confirmed" }, dominance: { state: "confirmed" } }, present: "yes", ...extra }))

  test("the worksheet values and the Xs are on the page, read back from the PDF", async () => {
    const bytes = await pdf(confirmedJf1())
    const text = await pdfText(bytes, 1)
    const placed = vegetationPlacements(JF1_PROJECT, formFor(JF1_PROJECT, confirmedJf1())).vegetation
    const mine = text.slice(-placed.length)
    placed.forEach((p, i) => {
      expect(mine[i].text).toBe(p.text)
      expect(mine[i].x).toBeCloseTo(p.x, 1)
      expect(mine[i].baseline).toBeCloseTo(p.baseline, 1)
    })
    for (const value of ["100%", "2.55", "217", "85", "Yes"]) expect(mine.map((d) => d.text), value).toContain(value)
    expect(mine.filter((d) => d.text === "X")).toHaveLength(3)
  })

  test("everything confirmed: one page, no cover note", async () => {
    expect(await pages(await pdf(confirmedJf1()))).toBe(1)
  })

  test("suggestions not confirmed go on a cover note, with the numbers, the rule and where it is", async () => {
    const bytes = await pdf(jf1())
    expect(await pages(bytes)).toBe(2)
    const note = (await pdfText(bytes, 2)).map((d) => d.text).join(" ")
    expect(note).toContain("Cover note: hydrophytic vegetation")
    expect(note).toContain("Suggested by the app, not confirmed")
    expect(note).toContain("1 - Rapid Test for Hydrophytic Vegetation")
    expect(note).toContain("All 1 dominant species is OBL or FACW.")
    expect(note).toContain("2 - Dominance Test is >50%")
    expect(note).toContain("1 of 1 dominant species is OBL, FACW or FAC: 100 percent.")
    expect(note).toContain("Rule: More than 50 percent of the dominant plant species across all strata are rated OBL, FACW, or FAC.")
    expect(note).toContain("Source: Northcentral and Northeast Regional Supplement, ERDC/EL TR-12-1, Version 2.0 (2012), p. 25")
    expect(note).not.toContain("Ticked by the user")
  })

  test("the user's own tick and the reason the index was applied are on the cover note", async () => {
    const bytes = await pdf(
      confirmedJf1({
        indicators: { rapid: { state: "confirmed" }, dominance: { state: "confirmed" }, morphological: { state: "confirmed", manual: true, remark: "Adventitious roots on 80% of the Cirsium" } },
        prevalenceReason: "Checking the arithmetic",
      }),
    )
    const note = (await pdfText(bytes, 2)).map((d) => d.text).join(" ")
    expect(note).toContain("Ticked by the user")
    expect(note).toContain("4 - Morphological Adaptations")
    expect(note).toContain("The user's reason: Adventitious roots on 80% of the Cirsium")
    expect(note).toContain("Prevalence index applied by the user")
    expect(note).toContain("Checking the arithmetic")
    expect((await pdfText(bytes, 1)).filter((d) => d.text === "X")).toHaveLength(4)
  })

  test("with more plants than the first page holds, the cover note follows the Continued page", async () => {
    const many = pointWith((v) => ({ ...v, plants: [...JF1_PLANTS_TYPED.map(([name, cover]) => typed(name, cover)), ...Array.from({ length: 5 }, (_, i) => rated("herb", `Filler ${i}`, "FACU", 0.1))] }))
    const bytes = await pdf(many)
    expect(await pages(bytes)).toBe(3)
    expect((await pdfText(bytes, 2)).some((d) => d.text.includes("VEGETATION Continued"))).toBe(true)
    expect((await pdfText(bytes, 3)).some((d) => d.text.includes("Cover note: hydrophytic vegetation"))).toBe(true)
  })
})
