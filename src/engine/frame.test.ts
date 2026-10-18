// Seam 1: the frame finder. Every test builds a simulated Photo of the frame card, calls
// findCard, and checks what a caller would see: the frame's outline or nothing, and what
// readPhoto makes of it. The last tests check the finder is its own chunk, loaded only when a
// frame is chosen.
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { build, type BuildEnvironmentOptions } from "vite"
import { afterAll, describe, expect, it } from "vitest"
import { CARD_CHECK_GOOD, readPhoto } from "./index"
import type { Corners, Pixels, XY } from "./index"
import { findCard } from "./frame"
import {
  EVENNESS_MM,
  EVENNESS_RADIUS_MM,
  FRAME_MARKERS,
  FRAME_MARKER_CODES,
  FRAME_PATCHES,
  FRAME_SIZE_MM,
  MARKER_CELLS,
  OUTLINE_MM,
  WINDOW_MM,
  markerCellIsWhite,
} from "./frameLayout"
import {
  LIGHTS,
  PHONE_TONE_CURVE,
  SIM_SOIL,
  simulatePhoto,
  type SimPhoto,
  type SimScene,
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
/** The same Chip, or one step away in value, in chroma or on the next page. */
const withinOneChip = (a: string, b: string) => stepsApart(a, b) <= 1

// ---- helpers ----
const camera = { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE }
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)

/** The outline is found to within this many Photo pixels of where the markers' corners really are. */
const CORNER_TOLERANCE = 2

/** The ticket's tilts: 35 to 45 degrees to the side, up to 25 degrees back or forward. */
const TILTS: [string, SimTilt][] = [
  ["40 degrees to the side", { yaw: 40, pitch: 0 }],
  ["45 degrees to the side", { yaw: 45, pitch: 0 }],
  ["35 degrees to the side and 25 degrees back", { yaw: 35, pitch: -25 }],
  ["38 degrees to the side and 25 degrees forward", { yaw: 38, pitch: 25 }],
  ["45 degrees to the side and 25 degrees forward", { yaw: 45, pitch: 25 }],
]

/** A photographed frame card, tilted if asked. */
const framed = (tilt?: SimTilt, scene: Partial<SimScene> = {}): SimPhoto =>
  simulatePhoto({ camera, frame: {}, tilt, ...scene })

/** What readPhoto makes of a Photo given the frame's outline. */
const readFrame = (sim: SimPhoto, outline: Corners) =>
  readPhoto({ pixels: sim.pixels, card: { kind: "frame", outline, batch: sim.frame!.batch }, spots: [sim.spot] })

/** The Photo turned a quarter clockwise, and where a point of the old Photo lands in it. */
function turnClockwise({ width, height, data }: Pixels) {
  const turned = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4
      const to = (x * height + (height - 1 - y)) * 4
      for (let k = 0; k < 4; k++) turned[to + k] = data[from + k]
    }
  }
  return {
    pixels: { width: height, height: width, data: turned },
    point: ({ x, y }: XY): XY => ({ x: height - 1 - y, y: x }),
  }
}

/** The Photo and its outline, every pixel repeated `k` times each way: the same Photo shot with a bigger frame in it. */
function upscale({ width, height, data }: Pixels, outline: Corners, k: number) {
  const big = new Uint8ClampedArray(width * k * height * k * 4)
  for (let y = 0; y < height * k; y++) {
    for (let x = 0; x < width * k; x++) {
      const from = (Math.floor(y / k) * width + Math.floor(x / k)) * 4
      for (let c = 0; c < 4; c++) big[(y * width * k + x) * 4 + c] = data[from + c]
    }
  }
  return {
    pixels: { width: width * k, height: height * k, data: big },
    outline: outline.map(({ x, y }) => ({ x: x * k, y: y * k })) as Corners,
  }
}

/**
 * A flat framed Photo with a second copy of marker `id`, white margin and all, printed in the
 * window, at `size` times the real one: a second frame in the shot, or a spare marker. Specks
 * are copied by nearest pixel.
 */
function withSpareMarker({ width, height, data }: Pixels, outline: Corners, id: number, size = 1): Pixels {
  const scale = (outline[1].x - outline[0].x) / (OUTLINE_MM[1].x - OUTLINE_MM[0].x) // Photo pixels to the millimetre
  const mm = ({ x, y }: XY): XY => ({ x: outline[0].x + (x - OUTLINE_MM[0].x) * scale, y: outline[0].y + (y - OUTLINE_MM[0].y) * scale })
  const marker = FRAME_MARKERS[id]
  const from = mm({ x: marker.corners[0].x - marker.quiet, y: marker.corners[0].y - marker.quiet })
  const span = (marker.side + 2 * marker.quiet) * scale
  const to = mm({ x: 60, y: 34 }) // inside the window
  const pasted = new Uint8ClampedArray(data)
  for (let y = 0; y < span * size; y++) {
    for (let x = 0; x < span * size; x++) {
      const [sx, sy] = [Math.round(from.x + x / size), Math.round(from.y + y / size)]
      const [tx, ty] = [Math.round(to.x + x), Math.round(to.y + y)]
      for (let k = 0; k < 4; k++) pasted[(ty * width + tx) * 4 + k] = data[(sy * width + sx) * 4 + k]
    }
  }
  return { width, height, data: pasted }
}

describe("the frame's layout", () => {
  it("holds the marker cells agent-fab checked against OpenCV's DICT_ARUCO_MIP_36h12", () => {
    // aruco_mip36h12_ids0-3.json from the prototype 1 package: W is white, B black, row by row.
    const printed = [
      "WWBWBB WBWBWW BWWBBB WWWBWB BBBBWB BWWWBW",
      "BWWBBB BBBBBB BBBWBB BWBBWW BWBBWW WBBWBW",
      "BBBWBB WBBBBB BWWBWW WWWBWW WWWBBW WWBBWB",
      "WWWWWW WWWBBB WBWBWW BWBWWB WWBBWB WWBWBB",
    ]
    printed.forEach((pattern, id) => {
      const cells = Array.from({ length: (MARKER_CELLS - 2) ** 2 }, (_, i) =>
        markerCellIsWhite(id, 1 + Math.floor(i / (MARKER_CELLS - 2)), 1 + (i % (MARKER_CELLS - 2))) ? "W" : "B",
      )
      expect(cells.join("")).toBe(pattern.replace(/ /g, ""))
    })
    expect(FRAME_MARKER_CODES).toHaveLength(4)
  })

  it("puts every place read for even light on the bare black base, clear of tiles, markers, window and edge", () => {
    /** Distance from a point to a rectangle (0 inside it). */
    const away = ({ x, y }: XY, [x0, y0, x1, y1]: number[]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1))
    const rects = [
      ...FRAME_PATCHES.map((p) => [p.center.x - p.size / 2, p.center.y - p.size / 2, p.center.x + p.size / 2, p.center.y + p.size / 2]),
      ...FRAME_MARKERS.map((m) => [m.corners[0].x - m.quiet, m.corners[0].y - m.quiet, m.corners[2].x + m.quiet, m.corners[2].y + m.quiet]),
      [WINDOW_MM[0].x, WINDOW_MM[0].y, WINDOW_MM[2].x, WINDOW_MM[2].y],
    ]
    expect(EVENNESS_MM.length).toBeGreaterThanOrEqual(6)
    for (const sample of EVENNESS_MM) {
      for (const rect of rects) expect(away(sample, rect)).toBeGreaterThanOrEqual(EVENNESS_RADIUS_MM)
      expect(Math.min(sample.x, sample.y, FRAME_SIZE_MM.width - sample.x, FRAME_SIZE_MM.height - sample.y)).toBeGreaterThanOrEqual(EVENNESS_RADIUS_MM)
    }
  })
})

describe("a flat framed Photo", () => {
  const sim = framed()
  const found = findCard(sim.pixels)

  it("gives the outline: the outer corners of the four markers, top left first", () => {
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, sim.frame!.outline[i])).toBeLessThan(CORNER_TOLERANCE))
  })

  it("reads the same as the true outline: same Card check, same Reading", () => {
    const [byFinder, byTruth] = [readFrame(sim, found!), readFrame(sim, sim.frame!.outline)]
    expect(byTruth.cardCheck?.ok).toBe(true)
    expect(byFinder.cardCheck?.ok).toBe(true)
    expect(byFinder.cardCheck!.meanDE).toBeCloseTo(byTruth.cardCheck!.meanDE, 1)
    expect(byFinder.readings[0].corrected!.chip.notation).toBe(byTruth.readings[0].corrected!.chip.notation)
    expect(byFinder.readings[0].corrected!.chip.notation).toBe(SIM_SOIL)
  })

  it.each(Object.entries(LIGHTS))("finds the frame under %s light, and the Card check passes", (_name, light) => {
    const lit = framed(undefined, { camera: { light, toneCurve: PHONE_TONE_CURVE } })
    const outline = findCard(lit.pixels)
    expect(outline).not.toBeNull()
    expect(readFrame(lit, outline!).cardCheck!.meanDE).toBeLessThan(CARD_CHECK_GOOD)
  })
})

describe.each(TILTS)("a framed Photo tilted %s", (_name, tilt) => {
  const sim = framed(tilt)
  const found = findCard(sim.pixels)

  it("gives the outline, where the markers' corners are", () => {
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, sim.frame!.outline[i])).toBeLessThan(CORNER_TOLERANCE))
  })

  it("passes the Card check and reads within one Chip of the true outline, and of the true Chip", () => {
    const [byFinder, byTruth] = [readFrame(sim, found!), readFrame(sim, sim.frame!.outline)]
    expect(byFinder.cardCheck?.ok).toBe(true)
    const corrected = byFinder.readings[0].corrected!.chip.notation
    expect(withinOneChip(corrected, byTruth.readings[0].corrected!.chip.notation)).toBe(true)
    expect(withinOneChip(corrected, SIM_SOIL)).toBe(true)
  })
})

describe("a framed Photo turned on its side", () => {
  it("still gives the outline in the frame's own order, because markers are told apart by ID", () => {
    const sim = framed({ yaw: 40, pitch: 0 })
    const { pixels, point } = turnClockwise(sim.pixels)
    const found = findCard(pixels)
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, point(sim.frame!.outline[i]))).toBeLessThan(CORNER_TOLERANCE))
    const turned = { ...sim, pixels, spot: point(sim.spot) }
    expect(readFrame(turned, found!).cardCheck?.ok).toBe(true)
  })
})

describe("a Photo without the whole frame", () => {
  it("gives nothing when the Card is a ColorChecker, flat or tilted", () => {
    expect(findCard(simulatePhoto({ camera }).pixels)).toBeNull()
    expect(findCard(simulatePhoto({ camera, tilt: { yaw: 40, pitch: 0, distance: 1000 } }).pixels)).toBeNull()
  })

  it("gives nothing when there is no Card at all", () => {
    expect(findCard(simulatePhoto({ camera, card: false }).pixels)).toBeNull()
  })

  it("gives nothing when no marker is printed", () => {
    expect(findCard(framed(undefined, { frame: { markers: [] } }).pixels)).toBeNull()
  })

  it.each([[0], [1], [2], [3]])("gives nothing when marker %i is missing, flat or tilted", (missing) => {
    const markers = [0, 1, 2, 3].filter((id) => id !== missing)
    expect(findCard(framed(undefined, { frame: { markers } }).pixels)).toBeNull()
    expect(findCard(framed(TILTS[0][1], { frame: { markers } }).pixels)).toBeNull()
  })

  it.each([[0], [1], [2], [3]])("gives nothing when only marker %i is there", (only) => {
    expect(findCard(framed(undefined, { frame: { markers: [only] } }).pixels)).toBeNull()
  })

  it.each([[0], [1], [2], [3]])("gives nothing when marker %i is in the shot twice: which one is the frame's is a guess", (twice) => {
    const sim = framed()
    expect(findCard(sim.pixels)).not.toBeNull() // the frame alone is fine, so the copy is what spoils it
    expect(findCard(withSpareMarker(sim.pixels, sim.frame!.outline, twice))).toBeNull()
  })

  it.each([[0], [3]])("ignores a speck of marker %i, under a third of the frame's markers' size", (speck) => {
    // On a Photo twice the size, the frame's markers are 240 pixels across and the speck 72:
    // small, but big enough for js-aruco2 to read (from about 55).
    const { pixels, outline } = upscale(framed().pixels, framed().frame!.outline, 2)
    expect(findCard(pixels)).not.toBeNull()
    const spotted = withSpareMarker(pixels, outline, speck, 0.3)
    const found = findCard(spotted)
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, outline[i])).toBeLessThan(2 * CORNER_TOLERANCE))
    // The same speck at half the size is a second marker, and the frame is refused.
    expect(findCard(withSpareMarker(pixels, outline, speck, 0.5))).toBeNull()
  }, 30_000)
})

describe("the app bundle", () => {
  // The build's code stays in memory, but the PWA plugin writes its service worker to the output
  // directory whatever `write` says, so that directory is a disposable one, not dist/.
  const scratch = mkdtempSync(join(tmpdir(), "frame-test-"))
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  /** The JavaScript a production build of the project makes, with `options` on top. */
  async function chunksOf(options: BuildEnvironmentOptions = {}) {
    const result = await build({
      logLevel: "silent",
      mode: "production",
      build: { write: false, outDir: scratch, ...options },
    })
    const outputs = Array.isArray(result) ? result.flatMap((r) => r.output) : "output" in result ? result.output : []
    return outputs.flatMap((output) => (output.type === "chunk" ? [output] : []))
  }

  const holdsFinder = (chunk: { moduleIds: string[] }) =>
    chunk.moduleIds.some((id) => /js-aruco2|[\\/]engine[\\/]frame\.ts$/.test(id))

  it("keeps the frame finder out of what loads at startup: it is its own chunk, loaded when a frame is chosen", async () => {
    const chunks = await chunksOf()
    const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
    // The build really is the app: the engine is in it, so an empty result cannot pass.
    expect(chunks.flatMap((chunk) => chunk.moduleIds).some((id) => /[\\/]engine[\\/]readPhoto\.ts$/.test(id))).toBe(true)

    // Everything the page loads at startup: the entry chunk and what it imports, all the way down.
    const atStartup = new Set<string>()
    const visit = (name: string) => {
      if (atStartup.has(name) || !byName.has(name)) return
      atStartup.add(name)
      byName.get(name)!.imports.forEach(visit)
    }
    chunks.filter((chunk) => chunk.isEntry).forEach((chunk) => visit(chunk.fileName))
    expect(atStartup.size).toBeGreaterThan(0)
    for (const name of atStartup) {
      const chunk = byName.get(name)!
      expect(chunk.moduleIds.filter((id) => /js-aruco2|[\\/]engine[\\/]frame\.ts$/.test(id))).toEqual([])
      // js-aruco2's own code, in case it were copied in under another name. (Its dictionary's
      // name is not a sign: the layout JSON names it too.)
      expect(chunk.code).not.toMatch(/clockwiseCorners|findCandidates/)
    }

    // The finder is in exactly one chunk, which only a dynamic import loads, and the app does import it.
    const finder = chunks.filter(holdsFinder)
    expect(finder).toHaveLength(1)
    expect(finder[0].isDynamicEntry).toBe(true)
    expect(atStartup.has(finder[0].fileName)).toBe(false)
    expect(chunks.some((chunk) => chunk.dynamicImports.includes(finder[0].fileName))).toBe(true)
  }, 60_000)
})
