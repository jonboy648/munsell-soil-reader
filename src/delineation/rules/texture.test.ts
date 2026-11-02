// How a recorded texture term is read: the 21 Field Book classes (v4, p. 2-36) sorted into the two groups of
// the Field Indicators (v9.3 p. 7: sandy is loamy fine sand and coarser; loamy and clayey is loamy very fine
// sand and finer), the "mucky" modifier (Field Book p. 2-40), and the organic terms used in place of a
// texture (p. 2-42).
import { describe, expect, test } from "vitest"
import { textureOf } from "./texture"

const SANDY = ["coarse sand", "sand", "fine sand", "very fine sand", "loamy coarse sand", "loamy sand", "loamy fine sand"]
const LOAMY = [
  "loamy very fine sand",
  "coarse sandy loam",
  "sandy loam",
  "fine sandy loam",
  "very fine sandy loam",
  "loam",
  "silt loam",
  "silt",
  "sandy clay loam",
  "clay loam",
  "silty clay loam",
  "sandy clay",
  "silty clay",
  "clay",
]

describe("the 21 texture classes", () => {
  test("there are 21 of them here", () => {
    expect(SANDY.length + LOAMY.length).toBe(21)
  })

  test.each(SANDY)("%s is sandy", (term) => {
    expect(textureOf(term)).toEqual({ group: "sandy" })
  })

  test.each(LOAMY)("%s is loamy or clayey", (term) => {
    expect(textureOf(term)).toEqual({ group: "loamy" })
  })

  test.each([...SANDY, ...LOAMY])("mucky %s keeps its group and is mucky", (term) => {
    const plain = textureOf(term)
    expect(textureOf(`mucky ${term}`)).toEqual({ ...plain, mucky: true })
  })
})

describe("organic terms and what is not a texture", () => {
  test.each([
    ["muck", "muck"],
    ["mucky peat", "mucky peat"],
    ["peat", "peat"],
  ] as const)("%s is organic: %s", (term, organic) => {
    expect(textureOf(term)).toEqual({ group: "unknown", organic })
  })

  test("case and spacing do not matter", () => {
    expect(textureOf("  Silt   Loam ")).toEqual({ group: "loamy" })
    expect(textureOf("MUCKY Sand")).toEqual({ group: "sandy", mucky: true })
  })

  test.each([undefined, "", "   ", "gravel", "bedrock"])("%j is unknown, not either group", (term) => {
    expect(textureOf(term)).toEqual({ group: "unknown" })
  })
})
