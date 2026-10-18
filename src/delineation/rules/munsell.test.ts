// The color tests the indicators are written in. Expected values are the documents' own: the
// Field Indicators' glossary (v9.3, p. 38-41) and the NCNE supplement's worked examples (Tables 8 and 9,
// p. 43-44), whose every redox and matrix pair is labelled "Prominent".
import { describe, expect, test } from "vitest"
import { contrast, hueSteps, isGleyed, parseColor, type Color } from "./munsell"

const c = (notation: string): Color => {
  const color = parseColor(notation)
  if (!color) throw new Error(`not a color: ${notation}`)
  return color
}

describe("reading a notation", () => {
  test.each([
    ["10YR 4/2", 20, 4, 2],
    ["7.5YR 4/6", 17.5, 4, 6],
    ["2.5Y 6/3", 22.5, 6, 3],
    ["5GY 5/1", 35, 5, 1],
    ["10YR 2.5/1", 20, 2.5, 1],
    ["N 2.5/", null, 2.5, 0],
    ["GLEY1 5/10Y", 30, 5, 1],
    ["GLEY2 4/5PB", 75, 4, 1],
    ["GLEY1 2.5/N", null, 2.5, 0],
  ])("%s is hue %s, value %s, chroma %s", (notation, hue, value, chroma) => {
    expect(parseColor(notation)).toMatchObject({ hue, value, chroma })
  })

  test.each(["brown", "10YR", "4/2", "12QQ 4/2"])("%s is not a color", (notation) => {
    expect(parseColor(notation)).toBeNull()
  })

  test("a hue step is 2.5 hue units, around the circle", () => {
    expect(hueSteps(c("10YR 4/2"), c("7.5YR 4/6"))).toBe(1)
    expect(hueSteps(c("10YR 4/2"), c("5YR 4/6"))).toBe(2)
    expect(hueSteps(c("5RP 4/2"), c("5R 4/2"))).toBe(4) // 10 units across the end of the circle, not 90 the long way
    expect(hueSteps(c("N 4/"), c("5YR 4/6"))).toBe(0)
  })
})

describe("a gleyed matrix (glossary p. 41)", () => {
  test.each([
    ["10Y 4/1", true],
    ["5GY 5/1", true],
    ["10GY 6/1", true],
    ["10G 4/1", true],
    ["5BG 4/1", true],
    ["10BG 4/1", true],
    ["5B 4/1", true],
    ["10B 4/1", true],
    ["5PB 4/1", true],
    ["5G 4/1", true],
    ["5G 5/2", true], // 5G alone allows chroma 2
    ["N 4/", true],
    ["N 7/", true],
    ["GLEY1 4/10Y", true],
    ["10Y 4/2", false], // chroma 2 is not gley outside 5G
    ["5GY 5/2", false],
    ["10Y 3/1", false], // value under 4
    ["N 3/", false],
    ["5G 3/1", false],
    ["10YR 5/1", false], // 10YR is not a gley hue
    ["2.5Y 4/1", false],
    ["7.5GY 4/1", false], // only the printed hues
  ])("%s: %s", (notation, expected) => {
    expect(isGleyed(c(notation))).toBe(expected)
  })
})

describe("contrast of a redox feature against its matrix (glossary p. 39-40)", () => {
  test.each([
    // The supplement's examples, each labelled Prominent (NCNE Tables 8 and 9).
    ["10YR 3/1", "7.5YR 5/6"],
    ["10YR 5/2", "7.5YR 5/6"],
    ["10YR 3/1", "10YR 5/6"],
    ["10YR 4/1", "10YR 5/6"],
  ])("%s with %s is distinct or prominent", (matrix, feature) => {
    expect(contrast(c(matrix), c(feature))).toBe("distinct or prominent")
  })

  test.each([
    // Faint, by each of the four tests, at the edge.
    ["10YR 4/2", "10YR 6/3", "same hue: value 2 and chroma 1 apart"],
    ["10YR 4/2", "7.5YR 5/3", "one hue step: value 1 and chroma 1 apart"],
    ["10YR 4/2", "5YR 4/2", "two hue steps: no difference in value or chroma"],
    ["10YR 3/1", "5YR 2/2", "any hue, both dark and weak"],
  ])("%s with %s is faint: %s", (matrix, feature) => {
    expect(contrast(c(matrix), c(feature))).toBe("faint")
  })

  test.each([
    // One step past each edge.
    ["10YR 4/2", "10YR 7/3", "same hue, value 3 apart"],
    ["10YR 4/2", "10YR 6/4", "same hue, chroma 2 apart"],
    ["10YR 4/2", "7.5YR 6/3", "one hue step, value 2 apart"],
    ["10YR 4/2", "7.5YR 5/4", "one hue step, chroma 2 apart"],
    ["10YR 4/2", "5YR 5/2", "two hue steps, value 1 apart"],
    ["10YR 4/2", "2.5YR 4/2", "three hue steps"],
    ["10YR 3/1", "5YR 3/3", "dark, but chroma 3 is not weak"],
  ])("%s with %s is distinct or prominent: %s", (matrix, feature) => {
    expect(contrast(c(matrix), c(feature))).toBe("distinct or prominent")
  })
})
