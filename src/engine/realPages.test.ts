// Seam 1 on real Photos: Jon's Pages (Soil-Color Charts, 2009 Revision, 2015 Production), read
// the way a user reads them. The fixtures are in fixtures/real-pages/ (see the README there):
// downscaled to 756x1008, converted from Display P3 to sRGB, no metadata. The tap coordinates are
// in fixture pixels, placed by eye on the four Chips the app asks for.
//
// These tests record how the engine behaves on real Photos today, with bands wide enough for a
// recompression and narrow enough to notice a change. The Page's correction is the ladder's curves
// and a 3x3 held near diagonal (`fitPageCorrection`); with the full 3x3 after the curves, the same
// wood came out 11.8 CIEDE2000 apart across four Pages (see the wood tests below).
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import jpeg from "jpeg-js"
import { describe, expect, it } from "vitest"
import { shownReading } from "@/lib/verdict"
import { deltaE2000, linearToLab, luminance, rgb255ToLinear, type Vec3 } from "./color"
import { fitCorrection, type Fit } from "./correction"
import { PAGE_HUES, pageModel, pagePaperSites, pageSites, readPhoto } from "./index"
import type { Corners, PageHue, Pixels, XY } from "./index"
import { medianRgb255 } from "./sampling"
import { LIGHTS, PHONE_TONE_CURVE, simulatePhoto } from "./simulate"

interface Fixture {
  file: string
  hue: PageHue
  /** The four Chips the app asks for, in fixture pixels: `pageModel(hue).taps`. */
  taps: Corners
  /** What is behind the holes. */
  behind: "wood" | "fabric"
}

const xy = (x: number, y: number): XY => ({ x, y })
const FIXTURES: Record<string, Fixture> = {
  "10YR on fabric": {
    file: "10yr-fabric.jpg",
    hue: "10YR",
    taps: [xy(192, 225), xy(526, 219), xy(528, 532), xy(198, 846)], // 8/1, 8/8, 5/8, 2/1
    behind: "fabric",
  },
  "10YR on wood": {
    file: "10yr-wood.jpg",
    hue: "10YR",
    taps: [xy(198, 171), xy(529, 168), xy(529, 480), xy(193, 786)], // 8/1, 8/8, 5/8, 2/1
    behind: "wood",
  },
  "7.5YR on wood": {
    file: "7.5yr-wood.jpg",
    hue: "7.5YR",
    taps: [xy(182, 149), xy(492, 147), xy(574, 509), xy(175, 866)], // 8/1, 8/6, 5/8, 2.5/1
    behind: "wood",
  },
  "2.5Y on wood": {
    file: "2.5y-wood.jpg",
    hue: "2.5Y",
    taps: [xy(188, 137), xy(563, 137), xy(564, 373), xy(178, 837)], // 8/1, 8/8, 6/8, 2.5/1
    behind: "wood",
  },
  "5Y on wood": {
    file: "5y-wood.jpg",
    hue: "5Y",
    taps: [xy(188, 118), xy(568, 113), xy(570, 353), xy(183, 822)], // 8/1, 8/8, 6/8, 2.5/1
    behind: "wood",
  },
}
const WOOD = Object.entries(FIXTURES).filter(([, f]) => f.behind === "wood")

const pixelsCache = new Map<string, Pixels>()
function load({ file }: Fixture): Pixels {
  if (!pixelsCache.has(file)) {
    const bytes = readFileSync(fileURLToPath(new URL(`./fixtures/real-pages/${file}`, import.meta.url)))
    pixelsCache.set(file, jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true }))
  }
  return pixelsCache.get(file)!
}

const read = (f: Fixture, spots: XY[] = [], correction?: Fit) =>
  readPhoto({ pixels: load(f), card: { kind: "page", hue: f.hue, taps: f.taps }, spots, ...(correction ? { correction } : {}) })

/** The middle of every hole: halfway between the two Chips it sits between. */
function holes({ hue, taps }: Fixture): XY[] {
  const { chips } = pageModel(hue)
  const sites = pageSites(hue, taps)
  return chips.flatMap((c, i) => {
    const below = chips.findIndex((d) => d.col === c.col && d.row === c.row + 1)
    return below < 0 ? [] : [xy((sites[i].center.x + sites[below].center.x) / 2, (sites[i].center.y + sites[below].center.y) / 2)]
  })
}

/** The Chip's pixels in its read circle: how far the 90th-percentile pixel is from the median, in 8-bit levels. */
function circleSpread(pixels: Pixels, { center, radius }: { center: XY; radius: number }): number {
  const pixelsIn: number[][] = []
  for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y++) {
    for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x++) {
      if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius ** 2) continue
      const i = (y * pixels.width + x) * 4
      pixelsIn.push([pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]])
    }
  }
  const median = [0, 1, 2].map((k) => pixelsIn.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(pixelsIn.length / 2)])
  const off = pixelsIn.map((p) => Math.max(...p.map((v, k) => Math.abs(v - median[k])))).sort((a, b) => a - b)
  return off[Math.floor(off.length * 0.9)]
}

/**
 * How much the light changes across the Page, in stops: a plane through the paper gutters' brightness
 * (each read a quarter of the way up its pixels), as the quality check reads it.
 */
function paperStops(f: Fixture): number {
  const pixels = load(f)
  const points = pagePaperSites(f.hue, f.taps).map(({ center, radius }) => {
    const levels: number[] = []
    for (let y = Math.floor(center.y - radius); y <= Math.ceil(center.y + radius); y++) {
      for (let x = Math.floor(center.x - radius); x <= Math.ceil(center.x + radius); x++) {
        if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius ** 2) continue
        const i = (y * pixels.width + x) * 4
        levels.push(luminance(rgb255ToLinear([pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]])))
      }
    }
    levels.sort((a, b) => a - b)
    return { at: center, stops: Math.log2(levels[Math.floor(0.25 * (levels.length - 1))]) }
  })
  const mean = (g: (p: (typeof points)[number]) => number) => points.reduce((s, p) => s + g(p), 0) / points.length
  const [mx, my, mz] = [mean((p) => p.at.x), mean((p) => p.at.y), mean((p) => p.stops)]
  let [sxx, syy, sxy, sxz, syz] = [0, 0, 0, 0, 0]
  for (const { at, stops } of points) {
    const [dx, dy, dz] = [at.x - mx, at.y - my, stops - mz]
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
    sxz += dx * dz
    syz += dy * dz
  }
  const det = sxx * syy - sxy * sxy
  const [slopeX, slopeY] = [(sxz * syy - syz * sxy) / det, (syz * sxx - sxz * sxy) / det]
  const extent = (g: (p: (typeof points)[number]) => number) => Math.max(...points.map(g)) - Math.min(...points.map(g))
  return Math.abs(slopeX) * extent((p) => p.at.x) + Math.abs(slopeY) * extent((p) => p.at.y)
}

describe("the Page model against the real book", () => {
  it.each(Object.entries(FIXTURES))("%s: every Chip's read circle lands inside its Chip, and none reaches a hole", (_name, f) => {
    const pixels = load(f)
    const sites = pageSites(f.hue, f.taps)
    expect(sites).toHaveLength({ "10YR": 36, "7.5YR": 35, "2.5Y": 31, "5Y": 31 }[f.hue as "10YR"])
    // A Chip is one flat color; wood grain or fabric in the circle would put the 90th-percentile
    // pixel tens of levels off the median (the worst real Chip here is 10).
    sites.forEach((site, i) => expect(circleSpread(pixels, site), `${f.hue} Chip ${pageModel(f.hue).chips[i].chip.notation}`).toBeLessThanOrEqual(20))
  })

  it("has the four Chips to tap where the real Pages have them: top-left /1, top row's last, last column's lowest, lowest /1", () => {
    // Read off the photographs: 10YR 8/1, 8/8, 5/8, 2/1; 7.5YR 8/1, 8/6 (8/8 is not printed), 5/8, 2.5/1; 2.5Y and 5Y 8/1, 8/8, 6/8, 2.5/1.
    const notations = (hue: PageHue) => pageModel(hue).taps.map((c) => c.chip.notation)
    expect(notations("10YR")).toEqual(["10YR 8/1", "10YR 8/8", "10YR 5/8", "10YR 2/1"])
    expect(notations("7.5YR")).toEqual(["7.5YR 8/1", "7.5YR 8/6", "7.5YR 5/8", "7.5YR 2.5/1"])
    expect(notations("2.5Y")).toEqual(["2.5Y 8/1", "2.5Y 8/8", "2.5Y 6/8", "2.5Y 2.5/1"])
    expect(notations("5Y")).toEqual(["5Y 8/1", "5Y 8/8", "5Y 6/8", "5Y 2.5/1"])
  })
})

describe("the Card check on real Photos", () => {
  it("is worse than the simulated camera's on every real Page, which never passes 1", () => {
    for (const [name, f] of Object.entries(FIXTURES)) {
      const sim = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE }, page: f.hue })
      const simulated = readPhoto({ pixels: sim.pixels, card: { kind: "page", hue: f.hue, taps: sim.corners }, spots: [] }).cardCheck!.meanDE
      expect(simulated, name).toBeLessThan(1)
      expect(read(f).cardCheck!.meanDE, name).toBeGreaterThan(1.8 * simulated)
    }
  })

  describe("10YR on wood (Jon's 8/1 and 7/1 are smudged)", () => {
    const result = read(FIXTURES["10YR on wood"])
    it("leaves out the two smudged ladder steps, which are the two worst Chips on the Page", () => {
      expect(result.cardCheck!.leftOut).toContain("10YR 8/1")
      expect(result.cardCheck!.leftOut).toContain("10YR 7/1")
      expect(result.cardCheck!.suspectRow).toBeUndefined()
    })
    it("has a Card check of about 2.8 (5.2 with nothing left out), too high to be good, and no row to blame", () => {
      expect(result.cardCheck!.meanDE).toBeGreaterThan(2.4)
      expect(result.cardCheck!.meanDE).toBeLessThan(3.2)
    })
  })

  describe("7.5YR on wood", () => {
    const f = FIXTURES["7.5YR on wood"]
    const result = read(f, [holes(f)[3]])
    it("fails the Card check on the 2.5/ row, with the dark saturated Chips left out", () => {
      expect(result.cardCheck!.ok).toBe(false)
      expect(result.cardCheck!.suspectRow).toBe(2.5)
      expect(result.cardCheck!.leftOut).toContain("7.5YR 2.5/2")
      expect(result.cardCheck!.leftOut).toContain("7.5YR 2.5/3")
    })

    it("fails because those Chips lie below what the gray ladder reaches, not because they are dirty", () => {
      // The darkest gray step measures about (47, 48, 48); the two Chips about (31, 22, 12) and
      // (36, 22, 9). Their blue is far below the ladder's lowest blue, so the fit extrapolates it.
      const pixels = load(f)
      const { chips } = pageModel(f.hue)
      const sites = pageSites(f.hue, f.taps)
      const blue = (notation: string) => medianRgb255(pixels, sites[chips.findIndex((c) => c.chip.notation === notation)].center, sites[chips.findIndex((c) => c.chip.notation === notation)].radius)[2]
      const ladderFloor = blue("7.5YR 2.5/1")
      expect(ladderFloor - blue("7.5YR 2.5/2")).toBeGreaterThan(25)
      expect(ladderFloor - blue("7.5YR 2.5/3")).toBeGreaterThan(25)
    })

    it("says so in the Readings sheet, and shows the uncorrected Reading", () => {
      const shown = shownReading(result.readings[0], result.cardCheck, [], result.offCard, { kind: "page", hue: f.hue })
      expect(shown.verdict).toBe("failed")
      expect(shown.main).toBe(result.readings[0].raw)
      expect(shown.why).toContain("2.5/ row")
      expect(shown.why).toContain("darker or stronger than the gray /1 column")
    })
  })

  it.each([
    ["2.5Y on wood", 2.4, 3.2, false],
    ["5Y on wood", 1.5, 2.1, true],
  ])("%s: a Card check of %f to %f, nothing left out, good only if it is under 2 (%s)", (name, low, high, good) => {
    const check = read(FIXTURES[name]).cardCheck!
    expect(check.leftOut).toEqual([])
    expect(check.meanDE).toBeGreaterThan(low)
    expect(check.meanDE).toBeLessThan(high)
    expect(check.ok).toBe(good)
  })

  it("10YR on fabric, in warm indoor light, fails by a wide margin, though it finds the smudged pair", () => {
    // The grays measure far from their notation (8/1 is (180, 149, 119) for (207, 199, 188), 2/1 is
    // (16, 14, 15) for (55, 48, 41)), so the check stays high; the smudges on 8/1 and 7/1 are plain.
    const check = read(FIXTURES["10YR on fabric"]).cardCheck!
    expect(check.ok).toBe(false)
    expect(check.meanDE).toBeGreaterThan(3.5)
    expect(check.leftOut).toEqual(["10YR 8/1", "10YR 7/1"])
  })
})

describe("the paper on real Photos", () => {
  it.each(WOOD)("%s: the light across the Page is even enough, and no warning is raised", (_name, f) => {
    // 0.07 to 0.27 stops here; the Page's limit is 0.45.
    expect(paperStops(f)).toBeLessThan(0.45)
    expect(read(f, [holes(f)[3]]).quality).toEqual([])
  })

  it("10YR on fabric, lit from one side, is flagged as uneven light, and the Card check blames it", () => {
    const f = FIXTURES["10YR on fabric"]
    expect(paperStops(f)).toBeGreaterThan(1)
    const result = read(f, [holes(f)[3]])
    expect(result.quality.map((q) => q.kind)).toEqual(["uneven-light"])
    expect(shownReading(result.readings[0], result.cardCheck, result.quality, result.offCard, { kind: "page", hue: f.hue }).why).toContain("problem flagged below")
  })
})

describe("the wood behind the holes, as a stand-in sample", () => {
  // The same wood, in the same light, with the same phone: all four Photos show the paper as the same
  // cool white, and the wood's raw color is within 2.4 CIEDE2000 from one Page to the next. A Reading
  // of it corrected against each Page should agree about as well, whatever hue the Page is.
  const lab = (rgb: number[]): Vec3 => linearToLab(rgb255ToLinear(rgb as Vec3))
  const meanLab = (labs: Vec3[]): Vec3 => [0, 1, 2].map((k) => labs.reduce((s, v) => s + v[k], 0) / labs.length) as Vec3

  /** The mean color of the wood through every hole of each Page, raw and corrected. */
  function woodThroughHoles(correction?: Fit) {
    return WOOD.map(([name, f]) => {
      const readings = read(f, holes(f), correction).readings
      return {
        name,
        raw: meanLab(readings.map((r) => lab(r.raw.rgb))),
        corrected: meanLab(readings.map((r) => lab(r.corrected!.rgb))),
      }
    })
  }
  const spread = (colors: Vec3[]) => {
    const pairs = colors.flatMap((a, i) => colors.slice(i + 1).map((b, k) => ({ i, j: i + 1 + k, de: deltaE2000(a, b) })))
    return { max: Math.max(...pairs.map((p) => p.de)), mean: pairs.reduce((s, p) => s + p.de, 0) / pairs.length, pairs }
  }

  const current = woodThroughHoles()

  it("reads the same raw color on every Page", () => {
    expect(spread(current.map((w) => w.raw)).max).toBeLessThan(3)
  })

  it("reads the same corrected color on every Page, at the noise floor of the wood's grain", () => {
    // 4.3 largest and 3.1 mean (the full 3x3 after the curves: 11.8 and 8.3). Within one Photo the
    // holes differ from their own mean by a median of 2.6 to 6.9, so this is about as close as the
    // four Photos can be.
    const { max, mean } = spread(current.map((w) => w.corrected))
    expect(max).toBeLessThan(4.5)
    expect(mean).toBeLessThan(3.5)
  })

  it("can fail: the full 3x3 after the curves, which the Page used to get, pulls the four Pages 8 to 15 apart", () => {
    const { max } = spread(woodThroughHoles(fitCorrection).map((w) => w.corrected))
    expect(max).toBeGreaterThan(8)
    expect(max).toBeLessThan(15)
  })

  it("reads every Page's holes within a few CIEDE2000 of their own mean: the wood's grain", () => {
    for (const [name, f] of WOOD) {
      const readings = read(f, holes(f)).readings.map((r) => lab(r.corrected!.rgb))
      const mean = meanLab(readings)
      const off = readings.map((l) => deltaE2000(l, mean)).sort((a, b) => a - b)
      expect(off[Math.floor(off.length / 2)], name).toBeLessThan(8) // 2.6 to 6.9
    }
  })

  it("reads as 10YR on every Page, corrected as well as raw, and the hue suggestion says so on the others", () => {
    // Before, the 2.5Y and 5Y Pages pulled the Reading onto their own hue (2.5Y 5/6 on 20 of 25 holes,
    // 5Y on 16 of 25) and `betterPage` was set for none of them.
    const commonHue = (hues: string[]) =>
      Object.entries(hues.reduce<Record<string, number>>((n, h) => ({ ...n, [h]: (n[h] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0]
    for (const [name, f] of WOOD) {
      const readings = read(f, holes(f)).readings
      expect(commonHue(readings.map((r) => r.raw.chip.hue)), `${name} raw`).toBe("10YR")
      expect(commonHue(readings.map((r) => r.corrected!.chip.hue)), `${name} corrected`).toBe("10YR")
      if (f.hue !== "10YR") {
        // 10YR is the most common suggestion, and it is made for most of the holes.
        const suggested = readings.flatMap((r) => (r.betterPage ? [r.betterPage] : []))
        expect(commonHue(suggested), `${name} suggestion`).toBe("10YR")
        expect(suggested.length, `${name} suggestions`).toBeGreaterThan(0.6 * readings.length)
      }
    }
  })

  it("covers all four hue Pages the engine can read", () => {
    expect(WOOD.map(([, f]) => f.hue).sort()).toEqual(["10YR", "2.5Y", "5Y", "7.5YR"])
    expect(PAGE_HUES).toEqual(expect.arrayContaining(["10YR", "7.5YR", "2.5Y", "5Y"]))
  })
})
