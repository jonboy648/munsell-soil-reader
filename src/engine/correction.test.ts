// Seam 1 again: which correction the engine uses, and what the Card check measures. Every
// test builds a simulated Photo and calls readPhoto, like engine.test.ts. The comparison in
// docs/correction-comparison.md comes from the cases below.
import * as munsell from "munsell"
import { beforeAll, describe, expect, it } from "vitest"
import { CARD_CHECK_CAUTION, deltaE2000, patchSites, readPhoto } from "./index"
import type { Corners } from "./index"
import { decode, encode, linearToLab, rgb255ToLinear, type Vec3 } from "./color"
import { PATCH_LINEAR } from "./colorchecker"
import { fitMatrix, linearizeThen, pchip, type Fit } from "./correction"
import { fitRootPolynomial, leastSquaresPolynomial, linearizeShared } from "./correctionCandidates.testkit"
import realSensor from "./golden/realSensor.json"
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

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length

describe("the Card check is held out", () => {
  const photo = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: 0.5 } })

  it("passes the shipped correction on a Photo it reads well", () => {
    const { cardCheck, chipsOff } = readSoil(photo, SIM_SOIL)
    expect(chipsOff).toBe(0)
    expect(cardCheck.ok).toBe(true)
    expect(cardCheck.verdict).toBe("good")
  })

  it("fails a correction flexible enough to memorise the Card", () => {
    // Fitted on all 24 patches, 13 terms (root-polynomial degree 3) or 22 terms (degree 4)
    // bend to the Card and look good on it. Asked to predict a patch it was not fitted on,
    // each is far off. The Card check measures the second thing, so it fails them.
    for (const degree of [3, 4] as const) {
      const { cardCheck } = readSoil(photo, SIM_SOIL, { correction: fitRootPolynomial(degree) })
      expect(cardCheck.verdict, `degree ${degree}`).toBe("failed")
    }
  })
})

describe("the shipped correction against the alternatives, across the simulated cases", () => {
  const CANDIDATES = {
    shipped: undefined, // a PCHIP curve through the grays for each channel, then a 3x3
    matrix: fitMatrix,
    rootPolynomial2: fitRootPolynomial(2),
    curveRootPolynomial2: linearizeThen(pchip, fitRootPolynomial(2)),
    cubicCurves: linearizeThen(leastSquaresPolynomial(3)),
    sharedCurve: linearizeShared(), // one curve shape for the three channels
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

  const meanOf = (name: Name, pick: (r: Result) => number, where: (row: Row) => boolean = () => true) =>
    mean(rows.filter(where).map((row) => pick(row.results[name])))
  const check = (r: Result) => r.cardCheck.meanDE
  const error = (r: Result) => r.soilDE

  it("covers 160 cases", () => {
    expect(rows).toHaveLength(160)
  })

  it("passes every well-formed Photo: none fails, and nearly all are good", () => {
    const verdicts = rows.map((row) => row.results.shipped.cardCheck.verdict)
    expect(verdicts.filter((v) => v === "failed")).toHaveLength(0)
    expect(verdicts.filter((v) => v === "good").length).toBeGreaterThanOrEqual(0.9 * rows.length)
    // A Photo that is only caution has a gray step left out, and says which.
    for (const row of rows) {
      const { cardCheck } = row.results.shipped
      if (cardCheck.verdict === "caution") expect(cardCheck.leftOut.length, `${row.soil}, ${row.light}`).toBeGreaterThan(0)
    }
  })

  it("reads every soil within 3.5 of its true color, and within one Chip unless it is chroma 1", () => {
    // At chroma 1 neighbouring hue pages are about 1 apart in CIEDE2000, so a Reading 2 off
    // can sit two pages away.
    for (const row of rows) {
      const r = row.results.shipped
      const where = `${row.soil}, ${row.light}, tone curve ${row.toneCurve}`
      expect(r.soilDE, where).toBeLessThan(3.5)
      if (r.chipsOff > 1) expect(row.soil, where).toMatch(/\/1$/)
    }
  })

  it("reads the soil closer to its true color than a 3x3 or root-polynomial, and as well as any other curve", () => {
    expect(meanOf("shipped", error)).toBeLessThan(meanOf("matrix", error))
    expect(meanOf("shipped", error)).toBeLessThan(meanOf("rootPolynomial2", error))
    // On a clean simulated camera a curve through every gray is as exact as it gets.
    expect(meanOf("shipped", error)).toBeLessThanOrEqual(meanOf("cubicCurves", error))
    expect(meanOf("shipped", error)).toBeLessThanOrEqual(meanOf("sharedCurve", error))
  })

  it("is not thrown by a strong tone curve, and costs little on a camera without one", () => {
    const at = (curve: number) => (row: Row) => row.toneCurve === curve
    expect(meanOf("matrix", error, at(0.7))).toBeGreaterThan(4)
    expect(meanOf("shipped", error, at(0.7))).toBeLessThan(1)
    expect(meanOf("shipped", error, at(0)) - meanOf("matrix", error, at(0))).toBeLessThan(0.15)
  })

  it("finds root-polynomial a wash against the 3x3 on the Card check", () => {
    // A lower mean, no significant difference (Wilcoxon p = 0.97 over these 160 cases, see
    // docs/correction-comparison.md). It wins the dim lights and loses the others.
    expect(Math.abs(meanOf("rootPolynomial2", check) - meanOf("matrix", check))).toBeLessThan(0.25)
    const dim = (row: Row) => row.light.startsWith("dim light")
    const bright = (row: Row) => !dim(row) && row.light !== "shade"
    expect(meanOf("rootPolynomial2", check, dim)).toBeLessThan(meanOf("matrix", check, dim))
    expect(meanOf("rootPolynomial2", check, bright)).toBeGreaterThan(meanOf("matrix", check, bright))
    // The Reading it gives is worse, not a wash.
    expect(meanOf("rootPolynomial2", error)).toBeGreaterThan(meanOf("matrix", error))
  })

  it("gains nothing from root-polynomial terms once the tone curve is undone", () => {
    expect(meanOf("curveRootPolynomial2", error)).toBeGreaterThan(meanOf("shipped", error))
  })
})

describe("on a real sensor's response", () => {
  // The Nikon D5100's spectral sensitivities, the ColorChecker's measured reflectances (not the
  // reference values the engine corrects towards) and an ideal white balance, in daylight,
  // cool white fluorescent and tungsten light. See golden/make_real_sensor_fixture.py.
  const FIXTURE = realSensor.lights as Record<string, { patches: number[][]; soils: Record<string, number[]> }>
  const key = (v: Vec3) => v.map((x) => x.toFixed(9)).join(",")

  /** A Photo of the Card and a soil as that sensor records them, then through a tone curve. */
  function sensorPhoto(light: string, soil: string, toneCurve: number): SimPhoto {
    const table = new Map<string, Vec3>()
    PATCH_LINEAR.forEach((p, i) => table.set(key(p), FIXTURE[light].patches[i] as Vec3))
    table.set(key(munsell.munsellToLinearRgb(soil) as Vec3), FIXTURE[light].soils[soil] as Vec3)
    return simulatePhoto({ camera: { light: (lin) => table.get(key(lin)) ?? lin, toneCurve }, soil })
  }

  const SOILS_ON_SENSOR = Object.keys(FIXTURE.D65.soils)
  const shared = linearizeShared()
  const rows: { light: string; soil: string; shipped: Result; shared: Result }[] = []

  beforeAll(() => {
    for (const light of Object.keys(FIXTURE)) {
      for (const soil of SOILS_ON_SENSOR) {
        for (const toneCurve of [0.3, 0.5]) {
          const photo = sensorPhoto(light, soil, toneCurve)
          rows.push({ light, soil, shipped: readSoil(photo, soil), shared: readSoil(photo, soil, { correction: shared }) })
        }
      }
    }
  }, 120_000)

  it("never fails a clean Card, in any of the three lights", () => {
    expect(rows).toHaveLength(66)
    for (const row of rows) expect(row.shipped.cardCheck.verdict, `${row.light}, ${row.soil}`).not.toBe("failed")
  })

  it("scores daylight better than tungsten, and shows caution rather than failure where it is unsure", () => {
    const at = (light: string) => mean(rows.filter((r) => r.light === light).map((r) => r.shipped.cardCheck.meanDE))
    expect(at("D65")).toBeLessThan(at("A"))
    expect(rows.filter((r) => r.shipped.cardCheck.verdict === "caution").length).toBeGreaterThan(0)
    expect(Math.max(...rows.map((r) => r.shipped.cardCheck.meanDE))).toBeLessThan(CARD_CHECK_CAUTION)
  })

  it("holds the grays out too: fluorescent light scores over 2.3, where a leaked curve scores 2.1 to 2.2", () => {
    // The tone ladder is held out like every other reference: the curve is refitted without the
    // gray it predicts. A curve drawn through all six grays and then asked about one of them is
    // asked nothing hard, and scores a real camera's Card better than it should.
    const fluorescent = rows.filter((r) => r.light === "FL2")
    expect(fluorescent.length).toBeGreaterThan(0)
    for (const row of fluorescent) expect(row.shipped.cardCheck.meanDE).toBeGreaterThan(2.3)
  })

  it("is caution, not good, on a clean Card from a real sensor: its Readings are not all within a Chip", () => {
    // Where the check says good the Reading is within a Chip. A real sensor's clean Card scores
    // over the good limit, and a quarter of its Readings are more than a Chip off.
    const wrong = rows.filter((r) => r.shipped.chipsOff > 1)
    expect(wrong.length).toBeGreaterThan(0)
    for (const row of rows) {
      if (row.shipped.cardCheck.verdict === "good") expect(row.shipped.chipsOff, `${row.light}, ${row.soil}`).toBeLessThanOrEqual(1)
    }
    expect(rows.filter((r) => r.shipped.cardCheck.verdict === "caution").length).toBeGreaterThan(0.9 * rows.length)
  })

  it("would read the same Photos closer to the truth with one curve shape for the three channels", () => {
    // The sensor's channels disagree a little, and a shared shape averages that out. It is not the
    // shipped correction: on Jon's real Pages the shared shape fits the gray ladder worse than a
    // curve per channel (rms 0.06 to 0.17 in log units against 0.04 to 0.10), and it misses the
    // smudged steps the Page's leave-out finds. So it waits for a real ColorChecker Photo (#15).
    expect(mean(rows.map((r) => r.shared.soilDE))).toBeLessThan(mean(rows.map((r) => r.shipped.soilDE)) - 0.4)
    expect(mean(rows.map((r) => r.shared.cardCheck.meanDE))).toBeLessThan(mean(rows.map((r) => r.shipped.cardCheck.meanDE)))
    const wrong = (pick: (r: (typeof rows)[number]) => Result) => rows.filter((r) => pick(r).chipsOff > 1).length
    expect(wrong((r) => r.shared)).toBeLessThan(wrong((r) => r.shipped))
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
  /** Light falling off across the Card by `drop`, left to right, over the whole Photo. */
  function lightGradient(photo: SimPhoto, drop: number) {
    const { width, height, data } = photo.pixels
    const [tl, tr] = SIM_CORNERS
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const f = 1 - drop * Math.min(1, Math.max(0, (x - tl.x) / (tr.x - tl.x)))
        for (let k = 0; k < 3; k++) {
          const i = (y * width + x) * 4 + k
          data[i] = Math.round(255 * encode(decode(data[i] / 255) * f))
        }
      }
    }
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
      expect(cardCheck.verdict).toBe("failed")
      expect(cardCheck.meanDE).toBeGreaterThan(20)
    }
  })

  it("still passes when the corners are tapped a patch's width or so off", () => {
    const photo = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: 0.5 } })
    const corners = SIM_CORNERS.map((p) => ({ x: p.x + 24, y: p.y })) as Corners
    const { cardCheck, chipsOff } = readSoil(photo, SIM_SOIL, { corners })
    expect(cardCheck.verdict).toBe("good")
    expect(chipsOff).toBeLessThanOrEqual(1)
  })

  it("never calls good a damaged Card whose Reading is more than one Chip off, and nearly always fails it", () => {
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
    for (const c of wrong) expect(c.cardCheck.verdict).not.toBe("good")
    expect(wrong.filter((c) => c.cardCheck.verdict === "failed").length).toBeGreaterThanOrEqual(0.9 * wrong.length)
  })

  it("passes a mild light gradient across the Card, and still reads right", () => {
    for (const drop of [0.1, 0.2]) {
      for (const [name, light] of LIGHT_CASES) {
        const photo = simulatePhoto({ camera: { light, toneCurve: 0.5 } })
        lightGradient(photo, drop)
        const { cardCheck, chipsOff } = readSoil(photo, SIM_SOIL)
        expect(cardCheck.verdict, `${name}, ${drop}`).not.toBe("failed")
        expect(chipsOff, `${name}, ${drop}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it("passes a dark, dull soil the 3x3 once passed while reading it two Chips off", () => {
    // 10YR 3/2 under a 3x3 and a gentle tone curve read 7.5YR 2.5/2 with the old threshold
    // of 3 still saying good. The shipped correction reads it right.
    for (const [, light] of LIGHT_CASES) {
      for (const toneCurve of [0.3, 0.5]) {
        const photo = simulatePhoto({ camera: { light, toneCurve }, soil: "10YR 3/2" })
        const { cardCheck, chipsOff } = readSoil(photo, "10YR 3/2")
        expect(cardCheck.verdict).not.toBe("failed")
        expect(chipsOff).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe("a gray step that is dirty", () => {
  // The grays are the tone ladder, and a smudge on one bends the curve of every channel. The mean
  // of the Card check hides it (a gray is one reference of 24), so the grays are judged on their
  // own: a dirty one is named and left out, and the Card check can be no better than caution.
  const key = (v: Vec3) => v.map((x) => x.toFixed(9)).join(",")
  const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]
  const BLACK = 23
  /** A light that first damages one Card patch in the scene, as a smudge would. */
  const smudged = (light: SimCamera["light"], patch: number, damage: (scene: Vec3) => Vec3): SimCamera["light"] => {
    const target = key(PATCH_LINEAR[patch])
    return (lin) => light(key(lin) === target ? damage(lin) : lin)
  }
  const hazy = (scene: Vec3) => mix(scene, [0.2, 0.2, 0.2], 0.2) // a black gone gray with handling

  function read(soil: string, light: SimCamera["light"], toneCurve: number) {
    return readSoil(simulatePhoto({ camera: { light, toneCurve }, soil }), soil)
  }

  it("is named, left out, and the soil still reads right", () => {
    const cases: [string, number, (s: Vec3) => Vec3, string, number[]][] = [
      ["10YR 2.5/2", BLACK, hazy, "black 2", [0.3]],
      ["10YR 3/2", BLACK, hazy, "black 2", [0.3, 0.7]],
      ["10YR 4/3", BLACK, hazy, "black 2", [0.3, 0.7]],
    ]
    for (const [soil, patch, damage, name, tones] of cases) {
      for (const toneCurve of tones) {
        const { cardCheck, chipsOff } = read(soil, smudged(LIGHTS.warm, patch, damage), toneCurve)
        expect(cardCheck.leftOut, `${soil}, ${name}, tone ${toneCurve}`).toEqual([name])
        expect(cardCheck.verdict).toBe("caution")
        expect(chipsOff, `${soil}, ${name}, tone ${toneCurve}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it("is not mistaken for a clean Card, nor a clean Card for a dirty one", () => {
    // The same Photos with a clean Card leave nothing out and are good.
    for (const toneCurve of [0.3, 0.7]) {
      const { cardCheck } = read("10YR 2.5/2", LIGHTS.warm, toneCurve)
      expect(cardCheck.leftOut).toEqual([])
      expect(cardCheck.verdict).toBe("good")
    }
  })
})
