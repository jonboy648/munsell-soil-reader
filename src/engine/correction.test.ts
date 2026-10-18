// Seam 1 again: which correction the engine uses, and what the Card check measures. Every
// test builds a simulated Photo and calls readPhoto, like engine.test.ts. The comparison
// table in docs/correction-comparison.md comes from the cases below.
import * as munsell from "munsell"
import { describe, expect, it } from "vitest"
import { deltaE2000, readPhoto } from "./index"
import { linearToLab, rgb255ToLinear, type Vec3 } from "./color"
import { LIGHTS, SIM_CORNERS, SIM_SOIL, SIM_SPOT, simulatePhoto, type SimCamera } from "./simulate"

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
const TRUE_SOIL_LAB = linearToLab(munsell.munsellToLinearRgb(SIM_SOIL) as Vec3)

// ---- the cases: five lights through a camera with a tone curve at three strengths ----
const TONE_CURVES = [0.3, 0.5, 0.7]
const SHIFT_AND_DIM = (lin: Vec3) => LIGHTS.shift([lin[0] * 0.5, lin[1] * 0.5, lin[2] * 0.5])
const SHADE = (lin: Vec3): Vec3 => [lin[0] * 0.64, lin[1] * 0.76, lin[2] * 0.96] // blue-ish and dim
const LIGHT_CASES: [string, SimCamera["light"]][] = [
  ["camera color shift", LIGHTS.shift],
  ["warm light", LIGHTS.warm],
  ["dim light", LIGHTS.dim],
  ["shade", SHADE],
  ["dim light with a color shift", SHIFT_AND_DIM],
]
const CASES = TONE_CURVES.flatMap((toneCurve) =>
  LIGHT_CASES.map(([name, light]) => ({ name: `${name}, tone curve ${toneCurve}`, camera: { light, toneCurve } })),
)

/** Read the simulated soil. `correctionDegree` unset reads with the correction the engine ships. */
function read(camera: SimCamera, correctionDegree?: 1 | 2 | 3 | 4) {
  const sim = simulatePhoto({ camera })
  const result = readPhoto({
    pixels: sim.pixels,
    card: { kind: "colorchecker", corners: SIM_CORNERS },
    spots: [SIM_SPOT],
    ...(correctionDegree ? { correctionDegree } : {}),
  })
  const corrected = result.readings[0].corrected!
  return {
    cardCheck: result.cardCheck!,
    chip: corrected.chip.notation,
    chipsOff: stepsApart(corrected.chip.notation, SIM_SOIL),
    soilDE: deltaE2000(linearToLab(rgb255ToLinear(corrected.rgb)), TRUE_SOIL_LAB),
    corrected,
  }
}

describe("the Card check is held out", () => {
  const warm = { light: LIGHTS.warm, toneCurve: 0.3 }

  it("passes the 3x3 on a Photo it reads well", () => {
    expect(read(warm, 1).cardCheck.ok).toBe(true)
  })

  it("fails a correction flexible enough to memorise the Card", () => {
    // Fitted on all 24 patches, 13 terms (degree 3) or 22 terms (degree 4) bend to the Card
    // and look good on it. Asked to predict a patch it was not fitted on, each is far off.
    // The Card check measures the second thing, so it fails them.
    expect(read(warm, 3).cardCheck.ok).toBe(false)
    expect(read(warm, 4).cardCheck.ok).toBe(false)
  })
})

describe("the 3x3 against root-polynomial, across the simulated cases", () => {
  const results = CASES.map((c) => ({
    ...c,
    matrix: read(c.camera, 1),
    root2: read(c.camera, 2),
  }))

  it("reads the soil no further from its true color with the 3x3, in any case", () => {
    // Root-polynomial degree 2 is a mixed result on the Card check (next test), so the
    // Reading itself decides: how far the corrected soil is from its true color. (One case
    // ties, because both land on the same 8-bit color.)
    for (const c of results) expect(c.matrix.soilDE, c.name).toBeLessThanOrEqual(c.root2.soilDE)
    const mean = (pick: (c: (typeof results)[number]) => number) =>
      results.reduce((sum, c) => sum + pick(c), 0) / results.length
    expect(mean((c) => c.matrix.soilDE)).toBeLessThan(mean((c) => c.root2.soilDE))
  })

  it("is not a clear win on the Card check for root-polynomial", () => {
    // The ticket's rule: use root-polynomial only if its held-out Card check is lower across
    // the cases. It is lower in some, higher in others.
    const lower = results.filter((c) => c.root2.cardCheck.meanDE < c.matrix.cardCheck.meanDE)
    expect(lower.length).toBeGreaterThan(0)
    expect(lower.length).toBeLessThan(results.length)
  })

  it("ships the 3x3", () => {
    for (const c of results) {
      const shipped = read(c.camera)
      expect(shipped.cardCheck, c.name).toEqual(c.matrix.cardCheck)
      expect(shipped.corrected, c.name).toEqual(c.matrix.corrected)
    }
  })
})

describe("what the Card check tells the user, with the shipped correction", () => {
  const results = CASES.map((c) => ({ ...c, ...read(c.camera) }))

  it("is good on a phone-like tone curve, and those Readings are right", () => {
    for (const c of results.filter((r) => r.camera.toneCurve === 0.3)) {
      expect(c.cardCheck.ok, c.name).toBe(true)
      expect(c.chipsOff, c.name).toBe(0)
    }
  })

  it("never passes a Photo whose Reading is more than one Chip off", () => {
    for (const c of results.filter((r) => r.chipsOff > 1)) expect(c.cardCheck.ok, c.name).toBe(false)
    // The cases this checks exist: at tone curve 0.7 the 3x3 is out of its depth.
    expect(results.filter((r) => r.chipsOff > 1).length).toBeGreaterThan(0)
  })

  it("gets worse as the tone curve gets stronger", () => {
    const mean = (curve: number) => {
      const rows = results.filter((r) => r.camera.toneCurve === curve)
      return rows.reduce((sum, r) => sum + r.cardCheck.meanDE, 0) / rows.length
    }
    expect(mean(0.3)).toBeLessThan(mean(0.5))
    expect(mean(0.5)).toBeLessThan(mean(0.7))
  })
})
