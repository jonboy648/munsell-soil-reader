// Seam 1: a Card photographed at an angle. Every test builds a simulated Photo with the Card
// in perspective, calls readPhoto, and checks what a caller would see.
import { describe, expect, it } from "vitest"
import { CARD_CHECK_GOOD, readPhoto } from "./index"
import type { Corners, XY } from "./index"
import {
  LIGHTS,
  PHONE_TONE_CURVE,
  SIM_HEIGHT,
  SIM_SOIL,
  SIM_WIDTH,
  simulatePhoto,
  type SimTilt,
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
const withinOneChip = (a: string, b: string) => stepsApart(a, b) <= 1

// ---- helpers ----
const camera = { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE }
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)

/** Photograph the scene at a tilt and read it; `tap` can change which corners the user tapped. */
function read(tilt: SimTilt | undefined, tap: (corners: Corners) => Corners = (c) => c) {
  const sim = simulatePhoto({ camera, tilt })
  const result = readPhoto({
    pixels: sim.pixels,
    card: { kind: "colorchecker", corners: tap(sim.corners) },
    spots: [sim.spot],
  })
  return { sim, result, corrected: result.readings[0].corrected!.chip.notation }
}

/** The prototype's mapping: bilinear between the four corner patch centers. */
function bilinearCenters([tl, tr, br, bl]: Corners): XY[] {
  const out: XY[] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const u = c / 5
      const v = r / 3
      const at = (k: "x" | "y") =>
        (1 - u) * (1 - v) * tl[k] + u * (1 - v) * tr[k] + u * v * br[k] + (1 - u) * v * bl[k]
      out.push({ x: at("x"), y: at("y") })
    }
  }
  return out
}

const TILTS: [string, SimTilt][] = [
  ["40 degrees to the side", { yaw: 40, pitch: 0 }],
  ["45 degrees to the side", { yaw: 45, pitch: 0 }],
  ["35 degrees to the side and 25 degrees back", { yaw: 35, pitch: -25 }],
  ["38 degrees to the side and 25 degrees forward", { yaw: 38, pitch: 25 }],
]

describe("an angled ColorChecker", () => {
  const flat = read(undefined)

  it("is the baseline: the flat Photo passes the Card check and reads the true Chip", () => {
    expect(flat.result.cardCheck?.ok).toBe(true)
    expect(flat.corrected).toBe(SIM_SOIL)
  })

  describe.each(TILTS)("tilted %s", (_name, tilt) => {
    const { sim, result, corrected } = read(tilt)

    it("is a real perspective view with the Card and the Spot in the Photo", () => {
      // The two long edges of the Card differ a lot in length, which a flat Photo never shows.
      const [tl, tr, br, bl] = sim.corners
      const [left, right, top, bottom] = [dist(tl, bl), dist(tr, br), dist(tl, tr), dist(bl, br)]
      expect(Math.max(left / right, right / left, top / bottom, bottom / top)).toBeGreaterThan(1.25)
      for (const p of [...sim.corners, sim.spot]) {
        expect(p.x).toBeGreaterThan(0)
        expect(p.x).toBeLessThan(SIM_WIDTH)
        expect(p.y).toBeGreaterThan(0)
        expect(p.y).toBeLessThan(SIM_HEIGHT)
      }
    })

    it("passes the Card check", () => {
      expect(result.cardCheck?.ok).toBe(true)
      expect(result.cardCheck!.meanDE).toBeLessThan(CARD_CHECK_GOOD)
      // As good a fit as the flat Photo: every patch was read where it really is.
      expect(result.cardCheck!.meanDE).toBeLessThan(flat.result.cardCheck!.meanDE + 0.2)
    })

    it("reads within one Chip of the flat Photo, and of the true Chip", () => {
      expect(withinOneChip(corrected, flat.corrected)).toBe(true)
      expect(withinOneChip(corrected, SIM_SOIL)).toBe(true)
    })

    it("is a case the prototype's bilinear grid fails: it lands off the patches", () => {
      // Where the prototype would have read each patch, against where the patch really is.
      // Off by more than a fifth of the patch pitch means the read circle sits partly on
      // the next patch or the Card's frame. This is what makes the tests above able to fail.
      const guess = bilinearCenters(sim.corners)
      const off = guess.filter((g, i) => {
        const [r, c] = [Math.floor(i / 6), i % 6]
        const pitch = Math.min(
          dist(sim.patches[i], sim.patches[r * 6 + (c < 5 ? c + 1 : c - 1)]),
          dist(sim.patches[i], sim.patches[(r < 3 ? r + 1 : r - 1) * 6 + c]),
        )
        return dist(g, sim.patches[i]) > 0.2 * pitch
      })
      expect(off.length).toBeGreaterThanOrEqual(8)
    })
  })

  it("fails the Card check when the corners are tapped in the wrong order", () => {
    const wrong = read(TILTS[0][1], ([tl, tr, br, bl]) => [bl, tl, tr, br]) // started on the white patch
    expect(wrong.result.cardCheck?.ok).toBe(false)
    expect(wrong.result.cardCheck!.meanDE).toBeGreaterThan(CARD_CHECK_GOOD)
  })

  it("fails the Card check, without crashing, when the corners are tapped crossed over", () => {
    const crossed = read(TILTS[0][1], ([tl, tr, br, bl]) => [tl, tr, bl, br]) // a Z, not a loop
    expect(crossed.result.cardCheck?.ok).toBe(false)
  })

  it("fails the Card check, without crashing, when the corners are all the same point", () => {
    const p = { x: 300, y: 300 }
    const stuck = read(TILTS[0][1], () => [p, p, p, p])
    expect(stuck.result.cardCheck?.ok).toBe(false)
  })
})
