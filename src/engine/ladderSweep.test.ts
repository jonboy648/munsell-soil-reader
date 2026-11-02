// Seam 1: the ColorChecker's choice of tone curve, pinned by a sweep of 624 Photos in which one of
// the six grays is dirty. Soils are dark and light, the lights are warm and dim, the tone curves
// 0.3 and 0.7, and the dirt is a soil film on any gray, a yellowed white, or a hazy black or N3.5.
// The ColorChecker shares one tone curve between the three channels; a curve per channel (PCHIP,
// which a Page uses) is the alternative. docs/correction-comparison.md has the numbers.
import * as munsell from "munsell"
import { beforeAll, describe, expect, it } from "vitest"
import { readPhoto } from "./index"
import type { Vec3 } from "./color"
import { NEUTRAL_PATCHES, PATCH_LINEAR, PATCH_NAMES } from "./colorchecker"
import { linearizeThen, pchip } from "./correction"
import { LIGHTS, SIM_CORNERS, SIM_SPOT, simulatePhoto, type SimCamera } from "./simulate"

const PAGES = ["10R", "2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y"]
const VALUES = [2, 2.5, 3, 4, 5, 6, 7, 8, 8.5, 9, 9.5]
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

const key = (v: Vec3) => v.map((x) => x.toFixed(9)).join(",")
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]
const FILM = munsell.munsellToLinearRgb("10YR 4/3") as Vec3

/** The dirt, as a change to one gray's color in the scene before the camera sees it. */
const dirt = (gray: number): [string, (scene: Vec3) => Vec3][] => [
  ...[0.1, 0.17, 0.25].map((a): [string, (s: Vec3) => Vec3] => [`soil film ${a}`, (s) => mix(s, FILM, a)]),
  ...(gray <= 19 ? [0.08, 0.2].map((b): [string, (s: Vec3) => Vec3] => [`yellowed ${b}`, (s) => [s[0], s[1] * (1 - b / 4), s[2] * (1 - b)]]) : []),
  ...(gray >= 22 ? [0.1, 0.2].map((a): [string, (s: Vec3) => Vec3] => [`hazy ${a}`, (s) => mix(s, [0.2, 0.2, 0.2], a)]) : []),
]

const SOILS = ["10YR 2.5/2", "10YR 3/2", "5YR 3/4", "10YR 4/3", "7.5YR 5/6", "10YR 8/2"]
const LIGHT_CASES: [string, SimCamera["light"]][] = [["warm", LIGHTS.warm], ["dim", LIGHTS.dim]]

describe("one dirty gray, in 624 Photos", () => {
  interface Row {
    gray: string
    shown: boolean // the Card check did not fail, so the corrected Reading is the answer
    wrong: boolean // the Reading is more than one Chip off
    good: boolean
    leftOut: string[]
  }
  const shipped: Row[] = []
  const perChannel: Row[] = []
  const pchipFit = linearizeThen(pchip)

  beforeAll(() => {
    for (const soil of SOILS) {
      for (const toneCurve of [0.3, 0.7]) {
        for (const [, baseLight] of LIGHT_CASES) {
          for (const patch of NEUTRAL_PATCHES) {
            for (const [, damage] of dirt(patch)) {
              const target = key(PATCH_LINEAR[patch])
              const light = (lin: Vec3) => baseLight(key(lin) === target ? damage(lin) : lin)
              const photo = simulatePhoto({ camera: { light, toneCurve }, soil })
              for (const [rows, correction] of [[shipped, undefined], [perChannel, pchipFit]] as const) {
                const result = readPhoto({
                  pixels: photo.pixels,
                  card: { kind: "colorchecker", corners: SIM_CORNERS },
                  spots: [SIM_SPOT],
                  ...(correction ? { correction } : {}),
                })
                const corrected = result.readings[0].corrected!
                const off = stepsApart(corrected.chip.notation, soil) > 1
                const check = result.cardCheck!
                rows.push({
                  gray: PATCH_NAMES[patch],
                  shown: check.verdict !== "failed",
                  wrong: off,
                  good: check.verdict === "good",
                  leftOut: check.leftOut,
                })
              }
            }
          }
        }
      }
    }
  }, 300_000)

  it("covers 624 Photos", () => {
    expect(shipped).toHaveLength(624)
    expect(perChannel).toHaveLength(624)
  })

  const shownWrong = (rows: Row[]) => rows.filter((r) => r.shown && r.wrong).length

  it("shows far fewer wrong Readings with one tone curve shared by the channels than with a curve per channel", () => {
    // 15 against 46 when this was written.
    expect(shownWrong(shipped)).toBeLessThanOrEqual(25)
    expect(shownWrong(perChannel)).toBeGreaterThanOrEqual(35)
    expect(shownWrong(shipped)).toBeLessThan(shownWrong(perChannel) / 1.5)
  })

  it("never calls a Card good when it left a gray out, and leaves out only a gray, and nearly always the dirty one", () => {
    const out = shipped.filter((r) => r.leftOut.length > 0)
    expect(out.length).toBeGreaterThan(20) // it finds a good share of the dirt
    for (const r of out) expect(r.good).toBe(false)
    for (const r of out) for (const name of r.leftOut) expect(NEUTRAL_PATCHES.map((i) => PATCH_NAMES[i])).toContain(name)
    expect(out.filter((r) => r.leftOut.length === 1 && r.leftOut[0] === r.gray).length).toBeGreaterThanOrEqual(0.95 * out.length)
  })

  it("leaves no Reading both wrong and good in more than a handful of the 624", () => {
    expect(shipped.filter((r) => r.wrong && r.good).length).toBeLessThanOrEqual(5)
  })
})
