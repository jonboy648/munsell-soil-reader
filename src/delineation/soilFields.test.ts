// The rest of the profile row: texture, redox type and location, the restrictive layer, and colors typed in.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { fieldId, formFor } from "./formFor"
import { layerOfDraft, emptyLayerDraft, draftOfLayer, type LayerDraft } from "./layerDraft"
import { newPoint, newProject, type Layer, type SamplingPoint } from "./model"
import { soilPagePdf } from "./pdf"
import { regionOf } from "./regions"
import { printedTexture, soilPlacements } from "./soilPage"
import { pdfText } from "./testing/pdfText"
import { widthOf } from "./text"

const project = newProject("Pond", "NCNE")
const { soil } = regionOf("NCNE")
const blank = readFileSync(new URL("./regions/ncne/soil-page.pdf", import.meta.url))

const layer = (top: number, bottom: number, extra: Partial<Layer> = {}): Layer => ({
  id: `${top}-${bottom}`,
  top,
  bottom,
  matrix: { notation: "10YR 4/2", percent: 100 },
  redox: [],
  remarks: "",
  ...extra,
})
const point = (layers: Layer[], extra: Partial<SamplingPoint> = {}): SamplingPoint => ({ ...newPoint("SP-1"), layers, ...extra })

describe("texture and the redox codes in the profile row", () => {
  const p = point([
    layer(0, 8, { texture: "clay loam" }),
    layer(8, 20, {
      texture: "mucky silt loam",
      redox: [
        { notation: "7.5YR 4/6", percent: 5, type: "C", location: "PL" },
        { notation: "10YR 5/1", percent: 10, type: "D", location: "M" },
        { notation: "5YR 4/6", percent: 2 },
      ],
    }),
  ])
  const form = formFor(project, p)

  test("the texture is on its layer's row, and the type and location on their redox color's row", () => {
    expect(form.fields[fieldId(0, "texture")]).toBe("clay loam")
    expect([0, 1, 2, 3].map((r) => form.fields[fieldId(r, "texture")])).toEqual(["clay loam", "mucky silt loam", "", ""])
    expect([1, 2, 3].map((r) => [form.fields[fieldId(r, "redoxColor")], form.fields[fieldId(r, "redoxType")], form.fields[fieldId(r, "redoxLoc")]])).toEqual([
      ["7.5YR 4/6", "C", "PL"],
      ["10YR 5/1", "D", "M"],
      ["5YR 4/6", "", ""],
    ])
    expect(form.fields[fieldId(0, "redoxType")]).toBe("")
  })

  test("a layer with no texture or codes recorded leaves those cells blank", () => {
    const plain = formFor(project, point([layer(0, 6)]))
    expect(plain.fields[fieldId(0, "texture")]).toBe("")
    expect(plain.fields[fieldId(0, "redoxType")]).toBe("")
  })

  test("the texture prints in its column; a term too long to read there prints as its Field Book code", () => {
    const room = soil.columns.texture[1] - soil.columns.texture[0] - 2 * soil.inset
    expect(printedTexture("clay loam", room, soil.fontSize)).toBe("clay loam")
    expect(printedTexture("mucky silty clay loam", room, soil.fontSize)).toBe("mucky silty clay loam")
    expect(printedTexture("mucky very fine sandy loam", room, soil.fontSize)).toBe("MK-VFSL")
    const placed = soilPlacements(project, form)
    for (const id of [fieldId(0, "texture"), fieldId(1, "texture")]) {
      const at = placed.find((x) => x.id === id)!
      expect(at.x).toBeCloseTo(soil.columns.texture[0] + soil.inset, 5)
      expect(widthOf(at.text, at.size)).toBeLessThanOrEqual(room)
    }
  })

  test("they are drawn on the official page, in their columns, and read back from the PDF", async () => {
    const drawn = await pdfText(await soilPagePdf(blank, project, p, form))
    const at = (text: string) => drawn.filter((d) => d.text === text).at(-1)!
    expect(at("clay loam").x).toBeCloseTo(soil.columns.texture[0] + soil.inset, 1)
    expect(at("mucky silt loam").x).toBeCloseTo(soil.columns.texture[0] + soil.inset, 1)
    expect(at("C").x).toBeCloseTo(soil.columns.redoxType[0] + soil.inset, 1)
    expect(at("PL").x).toBeCloseTo(soil.columns.redoxLoc[0] + soil.inset, 1)
    expect(at("D").x).toBeCloseTo(soil.columns.redoxType[0] + soil.inset, 1)
    expect(at("M").x).toBeCloseTo(soil.columns.redoxLoc[0] + soil.inset, 1)
    // On the redox color's own row.
    expect(at("PL").baseline).toBeCloseTo(at("7.5YR 4/6").baseline, 1)
    expect(at("M").baseline).toBeCloseTo(at("10YR 5/1").baseline, 1)
  })
})

describe("the restrictive layer box", () => {
  test("the type and depth print on their rules", async () => {
    const p = point([layer(0, 6)], { restrictive: { type: "fragipan", depth: 18.5 } })
    const form = formFor(project, p)
    expect([form.fields["soil.restrictive.type"], form.fields["soil.restrictive.depth"]]).toEqual(["fragipan", "18.5"])
    const placed = soilPlacements(project, form)
    const type = placed.find((x) => x.id === "soil.restrictive.type")!
    const depth = placed.find((x) => x.id === "soil.restrictive.depth")!
    expect(type.baseline).toBeCloseTo(soil.restrictive.type.rule - soil.aboveRule, 5)
    expect(depth.baseline).toBeCloseTo(soil.restrictive.depth.rule - soil.aboveRule, 5)
    expect(type.x).toBeGreaterThan(soil.restrictive.type.column[0])
    expect(depth.x + widthOf(depth.text, depth.size)).toBeLessThanOrEqual(soil.restrictive.depth.column[1])

    const drawn = await pdfText(await soilPagePdf(blank, project, p, form))
    expect(drawn.some((d) => d.text === "fragipan")).toBe(true)
    expect(drawn.some((d) => d.text === "18.5")).toBe(true)
  })

  test("with none observed the box is blank, and a type with no depth yet prints the type alone", () => {
    expect(formFor(project, point([layer(0, 6)])).fields["soil.restrictive.type"]).toBe("")
    const half = formFor(project, point([layer(0, 6)], { restrictive: { type: "lithic bedrock", depth: null } }))
    expect([half.fields["soil.restrictive.type"], half.fields["soil.restrictive.depth"]]).toEqual(["lithic bedrock", ""])
  })

  test("a long kind shrinks to fit its rule instead of running past it", () => {
    const form = formFor(project, point([layer(0, 6)], { restrictive: { type: "strongly contrasting textural stratification", depth: 20 } }))
    const type = soilPlacements(project, form).find((x) => x.id === "soil.restrictive.type")!
    expect(widthOf(type.text, type.size)).toBeLessThanOrEqual(soil.restrictive.type.column[1] - soil.restrictive.type.column[0])
    expect(type.size).toBeLessThan(soil.fontSize)
  })
})

describe("colors typed in by hand", () => {
  const draft = (extra: Partial<LayerDraft>): LayerDraft => ({ ...emptyLayerDraft, top: "0", bottom: "6", ...extra })
  const layerOf = (d: LayerDraft) => {
    const parsed = layerOfDraft(d)
    if ("problem" in parsed) throw new Error(parsed.problem)
    return parsed.value
  }

  test("a Chip is accepted as typed; a valid notation the book lacks is accepted as exact, prints as typed, and warns", () => {
    const l = layerOf(draft({ matrix: "10yr 4/2", redox: [{ color: "7.5YR 4.5/6", percent: "5", type: "C", location: "PL" }] }))
    expect(l.matrix).toEqual({ notation: "10YR 4/2", percent: 100 })
    expect(l.redox[0]).toMatchObject({ notation: "7.5YR 4.5/6", percent: 5, exact: true, type: "C", location: "PL" })
    const form = formFor(project, point([l]))
    expect(form.fields[fieldId(0, "redoxColor")]).toBe("7.5YR 4.5/6")
    expect(form.warnings.map((w) => [w.kind, w.layer])).toEqual([["color-not-a-chip", 0]])
    expect(form.warnings[0].text).toContain("7.5YR 4.5/6 is not a Chip in the soil book. It is printed as entered.")
  })

  test("a color that is no Munsell color is refused with the reason", () => {
    expect(layerOfDraft(draft({ matrix: "10YR 11/2" }))).toEqual({ problem: expect.stringContaining("Matrix: 10YR 11/2 is outside the Munsell system") })
  })

  test("texture, the mucky modifier and the codes survive editing a layer", () => {
    const l = layerOf(draft({ matrix: "10YR 3/1", textureBase: "silt loam", mucky: true, redox: [{ color: "7.5YR 4/6", percent: "3", type: "RM", location: "M" }] }))
    expect(l.texture).toBe("mucky silt loam")
    const again = draftOfLayer(l)
    expect([again.textureBase, again.mucky]).toEqual(["silt loam", true])
    expect(again.redox[0]).toMatchObject({ type: "RM", location: "M" })
    expect(layerOf(again)).toMatchObject({ texture: "mucky silt loam", redox: [{ type: "RM", location: "M" }] })
  })

  test("an organic term takes no modifier, and no texture is no texture", () => {
    expect(layerOf(draft({ textureBase: "muck", mucky: true })).texture).toBe("muck")
    expect(layerOf(draft({ textureBase: "" })).texture).toBeUndefined()
    expect("texture" in layerOf(draft({}))).toBe(false)
  })

  test("a code that is not one of the form's is dropped, not stored", () => {
    const l = layerOf(draft({ redox: [{ color: "7.5YR 4/6", percent: "3", type: "Z", location: "Q" }] }))
    expect("type" in l.redox[0]).toBe(false)
    expect("location" in l.redox[0]).toBe(false)
  })
})

describe("gaps and overlaps between layers", () => {
  test("they are in formFor's warnings, which the sampling point shows", () => {
    const warnings = formFor(project, point([layer(0, 6), layer(8, 12), layer(10, 20)])).warnings
    expect(warnings.map((w) => [w.kind, w.layer])).toEqual([["gap", 1], ["overlap", 2]])
    expect(warnings[0].text).toBe("There is a gap between layers 1 and 2.")
    expect(warnings[1].text).toBe("Layers 2 and 3 overlap.")
  })
})
