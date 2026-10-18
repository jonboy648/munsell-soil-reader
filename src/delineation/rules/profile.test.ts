// The parts of the indicators that are the book's definitions rather than an indicator's own numbers:
// a depleted matrix (Field Indicators glossary p. 38-39), where depth is measured from, and the chroma
// allowed in the layers above (Field Indicators p. 6, as corrected by the Feb 2026 errata p. 3).
import { describe, expect, test } from "vitest"
import { L } from "./cases"
import { aboveChroma } from "./families"
import { buildProfile, isDepleted } from "./profile"

const PROMINENT = "7.5YR 4/6" // against a matrix of value 4 or 5 and chroma 1 or 2: prominent
const depleted = (matrix: string, redox: [string, number, ("C" | "D")?][] = []) => {
  const profile = buildProfile([L(0, 6, matrix, { redox })])
  return isDepleted(profile.segs[0])
}

describe("a depleted matrix", () => {
  test.each([
    ["10YR 5/1", [], true],
    ["10YR 6/1", [], true],
    ["10YR 6/2", [], true],
    ["10YR 5/2", [], false],
    ["10YR 6/3", [], false],
    ["10YR 4/1", [], false],
    ["10YR 5/2", [[PROMINENT, 2]], true],
    ["10YR 4/2", [[PROMINENT, 2]], true],
    ["10YR 4/1", [[PROMINENT, 2]], true],
    ["10YR 4/2", [[PROMINENT, 1]], false],
    ["10YR 3/1", [[PROMINENT, 2]], false],
    ["10YR 4/3", [[PROMINENT, 5]], false],
    ["10YR 5/2", [["10YR 5/3", 2]], false],
    ["10YR 5/2", [["10YR 6/1", 5, "D"]], false],
  ] as const)("%s with %j: %s", (matrix, redox, expected) => {
    expect(depleted(matrix, redox.map((r) => [...r]) as [string, number, ("C" | "D")?][])).toBe(expected)
  })
})

describe("where depth is measured from", () => {
  test("peat and mucky peat at the top are left out of depths measured from the muck or mineral surface, muck as well from the mineral surface", () => {
    const peat = buildProfile([L(0, 4, "10YR 2/1", { texture: "peat" }), L(4, 10, "10YR 3/1", { texture: "silt loam" })])
    expect(peat.offset).toEqual({ soil: 0, muckOrMineral: 4, mineral: 4 })
    const muck = buildProfile([L(0, 3, "10YR 2/1", { texture: "muck" }), L(3, 10, "10YR 3/1", { texture: "silt loam" })])
    expect(muck.offset).toEqual({ soil: 0, muckOrMineral: 0, mineral: 3 })
    const none = buildProfile([L(0, 10, "10YR 3/1", { texture: "silt loam" })])
    expect(none.offset).toEqual({ soil: 0, muckOrMineral: 0, mineral: 0 })
  })

  test("only organic layers that start at the surface count", () => {
    const buried = buildProfile([L(0, 4, "10YR 3/1", { texture: "silt loam" }), L(4, 8, "10YR 2/1", { texture: "muck" })])
    expect(buried.offset.mineral).toBe(0)
  })

  test("a layer of unknown texture is not organic", () => {
    expect(buildProfile([L(0, 4, "10YR 2/1"), L(4, 10, "10YR 3/1")]).offset.mineral).toBe(0)
  })
})

describe("chroma above the layer that meets an indicator", () => {
  const target = (above: ReturnType<typeof L>[]) => {
    const profile = buildProfile([...above, L(above[above.length - 1].bottom, above[above.length - 1].bottom + 6, "10YR 4/1")])
    return aboveChroma(profile, profile.segs[profile.segs.length - 1])
  }

  test("a zone of chroma above 2 less than 6 in thick directly above it is allowed, over material of chroma 2 or less", () => {
    expect(target([L(0, 5, "10YR 4/3")]).ok).toBe(true)
    expect(target([L(0, 3, "10YR 4/1"), L(3, 5, "10YR 4/3")]).ok).toBe(true)
  })

  test("6 in or more of it is not", () => {
    const result = target([L(0, 6, "10YR 4/3")])
    expect(result.ok).toBe(false)
    expect(result.note).toContain("6 in")
  })

  test("chroma above 2 over a layer of chroma 2 or less is not: the rest of the material above must be 2 or less", () => {
    const result = target([L(0, 3, "10YR 4/3"), L(3, 5, "10YR 4/1")])
    expect(result.ok).toBe(false)
    expect(result.note).toContain("Layer 1")
  })

  test("organic layers and layers with no color are skipped", () => {
    expect(target([L(0, 4, "10YR 2/1", { texture: "muck" }), L(4, 8, "10YR 4/3")]).ok).toBe(true)
    const colorless = buildProfile([{ ...L(0, 8, "10YR 4/3"), matrix: null }, L(8, 14, "10YR 4/1")])
    expect(aboveChroma(colorless, colorless.segs[1]).ok).toBe(true)
  })
})
