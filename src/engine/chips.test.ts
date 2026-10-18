// The soil-book Chip list, tested the way a caller meets it: through the engine's public
// surface (the lists, and readPhoto). Expected values are copied by hand from the source of
// the list (tomax31/Munsell-Soil-Color-Chart-palette, CC0) and from Jon's physical soil book
// (Soil-Color Charts, 2009 Revision, 2015 Production), never from the code under test.
import * as munsell from "munsell"
import { describe, expect, it } from "vitest"
import { CHIP_LIST, SOIL_BOOK_CHIPS, readPhoto } from "./index"
import type { ChipPage } from "./index"
import { LIGHTS, SIM_CORNERS, SIM_SPOT, simulatePhoto } from "./simulate"

const bookChip = (notation: string) => SOIL_BOOK_CHIPS.find((chip) => chip.notation === notation)

describe("the CC0 list, as the source has it", () => {
  it("has as many Chips as the source: 315", () => {
    expect(CHIP_LIST).toHaveLength(315)
    expect(new Set(CHIP_LIST.map(([notation]) => notation)).size).toBe(315)
  })

  it("has as many Chips on each hue as the source", () => {
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
    // Stale names, left as the source has them; the corrections below replace them.
    ["5GY 3/1", "dark greenish gray"],
    ["5G 3/2", "dark grayish green"],
  ])("lists %s as %s", (notation, name) => {
    expect(new Map(CHIP_LIST).get(notation)).toBe(name)
  })
})

describe("the Chips the engine knows: the CC0 list plus the corrections from the physical book", () => {
  it("has 359 Chips, none twice", () => {
    expect(SOIL_BOOK_CHIPS).toHaveLength(359)
    expect(new Set(SOIL_BOOK_CHIPS.map((chip) => chip.notation)).size).toBe(359)
  })

  it("has the Chips the book prints on each Page", () => {
    // A Chip printed on two Pages counts on both: the 7 Chips of the WHITE Page's value 8
    // column are also on their own Pages.
    const perPage = new Map<ChipPage, number>()
    for (const { pages } of SOIL_BOOK_CHIPS) for (const page of pages) perPage.set(page, (perPage.get(page) ?? 0) + 1)
    expect(Object.fromEntries(perPage)).toEqual({
      // Counted on the photographed Pages and Diagrams.
      "2.5YR": 37, "5YR": 33, "7.5YR": 35, "10YR": 36, "2.5Y": 31, "5Y": 31,
      "10Y-5GY": 16, GLEY1: 42, GLEY2: 42, WHITE: 28,
      // From the CC0 list only. Not checked: Jon's binder tabs start at 2.5YR.
      "10R": 35,
    })
  })

  it("matches the 10YR Page printed in the 2009 Revision of the soil book", () => {
    // Values 8 to 5 with chromas 1, 2, 3, 4, 6, 8; values 4 and 3 with chromas 1, 2, 3, 4, 6;
    // value 2 with chromas 1 and 2: 36 Chips.
    const printed = [
      ...[8, 7, 6, 5].flatMap((v) => [1, 2, 3, 4, 6, 8].map((c) => `10YR ${v}/${c}`)),
      ...[4, 3].flatMap((v) => [1, 2, 3, 4, 6].map((c) => `10YR ${v}/${c}`)),
      "10YR 2/1",
      "10YR 2/2",
    ]
    const listed = SOIL_BOOK_CHIPS.filter((chip) => chip.pages.includes("10YR")).map((chip) => chip.notation)
    expect([...listed].sort()).toEqual([...printed].sort())
  })

  describe("correction: the neutral Chips the CC0 list lacks (Gley 1's first column)", () => {
    it.each([
      ["N 8/", "white", 8],
      ["N 7/", "light gray", 7],
      ["N 6/", "gray", 6],
      ["N 5/", "gray", 5],
      ["N 4/", "dark gray", 4],
      ["N 3/", "very dark gray", 3],
      ["N 2.5/", "black", 2.5],
    ])("adds %s, %s", (notation, name, value) => {
      const pages = notation === "N 8/" ? ["GLEY1", "WHITE"] : ["GLEY1"] // N 8/ is also on WHITE
      expect(bookChip(notation)).toEqual({ notation, name, hue: "N", value, chroma: 0, pages })
    })
  })

  describe("correction: the WHITE Page, values 9.5, 9, 8.5 and 8", () => {
    // Rows are hue/chroma; columns are the four values, lightest first.
    const rows: [row: string, names: string[]][] = [
      ["N", ["white", "white", "white", "white"]],
      ["7.5YR /1", ["white", "white", "white", "white"]],
      ["7.5YR /2", ["pale yellowish pink", "pale yellowish pink", "pinkish white", "pinkish white"]],
      ["10YR /1", ["white", "white", "white", "white"]],
      ["10YR /2", ["pale orange yellow", "pale orange yellow", "very pale brown", "very pale brown"]],
      ["2.5Y /1", ["white", "white", "white", "white"]],
      ["2.5Y /2", ["very pale yellow", "very pale yellow", "pale yellow", "pale yellow"]],
    ]
    const values = ["9.5", "9", "8.5", "8"]
    const notation = (row: string, value: string) => (row === "N" ? `N ${value}/` : row.replace(" /", ` ${value}/`))
    const chips = rows.flatMap(([row, names]) => values.map((value, i) => [notation(row, value), names[i]] as const))

    it("has exactly the 28 Chips the WHITE Page prints", () => {
      const listed = SOIL_BOOK_CHIPS.filter((chip) => chip.pages.includes("WHITE")).map((chip) => chip.notation)
      expect(chips).toHaveLength(28)
      expect([...listed].sort()).toEqual(chips.map(([n]) => n).sort())
    })

    it.each(chips)("names %s %s", (n, name) => {
      expect(bookChip(n)?.name).toBe(name)
    })
  })

  describe("correction: the 10Y-5GY Page the CC0 list lacks", () => {
    // Rows are values 6, 5, 4, 3; columns are 10Y /2, 10Y /4, 5GY /2, 5GY /4.
    const names = [
      ["light grayish olive", "pale olive", "light grayish green", "pale yellowish green"],
      ["grayish olive", "light olive", "grayish green", "light olive green"],
      ["dark grayish olive", "olive", "dark grayish green", "olive green"],
      ["very dark grayish olive", "dark olive", "very dark grayish green", "dark olive green"],
    ]
    const columns = [["10Y", 2], ["10Y", 4], ["5GY", 2], ["5GY", 4]] as const
    const chips = [6, 5, 4, 3].flatMap((value, row) =>
      columns.map(([hue, chroma], col) => [`${hue} ${value}/${chroma}`, names[row][col]] as const),
    )

    it.each(chips)("adds %s, %s", (notation, name) => {
      expect(bookChip(notation)?.name).toBe(name)
      expect(bookChip(notation)?.pages).toEqual(["10Y-5GY"])
    })
  })

  describe("correction: stale names in the CC0 list", () => {
    it.each([
      ["10Y 3/1", "very dark greenish gray"],
      ["5GY 3/1", "very dark greenish gray"],
      ["10GY 3/1", "very dark greenish gray"],
      ["5G 3/1", "very dark greenish gray"],
      ["5G 3/2", "very dark grayish green"],
      ["5G 2.5/2", "very dark grayish green"],
    ])("renames %s to %s", (notation, name) => {
      expect(bookChip(notation)?.name).toBe(name)
    })
  })

  it("names every other Gley 1 Chip as Jon's Gley 1 Diagram does", () => {
    const grays: Record<number, string> = {
      8: "light greenish gray", 7: "light greenish gray", 6: "greenish gray", 5: "greenish gray",
      4: "dark greenish gray", 3: "very dark greenish gray", 2.5: "greenish black",
    }
    const greens: Record<number, string> = {
      8: "pale green", 7: "pale green", 6: "pale green", 5: "grayish green", 4: "grayish green",
      3: "very dark grayish green", 2.5: "very dark grayish green",
    }
    const gley1 = SOIL_BOOK_CHIPS.filter((chip) => chip.pages.includes("GLEY1") && chip.hue !== "N")
    expect(gley1).toHaveLength(35) // 10Y, 5GY, 10GY and 5G at chroma 1, and 5G at chroma 2
    for (const { notation, name, chroma, value } of gley1) {
      expect([notation, name]).toEqual([notation, (chroma === 2 ? greens : grays)[value]])
    }
  })

  it.each<[string, ChipPage[]]>([
    ["10YR 4/3", ["10YR"]],
    ["10Y 3/1", ["GLEY1"]],
    ["10Y 3/2", ["10Y-5GY"]],
    ["5GY 4/4", ["10Y-5GY"]],
    ["10GY 4/1", ["GLEY1"]],
    ["5G 4/2", ["GLEY1"]],
    ["N 5/", ["GLEY1"]],
    ["10G 4/1", ["GLEY2"]],
    ["5PB 8/1", ["GLEY2"]],
    // The WHITE Page repeats its value 8 column from other Pages, and adds lighter Chips.
    ["N 8/", ["GLEY1", "WHITE"]],
    ["10YR 8/2", ["10YR", "WHITE"]],
    ["7.5YR 8/3", ["7.5YR"]], // chroma 3 is not on WHITE
    ["5YR 8/1", ["5YR"]], // 5YR is not on WHITE
    ["N 9/", ["WHITE"]],
    ["10YR 9/1", ["WHITE"]],
  ])("prints %s on the %j Pages", (notation, pages) => {
    expect(bookChip(notation)?.pages).toEqual(pages)
  })
})

describe("readPhoto lands on a real Chip from every hue, gley and neutral included", () => {
  // One known Chip from each of the 17 hues in the CC0 list, then the Chips it lacks.
  const chips: [notation: string, name: string][] = [
    ["10R 4/3", "weak red"],
    ["2.5YR 4/4", "reddish brown"],
    ["5YR 5/4", "reddish brown"],
    ["7.5YR 6/4", "light brown"],
    ["10YR 4/3", "brown"],
    ["2.5Y 5/4", "light olive brown"],
    ["5Y 6/4", "pale olive"],
    ["10Y 7/1", "light greenish gray"],
    ["5GY 3/1", "very dark greenish gray"], // renamed from "dark greenish gray"
    ["10GY 5/1", "greenish gray"],
    ["5G 6/2", "pale green"],
    ["10G 3/1", "very dark greenish gray"],
    ["5BG 8/1", "light greenish gray"],
    ["10BG 2.5/1", "greenish black"],
    ["5B 6/1", "bluish gray"],
    ["10B 3/1", "very dark bluish gray"],
    ["5PB 4/1", "dark bluish gray"],
    ["N 5/", "gray"], // not in the CC0 list
    ["10Y 4/4", "olive"], // the 10Y-5GY Page, not in the CC0 list
    ["5GY 3/4", "dark olive green"],
    ["10YR 9/1", "white"], // the WHITE Page, not in the CC0 list
    ["7.5YR 9/2", "pale yellowish pink"],
    ["2.5Y 8.5/2", "pale yellow"],
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

  it("reads a neutral soil to a neutral Chip, which has no chroma", () => {
    const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: "N 5/" })
    const [reading] = readPhoto({ pixels: sim.pixels, card: { kind: "none" }, spots: [SIM_SPOT] }).readings
    expect(reading.raw.chip).toMatchObject({ notation: "N 5/", name: "gray", hue: "N", value: 5, chroma: 0 })
  })

  it.each([
    ["7.5YR 9.5/2", "pale yellowish pink"],
    ["10YR 9.5/2", "pale orange yellow"],
  ])("reads a soil at %s, a Chip outside the sRGB gamut, to that Chip", (notation, name) => {
    // The Chip's red is brighter than sRGB can show, so its swatch is clamped, but matching
    // is in Lab and still finds it. munsell.js is the independent check that it is outside.
    expect(Math.max(...munsell.munsellToLinearRgb(notation))).toBeGreaterThan(1)
    const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: notation })
    const [reading] = readPhoto({ pixels: sim.pixels, card: { kind: "none" }, spots: [SIM_SPOT] }).readings
    expect(reading.raw.chip.notation).toBe(notation)
    expect(reading.raw.chip.name).toBe(name)
    expect(reading.raw.chipRgb[0]).toBe(255)
  })

  it("names every candidate in the top 3, not only the nearest", () => {
    const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: "10YR 4/3" })
    const [reading] = readPhoto({ pixels: sim.pixels, card: { kind: "none" }, spots: [SIM_SPOT] }).readings
    expect(reading.raw.top3).toHaveLength(3)
    for (const { chip } of reading.raw.top3) {
      expect(chip.name).toBe(bookChip(chip.notation)?.name)
      expect(chip.name).not.toBe("")
    }
  })
})
