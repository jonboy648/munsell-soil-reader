// Seam 1: the reading engine. Every test builds a simulated Photo, calls readPhoto, and
// checks what a caller would see. Nothing here reaches into the engine's helpers.
import { describe, expect, it } from "vitest"
import { CARD_CHECK_GOOD, UnsupportedCardError, deltaE2000, readPhoto } from "./index"
import type { Corners, Reading } from "./index"
import {
  LIGHTS,
  PHONE_TONE_CURVE,
  SIM_CORNERS,
  SIM_SOIL,
  SIM_SPOT,
  simulatePhoto,
  type SimCamera,
} from "./simulate"

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
/** The same Chip, or one step away in value, in chroma or on the next page. */
const withinOneChip = (a: string, b: string) => stepsApart(a, b) <= 1

// ---- helpers ----
const phone = (light: SimCamera["light"]): SimCamera => ({ light, toneCurve: PHONE_TONE_CURVE })
const colorchecker = (corners: Corners = SIM_CORNERS) => ({ kind: "colorchecker" as const, corners })

function readSimulated(camera: SimCamera, corners: Corners = SIM_CORNERS) {
  const sim = simulatePhoto({ camera })
  return readPhoto({ pixels: sim.pixels, card: colorchecker(corners), spots: [SIM_SPOT] })
}

function firstReading(result: { readings: Reading[] }): Reading {
  expect(result.readings).toHaveLength(1)
  return result.readings[0]
}

describe("CIEDE2000 (Sharma, Wu and Dalal 2005 test pairs)", () => {
  const pairs: [[number, number, number], [number, number, number], number][] = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [56, -27, -3], 31.903],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ]
  it.each(pairs)("%j vs %j is %f", (a, b, expected) => {
    expect(deltaE2000(a, b)).toBeCloseTo(expected, 4)
    expect(deltaE2000(b, a)).toBeCloseTo(expected, 4)
  })
})

describe("readPhoto with a ColorChecker", () => {
  it("reads the soil's true Chip through a camera that sees the scene as it is", () => {
    const result = readSimulated({ light: LIGHTS.neutral })
    const reading = firstReading(result)
    expect(result.cardCheck?.ok).toBe(true)
    expect(result.cardCheck!.meanDE).toBeLessThan(1)
    expect(reading.corrected?.chip.notation).toBe(SIM_SOIL)
    expect(reading.raw.chip.notation).toBe(SIM_SOIL)
  })

  describe.each([
    ["camera color shift", LIGHTS.shift],
    ["warm light", LIGHTS.warm],
    ["dim light", LIGHTS.dim],
  ])("%s, through a camera with a tone curve", (_name, light) => {
    const result = readSimulated(phone(light))
    const reading = firstReading(result)

    it("passes the Card check", () => {
      expect(result.cardCheck?.ok).toBe(true)
      expect(result.cardCheck!.meanDE).toBeLessThan(CARD_CHECK_GOOD)
    })

    it("reads the true Chip, or a Neighbouring chip, once corrected", () => {
      expect(withinOneChip(reading.corrected!.chip.notation, SIM_SOIL)).toBe(true)
    })

    it("does not read the true Chip uncorrected", () => {
      // The check that can fail: if the Card did nothing, the raw Reading would be right too.
      expect(reading.raw.chip.notation).not.toBe(SIM_SOIL)
    })
  })

  it("reads a value far too low when the Photo is dim, until it is corrected", () => {
    const reading = firstReading(readSimulated(phone(LIGHTS.dim)))
    expect(reading.raw.chip.value).toBeLessThan(3)
    expect(reading.corrected!.chip.value).toBeGreaterThanOrEqual(3)
  })

  it("fails the Card check when the corners are tapped in the wrong order", () => {
    const [tl, tr, br, bl] = SIM_CORNERS
    const result = readSimulated(phone(LIGHTS.warm), [bl, tl, tr, br]) // started on the white patch
    expect(result.cardCheck?.ok).toBe(false)
    expect(result.cardCheck!.meanDE).toBeGreaterThan(CARD_CHECK_GOOD)
  })

  it("fits a tone-curved Card less well than a linear one", () => {
    const meanDE = (toneCurve: number) =>
      readSimulated({ light: LIGHTS.warm, toneCurve }).cardCheck!.meanDE
    expect(meanDE(0)).toBeLessThan(meanDE(PHONE_TONE_CURVE))
    expect(meanDE(PHONE_TONE_CURVE)).toBeLessThan(meanDE(0.7))
  })

  it("reads each Spot separately, in the order given", () => {
    const sim = simulatePhoto({ camera: phone(LIGHTS.warm) })
    const ground = { x: 300, y: 560 } // bare ground below the Card, a darker, browner soil
    const result = readPhoto({
      pixels: sim.pixels,
      card: colorchecker(),
      spots: [SIM_SPOT, ground],
    })
    expect(result.readings.map((r) => r.spot)).toEqual([SIM_SPOT, ground])
    expect(result.readings[0].corrected!.chip.notation).not.toBe(result.readings[1].corrected!.chip.notation)
    expect(withinOneChip(result.readings[1].corrected!.chip.notation, "7.5YR 3/2")).toBe(true)
  })

  it("gives each Reading its nearest Chip, the top 3 by distance, and display colors", () => {
    const { corrected } = firstReading(readSimulated(phone(LIGHTS.warm)))
    expect(corrected!.top3).toHaveLength(3)
    expect(corrected!.top3[0].chip).toEqual(corrected!.chip)
    expect(corrected!.top3[0].de).toBe(corrected!.chipDE)
    const distances = corrected!.top3.map((t) => t.de)
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
    expect(new Set(corrected!.top3.map((t) => t.chip.notation)).size).toBe(3)
    expect(corrected!.exact).toMatch(/^[\d.]+[A-Z]+ [\d.]+\/[\d.]+$/)
    for (const rgb of [corrected!.rgb, corrected!.chipRgb]) {
      expect(rgb).toHaveLength(3)
      for (const v of rgb) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true)
    }
  })

  it("takes the median of a Spot, so a few blown pixels do not move the Reading", () => {
    const clean = simulatePhoto({ camera: phone(LIGHTS.warm) })
    const speckled = simulatePhoto({ camera: phone(LIGHTS.warm) })
    // Blow out roughly one soil pixel in seven, like specular glints on wet soil.
    const { width, data } = speckled.pixels
    for (let y = 150; y < 390; y++) {
      for (let x = 650; x < 890; x++) {
        if ((x + 3 * y) % 7 === 0) data.fill(255, (y * width + x) * 4, (y * width + x) * 4 + 3)
      }
    }
    const read = (pixels: typeof clean.pixels) =>
      firstReading(readPhoto({ pixels, card: colorchecker(), spots: [SIM_SPOT] }))
    expect(read(speckled.pixels).corrected!.chip.notation).toBe(read(clean.pixels).corrected!.chip.notation)
  })
})

describe("readPhoto with no Card", () => {
  const sim = simulatePhoto({ camera: phone(LIGHTS.warm), card: false })
  const result = readPhoto({ pixels: sim.pixels, card: { kind: "none" }, spots: [SIM_SPOT] })
  const reading = firstReading(result)

  it("gives a raw Reading only", () => {
    expect(result.cardCheck).toBeUndefined()
    expect(reading.corrected).toBeUndefined()
    expect(reading.raw.chip.notation).toMatch(/^\S+ [\d.]+\/[\d.]+$/)
  })

  it("is thrown off by the light, since nothing corrects it", () => {
    expect(reading.raw.chip.notation).not.toBe(SIM_SOIL)
  })
})

describe("readPhoto with a Page", () => {
  it("says plainly that Pages are not supported yet", () => {
    const sim = simulatePhoto({ camera: phone(LIGHTS.warm) })
    const read = () =>
      readPhoto({ pixels: sim.pixels, card: { kind: "page", hue: "10YR", corners: SIM_CORNERS }, spots: [SIM_SPOT] })
    expect(read).toThrow(UnsupportedCardError)
    expect(read).toThrow(/not supported yet/)
  })
})
