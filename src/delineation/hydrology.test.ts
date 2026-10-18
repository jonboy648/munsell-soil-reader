import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { formFor } from "./formFor"
import { suggestWetlandHydrology } from "./hydrology"
import { emptyHydrology, newPoint, newProject, type Hydrology } from "./model"
import { page1Placements } from "./page1"
import { page1Pdf } from "./pdf"
import { regionOf } from "./regions"
import { pdfText } from "./testing/pdfText"
import { widthOf } from "./text"

const region = regionOf("NCNE")
const { indicators, rule } = region.hydrology
const blank = readFileSync(new URL("./regions/ncne/page1.pdf", import.meta.url))
const project = newProject("Pond", "NCNE")

const point = (h: Partial<Hydrology>) => ({ ...newPoint("HP-1"), hydrology: { ...emptyHydrology, ...h } })
const primary = indicators.filter((i) => i.kind === "primary").map((i) => i.id)
const secondary = indicators.filter((i) => i.kind === "secondary").map((i) => i.id)

describe("the indicators are the ones the form prints", () => {
  // The form itself, read from the official page: each tick's label, and where it sits.
  const printed = async () =>
    (await pdfText(new Uint8Array(blank))).filter((d) => d.baseline > 395 && d.baseline < 550 && /\(([A-D]\d+)\)$|^Other \(/.test(d.text))

  test("the set of indicators equals the set of codes printed in the form's Hydrology section", async () => {
    const codes = (await printed()).flatMap((d) => (/\(([A-D]\d+)\)$/.exec(d.text) ? [/\(([A-D]\d+)\)$/.exec(d.text)![1]] : []))
    expect(codes).toHaveLength(29)
    expect(new Set(indicators.map((i) => i.id))).toEqual(new Set(codes))
    expect(indicators).toHaveLength(29)
    expect(primary).toHaveLength(18)
    expect(secondary).toHaveLength(11)
  })

  test("each label is the text printed beside its tick, and primary or secondary is where the form puts it", async () => {
    const items = await printed()
    for (const indicator of indicators) {
      const item = items.find((d) => d.text === indicator.label)
      expect(item, indicator.label).toBeDefined()
      // The form's right-hand column is its Secondary Indicators.
      expect(item!.x >= 380 ? "secondary" : "primary", indicator.label).toBe(indicator.kind)
    }
  })

  test("each tick blank is the one beside its label, on the label's line", async () => {
    const items = await printed()
    const { ticks } = region.page1.hydrology
    for (const indicator of indicators) {
      const item = items.find((d) => d.text === indicator.label)!
      const blankAt = ticks[indicator.id]
      expect(blankAt, indicator.id).toBeDefined()
      expect(item.x - blankAt.column[1], indicator.id).toBeCloseTo(1.6, 0)
      expect(blankAt.rule - item.baseline, indicator.id).toBeCloseTo(2.4, 0)
    }
    const other = items.find((d) => d.text.startsWith("Other ("))!
    expect(ticks.other.rule - other.baseline).toBeCloseTo(2.4, 0)
    expect(other.x - ticks.other.column[1]).toBeCloseTo(1.6, 0)
    expect(Object.keys(ticks)).toHaveLength(30)
  })

  test("every indicator has a definition and a citation of the supplement's chapter 4", () => {
    for (const i of indicators) {
      expect(i.definition.length, i.id).toBeGreaterThan(30)
      expect(i.definition, i.id).not.toMatch(/Figure/)
      expect(i.name, i.id).not.toBe("")
      const page = Number(/p\. (\d+)$/.exec(i.citation)?.[1])
      expect(page, i.id).toBeGreaterThanOrEqual(83)
      expect(page, i.id).toBeLessThanOrEqual(113)
      expect(i.citation, i.id).toContain(`Indicator ${i.id}`)
    }
  })
})

describe("Wetland Hydrology Present? by the rule: one primary or two secondary", () => {
  const answer = (ticked: string[]) => suggestWetlandHydrology(region, ticked).answer

  test("the rule is the supplement's, with its page", () => {
    expect([rule.primaryNeeded, rule.secondaryNeeded]).toEqual([1, 2])
    expect(rule.citation).toBe("ERDC/EL TR-12-1 (2012), p. 81")
  })

  test("any one primary indicator is yes", () => {
    for (const id of primary) expect(answer([id]), id).toBe(true)
  })

  test("one secondary indicator alone is no, for every secondary indicator", () => {
    for (const id of secondary) {
      const s = suggestWetlandHydrology(region, [id])
      expect(s.answer, id).toBe(false)
      expect(s.text).toContain("only 1 secondary indicator")
      expect(s.text).toContain("One primary or two secondary")
    }
  })

  test("any two secondary indicators are yes, with no primary indicator", () => {
    for (const [i, a] of secondary.entries()) for (const b of secondary.slice(i + 1)) expect(answer([a, b]), `${a} ${b}`).toBe(true)
    expect(suggestWetlandHydrology(region, ["B6", "D2"]).text).toBe("Yes: 2 secondary indicators ticked (B6, D2), and no primary indicator. Two are needed then.")
  })

  test("nothing ticked is no, and so is Other alone, which the rule does not count", () => {
    expect(answer([])).toBe(false)
    expect(suggestWetlandHydrology(region, []).text).toContain("no indicator is ticked")
    expect(answer(["other"])).toBe(false)
    expect(answer(["other", "B6"])).toBe(false)
    expect(answer(["other", "B6", "D2"])).toBe(true)
  })

  test("a primary and a secondary one is yes by the primary, and names it", () => {
    const s = suggestWetlandHydrology(region, ["B6", "A1", "nonsense"])
    expect(s).toMatchObject({ answer: true, primary: ["A1"], secondary: ["B6"] })
    expect(s.text).toBe("Yes: 1 primary indicator ticked (A1). One is enough.")
  })
})

describe("the Hydrology section through the form engine", () => {
  test("ticks print an X; depths print only for a Yes; the answer prints only once it is confirmed", () => {
    const form = formFor(project, point({
      ticked: ["B6", "D2"],
      waterTable: { present: true, depth: 14 },
      surfaceWater: { present: false, depth: 3 },
      saturation: { present: null, depth: null },
    }))
    const f = (name: string) => form.fields[`page1.hydrology.${name}`]
    expect(["tick.B6", "tick.D2", "tick.A1", "tick.other"].map(f)).toEqual(["X", "X", "", ""])
    expect([f("waterTable.yes"), f("waterTable.no"), f("waterTable.depth")]).toEqual(["X", "", "14"])
    expect([f("surfaceWater.yes"), f("surfaceWater.no"), f("surfaceWater.depth")]).toEqual(["", "X", ""])
    expect([f("saturation.yes"), f("saturation.no"), f("saturation.depth")]).toEqual(["", "", ""])
    // Suggested, not confirmed: nothing is printed for Wetland Hydrology Present?.
    expect([f("present.yes"), f("present.no")]).toEqual(["", ""])
    expect(form.suggestions).toMatchObject([{ id: "hydrology.present", answer: true }])
    expect(form.conclusions).toEqual([])
  })

  test("a confirmed answer prints and is a conclusion; Yes and No are one or the other", () => {
    const yes = formFor(project, point({ ticked: ["A1"], surfaceWater: { present: true, depth: 0 }, present: true }))
    expect([yes.fields["page1.hydrology.present.yes"], yes.fields["page1.hydrology.present.no"]]).toEqual(["X", ""])
    expect(yes.conclusions).toEqual([{ id: "hydrology.present", answer: true }])
    const no = formFor(project, point({ ticked: ["B6"], present: false }))
    expect([no.fields["page1.hydrology.present.yes"], no.fields["page1.hydrology.present.no"]]).toEqual(["", "X"])
    expect(no.conclusions).toEqual([{ id: "hydrology.present", answer: false }])
    expect(no.warnings).toEqual([])
  })

  test("a point with no hydrology recorded has blank hydrology fields and nothing suggested", () => {
    const form = formFor(project, newPoint("HP-1"))
    const filled = Object.entries(form.fields).filter(([id, text]) => id.startsWith("page1.hydrology.") && text !== "")
    expect(filled).toEqual([])
    expect(form.suggestions).toEqual([])
    expect(form.warnings).toEqual([])
  })

  test("depth fields and the two boxes of notes are recorded and printed, wrapped to their lines", () => {
    const describe_ = "Monitoring well MW-3 read 14 in. on 12 Oct; stream gauge 4 ft upstream shows a rising stage after rain."
    const form = formFor(project, point({ describe: describe_, remarks: "Seasonally flooded depression." }))
    const lines = Object.entries(form.fields).filter(([id]) => id.startsWith("page1.hydrology.describe.")).map(([, t]) => t).filter(Boolean)
    expect(lines.join(" ")).toBe(describe_)
    for (const line of lines) expect(widthOf(line, 8)).toBeLessThanOrEqual(531)
    expect(form.fields["page1.hydrology.remarks.0"]).toBe("Seasonally flooded depression.")
  })

  test("notes too long for their box are cut with an ellipsis and a warning; symbols the font lacks are spelled out", () => {
    const form = formFor(project, point({ describe: "word ".repeat(300).trim(), remarks: "pH ≤ 5" }))
    expect(form.fields["page1.hydrology.describe.1"]).toMatch(/\.\.\.$/)
    expect(form.fields["page1.hydrology.remarks.0"]).toBe("pH <= 5")
    expect(form.warnings.map((w) => w.kind).sort()).toEqual(["remarks-cut", "text-changed"])
  })

  test("a tick that needs an observation says so when the observation does not match", () => {
    const w = (h: Partial<Hydrology>) => formFor(project, point(h)).warnings.filter((x) => x.kind === "hydrology-observation").map((x) => x.text)
    expect(w({ ticked: ["A1"] })[0]).toContain("Surface Water (A1) is ticked, but Surface Water Present? is not Yes")
    expect(w({ ticked: ["A1"], surfaceWater: { present: true, depth: null } })).toEqual([])
    expect(w({ ticked: ["A2"], waterTable: { present: true, depth: 18 } })[0]).toContain("12 in. or less below the surface")
    expect(w({ ticked: ["A2"], waterTable: { present: true, depth: 8 } })).toEqual([])
    expect(w({ ticked: ["A2"], waterTable: { present: true, depth: null } })[0]).toContain("depth is blank")
    expect(w({ ticked: ["A3"], saturation: { present: true, depth: 20 } })[0]).toContain("12 in. or less from the surface")
    expect(w({ ticked: ["C2"], waterTable: { present: true, depth: 18 } })).toEqual([])
    expect(w({ ticked: ["C2"], waterTable: { present: true, depth: 6 } })[0]).toContain("between 12 and 24 in.")
    expect(w({ waterTable: { present: true, depth: null } })[0]).toContain("Water Table Present? is Yes, but its depth is blank")
  })

  test("an answer that differs from the rule is printed, and the difference is warned about", () => {
    const form = formFor(project, point({ ticked: ["B6"], present: true }))
    expect(form.fields["page1.hydrology.present.yes"]).toBe("X")
    expect(form.warnings.map((x) => x.kind)).toEqual(["hydrology-answer"])
    expect(form.warnings[0].text).toContain("Your answer is printed")
  })
})

describe("page 1's Hydrology section as a PDF", () => {
  const h = point({
    ticked: ["B6", "D2", "C3"],
    waterTable: { present: true, depth: 14 },
    describe: "Well MW-3 read 14 in.",
    remarks: "Seasonally flooded.",
    present: true,
  })

  test("the values are drawn on the official page where the placements say, after the page's own text", async () => {
    const form = formFor(project, h)
    const placed = page1Placements(project, form)
    expect(placed.map((p) => p.text).sort()).toEqual(["14", "Seasonally flooded.", "Well MW-3 read 14 in.", "X", "X", "X", "X", "X"].sort())
    const drawn = (await pdfText(await page1Pdf(blank, project, h, form))).slice(-placed.length)
    expect(drawn.map((d) => d.text)).toEqual(placed.map((p) => p.text))
    placed.forEach((p, i) => {
      expect(drawn[i].x).toBeCloseTo(p.x, 1)
      expect(drawn[i].baseline).toBeCloseTo(p.baseline, 1)
    })
    const ids = placed.map((p) => p.id)
    for (const id of ["tick.B6", "tick.D2", "tick.C3", "waterTable.yes", "waterTable.depth", "present.yes", "describe.0", "remarks.0"]) {
      expect(ids).toContain(`page1.hydrology.${id}`)
    }
    expect(ids).not.toContain("page1.hydrology.present.no")
  })

  test("each X is centered on its blank, just above its rule, and nothing is drawn past the box's right edge", () => {
    const { ticks, observations, present } = region.page1.hydrology
    const form = formFor(project, h)
    const byId = new Map(page1Placements(project, form).map((p) => [p.id, p]))
    const center = (id: string, blankAt: { column: readonly [number, number]; rule: number }) => {
      const p = byId.get(`page1.hydrology.${id}`)!
      expect(p.x + widthOf("X", p.size) / 2, id).toBeCloseTo((blankAt.column[0] + blankAt.column[1]) / 2, 5)
      expect(p.baseline, id).toBeCloseTo(blankAt.rule - 1.5, 5)
    }
    center("tick.B6", ticks.B6)
    center("tick.D2", ticks.D2)
    center("tick.C3", ticks.C3)
    center("waterTable.yes", { column: observations.yes, rule: observations.rows.waterTable })
    center("present.yes", { column: present.yes, rule: present.rule })
    for (const p of byId.values()) expect(p.x + widthOf(p.text, p.size)).toBeLessThanOrEqual(575)
  })
})
