// The soil-book Chip list, tested the way a caller meets it: through the engine's public
// surface (the list itself, and readPhoto). The expected values below are copied by hand from
// tomax31/Munsell-Soil-Color-Chart-palette, the source of the list, never from the code.
import { describe, expect, it } from "vitest"
import { CHIP_LIST, readPhoto } from "./index"
import { LIGHTS, SIM_CORNERS, SIM_SPOT, simulatePhoto } from "./simulate"

describe("the Chip list", () => {
  it("has as many Chips as the source: 315", () => {
    expect(CHIP_LIST).toHaveLength(315)
    expect(new Set(CHIP_LIST.map(([notation]) => notation)).size).toBe(315)
  })

  it("has as many Chips on each Page as the source", () => {
    const perHue = new Map<string, number>()
    for (const [notation] of CHIP_LIST) {
      const hue = notation.split(" ")[0]
      perHue.set(hue, (perHue.get(hue) ?? 0) + 1)
    }
    expect(Object.fromEntries(perHue)).toEqual({
      "10R": 35, "2.5YR": 37, "5YR": 33, "7.5YR": 35, "10YR": 36, "2.5Y": 31, "5Y": 31,
      "5PB": 7, "10B": 7, "5B": 7, "10BG": 7, "5BG": 7, "10G": 7, "5G": 14, "10GY": 7, "5GY": 7, "10Y": 7,
    })
  })

  it("matches the 10YR Page printed in the 2009 Revision of the soil book", () => {
    // Jon's physical Page: 36 Chips. Values 8 to 5 with chromas 1, 2, 3, 4, 6, 8; values 4
    // and 3 with chromas 1, 2, 3, 4, 6; value 2 with chromas 1 and 2.
    const printed = [
      ...[8, 7, 6, 5].flatMap((v) => [1, 2, 3, 4, 6, 8].map((c) => `10YR ${v}/${c}`)),
      ...[4, 3].flatMap((v) => [1, 2, 3, 4, 6].map((c) => `10YR ${v}/${c}`)),
      "10YR 2/1",
      "10YR 2/2",
    ]
    const listed = CHIP_LIST.map(([notation]) => notation).filter((n) => n.startsWith("10YR "))
    expect([...listed].sort()).toEqual([...printed].sort())
  })

  it.each([
    ["10YR 4/3", "brown"],
    ["10YR 8/1", "white"],
    ["10YR 7/2", "light gray"],
    ["10YR 3/2", "very dark grayish brown"],
    ["5Y 2.5/1", "black"],
    ["2.5Y 6/4", "light yellowish brown"],
    ["7.5YR 5/4", "brown"],
    ["5YR 6/4", "light reddish brown"],
    ["2.5YR 4/3", "reddish brown"],
    ["10R 6/4", "pale red"],
    ["5G 4/2", "grayish green"],
    ["10Y 8/1", "light greenish gray"],
    ["5PB 2.5/1", "bluish black"],
  ])("lists %s as %s", (notation, name) => {
    expect(new Map(CHIP_LIST).get(notation)).toBe(name)
  })
})

describe("readPhoto lands on a real Chip from every hue, gley included", () => {
  // One known Chip from each of the 17 hues in the list: 7 Pages, then the gley hues.
  const chips: [notation: string, name: string][] = [
    ["10R 4/3", "weak red"],
    ["2.5YR 4/4", "reddish brown"],
    ["5YR 5/4", "reddish brown"],
    ["7.5YR 6/4", "light brown"],
    ["10YR 4/3", "brown"],
    ["2.5Y 5/4", "light olive brown"],
    ["5Y 6/4", "pale olive"],
    ["10Y 7/1", "light greenish gray"],
    ["5GY 3/1", "dark greenish gray"],
    ["10GY 5/1", "greenish gray"],
    ["5G 6/2", "pale green"],
    ["10G 3/1", "very dark greenish gray"],
    ["5BG 8/1", "light greenish gray"],
    ["10BG 2.5/1", "greenish black"],
    ["5B 6/1", "bluish gray"],
    ["10B 3/1", "very dark bluish gray"],
    ["5PB 4/1", "dark bluish gray"],
  ]

  it.each(chips)("a soil at %s reads to %s", (notation, name) => {
    const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: notation })
    const colorchecker = { kind: "colorchecker" as const, corners: SIM_CORNERS }
    const [reading] = readPhoto({ pixels: sim.pixels, card: colorchecker, spots: [SIM_SPOT] }).readings
    for (const read of [reading.raw, reading.corrected!]) {
      expect(read.chip.notation).toBe(notation)
      expect(read.chip.name).toBe(name)
      expect(read.top3[0].chip.notation).toBe(notation)
    }
  })

  it("names every candidate in the top 3, not only the nearest", () => {
    const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: "10YR 4/3" })
    const [reading] = readPhoto({ pixels: sim.pixels, card: { kind: "none" }, spots: [SIM_SPOT] }).readings
    expect(reading.raw.top3).toHaveLength(3)
    for (const { chip } of reading.raw.top3) {
      expect(chip.name).toBe(new Map(CHIP_LIST).get(chip.notation))
      expect(chip.name).not.toBe("")
    }
  })
})
