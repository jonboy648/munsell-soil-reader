// Which indicators a profile satisfies, with each rule's numbers pinned from both sides. See cases.ts for
// where the profiles come from.
import { describe, expect, test } from "vitest"
import { JF1_POINT, JF1_PROJECT } from "../fixtures/jf1"
import { newPoint, newProject, type IndicatorChoice, type Layer, type Project } from "../model"
import { regionOf } from "../regions"
import { CASES, L } from "./cases"
import { evaluate } from "./families"
import { buildProfile } from "./profile"
import { scopeState, suggest } from "./suggest"

const region = regionOf("NCNE")
const record = (id: string) => region.indicators.find((i) => i.id === id)!

const project = (lrr = "K", mlra?: string): Project => ({ ...newProject("Pond", "NCNE"), subregion: { lrr, ...(mlra ? { mlra } : {}) } })
const point = (layers: Layer[], indicators?: Record<string, IndicatorChoice>) => ({ ...newPoint("SP-1"), layers, ...(indicators ? { indicators } : {}) })
const found = (layers: Layer[], p: Project = project()) => suggest(p, point(layers)).suggestions.map((s) => s.indicator)

describe("JF-1", () => {
  const result = suggest(JF1_PROJECT, JF1_POINT)

  test("suggests Thick Dark Surface (A12) and nothing else", () => {
    expect(result.suggestions.map((s) => s.indicator)).toEqual(["A12"])
  })

  test("quotes the rule and names the layers that satisfy it", () => {
    const [a12] = result.suggestions
    expect(a12.rule).toBe(record("A12").quote)
    expect(a12.citations.map((c) => c.document)).toContain(record("A12").citations[0].document)
    expect(a12.layers).toEqual([
      { n: 1, top: 0, bottom: 20 },
      { n: 2, top: 20, bottom: 25 },
      { n: 3, top: 25, bottom: 29 },
      { n: 4, top: 29, bottom: 34 },
    ])
    expect(a12.evidence.join(" ")).toContain("Layers 3 and 4 (25-34 in)")
    expect(a12.evidence.join(" ")).toContain("9 in thick")
    expect(a12.decision).toBe("pending")
  })

  test("the indicators it cannot decide are listed with what they need, not suggested", () => {
    const ids = result.needs.map((n) => n.indicator)
    for (const id of ["A1", "A3", "S1", "F1", "A4", "S7", "F8"]) expect(ids).toContain(id)
    expect(ids).not.toContain("A12")
  })

  test("a point with no subregion picked lists the scoped indicators as needing it, and decides the rest", () => {
    const none = suggest({ ...JF1_PROJECT, subregion: undefined }, JF1_POINT)
    expect(none.suggestions.map((s) => s.indicator)).toEqual(["A12"])
    expect(none.needs.find((n) => n.indicator === "F10")!.needs[0]).toMatch(/subregion/)
    expect(none.notHere).toEqual([])
  })
})

describe.each(CASES)("$id: $name", (c) => {
  test("the satisfying profile is suggested", () => {
    expect(found(c.yes)).toContain(c.id)
  })

  test.each(Object.entries(c.tighten))("the rule one step stricter (%s) no longer takes it", (_, tighter) => {
    expect(evaluate(tighter(record(c.id).criteria), buildProfile(c.yes))).toBeNull()
  })

  test.each(c.misses.map((m) => [m.by, m] as const))("a profile that misses by %s is not suggested", (_, miss) => {
    expect(found(miss.layers)).not.toContain(c.id)
  })

  test.each(c.misses.filter((m) => m.loosen).map((m) => [m.by, m] as const))("the rule one step looser on that point (%s) takes the miss", (_, miss) => {
    expect(evaluate(miss.loosen!(record(c.id).criteria), buildProfile(miss.layers))).not.toBeNull()
  })
})

describe("indicators that rest on texture", () => {
  const SANDY_MUCKY = { texture: "mucky sand" }
  const MUCKY = { texture: "mucky silt loam" }

  test("without a texture they are listed as needing one, whatever the colors", () => {
    const layers = [L(0, 8, "10YR 2/1"), L(8, 14, "10YR 4/2")]
    const result = suggest(project(), point(layers))
    for (const id of ["S1", "F1", "A3", "A10", "S3", "A1", "A2"]) {
      const need = result.needs.find((n) => n.indicator === id)
      expect(need, id).toBeDefined()
      expect(record(id).needs.some((n) => n.kind === "texture"), id).toBe(true)
    }
    expect(result.suggestions).toEqual([])
  })

  test("S1: mucky sand 2 in thick starting within 6 in", () => {
    expect(found([L(0, 2, "10YR 2/1", SANDY_MUCKY)])).toContain("S1")
    expect(found([L(0, 1.5, "10YR 2/1", SANDY_MUCKY)])).not.toContain("S1")
    expect(found([L(0, 7, "10YR 3/1", { texture: "loamy sand" }), L(7, 9, "10YR 2/1", SANDY_MUCKY)])).not.toContain("S1")
    expect(found([L(0, 2, "10YR 2/1", MUCKY)])).not.toContain("S1")
  })

  test("F1: mucky loamy or clayey material 4 in thick starting within 6 in, in LRR K and L only", () => {
    expect(found([L(0, 4, "10YR 2/1", MUCKY)])).toContain("F1")
    expect(found([L(0, 3.5, "10YR 2/1", MUCKY)])).not.toContain("F1")
    expect(found([L(0, 4, "10YR 2/1", SANDY_MUCKY)])).not.toContain("F1")
    expect(found([L(0, 4, "10YR 2/1", MUCKY)], project("L"))).toContain("F1")
  })

  test("A3: black muck 8 in thick over mineral soil of chroma 2 or less", () => {
    const muck = (bottom: number, color = "10YR 2/1") => L(0, bottom, color, { texture: "muck" })
    const mineral = (top: number, color = "10YR 4/2") => L(top, top + 6, color, { texture: "silt loam" })
    expect(found([muck(8), mineral(8)])).toContain("A3")
    expect(found([muck(7), mineral(7)])).not.toContain("A3")
    expect(found([muck(8, "7.5YR 2/1"), mineral(8)])).not.toContain("A3")
    expect(found([muck(8, "10YR 2/2"), mineral(8)])).not.toContain("A3")
    expect(found([muck(8), mineral(8, "10YR 4/3")])).not.toContain("A3")
  })

  test("A10 takes 0.75 in of muck, and S3 a peat with sand below it", () => {
    expect(found([L(0, 0.75, "10YR 2/1", { texture: "muck" })])).toContain("A10")
    expect(found([L(0, 0.5, "10YR 2/1", { texture: "muck" })])).not.toContain("A10")
    expect(found([L(0, 0.75, "10YR 2/1", { texture: "peat" })])).not.toContain("A10")
    const peat = L(0, 2, "10YR 2/1", { texture: "peat" })
    expect(found([peat, L(2, 8, "10YR 5/2", { texture: "sand" })])).toContain("S3")
    expect(found([peat, L(2, 8, "10YR 5/2", { texture: "silt loam" })])).not.toContain("S3")
  })

  test("a layer with a texture the app cannot read is neither sandy nor loamy: the sandy and loamy rules ask", () => {
    const layers = [L(0, 6, "10YR 3/1"), L(6, 10, "5GY 5/1")]
    const [s4] = suggest(project(), point(layers)).suggestions.filter((s) => s.indicator === "S4")
    expect(s4.checks.join(" ")).toMatch(/Texture is not recorded/)
  })
})

describe("indicators that rest on observations the Log does not hold", () => {
  test("none is ever suggested, and each says what it needs", () => {
    const fields = region.indicators.filter((i) => i.criteria.kind === "field")
    expect(fields.map((i) => i.id)).toEqual(expect.arrayContaining(["A4", "A5", "A18", "A17", "S6", "S7", "F8", "F10", "F12", "F22", "other"]))
    // Every layer a field indicator could be read from, in one profile with the colors of A12 and F6.
    const result = suggest(project("K", "149B"), point([L(0, 13, "10YR 2/1"), L(13, 19, "10YR 5/1")]))
    const ids = result.suggestions.map((s) => s.indicator)
    for (const i of fields) {
      expect(ids, i.id).not.toContain(i.id)
      expect(i.needs.length, i.id).toBeGreaterThan(0)
    }
  })
})

describe("combining indicators by thickness", () => {
  const SILT = { texture: "silt loam" }
  const table8 = [
    L(0, 3, "10YR 2/1", SILT),
    L(3, 6, "10YR 3/1", { ...SILT, pct: 97, redox: [["7.5YR 5/6", 3]] }),
    L(6, 10, "10YR 5/2", { ...SILT, pct: 95, redox: [["7.5YR 5/6", 5]] }),
    L(10, 14, "2.5Y 4/2", SILT),
  ]
  const table9 = [
    L(0, 3, "10YR 3/1", { ...SILT, pct: 97, redox: [["10YR 5/6", 3]] }),
    L(3, 6, "10YR 4/1", { texture: "loamy sand", pct: 97, redox: [["10YR 5/6", 3]] }),
    L(6, 16, "10YR 4/1", SILT),
  ]

  test("NCNE Table 8: F6 in the second layer and F3 in the third together meet F3's thickness", () => {
    const result = suggest(project(), point(table8))
    const f3 = result.suggestions.find((s) => s.indicator === "F3")!
    const f6 = result.suggestions.find((s) => s.indicator === "F6")!
    expect(f3.layers.map((l) => l.n)).toEqual([2, 3])
    expect(f6.layers.map((l) => l.n)).toEqual([2, 3])
    expect(f3.combinedWith).toMatch(/F3 and F6 combined.*7 in thick starting 3 in down.*most restrictive thickness.*6 in/)
    // Neither is met alone.
    expect(evaluate(record("F3").criteria, buildProfile(table8))).toBeNull()
    expect(evaluate(record("F6").criteria, buildProfile(table8))).toBeNull()
  })

  test("NCNE Table 9: F6 in a loamy layer and S5 in a sandy one together meet the thickness", () => {
    const result = suggest(project(), point(table9))
    expect(result.suggestions.map((s) => s.indicator)).toEqual(["S5", "F6"]) // in the order the form prints them
    expect(result.suggestions[0].layers.map((l) => l.n)).toEqual([1, 2])
    expect(evaluate(record("F6").criteria, buildProfile(table9))).toBeNull()
    expect(evaluate(record("S5").criteria, buildProfile(table9))).toBeNull()
  })

  test("a combination one inch short of the most restrictive thickness is not suggested", () => {
    const short = [table8[0], table8[1], { ...table8[2], bottom: 8 }, { ...table8[3], top: 8 }]
    expect(found(short)).not.toContain("F3")
    expect(found(short)).not.toContain("F6")
  })

  test("layers with a gap between them do not combine", () => {
    const gap = [table8[0], table8[1], { ...table8[2], top: 7, bottom: 11 }]
    expect(found(gap)).toEqual([])
  })

  test("a combination that starts too deep is not suggested", () => {
    const deep = [L(0, 8, "10YR 3/1", SILT), ...table8.slice(1).map((l) => ({ ...l, top: l.top + 8, bottom: l.bottom + 8 }))]
    expect(found(deep)).not.toContain("F3")
  })
})

describe("what the user decided", () => {
  const layers = JF1_POINT.layers

  test("confirming or rejecting a suggestion is carried on it", () => {
    expect(suggest(JF1_PROJECT, point(layers, { A12: { state: "confirmed" } })).suggestions[0].decision).toBe("confirmed")
    expect(suggest(JF1_PROJECT, point(layers, { A12: { state: "rejected", remark: "Relict" } })).suggestions[0]).toMatchObject({ decision: "rejected", remark: "Relict" })
  })

  test("an indicator ticked by the user that was not suggested is listed apart, with the remark", () => {
    const result = suggest(JF1_PROJECT, point(layers, { A4: { state: "confirmed", manual: true, remark: "Rotten egg smell at 8 in" } }))
    expect(result.ticked).toEqual([{ indicator: "A4", code: "A4", name: "Hydrogen Sulfide", remark: "Rotten egg smell at 8 in" }])
    expect(result.suggestions.map((s) => s.indicator)).toEqual(["A12"])
  })

  test("a rejected tick is not a tick", () => {
    expect(suggest(JF1_PROJECT, point(layers, { A4: { state: "rejected" } })).ticked).toEqual([])
  })

  test("an indicator confirmed on layers that were later edited is still the user's tick, listed as not suggested", () => {
    const edited = [L(0, 12, "10YR 2/1"), L(12, 18, "10YR 5/1")]
    const result = suggest(JF1_PROJECT, point(edited, { A12: { state: "confirmed" } }))
    expect(result.suggestions.map((s) => s.indicator)).toEqual(["A11"])
    expect(result.ticked.map((t) => t.indicator)).toEqual(["A12"])
  })
})

describe("the project's subregion", () => {
  const MUCKY = L(0, 4, "10YR 2/1", { texture: "mucky silt loam" })
  const state = (id: string, lrr?: string, mlra?: string) =>
    scopeState(record(id).scope, lrr ? project(lrr, mlra) : { ...project(), subregion: undefined }, region)

  test("an indicator for LRR K and L only is not suggested in LRR M, and is not asked about either", () => {
    const m = suggest(project("M"), point([MUCKY]))
    expect(m.suggestions).toEqual([])
    expect(m.notHere).toEqual(expect.arrayContaining(["F1", "F10", "S11", "A10", "S3", "S8-problematic", "S9-problematic"]))
    expect(m.needs.map((n) => n.indicator)).not.toContain("F1")
    expect(found([MUCKY], project("K"))).toContain("F1")
    expect(found([MUCKY], project("L"))).toContain("F1")
  })

  test("the indicators with no scope are suggested whatever the subregion", () => {
    for (const lrr of ["K", "L", "M", "R", "S"]) expect(found(JF1_POINT.layers, project(lrr)), lrr).toEqual(["A12"])
  })

  test("with no subregion picked, a scoped indicator waits for it and an unscoped one does not", () => {
    const none = suggest({ ...project(), subregion: undefined }, point([MUCKY]))
    expect(none.suggestions).toEqual([])
    expect(none.needs.find((n) => n.indicator === "F1")!.needs).toEqual([expect.stringMatching(/subregion/)])
    expect(none.needs.find((n) => n.indicator === "F1")!.colorsFit).toBe(false)
    expect(none.notHere).toEqual([])
  })

  test.each([
    ["F10", "K", undefined, "in"],
    ["F10", "L", undefined, "in"],
    ["F10", "M", undefined, "out"],
    ["F10", "R", "145", "out"],
    ["S3", "R", undefined, "in"],
    ["S3", "S", "149B", "out"],
    ["A10", "S", "149B", "in"],
    ["A10", "M", undefined, "out"],
    ["S8", "R", undefined, "in"],
    ["S8", "K", undefined, "out"],
    ["S8", "S", "149B", "in"],
    ["F19", "S", "149B", "in"],
    ["F19", "K", undefined, "out"],
    ["F19", "R", "144A", "out"],
    ["F10", undefined, undefined, "unknown"],
  ])("%s in LRR %s, MLRA %s: %s", (id, lrr, mlra, expected) => {
    expect(state(id, lrr, mlra)).toBe(expected)
  })

  test("an indicator for some MLRAs of an LRR waits for the MLRA when the LRR could be in one of them", () => {
    expect(state("A17", "R")).toBe("unknown")
    expect(state("A17", "R", "144A")).toBe("in")
    expect(state("A17", "R", "145")).toBe("in")
    expect(state("A17", "R", "other")).toBe("out")
    expect(state("A17", "S", "149B")).toBe("in")
    expect(state("A17", "K")).toBe("out")
    expect(state("A17", "M")).toBe("out")
  })

  test("Red Parent Material (F21) is on one list in MLRA 145 and on the other everywhere else", () => {
    const where = (lrr: string, mlra?: string) => ({ hydric: state("F21-MLRA-145", lrr, mlra), problematic: state("F21-outside-MLRA-145", lrr, mlra) })
    expect(where("R", "145")).toEqual({ hydric: "in", problematic: "out" })
    expect(where("R", "144A")).toEqual({ hydric: "out", problematic: "in" })
    expect(where("R", "other")).toEqual({ hydric: "out", problematic: "in" })
    expect(where("R")).toEqual({ hydric: "unknown", problematic: "unknown" })
    expect(where("K")).toEqual({ hydric: "out", problematic: "in" })
    expect(where("S", "149B")).toEqual({ hydric: "out", problematic: "in" })
  })
})
