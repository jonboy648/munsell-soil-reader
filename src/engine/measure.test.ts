// Seam 1: measurement mode. Simulated swatch cards of known color are photographed under the
// test lights and tone curves, measured against the ColorChecker beside them, and compared with
// the color they really are.
import { describe, expect, it } from "vitest"
import { BATCH_METHOD_CAMERA, SWATCH_IDS } from "./batchFile"
import { deltaE2000, labD50ToLinear, linearToLabD50, type Vec3 } from "./color"
import { PATCH_LINEAR } from "./colorchecker"
import { batchRows, measureShot, summarizeShots, swatchRadius, type ShotMeasurement } from "./measure"
import { LIGHTS, PHONE_TONE_CURVE, simSwatchLabs, simulatePhoto, type SimCamera, type SimScene } from "./simulate"
import type { Corners } from "./types"

const TRUE_LABS = simSwatchLabs()

/** Photographs the simulated swatch card and measures every swatch. */
function measureSimulated(scene: Omit<SimScene, "swatches">, corners = (found: Corners): Corners => found) {
  const sim = simulatePhoto({ ...scene, swatches: TRUE_LABS })
  const shot = measureShot(
    sim.pixels,
    corners(sim.corners),
    sim.swatches.map((at, i) => ({ id: SWATCH_IDS[i], at })),
  )
  return { sim, shot, errors: shot.swatches.map((s, i) => deltaE2000(s.lab, TRUE_LABS[i])) }
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length

describe("the Lab scale", () => {
  it("is D50, the Card's own: the ColorChecker's white reads as its published value", () => {
    const white = linearToLabD50(PATCH_LINEAR[18])
    expect(white[0]).toBeCloseTo(95.19, 2)
    expect(white[1]).toBeCloseTo(-1.03, 2)
    expect(white[2]).toBeCloseTo(2.93, 2)
  })

  it("goes to linear sRGB and back without loss", () => {
    for (const lab of TRUE_LABS) {
      const back = linearToLabD50(labD50ToLinear(lab))
      expect(deltaE2000(back, lab)).toBeLessThan(1e-3) // the sRGB matrices are rounded inverses
    }
  })
})

describe("measuring a swatch card photographed beside a ColorChecker", () => {
  // Tolerance, in CIEDE2000 from the swatch's true color, for one shot, and the error found
  // when this was written (the worst swatch, and the mean of all 18):
  //   neutral, warm and dim light, tone curve 0, 0.3 and 0.5: 1.5 for every swatch.
  //     Found: worst 1.22 (warm, 0.3), mean 0.33 to 0.56.
  //   camera color shift, tone curve 0 to 0.5: 3.5 for every swatch but the lightest, mean 1.2.
  //     Found: worst 2.90, mean 0.87 to 1.02.
  //   the same shift light, swatch_01 (L 95, as light as the Card's white, which clips its blue
  //     channel here): 5.5. Found: 5.08. A swatch lighter than the Card's own grays is read past
  //     the last reference, and the Card check (0.5 to 0.8) does not see that.
  // The tilted card's worst swatch is no worse than the straight-on one's, and its mean is within
  // 0.04. Averaging shots helps little, since most of this error is the correction's and shared
  // (see the shots test below).
  const lights = [
    ["neutral", LIGHTS.neutral, 1.5, 1.5, 1.5],
    ["warm", LIGHTS.warm, 1.5, 1.5, 1.5],
    ["dim", LIGHTS.dim, 1.5, 1.5, 1.5],
    ["camera color shift", LIGHTS.shift, 3.5, 5.5, 1.2],
  ] as const
  const tilts = [
    ["straight on", undefined],
    ["tilted", { yaw: 25, pitch: 10 }],
  ] as const

  describe.each(lights)("%s", (_name, light, each, lightest, meanLimit) => {
    describe.each([0, 0.3, PHONE_TONE_CURVE])("tone curve %s", (toneCurve) => {
      it.each(tilts)("%s: the Card check passes and every swatch is within tolerance", (_tilt, tilt) => {
        const camera: SimCamera = { light, toneCurve }
        const { shot, errors } = measureSimulated({ camera, tilt })
        expect(shot.cardCheck.ok).toBe(true)
        errors.forEach((error, i) => {
          expect(error, SWATCH_IDS[i]).toBeLessThan(i === 0 ? lightest : each)
        })
        expect(mean(errors)).toBeLessThan(meanLimit)
      })
    })
  })

  it("can fail: a Photo with the ColorChecker's corners in the wrong order measures far off", () => {
    const camera: SimCamera = { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE }
    const { shot, errors } = measureSimulated({ camera }, ([tl, tr, br, bl]) => [bl, tl, tr, br])
    expect(shot.cardCheck.ok).toBe(false)
    expect(Math.max(...errors)).toBeGreaterThan(5)
  })

  it.each([
    ["straight on", undefined],
    ["tilted", { yaw: 25, pitch: 10 }],
  ] as const)("%s: reads each swatch in a circle well inside its tile, whatever the size of the Photo", (_tilt, tilt) => {
    const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, swatches: TRUE_LABS, tilt })
    // Neighbouring swatches in a row are 42 scene pixels apart and the tile is 31 wide.
    const pitch = Math.hypot(sim.swatches[1].x - sim.swatches[0].x, sim.swatches[1].y - sim.swatches[0].y)
    const halfTile = (pitch * 31) / 42 / 2
    for (const at of sim.swatches) {
      const radius = swatchRadius(sim.corners, at)
      // Inside the tile with room for a tap a little off: 0.48 of the tile straight on, 0.70 tilted
      // (the card follows the nearest ColorChecker patch, which is nearer the camera than the swatch).
      expect(radius).toBeLessThan(0.8 * halfTile)
      expect(radius).toBeGreaterThan(0.3 * halfTile)
    }
  })
})

describe("averaging shots", () => {
  const shot = (ok: boolean, swatches: [string, Vec3][], meanDE = ok ? 0.5 : 3): ShotMeasurement => ({
    cardCheck: { meanDE, ok },
    swatches: swatches.map(([id, lab]) => ({ id, lab })),
  })

  it("gives each swatch's mean Lab, sample standard deviation per channel, and the number of shots", () => {
    const summary = summarizeShots([
      shot(true, [["swatch_07", [50, 0, 10]]]),
      shot(true, [["swatch_07", [52, 2, 10]]]),
      shot(true, [["swatch_07", [51, 1, 10]]]),
    ])
    expect(summary.excluded).toEqual([])
    const [s] = summary.swatches
    expect(s.id).toBe("swatch_07")
    expect(s.n).toBe(3)
    expect(s.lab).toEqual([51, 1, 10])
    expect(s.sd).toEqual([1, 1, 0])
  })

  it("leaves a shot whose Card check is not good out of every mean, and lists it", () => {
    const summary = summarizeShots([
      shot(true, [["swatch_01", [90, 0, 0]]]),
      shot(false, [["swatch_01", [10, 40, 40]]], 3.4),
      shot(true, [["swatch_01", [92, 0, 0]]]),
    ])
    expect(summary.excluded).toEqual([{ shot: 2, meanDE: 3.4 }])
    expect(summary.swatches[0].lab).toEqual([91, 0, 0])
    expect(summary.swatches[0].n).toBe(2)
  })

  it("counts a swatch only in the shots that have it, and gives no spread from a single shot", () => {
    const summary = summarizeShots([
      shot(true, [["swatch_01", [90, 0, 0]], ["swatch_02", [70, 1, 1]]]),
      shot(true, [["swatch_01", [92, 0, 0]]]),
    ])
    expect(summary.swatches.map((s) => [s.id, s.n])).toEqual([["swatch_01", 2], ["swatch_02", 1]])
    expect(summary.swatches[1].sd).toBeUndefined()
  })

  it("is empty when every shot failed its Card check", () => {
    const summary = summarizeShots([shot(false, [["swatch_01", [90, 0, 0]]])])
    expect(summary.swatches).toEqual([])
    expect(summary.excluded).toHaveLength(1)
  })

  it("measured from two Photos, a light and a place apart: n is 2, there is a spread, and the error is the correction's", () => {
    const a = measureSimulated({ camera: { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE } })
    const b = measureSimulated({
      camera: { light: LIGHTS.neutral, toneCurve: PHONE_TONE_CURVE },
      tilt: { yaw: 25, pitch: 10 },
      seed: 11,
    })
    const summary = summarizeShots([a.shot, b.shot])
    expect(summary.swatches).toHaveLength(18)
    expect(summary.swatches.every((s) => s.n === 2 && s.sd !== undefined)).toBe(true)
    const errors = summary.swatches.map((s, i) => deltaE2000(s.lab, TRUE_LABS[i]))
    // Found: the shots alone, mean 0.44 and worst 0.90 (warm) and 0.30 and 0.89 (neutral, tilted);
    // averaged, mean 0.28 and worst 0.68.
    expect(Math.max(...errors)).toBeLessThan(1)
    expect(mean(errors)).toBeLessThan(0.5)
  })
})

describe("the batch rows", () => {
  it("are keyed by frame slot, in slot order, with the method and date", () => {
    const summary = summarizeShots([
      {
        cardCheck: { meanDE: 0.5, ok: true },
        swatches: [{ id: "swatch_07", lab: [40, 5, 20] }, { id: "swatch_01", lab: [95, 0, 1] }],
      },
    ])
    expect(batchRows(summary, "2026-10-18")).toEqual([
      { patch: "G1", lab: [95, 0, 1], n: 1, method: BATCH_METHOD_CAMERA, date: "2026-10-18" },
      { patch: "S01", lab: [40, 5, 20], n: 1, method: BATCH_METHOD_CAMERA, date: "2026-10-18" },
    ])
  })
})
