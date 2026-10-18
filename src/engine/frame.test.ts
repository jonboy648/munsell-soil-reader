// Seam 1: the frame finder, hidden until a frame exists. Every test builds a simulated Photo
// with the printed frame around the Card, calls findCard, and checks what a caller would see:
// the Card's corners or nothing, and what readPhoto makes of them.
import { build } from "vite"
import { describe, expect, it } from "vitest"
import { CARD_CHECK_GOOD, readPhoto } from "./index"
import type { Corners, Pixels, XY } from "./index"
import { findCard } from "./frame"
import { MARKER_ORIGINS, MARKER_SIZE } from "./frameLayout"
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

/**
 * The camera backs off, so the whole frame stays in the Photo when it is tilted: at the default
 * distance the near side of the frame runs off the edge and its markers are lost.
 */
const FRAME_DISTANCE = 800

/** A frame is found to within this many Photo pixels of where the corner patches really are. */
const CORNER_TOLERANCE = 2

/** The ticket's tilts: 35 to 45 degrees to the side, up to 25 degrees back or forward. */
const TILTS: [string, SimTilt][] = [
  ["40 degrees to the side", { yaw: 40, pitch: 0 }],
  ["45 degrees to the side", { yaw: 45, pitch: 0 }],
  ["35 degrees to the side and 25 degrees back", { yaw: 35, pitch: -25 }],
  ["38 degrees to the side and 25 degrees forward", { yaw: 38, pitch: 25 }],
  ["45 degrees to the side and 25 degrees forward", { yaw: 45, pitch: 25 }],
]

/** A framed Photo, tilted if asked. */
const framed = (tilt?: SimTilt, scene: Partial<SimScene> = {}): SimPhoto =>
  simulatePhoto({
    camera,
    frame: true,
    tilt: tilt && { ...tilt, distance: FRAME_DISTANCE },
    ...scene,
  })

/** What readPhoto makes of a Photo with the Card's corners as given. */
const readCard = (sim: SimPhoto, corners: Corners) =>
  readPhoto({ pixels: sim.pixels, card: { kind: "colorchecker", corners }, spots: [sim.spot] })

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

/**
 * A flat framed Photo with a second copy of marker `id` pasted `dx` Photo pixels to its right,
 * quiet zone and all: a second frame in the shot, or a spare marker.
 */
function withSpareMarker(sim: SimPhoto, id: number, dx: number): Pixels {
  const { width, height, data } = sim.pixels
  const step = (sim.corners[1].x - sim.corners[0].x) / 5 // one grid step, in Photo pixels
  const size = MARKER_SIZE * step
  const [x0, y0] = [sim.corners[0].x + MARKER_ORIGINS[id].col * step, sim.corners[0].y + MARKER_ORIGINS[id].row * step]
  const margin = Math.round(size / 8)
  const pasted = new Uint8ClampedArray(data)
  for (let y = Math.round(y0) - margin; y < Math.round(y0 + size) + margin; y++) {
    for (let x = Math.round(x0) - margin; x < Math.round(x0 + size) + margin; x++) {
      for (let k = 0; k < 4; k++) pasted[(y * width + x + dx) * 4 + k] = data[(y * width + x) * 4 + k]
    }
  }
  return { width, height, data: pasted }
}

describe("a flat framed Photo", () => {
  const sim = framed()
  const found = findCard(sim.pixels)

  it("gives the Card's four corners, where the corner patches are", () => {
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, sim.corners[i])).toBeLessThan(CORNER_TOLERANCE))
  })

  it("reads the same as hand-tapped corners: same Card check, same Reading", () => {
    const [byFrame, byHand] = [readCard(sim, found!), readCard(sim, sim.corners)]
    expect(byHand.cardCheck?.ok).toBe(true)
    expect(byFrame.cardCheck?.ok).toBe(true)
    expect(byFrame.cardCheck!.meanDE).toBeCloseTo(byHand.cardCheck!.meanDE, 1)
    expect(byFrame.readings[0].corrected!.chip.notation).toBe(byHand.readings[0].corrected!.chip.notation)
    expect(byFrame.readings[0].corrected!.chip.notation).toBe(SIM_SOIL)
    expect(byFrame.readings[0].raw.chip.notation).toBe(byHand.readings[0].raw.chip.notation)
  })

  it.each(Object.entries(LIGHTS))("finds the frame under %s light, and the Card check passes", (_name, light) => {
    const lit = framed(undefined, { camera: { light, toneCurve: PHONE_TONE_CURVE } })
    const corners = findCard(lit.pixels)
    expect(corners).not.toBeNull()
    expect(readCard(lit, corners!).cardCheck!.meanDE).toBeLessThan(CARD_CHECK_GOOD)
  })
})

describe.each(TILTS)("a framed Photo tilted %s", (_name, tilt) => {
  const sim = framed(tilt)
  const found = findCard(sim.pixels)

  it("gives the Card's four corners, where the corner patches are", () => {
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, sim.corners[i])).toBeLessThan(CORNER_TOLERANCE))
  })

  it("passes the Card check and reads within one Chip of hand-tapped corners, and of the true Chip", () => {
    const [byFrame, byHand] = [readCard(sim, found!), readCard(sim, sim.corners)]
    expect(byFrame.cardCheck?.ok).toBe(true)
    const corrected = byFrame.readings[0].corrected!.chip.notation
    expect(withinOneChip(corrected, byHand.readings[0].corrected!.chip.notation)).toBe(true)
    expect(withinOneChip(corrected, SIM_SOIL)).toBe(true)
  })
})

describe("a framed Photo turned on its side", () => {
  it("still gives the Card's corners in the Card's own order, because markers are told apart by ID", () => {
    const sim = framed({ yaw: 40, pitch: 0 })
    const { pixels, point } = turnClockwise(sim.pixels)
    const found = findCard(pixels)
    expect(found).not.toBeNull()
    found!.forEach((corner, i) => expect(dist(corner, point(sim.corners[i]))).toBeLessThan(CORNER_TOLERANCE))
    expect(readCard({ ...sim, pixels, spot: point(sim.spot) }, found!).cardCheck?.ok).toBe(true)
  })
})

describe("a Photo without the whole frame", () => {
  it("gives nothing when the Card has no frame, flat or tilted", () => {
    expect(findCard(simulatePhoto({ camera }).pixels)).toBeNull()
    expect(findCard(simulatePhoto({ camera, tilt: { yaw: 40, pitch: 0, distance: FRAME_DISTANCE } }).pixels)).toBeNull()
  })

  it("gives nothing when there is no Card and no frame", () => {
    expect(findCard(simulatePhoto({ camera, card: false }).pixels)).toBeNull()
  })

  it("gives nothing when the markers are printed but none shows", () => {
    expect(findCard(framed(undefined, { frameMarkers: [] }).pixels)).toBeNull()
  })

  it.each([[0], [1], [2], [3]])("gives nothing when marker %i is missing", (missing) => {
    const markers = [0, 1, 2, 3].filter((id) => id !== missing)
    expect(findCard(framed(undefined, { frameMarkers: markers }).pixels)).toBeNull()
    expect(findCard(framed(TILTS[0][1], { frameMarkers: markers }).pixels)).toBeNull()
  })

  it.each([[0], [1], [2], [3]])("gives nothing when only marker %i is there", (only) => {
    expect(findCard(framed(undefined, { frameMarkers: [only] }).pixels)).toBeNull()
  })

  it.each([[0], [1], [2], [3]])("gives nothing when marker %i is in the shot twice: which one is the frame's is a guess", (twice) => {
    const sim = framed()
    expect(findCard(sim.pixels)).not.toBeNull() // the frame alone is fine, so the copy is what spoils it
    expect(findCard(withSpareMarker(sim, twice, 100))).toBeNull()
  })
})

describe("the app bundle", () => {
  it("does not contain the frame finder, so it stays hidden until it is wired in", async () => {
    const result = await build({ logLevel: "silent", mode: "production", build: { write: false } })
    const outputs = Array.isArray(result) ? result.flatMap((r) => r.output) : "output" in result ? result.output : []
    const chunks = outputs.flatMap((output) => (output.type === "chunk" ? [output] : []))
    // The build really is the app: the engine is in it, so an empty result cannot pass.
    expect(chunks.flatMap((chunk) => chunk.moduleIds).some((id) => /[\\/]engine[\\/]readPhoto\.ts$/.test(id))).toBe(true)
    for (const chunk of chunks) {
      expect(chunk.moduleIds.filter((id) => /js-aruco2|[\\/]engine[\\/]frame\.ts$/.test(id))).toEqual([])
      // js-aruco2's own text, in case it were copied in under another name.
      expect(chunk.code).not.toContain("ARUCO_MIP_36h12")
    }
  }, 60_000)

  it("could take the frame finder when it is wired in: bundled on its own, it finds the same Card", async () => {
    // js-aruco2 is a plain script that fails in a production build unless vite.config.ts runs it
    // as CommonJS, so the finder is built here the way the app would build it and then run.
    const result = await build({
      logLevel: "silent",
      mode: "production",
      build: { write: false, lib: { entry: "src/engine/frame.ts", formats: ["es"], fileName: "frame" } },
    })
    const outputs = Array.isArray(result) ? result.flatMap((r) => r.output) : "output" in result ? result.output : []
    const chunk = outputs.find((output) => output.type === "chunk")
    expect(chunk?.type).toBe("chunk")
    const bundled = await import(/* @vite-ignore */ `data:text/javascript,${encodeURIComponent(chunk!.type === "chunk" ? chunk!.code : "")}`)
    const sim = framed({ yaw: 40, pitch: 0 })
    expect(bundled.findCard(sim.pixels)).toEqual(findCard(sim.pixels))
    expect(bundled.findCard(simulatePhoto({ camera }).pixels)).toBeNull()
  }, 60_000)
})
