// Seam 1 again: which correction the engine uses, and what the Card check measures. Every
// test builds a simulated Photo and calls readPhoto, like engine.test.ts. The comparison in
// docs/correction-comparison.md comes from the cases below.
import * as munsell from "munsell"
import { beforeAll, describe, expect, it } from "vitest"
import { CARD_CHECK_GOOD, deltaE2000, patchSites, readPhoto } from "./index"
import type { Corners } from "./index"
import { linearToLab, rgb255ToLinear, type Vec3 } from "./color"
import { fitMatrix, linearizeThen, pchip, type Fit } from "./correction"
import { fitRootPolynomial, piecewiseLinear } from "./correctionCandidates.testkit"
import { LIGHTS, SIM_CORNERS, SIM_SOIL, SIM_SPOT, simulatePhoto, type SimCamera, type SimPhoto } from "./simulate"

const patchCenters = (corners: Corners) => patchSites(corners).map((site) => site.center)

// ---- how far a Reading is from the truth: the same judge as engine.test.ts ----
const PAGES = ["10R", "2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y"]
const VALUES = [2.5, 3, 4, 5, 6, 7, 8]
const CHROMAS = [1, 2, 3, 4, 6, 8]

/** Steps between two Chips on the soil book's grid: pages, plus value rows, plus chroma columns. */
function stepsApart(a: string, b: string): number {
  const parse = (n: string) => {
    const m = /^(\S+) ([\d.]+)\/([\d.]+)$/.exec(n)
    return m ? [PAGES.indexOf(m[1]), VALUES.indexOf(Number(m[2])), CHROMAS.indexOf(Number(m[3]))] : null
  }
  const pa = parse(a)
  const pb = parse(b)
  if (a === b) return 0
  if (!pa || !pb || pa.includes(-1) || pb.includes(-1)) return Infinity
  return pa.reduce((sum, v, i) => sum + Math.abs(v - pb[i]), 0)
}

/** The soil's true color. The soil is never part of the Card fit, so it is a held-out reference. */
const soilLab = (soil: string) => linearToLab(munsell.munsellToLinearRgb(soil) as Vec3)

// ---- the cases: 8 soils, 5 lights, 4 tone curve strengths ----
const SOILS = ["10YR 4/3", "7.5YR 5/6", "10YR 6/3", "2.5Y 7/2", "5YR 3/4", "10R 4/6", "10YR 3/1", "2.5Y 8/2"]
const TONE_CURVES = [0, 0.3, 0.5, 0.7]
const SHIFT_AND_DIM = (lin: Vec3) => LIGHTS.shift([lin[0] * 0.5, lin[1] * 0.5, lin[2] * 0.5])
const SHADE = (lin: Vec3): Vec3 => [lin[0] * 0.64, lin[1] * 0.76, lin[2] * 0.96] // blue-ish and dim
const LIGHT_CASES: [string, SimCamera["light"]][] = [
  ["camera color shift", LIGHTS.shift],
  ["warm light", LIGHTS.warm],
  ["dim light", LIGHTS.dim],
  ["shade", SHADE],
  ["dim light with a color shift", SHIFT_AND_DIM],
]

/** Read the simulated soil. `correction` unset reads with the correction the engine ships. */
function readSoil(photo: SimPhoto, soil: string, options: { corners?: Corners; correction?: Fit } = {}) {
  const { corners = SIM_CORNERS, correction } = options
  const result = readPhoto({
    pixels: photo.pixels,
    card: { kind: "colorchecker", corners },
    spots: [SIM_SPOT],
    ...(correction ? { correction } : {}),
  })
  const corrected = result.readings[0].corrected!
  return {
    cardCheck: result.cardCheck!,
    chipsOff: stepsApart(corrected.chip.notation, soil),
    soilDE: deltaE2000(linearToLab(rgb255ToLinear(corrected.rgb)), soilLab(soil)),
  }
}
type Result = ReturnType<typeof readSoil>

describe("the Card check is held out", () => {
  const photo = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: 0.5 } })

  it("passes the shipped correction on a Photo it reads well", () => {
    const { cardCheck, chipsOff } = readSoil(photo, SIM_SOIL)
    expect(chipsOff).toBe(0)
    expect(cardCheck.ok).toBe(true)
  })

  it("fails a correction flexible enough to memorise the Card", () => {
    // Fitted on all 24 patches, 13 terms (root-polynomial degree 3) or 22 terms (degree 4)
    // bend to the Card and look good on it. Asked to predict a patch it was not fitted on,
    // each is far off. The Card check measures the second thing, so it fails them.
    for (const degree of [3, 4] as const) {
      const { cardCheck } = readSoil(photo, SIM_SOIL, { correction: fitRootPolynomial(degree) })
      expect(cardCheck.ok, `degree ${degree}`).toBe(false)
    }
  })
})

describe("the shipped correction against the alternatives, across the simulated cases", () => {
  const CANDIDATES = {
    shipped: undefined, // linearize along the gray ladder with PCHIP, then a 3x3
    matrix: fitMatrix,
    rootPolynomial2: fitRootPolynomial(2),
    linearPiecewise: linearizeThen(piecewiseLinear),
    linearPchipRootPolynomial2: linearizeThen(pchip, fitRootPolynomial(2)),
  }
  type Name = keyof typeof CANDIDATES
  interface Row {
    soil: string
    light: string
    toneCurve: number
    results: Record<Name, Result>
  }
  const rows: Row[] = []

  beforeAll(() => {
    for (const soil of SOILS) {
      for (const toneCurve of TONE_CURVES) {
        for (const [light, fn] of LIGHT_CASES) {
          const photo = simulatePhoto({ camera: { light: fn, toneCurve }, soil })
          const results = Object.fromEntries(
            Object.entries(CANDIDATES).map(([name, correction]) => [name, readSoil(photo, soil, { correction })]),
          ) as Record<Name, Result>
          rows.push({ soil, light, toneCurve, results })
        }
      }
    }
  }, 120_000)

  const mean = (name: Name, pick: (r: Result) => number, where: (row: Row) => boolean = () => true) => {
    const picked = rows.filter(where).map((row) => pick(row.results[name]))
    return picked.reduce((sum, v) => sum + v, 0) / picked.length
  }
  const check = (r: Result) => r.cardCheck.meanDE
  const error = (r: Result) => r.soilDE

  it("covers 160 cases", () => {
    expect(rows).toHaveLength(160)
  })

  it("ships the correction with the lowest mean held-out Card check", () => {
    for (const name of Object.keys(CANDIDATES) as Name[]) {
      if (name !== "shipped") expect(mean("shipped", check), name).toBeLessThan(mean(name, check))
    }
  })

  it("ships the correction that also reads the soil closest to its true color", () => {
    for (const name of Object.keys(CANDIDATES) as Name[]) {
      if (name !== "shipped") expect(mean("shipped", error), name).toBeLessThan(mean(name, error))
    }
  })

  it("reads every soil within 3 of its true color, and within one Chip unless it is chroma 1", () => {
    // At chroma 1 neighbouring hue pages are about 1 apart in CIEDE2000, so a Reading 2 off
    // can sit two pages away.
    for (const row of rows) {
      const r = row.results.shipped
      const where = `${row.soil}, ${row.light}, tone curve ${row.toneCurve}`
      expect(r.soilDE, where).toBeLessThan(3)
      if (r.chipsOff > 1) expect(row.soil, where).toMatch(/\/1$/)
    }
  })

  it("is not thrown by a strong tone curve, and costs little on a camera without one", () => {
    const at = (curve: number) => (row: Row) => row.toneCurve === curve
    expect(mean("matrix", error, at(0.7))).toBeGreaterThan(4)
    expect(mean("shipped", error, at(0.7))).toBeLessThan(1)
    expect(mean("shipped", error, at(0)) - mean("matrix", error, at(0))).toBeLessThan(0.15)
  })

  it("finds root-polynomial a wash against the 3x3 on the Card check", () => {
    // A lower mean, no significant difference (Wilcoxon p = 0.97 over these 160 cases, see
    // docs/correction-comparison.md). It wins the dim lights and loses the others.
    expect(Math.abs(mean("rootPolynomial2", check) - mean("matrix", check))).toBeLessThan(0.25)
    const dim = (row: Row) => row.light.startsWith("dim light")
    const bright = (row: Row) => !dim(row) && row.light !== "shade"
    expect(mean("rootPolynomial2", check, dim)).toBeLessThan(mean("matrix", check, dim))
    expect(mean("rootPolynomial2", check, bright)).toBeGreaterThan(mean("matrix", check, bright))
    // The Reading it gives is worse, not a wash.
    expect(mean("rootPolynomial2", error)).toBeGreaterThan(mean("matrix", error))
  })

  it("gains nothing from root-polynomial terms once the curve is linearized", () => {
    expect(mean("linearPchipRootPolynomial2", check)).toBeGreaterThan(mean("shipped", check))
    expect(mean("linearPchipRootPolynomial2", error)).toBeGreaterThan(mean("shipped", error))
  })

  it("prefers PCHIP to straight lines between the ladder steps", () => {
    expect(mean("shipped", check)).toBeLessThan(mean("linearPiecewise", check))
  })
})

describe("the Card check on a Card that is not right", () => {
  /** Paint over one Card patch (0-23) with a flat 8-bit color, like a smudge or a glare spot. */
  function paintPatch(photo: SimPhoto, patch: number, rgb: Vec3) {
    const { x, y } = patchCenters(SIM_CORNERS)[patch]
    const { width, data } = photo.pixels
    for (let j = Math.round(y) - 27; j <= Math.round(y) + 27; j++) {
      for (let i = Math.round(x) - 27; i <= Math.round(x) + 27; i++) data.set(rgb, (j * width + i) * 4)
    }
  }
  /** A shadow over the right three columns of the Card: those patches come out `factor` as bright. */
  function shadeRightHalf(photo: SimPhoto, factor: number) {
    const { width, data } = photo.pixels
    patchCenters(SIM_CORNERS).forEach(({ x, y }, patch) => {
      if (patch % 6 < 3) return
      for (let j = Math.round(y) - 31; j <= Math.round(y) + 31; j++) {
        for (let i = Math.round(x) - 31; i <= Math.round(x) + 31; i++) {
          for (let k = 0; k < 3; k++) data[(j * width + i) * 4 + k] *= factor
        }
      }
    })
  }
  const DAMAGE: [string, (photo: SimPhoto) => void][] = [
    ["a dirty patch", (p) => paintPatch(p, 13, [200, 60, 60])],
    ["two dirty patches", (p) => (paintPatch(p, 13, [200, 60, 60]), paintPatch(p, 21, [60, 60, 200]))],
    ["glare on a patch", (p) => paintPatch(p, 1, [250, 250, 250])],
    ["a light shadow across the Card", (p) => shadeRightHalf(p, 0.85)],
    ["a heavy shadow across the Card", (p) => shadeRightHalf(p, 0.5)],
  ]

  it("fails when the corners are tapped in the wrong order, however they are shuffled", () => {
    const [tl, tr, br, bl] = SIM_CORNERS
    const photo = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: 0.5 } })
    const shuffles: Corners[] = [
      [bl, tl, tr, br], [br, bl, tl, tr], [tr, br, bl, tl], // turned a quarter, half, three quarters
      [tr, tl, bl, br], [tl, bl, br, tr], [bl, br, tr, tl], [br, tr, tl, bl], // mirrored
    ]
    for (const corners of shuffles) {
      const { cardCheck } = readSoil(photo, SIM_SOIL, { corners })
      expect(cardCheck.ok).toBe(false)
      expect(cardCheck.meanDE).toBeGreaterThan(10 * CARD_CHECK_GOOD)
    }
  })

  it("still passes when the corners are tapped a patch's width or so off", () => {
    const photo = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: 0.5 } })
    const corners = SIM_CORNERS.map((p) => ({ x: p.x + 24, y: p.y })) as Corners
    const { cardCheck, chipsOff } = readSoil(photo, SIM_SOIL, { corners })
    expect(cardCheck.ok).toBe(true)
    expect(chipsOff).toBeLessThanOrEqual(1)
  })

  it("never passes a damaged Card whose Reading is more than one Chip off", () => {
    // Damage that moves the Reading by more than a Chip is caught. Damage that does not may
    // or may not be: a smudge on a patch the fit does not lean on is harmless, and passes.
    const cases: Result[] = []
    for (const toneCurve of [0.3, 0.7]) {
      for (const [, light] of LIGHT_CASES.filter(([name]) => name !== "camera color shift")) {
        for (const [, damage] of DAMAGE) {
          const photo = simulatePhoto({ camera: { light, toneCurve } })
          damage(photo)
          cases.push(readSoil(photo, SIM_SOIL))
        }
      }
    }
    const wrong = cases.filter((c) => c.chipsOff > 1)
    expect(wrong.length).toBeGreaterThan(0) // the damage does move some Readings by 2 Chips or more
    for (const c of wrong) expect(c.cardCheck.ok).toBe(false)
  })

  it("passes a dark, dull soil the 3x3 once passed while reading it two Chips off", () => {
    // 10YR 3/2 under a 3x3 and a gentle tone curve read 7.5YR 2.5/2 with the old threshold
    // of 3 still saying good. The shipped correction reads it right.
    for (const [, light] of LIGHT_CASES) {
      for (const toneCurve of [0.3, 0.5]) {
        const photo = simulatePhoto({ camera: { light, toneCurve }, soil: "10YR 3/2" })
        const { cardCheck, chipsOff } = readSoil(photo, "10YR 3/2")
        expect(cardCheck.ok).toBe(true)
        expect(chipsOff).toBeLessThanOrEqual(1)
      }
    }
  })
})
