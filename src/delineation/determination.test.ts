import { expect, test } from "vitest"
import { formFor } from "./formFor"
import { JF1_POINT, JF1_PROJECT } from "./fixtures/jf1"
import { emptyHydrology } from "./model"
import { emptyVegetation } from "./vegetation/entry"
import { CONCLUSIONS, PARAMETERS, confirmConclusion, type Answer, type ConclusionId } from "./determination"
import { JF1_DETERMINATION_POINT as fixture, JF1_DETERMINATION_PROJECT as project } from "./fixtures/jf1Determination"
import { normalizeProject, type Project, type SamplingPoint } from "./model"

const summary = (point: SamplingPoint, p: Project = project) => formFor(p, point).determination
const confirm = (point: SamplingPoint, id: ConclusionId, answer: Answer | null, remark = "", p = project) =>
  confirmConclusion(point, summary(point, p), id, answer, remark)
const answered = (vegetation: Answer | null, soil: Answer | null, hydrology: Answer | null): SamplingPoint => ({
  ...fixture,
  vegetation: { ...fixture.vegetation!, present: vegetation ?? undefined },
  hydricSoilPresent: soil ?? undefined,
  hydrology: { ...fixture.hydrology!, present: hydrology === null ? null : hydrology === "yes" },
})

test("confirmed page answers reach the summary without confirming the overall determination", () => {
  const point = {
    ...JF1_POINT,
    hydricSoilPresent: "yes" as const,
    vegetation: { ...emptyVegetation, present: "yes" as const },
    hydrology: { ...emptyHydrology, present: true },
  }
  expect(formFor(JF1_PROJECT, point).fields).toMatchObject({
    "page1.summary.vegetation.yes": "X",
    "page1.summary.soil.yes": "X",
    "page1.summary.hydrology.yes": "X",
    "page1.summary.wetland.yes": "",
    "page1.summary.wetland.no": "",
  })
})

test.each([
  ["yes", "yes", "yes", "yes"],
  ["yes", "yes", "no", "no"],
  ["yes", "no", "yes", "no"],
  ["yes", "no", "no", "no"],
  ["no", "yes", "yes", "no"],
  ["no", "yes", "no", "no"],
  ["no", "no", "yes", "no"],
  ["no", "no", "no", "no"],
] as const)("vegetation %s, soil %s, hydrology %s suggests %s, never confirms", (v, s, h, expected) => {
  const result = summary(answered(v, s, h))
  expect(result.conclusions.wetland.suggested).toBe(expected)
  expect(result.conclusions.wetland.confirmed).toBeNull()
})

const answers: (Answer | null)[] = ["yes", "no", null]
test.each(answers.flatMap((v) => answers.flatMap((s) => answers.map((h) => [v, s, h] as const))).filter((row) => row.includes(null)))(
  "unknown remains unknown with vegetation %s, soil %s, hydrology %s", (v, s, h) => {
    expect(summary(answered(v, s, h)).conclusions.wetland.suggested).toBeNull()
  },
)

test("indicators and complete readings suggest parameters, but never confirm parameters or overall", () => {
  const result = summary(fixture)
  expect(PARAMETERS.map((id) => result.conclusions[id].suggested)).toEqual(["yes", "yes", "yes"])
  expect(result.pending.map((c) => c.id)).toEqual(["vegetation", "soil", "hydrology", "wetland"])
  expect(result.conclusions.soil.because).toContain("A12")
  expect(result.conclusions.hydrology.because).toContain("B6, D2")
  for (const id of CONCLUSIONS) {
    expect(formFor(project, fixture).fields[`page1.summary.${id}.yes`]).toBe("")
    expect(formFor(project, fixture).fields[`page1.summary.${id}.no`]).toBe("")
  }
})

test("satisfied vegetation and soil indicators must themselves be confirmed before suggesting parameters", () => {
  const pending = { ...fixture, indicators: {}, vegetation: { ...fixture.vegetation!, indicators: {} } }
  expect(summary(pending).conclusions.vegetation.suggested).toBeNull()
  expect(summary(pending).conclusions.soil.suggested).toBeNull()
})

test("stale vegetation indicators no longer support a parameter suggestion", () => {
  const stale = { ...fixture, vegetation: { ...fixture.vegetation!, plants: [] } }
  expect(summary(stale).conclusions.vegetation.suggested).toBeNull()
})

test.each([[], ["other"], ["unknown-indicator"]])("unrecorded or unrecognized hydrology is not No: %j", (...ticked) => {
  // test.each supplies each array's items as arguments.
  const point = { ...fixture, hydrology: { ...emptyHydrology, ticked } }
  expect(summary(point).conclusions.hydrology.suggested).toBeNull()
})

test("one secondary indicator can suggest No, while field observations remain unknown", () => {
  const point = { ...fixture, hydrology: { ...emptyHydrology, ticked: ["B6"] } }
  expect(summary(point).conclusions.hydrology.suggested).toBe("no")
  const saved = confirm(point, "hydrology", "no")
  expect(saved.hydrology?.surfaceWater).toEqual({ present: null, depth: null })
  expect(saved.hydrology?.waterTable).toEqual({ present: null, depth: null })
  expect(saved.hydrology?.saturation).toEqual({ present: null, depth: null })
})

test.each(["disturbed", "problematic"] as const)("%s parameters require human judgment, even with all three Yes", (condition) => {
  for (const parameter of PARAMETERS) {
    const exceptional = { ...project, header: { ...project.header, [condition]: { ...project.header[condition], [parameter]: "yes" } } }
    const result = summary(answered("yes", "yes", "yes"), exceptional)
    expect(result.conclusions.wetland.suggested).toBeNull()
    expect(result.conclusions.wetland.because).toContain("Human judgment required")
  }
})

test.each(["no", ""] as const)("normal circumstances %j cannot silently use the normal rule", (normalCircumstances) => {
  const exceptional = { ...project, header: { ...project.header, normalCircumstances } }
  const point = answered("yes", "yes", "yes")
  expect(summary(point, exceptional).conclusions.wetland.suggested).toBeNull()
  expect(() => confirm(point, "wetland", "yes", "", exceptional)).toThrow(/remark/)
  expect(confirm(point, "wetland", "yes", "Synthetic alternative procedure for this test", exceptional).determination?.answer).toBe("yes")
})

test("problematic indicators require human judgment even when the header flags were not set", () => {
  const point = answered("yes", "yes", "yes")
  expect(summary({ ...point, indicators: { A10: { state: "confirmed" } } }).conclusions.wetland.suggested).toBeNull()
  expect(summary({ ...point, vegetation: { ...point.vegetation!, indicators: { problematic: { state: "confirmed", remark: "Test" } } } }).conclusions.wetland.suggested).toBeNull()
})

test.each(CONCLUSIONS)("overriding %s requires a remark and writes the same answer to each page", (id) => {
  const point = answered("yes", "yes", "yes")
  expect(() => confirm(point, id, "no")).toThrow(/remark/)
  expect(() => confirm(point, id, "no", " \n ")).toThrow(/remark/)
  const saved = confirm(point, id, "no", `  Synthetic ${id} override  `)
  const form = formFor(project, saved)
  expect(form.fields[`page1.summary.${id}.no`]).toBe("X")
  expect(form.fields[`page1.summary.${id}.yes`]).toBe("")
  expect(form.fields["page1.summaryRemarks"]).toContain(`Synthetic ${id} override`)
  if (id === "vegetation") expect(form.fields["veg.present.no"]).toBe("X")
  if (id === "soil") expect(form.fields["soil.hydric.no"]).toBe("X")
  if (id === "hydrology") expect(form.fields["page1.hydrology.present.no"]).toBe("X")
  expect(summary(confirm(saved, id, null)).conclusions[id].confirmed).toBeNull()
  expect(summary(confirm(saved, id, null)).conclusions[id].remark).toBe("")
})

test("a saved confirmation survives reload and evidence edits, is flagged for review, and can be reconfirmed", () => {
  const point = confirm(answered("yes", "yes", "yes"), "wetland", "yes")
  const reloaded = normalizeProject(JSON.parse(JSON.stringify({ ...project, points: [point] }))).points[0]
  expect(summary(reloaded).conclusions.wetland.review).toBe("")
  const changed = { ...reloaded, layers: [] }
  const result = summary(changed)
  expect(result.conclusions.wetland.confirmed).toBe("yes")
  expect(result.conclusions.wetland.review).toContain("retained")
  expect(formFor(project, changed).fields["page1.summary.wetland.yes"]).toBe("X")
  expect(summary(confirm(changed, "wetland", "yes")).conclusions.wetland.review).toBe("")
})

test("a later parameter change keeps the detail and summary pages aligned and flags the overall answer", () => {
  const point = confirm(answered("yes", "yes", "yes"), "wetland", "yes")
  const changed = confirm(point, "soil", "no", "Synthetic soil review")
  const form = formFor(project, changed)
  expect(form.fields["soil.hydric.no"]).toBe("X")
  expect(form.fields["page1.summary.soil.no"]).toBe("X")
  expect(form.fields["page1.summary.wetland.yes"]).toBe("X")
  expect(form.determination.conclusions.wetland.suggested).toBe("no")
  expect(form.determination.conclusions.wetland.review).toContain("retained")
})

test("old records gain no invented observations or confirmations", () => {
  const old = normalizeProject(JF1_PROJECT).points[0]
  expect(summary(old).pending).toHaveLength(4)
  expect(old.determination).toBeUndefined()
  expect(old.hydrology).toBeUndefined()
  expect(old.vegetation).toBeUndefined()
})

test("an old explanation is not attached to a different parameter answer", () => {
  const point = confirm(answered("yes", "yes", "yes"), "soil", "no", "Synthetic override")
  const changed: SamplingPoint = { ...point, hydricSoilPresent: "yes" }
  expect(summary(changed).conclusions.soil.remark).toBe("")
})
