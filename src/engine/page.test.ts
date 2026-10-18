// Seam 1: a Page of the soil book as the Card. Every test builds a simulated Photo of a Page
// lying on soil (soil behind its holes, soil beside it), calls readPhoto, and checks what a
// caller would see. The layouts are copied by hand from Jon's physical book (Soil-Color Charts,
// 2009 Revision, 2015 Production), never from the code under test.
import { describe, expect, it } from "vitest"
import {
  CARD_CHECK_GOOD,
  PAGE_HUES,
  UnsupportedCardError,
  pageModel,
  pagePaperSites,
  pageSites,
  readPhoto,
} from "./index"
import type { Corners, PageHue, Pixels, Site, XY } from "./index"
import { LIGHTS, PHONE_TONE_CURVE, simulatePhoto, type SimCamera, type SimScene, type SimTilt } from "./simulate"

// ---- the soil book's grid, used only to judge "the same Chip or a Neighbouring chip" ----
const PAGES = ["10R", "2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y"]
const VALUES = [2.5, 3, 4, 5, 6, 7, 8]
const CHROMAS = [1, 2, 3, 4, 6, 8]

/** Steps between two Chips on the grid: pages, plus value rows, plus chroma columns. */
function stepsApart(a: string, b: string): number {
  const parse = (n: string) => {
    const m = /^(\S+) ([\d.]+)\/([\d.]+)$/.exec(n)
    if (!m) return null
    return [PAGES.indexOf(m[1]), VALUES.indexOf(Number(m[2])), CHROMAS.indexOf(Number(m[3]))]
  }
  const pa = parse(a)
  const pb = parse(b)
  if (a === b) return 0
  if (!pa || !pb || pa.includes(-1) || pb.includes(-1)) return Infinity
  return pa.reduce((sum, v, i) => sum + Math.abs(v - pb[i]), 0)
}
const withinOneChip = (a: string, b: string) => stepsApart(a, b) <= 1

// ---- helpers ----
const phone = (light: SimCamera["light"]): SimCamera => ({ light, toneCurve: PHONE_TONE_CURVE })
const TILT: SimTilt = { yaw: 35, pitch: -15 }

/** Photograph a Page and read it; `tap` can change which Chips the user tapped, `spots` where. */
function read(
  scene: Partial<SimScene> & { page: PageHue },
  options: { tap?: (taps: Corners) => Corners; spots?: (sim: ReturnType<typeof simulatePhoto>) => XY[] } = {},
) {
  const sim = simulatePhoto({ camera: phone(LIGHTS.warm), ...scene })
  const taps = options.tap ? options.tap(sim.corners) : sim.corners
  const result = readPhoto({
    pixels: sim.pixels,
    card: { kind: "page", hue: scene.page, taps },
    spots: options.spots ? options.spots(sim) : [sim.spot],
  })
  return { sim, result, check: result.cardCheck!, reading: result.readings[0] }
}

/** The pixels of a read circle, as [r, g, b] triples. */
function circle(pixels: Pixels, { center, radius }: Site): number[][] {
  const out: number[][] = []
  for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y++) {
    for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x++) {
      if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius * radius) continue
      const i = (y * pixels.width + x) * 4
      out.push([pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]])
    }
  }
  return out
}

/** How far the pixels of a circle stray from their own median, in 8-bit levels, over all channels. */
function spread(pixels: number[][]): number {
  const median = (k: number) => pixels.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(pixels.length / 2)]
  const mid = [0, 1, 2].map(median)
  return Math.max(...pixels.flatMap((p) => p.map((v, k) => Math.abs(v - mid[k]))))
}

describe("the Page model, as printed in the soil book", () => {
  // Rows are values top to bottom; each row lists the chromas printed on it.
  const printed: Record<PageHue, [value: number, chromas: number[]][]> = {
    "10YR": [
      [8, [1, 2, 3, 4, 6, 8]], [7, [1, 2, 3, 4, 6, 8]], [6, [1, 2, 3, 4, 6, 8]], [5, [1, 2, 3, 4, 6, 8]],
      [4, [1, 2, 3, 4, 6]], [3, [1, 2, 3, 4, 6]], [2, [1, 2]],
    ],
    "7.5YR": [
      [8, [1, 2, 3, 4, 6]], [7, [1, 2, 3, 4, 6, 8]], [6, [1, 2, 3, 4, 6, 8]], [5, [1, 2, 3, 4, 6, 8]],
      [4, [1, 2, 3, 4, 6]], [3, [1, 2, 3, 4]], [2.5, [1, 2, 3]],
    ],
    "2.5Y": [
      [8, [1, 2, 3, 4, 6, 8]], [7, [1, 2, 3, 4, 6, 8]], [6, [1, 2, 3, 4, 6, 8]], [5, [1, 2, 3, 4, 6]],
      [4, [1, 2, 3, 4]], [3, [1, 2, 3]], [2.5, [1]],
    ],
    "5Y": [
      [8, [1, 2, 3, 4, 6, 8]], [7, [1, 2, 3, 4, 6, 8]], [6, [1, 2, 3, 4, 6, 8]], [5, [1, 2, 3, 4, 6]],
      [4, [1, 2, 3, 4]], [3, [1, 2]], [2.5, [1, 2]],
    ],
    "2.5YR": [
      [8, [1, 2, 3, 4]], [7, [1, 2, 3, 4, 6, 8]], [6, [1, 2, 3, 4, 6, 8]], [5, [1, 2, 3, 4, 6, 8]],
      [4, [1, 2, 3, 4, 6, 8]], [3, [1, 2, 3, 4, 6]], [2.5, [1, 2, 3, 4]],
    ],
    "5YR": [
      [8, [1, 2, 3, 4]], [7, [1, 2, 3, 4, 6, 8]], [6, [1, 2, 3, 4, 6, 8]], [5, [1, 2, 3, 4, 6, 8]],
      [4, [1, 2, 3, 4, 6]], [3, [1, 2, 3, 4]], [2.5, [1, 2]],
    ],
  }
  const counts: Record<PageHue, number> = { "10YR": 36, "7.5YR": 35, "2.5Y": 31, "5Y": 31, "2.5YR": 37, "5YR": 33 }

  it("offers the six hue Pages of Jon's book", () => {
    expect([...PAGE_HUES].sort()).toEqual(["10YR", "2.5Y", "2.5YR", "5Y", "5YR", "7.5YR"])
  })

  it.each(PAGE_HUES)("puts every %s Chip in its value row and chroma column, and none elsewhere", (hue) => {
    const { chips, values } = pageModel(hue)
    expect(chips).toHaveLength(counts[hue])
    expect(values).toEqual(printed[hue].map(([value]) => value))
    for (const { chip, col, row } of chips) {
      expect(chip.notation).toBe(`${hue} ${printed[hue][row][0]}/${CHROMAS[col]}`)
    }
    const expected = printed[hue].flatMap(([value, chromas]) => chromas.map((c) => `${hue} ${value}/${c}`))
    expect(chips.map((c) => c.chip.notation)).toEqual(expected)
  })

  it("has 7 value rows and 6 evenly spaced chroma columns on the 10YR Page", () => {
    const { chips, values } = pageModel("10YR")
    expect(values).toEqual([8, 7, 6, 5, 4, 3, 2])
    expect(new Set(chips.map((c) => c.col))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
    // Columns are positions: /6 is column 4 and /8 is column 5, though they are two chroma steps apart.
    expect(chips.find((c) => c.chip.notation === "10YR 5/6")!.col).toBe(4)
    expect(chips.find((c) => c.chip.notation === "10YR 5/8")!.col).toBe(5)
  })

  it.each<[PageHue, string[]]>([
    ["10YR", ["10YR 8/1", "10YR 8/8", "10YR 5/8", "10YR 2/1"]],
    ["7.5YR", ["7.5YR 8/1", "7.5YR 8/6", "7.5YR 5/8", "7.5YR 2.5/1"]], // 8/8 is not printed; /8 starts at 7/
    ["2.5Y", ["2.5Y 8/1", "2.5Y 8/8", "2.5Y 6/8", "2.5Y 2.5/1"]],
  ])("asks for four Chips that exist on the %s Page: %j", (hue, notations) => {
    expect(pageModel(hue).taps.map((c) => c.chip.notation)).toEqual(notations)
  })

  it.each(PAGE_HUES)("asks for four Chips on the %s Page that no three lie on one line", (hue) => {
    const taps = pageModel(hue).taps
    for (const skip of [0, 1, 2, 3]) {
      const [a, b, c] = taps.filter((_, i) => i !== skip)
      expect((b.col - a.col) * (c.row - a.row) - (b.row - a.row) * (c.col - a.col)).not.toBe(0)
    }
  })

  it("keeps the /1 column running from the top row to the bottom row, the ladder, on every Page", () => {
    for (const hue of PAGE_HUES) {
      const { chips, values } = pageModel(hue)
      expect(chips.filter((c) => c.col === 0).map((c) => c.row)).toEqual(values.map((_, i) => i))
    }
  })

  it.each(["GLEY1", "GLEY2", "10Y-5GY", "WHITE", "10R"] as const)("does not support the %s Page as a Card yet", (hue) => {
    const sim = simulatePhoto({ camera: phone(LIGHTS.warm), page: "10YR" })
    const run = () => readPhoto({ pixels: sim.pixels, card: { kind: "page", hue, taps: sim.corners }, spots: [sim.spot] })
    expect(run).toThrow(UnsupportedCardError)
  })
})

describe("a simulated 10YR Page beside soil", () => {
  it("reads the soil's true Chip through a camera that sees the scene as it is, and leaves no Chip out", () => {
    const { check, reading } = read({ page: "10YR", camera: { light: LIGHTS.neutral } })
    expect(check.ok).toBe(true)
    expect(check.meanDE).toBeLessThan(1)
    expect(check.leftOut).toEqual([])
    expect(reading.corrected?.chip.notation).toBe("10YR 4/3")
  })

  describe.each([
    ["camera color shift", LIGHTS.shift],
    ["warm light", LIGHTS.warm],
    ["dim light", LIGHTS.dim],
  ])("%s, through a camera with a tone curve", (_name, light) => {
    describe.each([
      ["flat", undefined],
      ["tilted", TILT],
    ])("%s", (_view, tilt) => {
      const { check, reading } = read({ page: "10YR", camera: phone(light), tilt })

      it("passes the Card check with nothing left out", () => {
        expect(check.ok).toBe(true)
        expect(check.meanDE).toBeLessThan(CARD_CHECK_GOOD)
        expect(check.leftOut).toEqual([])
      })

      it("reads the true Chip, or a Neighbouring chip, once corrected", () => {
        expect(withinOneChip(reading.corrected!.chip.notation, "10YR 4/3")).toBe(true)
      })

      it("does not read the true Chip uncorrected, so the Card did the work", () => {
        expect(reading.raw.chip.notation).not.toBe("10YR 4/3")
      })
    })
  })

  it("reads a value far too low when the Photo is dim, until it is corrected", () => {
    const { reading } = read({ page: "10YR", camera: phone(LIGHTS.dim) })
    expect(reading.raw.chip.value).toBeLessThan(3)
    expect(reading.corrected!.chip.value).toBeGreaterThanOrEqual(3)
  })

  it("reads soil of other colors too, not only the one the Page is dressed for", () => {
    for (const soil of ["10YR 6/4", "10YR 3/2", "10YR 7/2"]) {
      const { reading } = read({ page: "10YR", camera: phone(LIGHTS.warm), soil })
      expect(withinOneChip(reading.corrected!.chip.notation, soil), soil).toBe(true)
    }
  })

  describe("wrong-order taps", () => {
    const orders: [string, (taps: Corners) => Corners][] = [
      ["started on the lowest /1", ([tl, tr, br, bl]) => [bl, tl, tr, br]],
      ["started on the top right", ([tl, tr, br, bl]) => [tr, br, bl, tl]],
      ["crossed over", ([tl, tr, br, bl]) => [tl, tr, bl, br]],
      ["all the same point", () => [{ x: 300, y: 300 }, { x: 300, y: 300 }, { x: 300, y: 300 }, { x: 300, y: 300 }]],
    ]
    it.each(orders)("fail the Card check when %s", (_name, tap) => {
      for (const tilt of [undefined, TILT]) {
        const { check } = read({ page: "10YR", tilt }, { tap })
        expect(check.ok).toBe(false)
        // Far above any honest Photo (they score under 2), not a multiple of the limit.
        expect(check.meanDE).toBeGreaterThan(5)
      }
    })
  })
})

describe("a simulated 7.5YR Page, which has a different bottom row and /8 column", () => {
  it.each([
    ["flat", undefined],
    ["tilted", TILT],
  ])("reads soil from the Page's own hue, %s", (_view, tilt) => {
    const { check, reading } = read({ page: "7.5YR", soil: "7.5YR 4/4", tilt })
    expect(check.ok).toBe(true)
    expect(check.leftOut).toEqual([])
    expect(withinOneChip(reading.corrected!.chip.notation, "7.5YR 4/4")).toBe(true)
    expect(reading.betterPage).toBeUndefined()
  })

  it("fails the Card check on wrong-order taps", () => {
    const { check } = read({ page: "7.5YR" }, { tap: ([tl, tr, br, bl]) => [bl, tl, tr, br] })
    expect(check.ok).toBe(false)
    expect(check.meanDE).toBeGreaterThan(5)
  })

  it("is not read as the 10YR Page: the same Photo with the wrong hue fails the Card check", () => {
    const sim = simulatePhoto({ camera: phone(LIGHTS.warm), page: "7.5YR" })
    const result = readPhoto({ pixels: sim.pixels, card: { kind: "page", hue: "10YR", taps: sim.corners }, spots: [sim.spot] })
    expect(result.cardCheck!.ok).toBe(false)
  })

  it.each(PAGE_HUES)("reads soil from the %s Page's own hue", (hue) => {
    const soil = `${hue} 4/3`
    const { check, reading } = read({ page: hue, soil })
    expect(check.ok).toBe(true)
    expect(withinOneChip(reading.corrected!.chip.notation, soil)).toBe(true)
  })
})

describe("soil seen through the holes of the Page", () => {
  it.each([
    ["flat", undefined],
    ["tilted", TILT],
  ])("reads the soil behind the Page, not the Chips around the hole, %s", (_view, tilt) => {
    const { sim, result } = read({ page: "10YR", camera: phone(LIGHTS.warm), tilt }, { spots: (s) => [s.spot, ...s.holes] })
    expect(sim.holes.length).toBeGreaterThan(20) // a hole sits between every two vertical neighbours
    const beside = result.readings[0].corrected!.chip.notation
    expect(withinOneChip(beside, "10YR 4/3")).toBe(true)
    for (const [i, hole] of result.readings.slice(1).entries()) {
      expect(withinOneChip(hole.corrected!.chip.notation, "10YR 4/3"), `hole ${i + 1}`).toBe(true)
    }
  })

  it("reads a Chip's own color when the Spot is tapped on the Chip instead: only the holes show soil", () => {
    const at = pageModel("10YR").chips.findIndex((c) => c.chip.notation === "10YR 6/3")
    const { result } = read({ page: "10YR", camera: phone(LIGHTS.warm) }, { spots: (s) => [s.patches[at]] })
    expect(result.readings[0].corrected!.chip.notation).toBe("10YR 6/3")
  })

  it("reads a Spot in a hole even when the Page is small in the Photo and the usual Spot circle is wider than the hole", () => {
    // The usual Spot circle is 2.5% of the Photo's long side: 24 px here, and the tilted Page's
    // holes are about 14 px across the radius. The Spot is cut down to the hole.
    const { result } = read({ page: "10YR", camera: phone(LIGHTS.warm), tilt: TILT }, { spots: (s) => [s.holes[3]] })
    expect(withinOneChip(result.readings[0].corrected!.chip.notation, "10YR 4/3")).toBe(true)
  })
})

describe("sampling stays on the solid middle of every Chip", () => {
  // A soil that is nothing like any Chip, so a read circle that reaches into a hole is obvious.
  const soil = "5PB 4/8"
  it.each([
    ["flat", undefined],
    ["tilted", TILT],
  ])("keeps every Chip's read circle clear of the holes, %s", (_view, tilt) => {
    for (const hue of PAGE_HUES) {
      const sim = simulatePhoto({ camera: phone(LIGHTS.warm), page: hue, soil, tilt })
      const sites = pageSites(hue, sim.corners)
      expect(sites).toHaveLength(pageModel(hue).chips.length)
      sites.forEach((site, i) => {
        // The Chip is one flat color plus a little noise; a hole would add the soil's blue.
        expect(spread(circle(sim.pixels, site)), `${hue} Chip ${i}`).toBeLessThanOrEqual(6)
      })
    }
  })

  it("puts the paper sites on bare white paper, away from Chips and holes", () => {
    for (const hue of PAGE_HUES) {
      const sim = simulatePhoto({ camera: phone(LIGHTS.warm), page: hue, soil, tilt: TILT })
      const paper = pagePaperSites(hue, sim.corners)
      // The grid is 7 rows by 6 columns; what is not a Chip is paper.
      expect(paper).toHaveLength(42 - pageModel(hue).chips.length)
      paper.forEach((site, i) => expect(spread(circle(sim.pixels, site)), `${hue} paper ${i}`).toBeLessThanOrEqual(6))
    }
  })
})

describe("a worn Page", () => {
  // Jon's 10YR Page has smudged 8/1 and 7/1, which are steps of the ladder. A smudge is dirt over
  // part of a Chip; here it covers a share of the whole Chip, which is the hardest case for a read circle.
  it("leaves out two smudged ladder Chips, names them, and still reads within one Chip", () => {
    const smudged = { "10YR 8/1": 0.3, "10YR 7/1": 0.3 }
    for (const light of [LIGHTS.warm, LIGHTS.dim, LIGHTS.shift]) {
      for (const tilt of [undefined, TILT]) {
        const { check, reading } = read({ page: "10YR", camera: phone(light), smudged, tilt })
        expect(check.leftOut).toEqual(["10YR 8/1", "10YR 7/1"])
        expect(check.ok).toBe(true)
        expect(withinOneChip(reading.corrected!.chip.notation, "10YR 4/3")).toBe(true)
      }
    }
  })

  it("leaves out two smudged Chips off the ladder, and still reads within one Chip", () => {
    const smudged = { "10YR 4/6": 0.35, "10YR 6/3": 0.35 }
    const { check, reading } = read({ page: "10YR", camera: phone(LIGHTS.warm), smudged })
    expect(check.leftOut).toEqual(["10YR 6/3", "10YR 4/6"])
    expect(check.ok).toBe(true)
    expect(withinOneChip(reading.corrected!.chip.notation, "10YR 4/3")).toBe(true)
  })

  it("leaves out the blotchy Chip of a 7.5YR Page", () => {
    const { check, reading } = read({ page: "7.5YR", soil: "7.5YR 4/4", smudged: { "7.5YR 4/6": 0.35 } })
    expect(check.leftOut).toEqual(["7.5YR 4/6"])
    expect(withinOneChip(reading.corrected!.chip.notation, "7.5YR 4/4")).toBe(true)
  })

  it("names a single smudged Chip, and only that one", () => {
    const { check } = read({ page: "10YR", smudged: { "10YR 5/3": 0.4 } })
    expect(check.leftOut).toEqual(["10YR 5/3"])
  })

  it("does not rescue a Page that is dirty all over: the Card check fails", () => {
    const dirty = Object.fromEntries(
      pageModel("10YR").chips.filter((c) => c.chip.value >= 4 && c.col % 2 === 0).map((c) => [c.chip.notation, 0.4]),
    )
    expect(Object.keys(dirty).length).toBeGreaterThan(8)
    const { check } = read({ page: "10YR", smudged: dirty })
    expect(check.ok).toBe(false)
  })
})

describe("the hue suggestion", () => {
  it("is set when the soil's nearest Chip is on a different hue than the Page used", () => {
    // The correction is weaker this far from the Page's hue, so the Reading may land a step short.
    const { reading } = read({ page: "10YR", soil: "5Y 6/4" })
    const nearest = reading.corrected!.chip
    expect(withinOneChip(nearest.notation, "5Y 6/4")).toBe(true)
    expect(nearest.hue).not.toBe("10YR")
    expect(reading.betterPage).toBe(nearest.pages[0])
    expect(reading.betterPage).toMatch(/^(2\.5Y|5Y)$/)
  })

  it("is not set when the soil's nearest Chip is on the Page used", () => {
    expect(read({ page: "10YR", soil: "10YR 6/4" }).reading.betterPage).toBeUndefined()
  })

  it("is not set for a Chip printed on two Pages when one of them is the Page used", () => {
    // 10YR 8/2 is on the 10YR Page and on the WHITE Page.
    expect(read({ page: "10YR", soil: "10YR 8/2" }).reading.betterPage).toBeUndefined()
  })

  it("is never set with no Card or a ColorChecker", () => {
    const sim = simulatePhoto({ camera: phone(LIGHTS.warm), soil: "2.5Y 6/4" })
    const result = readPhoto({ pixels: sim.pixels, card: { kind: "none" }, spots: [sim.spot] })
    expect(result.readings[0].betterPage).toBeUndefined()
  })
})
