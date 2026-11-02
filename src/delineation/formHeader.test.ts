// Page 1's header through the form engine: the lines a Project fills once for every Sampling point,
// the lines each point fills for itself, the Y, N and tick blanks, and the pair.
import { describe, expect, test } from "vitest"
import { formFor, ruleRoom } from "./formFor"
import { subregionText } from "./headerFields"
import { JF1_POINT, JF1_PROJECT } from "./fixtures/jf1"
import { emptyHeader, newPoint, newProject, normalizeProject, pairOf, type Project, type SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { regionOf } from "./regions"
import { PAGE1_MARK_FIELDS, PAGE1_TEXT_FIELDS } from "./regions/types"
import { widthOf } from "./text"

const jf2: SamplingPoint = { ...newPoint("JF-2"), id: "jf-2", lat: "42.5012", long: "-93.2210", datum: "WGS84" }
const jf1: SamplingPoint = { ...JF1_POINT, lat: "42.5009", long: "-93.2204", datum: "WGS84" }

const project: Project = {
  ...JF1_PROJECT,
  header: {
    site: "Cedar Creek crossing",
    applicant: "County Roads Dept",
    county: "Story",
    state: "IA",
    investigators: "J. Fixture",
    date: "2026-10-18",
    sectionTownshipRange: "S14 T83N R24W",
    landform: "terrace",
    localRelief: "concave",
    slope: "2",
    soilMapUnit: "Clarion loam, 2 to 5 percent slopes",
    nwi: "PEM1C",
    normalCircumstances: "yes",
    disturbed: { vegetation: "no", soil: "no", hydrology: "yes" },
    problematic: { vegetation: "", soil: "no", hydrology: "no" },
  },
  // Picked once for the project, where it also decides which hydric soil indicators apply.
  subregion: { lrr: "R", mlra: "144A" },
  points: [jf1, jf2],
}

const printed = (point: SamplingPoint, p: Project = project) =>
  Object.fromEntries(Object.entries(formFor(p, point).fields).filter(([id, text]) => id.startsWith("page1.") && text !== ""))

describe("the header of page 1", () => {
  test("a Project's lines are the same on every Sampling point's form; the point's own lines differ", () => {
    const first = printed(jf1)
    const second = printed(jf2)
    expect(first).toEqual({
      "page1.site": "Cedar Creek crossing",
      "page1.applicant": "County Roads Dept",
      "page1.county": "Story",
      "page1.state": "IA",
      "page1.investigators": "J. Fixture",
      "page1.date": "10/18/2026",
      "page1.sectionTownshipRange": "S14 T83N R24W",
      "page1.landform": "terrace",
      "page1.localRelief": "concave",
      "page1.slope": "2",
      "page1.subregion": "LRR R, MLRA 144A",
      "page1.soilMapUnit": "Clarion loam, 2 to 5 percent slopes",
      "page1.nwi": "PEM1C",
      "page1.samplingPoint": "JF-1",
      "page1.lat": "42.5009",
      "page1.long": "-93.2204",
      "page1.datum": "WGS84",
      "page1.normalYes": "X",
      "page1.disturbedVegetation": "N",
      "page1.disturbedSoil": "N",
      "page1.disturbedHydrology": "Y",
      "page1.problematicSoil": "N",
      "page1.problematicHydrology": "N",
    })
    const own = ["page1.samplingPoint", "page1.lat", "page1.long", "page1.datum"]
    for (const [id, text] of Object.entries(first)) {
      if (!own.includes(id)) expect(second[id], id).toBe(text)
    }
    expect([second["page1.samplingPoint"], second["page1.lat"], second["page1.long"]]).toEqual(["JF-2", "42.5012", "-93.2210"])
  })

  test("every other line is blank, and a Project with no header fills only the point's name", () => {
    const bare = printed(JF1_POINT, JF1_PROJECT)
    expect(bare).toEqual({ "page1.samplingPoint": "JF-1" })
    const form = formFor(JF1_PROJECT, JF1_POINT)
    for (const field of [...PAGE1_TEXT_FIELDS, ...PAGE1_MARK_FIELDS]) {
      if (field !== "samplingPoint") expect(form.fields[`page1.${field}`], field).toBe("")
    }
  })

  test("a new Project's site is its name, and an older record gets the header it lacks", () => {
    expect(newProject(" Wetland A ", "NCNE").header).toEqual(emptyHeader("Wetland A"))
    const old = { ...JF1_PROJECT, header: undefined, points: [{ id: "x", name: "P", layers: [] }] } as unknown as Project
    const normal = normalizeProject(old)
    expect(normal.header).toEqual(emptyHeader())
    expect(normal.points[0]).toMatchObject({ lat: "", long: "", datum: "" })
  })

  test("the Subregion line is the one the project picked, and blank until it is picked", () => {
    expect(subregionText({ lrr: "M" })).toBe("LRR M")
    expect(subregionText({ lrr: "R", mlra: "145" })).toBe("LRR R, MLRA 145")
    expect(subregionText({ lrr: "R", mlra: "other" })).toBe("LRR R")
    expect(subregionText(undefined)).toBe("")
    expect(printed(jf1, { ...project, subregion: undefined })["page1.subregion"]).toBeUndefined()
  })

  test("not-answered Yes and No stay blank, and No ticks the other blank", () => {
    const answered = { ...project, header: { ...project.header, normalCircumstances: "no" as const } }
    const fields = printed(jf1, answered)
    expect(fields["page1.normalNo"]).toBe("X")
    expect(fields["page1.normalYes"]).toBeUndefined()
    expect(fields["page1.problematicVegetation"]).toBeUndefined()
  })
})

describe("a pair of Sampling points", () => {
  test("is recorded on one point and printed on both forms", () => {
    const paired: Project = { ...project, points: [{ ...jf1, pair: { with: "jf-2", role: "wetland" } }, jf2] }
    expect(pairOf(paired, paired.points[0])).toMatchObject({ role: "wetland", other: { name: "JF-2" } })
    expect(pairOf(paired, paired.points[1])).toMatchObject({ role: "upland", other: { name: "JF-1" } })
    expect(formFor(paired, paired.points[0]).fields["page1.summaryRemarks"]).toBe("Wetland point, paired with the upland point JF-2.")
    expect(formFor(paired, paired.points[1]).fields["page1.summaryRemarks"]).toBe("Upland point, paired with the wetland point JF-1.")
  })

  test("says nothing when there is no pair, or when the other half is gone", () => {
    expect(formFor(project, jf1).fields["page1.summaryRemarks"]).toBe("")
    const orphan: Project = { ...project, points: [{ ...jf1, pair: { with: "deleted", role: "upland" } }] }
    expect(pairOf(orphan, orphan.points[0])).toBeNull()
    expect(formFor(orphan, orphan.points[0]).fields["page1.summaryRemarks"]).toBe("")
  })
})

describe("text that does not fit or cannot be printed", () => {
  test("a long line shrinks to its rule, and is cut with a warning when even that is not enough", () => {
    const { page1 } = regionOf("NCNE")
    const long = { ...project, header: { ...project.header, date: "2026-10-18", county: "Story County, Iowa, and the neighbouring counties besides" } }
    const form = formFor(long, jf1)
    const county = form.fields["page1.county"]
    expect(county.endsWith("...")).toBe(true)
    expect(form.warnings.some((w) => w.kind === "field-cut" && w.text.includes("City/County"))).toBe(true)
    expect(widthOf(county, 5)).toBeLessThanOrEqual(ruleRoom(page1, "county"))
    // The date is a little too wide at the form's size, and shrinks without a warning.
    expect(form.warnings.some((w) => w.text.includes("Sampling Date"))).toBe(false)
  })

  test("characters the form's font does not have are replaced, with a warning", () => {
    const odd = { ...project, header: { ...project.header, investigators: "José 中" } }
    const form = formFor(odd, jf1)
    expect(form.fields["page1.investigators"]).toBe("José ?")
    expect(form.warnings.some((w) => w.kind === "text-changed" && w.text.includes("Investigator(s)"))).toBe(true)
  })
})

describe("where page 1 is drawn", () => {
  const { page1 } = regionOf("NCNE")
  const placements = page1Placements(project, formFor(project, jf1))

  test("each value is on its own rule: inside its ends, just above it, no wider than it", () => {
    expect(placements.length).toBeGreaterThan(20)
    for (const p of placements) {
      const field = p.id.replace("page1.", "")
      if (field === "remarks") continue
      const rule = page1.fields[field as keyof typeof page1.fields]
      expect(p.x, p.id).toBeGreaterThanOrEqual(rule.left)
      expect(p.x + widthOf(p.text, p.size), p.id).toBeLessThanOrEqual(rule.right + 0.01)
      expect(p.baseline, p.id).toBeCloseTo(rule.rule - page1.aboveRule, 5)
      expect(p.size, p.id).toBeLessThanOrEqual(page1.fontSize)
    }
  })

  test("a Y, N or tick is in the middle of its blank", () => {
    for (const p of placements.filter((p) => /normal|disturbed|problematic/.test(p.id))) {
      const rule = page1.fields[p.id.replace("page1.", "") as keyof typeof page1.fields]
      const middle = p.x + widthOf(p.text, p.size) / 2
      expect(middle, p.id).toBeCloseTo((rule.left + rule.right) / 2, 5)
    }
  })

  test("a paired point's note starts the Summary remarks, inside the box", () => {
    const paired: Project = { ...project, points: [{ ...jf1, pair: { with: "jf-2", role: "wetland" } }, jf2] }
    const note = page1Placements(paired, formFor(paired, paired.points[0])).find((p) => p.id === "page1.summaryRemarks")
    expect(note?.text).toBe("Wetland point, paired with the upland point JF-2.")
    expect(note?.x).toBe(page1.summaryRemarks.left)
    expect(note?.baseline).toBe(page1.summaryRemarks.baseline)
  })
})
