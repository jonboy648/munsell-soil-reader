// Seam 1: the frame as a Card (ADR 0003). Every test builds a simulated Photo of the frame card,
// rendered from the layout JSON, with a made-up batch, calls readPhoto, and checks what a caller
// would see: the Reading, the Card check, the warnings, and the refusal of an unmeasured batch.
import { describe, expect, it } from "vitest"
import { CARD_CHECK_GOOD, readPhoto } from "./index"
import type { Batch, Corners, XY } from "./index"
import { BatchFormatError, UnmeasuredBatchError, batchProblem, parseBatch } from "./batch"
import { FRAME_PATCHES } from "./frameLayout"
import {
  FRAME_DISTANCE,
  LIGHTS,
  PHONE_TONE_CURVE,
  SIM_SOIL,
  simFrameBatch,
  simulatePhoto,
  type SimCamera,
  type SimPhoto,
  type SimScene,
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
const phone = (light: SimCamera["light"], toneCurve = PHONE_TONE_CURVE): SimCamera => ({ light, toneCurve })
const WARM: SimScene = { camera: phone(LIGHTS.warm), frame: {} }

/** Read a simulated frame Photo with the outline where the markers really are. */
function read(sim: SimPhoto, extra: { spots?: XY[]; batch?: Batch; outline?: Corners } = {}) {
  return readPhoto({
    pixels: sim.pixels,
    card: { kind: "frame", outline: extra.outline ?? sim.frame!.outline, batch: extra.batch ?? sim.frame!.batch },
    spots: extra.spots ?? [sim.spot],
  })
}
const corrected = (sim: SimPhoto, extra?: Parameters<typeof read>[1]) => read(sim, extra).readings[0].corrected!.chip.notation

/** The batch as the CSV file the measurement mode exports, with the rows of `leave` blanked or left out. */
function csvOf(batch: Batch, options: { leave?: string[]; blank?: boolean } = {}): string {
  const rows = FRAME_PATCHES.filter((p) => p.kind !== "reserved").flatMap((p) => {
    const measured = batch.patches.find((m) => m.id === p.id)!
    if (options.leave?.includes(p.id)) return options.blank ? [`${p.id},,,,,,,`] : []
    const [L, a, b] = measured.lab
    return [`${p.id},${L},${a},${b},${measured.sd},${measured.n},"${measured.method}",${measured.date}`]
  })
  return ["patch,L,a,b,sd,n,method,date", ...rows].join("\n")
}

describe("readPhoto with the frame card", () => {
  describe.each([
    ["a camera that sees the scene as it is", LIGHTS.neutral],
    ["camera color shift", LIGHTS.shift],
    ["warm light", LIGHTS.warm],
    ["dim light", LIGHTS.dim],
  ])("%s", (_name, light) => {
    describe.each([0, 0.3, PHONE_TONE_CURVE])("through a tone curve of %f", (toneCurve) => {
      const sim = simulatePhoto({ camera: phone(light, toneCurve), frame: {} })
      const result = read(sim)

      it("passes the Card check", () => {
        expect(result.cardCheck?.ok).toBe(true)
        expect(result.cardCheck!.meanDE).toBeLessThan(CARD_CHECK_GOOD)
      })

      it("reads the true Chip, or a Neighbouring chip, once corrected", () => {
        expect(withinOneChip(result.readings[0].corrected!.chip.notation, SIM_SOIL)).toBe(true)
      })

      it("raises no warning", () => {
        expect(result.quality).toEqual([])
        expect(result.offCard).toBeUndefined()
      })

      it("changes the Reading, uncorrected, unless the camera does next to nothing to the scene", () => {
        // The check that can fail: if the Card did nothing, the raw Reading would be right too.
        const raw = result.readings[0].raw.chip.notation
        if (light === LIGHTS.neutral && toneCurve < 0.4) expect(raw).toBe(SIM_SOIL)
        else expect(raw).not.toBe(SIM_SOIL)
      })
    })
  })

  it.each(["10YR 3/3", "10YR 5/6", "7.5YR 4/4", "5YR 4/4", "2.5Y 5/4", "10YR 2/2"])(
    "reads soil of %s within one Chip, through warm light and a tone curve",
    (soil) => {
      const sim = simulatePhoto({ ...WARM, soil })
      expect(withinOneChip(corrected(sim), soil)).toBe(true)
    },
  )

  it("reads Chips of the 10YR Page that the patches bracket within one Chip when the camera is shifted and tilted", () => {
    const sim = simulatePhoto({ camera: phone(LIGHTS.shift), frame: {}, tilt: { yaw: 40, pitch: 0 }, soil: "10YR 5/4" })
    expect(withinOneChip(corrected(sim), "10YR 5/4")).toBe(true)
  })

  it.each([
    ["40 degrees to the side", { yaw: 40, pitch: 0 }],
    ["45 degrees to the side", { yaw: 45, pitch: 0 }],
    ["35 degrees to the side and 25 degrees back", { yaw: 35, pitch: -25 }],
    ["45 degrees to the side and 25 degrees forward", { yaw: 45, pitch: 25 }],
  ])("reads a frame tilted %s as well as a flat one", (_name, tilt) => {
    const flat = read(simulatePhoto(WARM))
    const result = read(simulatePhoto({ ...WARM, tilt }))
    expect(result.cardCheck?.ok).toBe(true)
    expect(result.cardCheck!.meanDE).toBeLessThan(flat.cardCheck!.meanDE + 0.2)
    expect(withinOneChip(result.readings[0].corrected!.chip.notation, SIM_SOIL)).toBe(true)
    expect(result.quality).toEqual([])
  })

  it("reads a batch measured a little off, within one Chip, and says so when it is far off", () => {
    expect(withinOneChip(corrected(simulatePhoto({ ...WARM, frame: { batchError: 1 } })), SIM_SOIL)).toBe(true)
    // Every patch measured 8 CIELAB units off, with signs that differ from patch to patch: the
    // references disagree with each other, which the Card check sees.
    const wrong = read(simulatePhoto({ ...WARM, frame: { batchError: 8 } }))
    expect(wrong.cardCheck?.ok).toBe(false)
  })

  it("fails the Card check when the outline is not on the frame", () => {
    const sim = simulatePhoto(WARM)
    const [tl, tr, br, bl] = sim.frame!.outline
    for (const outline of [[tr, br, bl, tl], [bl, tl, tr, br], [br, bl, tl, tr]] as Corners[]) {
      // The frame turned a quarter: every patch is read in the wrong place.
      expect(read(sim, { outline }).cardCheck?.ok).toBe(false)
    }
    // And the outline moved most of the way across the Photo.
    const moved = sim.frame!.outline.map(({ x, y }) => ({ x: x - 160, y: y + 20 })) as Corners
    expect(read(sim, { outline: moved }).cardCheck?.ok).toBe(false)
  })

  it("reads each Spot separately, and notes the ones outside the window", () => {
    const sim = simulatePhoto(WARM)
    const ground: XY = { x: 40, y: 560 } // the bare ground below the frame
    const onTile: XY = sim.frame!.patches.S03 // a Spot on a reference patch, outside the window
    const result = read(sim, { spots: [sim.spot, onTile, ground] })
    expect(result.readings.map((r) => r.spot)).toEqual([sim.spot, onTile, ground])
    expect(result.readings.map((r) => r.outsideWindow)).toEqual([undefined, true, true])
    // Inside the window the Reading is the soil's; a Spot elsewhere still gets a corrected Reading.
    expect(withinOneChip(result.readings[0].corrected!.chip.notation, SIM_SOIL)).toBe(true)
    expect(result.readings[2].corrected).toBeDefined()
  })

  it("puts a Spot on the window's edge inside it, and one just past the edge outside", () => {
    const sim = simulatePhoto(WARM)
    const [tl, , br] = sim.frame!.window
    const edge: XY = { x: (tl.x + br.x) / 2, y: tl.y + 3 }
    const past: XY = { x: (tl.x + br.x) / 2, y: tl.y - 3 }
    expect(read(sim, { spots: [edge] }).readings[0].outsideWindow).toBeUndefined()
    expect(read(sim, { spots: [past] }).readings[0].outsideWindow).toBe(true)
  })

  it("keeps the window inside the window when the frame is tilted", () => {
    const sim = simulatePhoto({ ...WARM, tilt: { yaw: 45, pitch: 25 } })
    const [a, b, c, d] = sim.frame!.window
    const inside: XY[] = [sim.spot, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 4 }, { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 - 4 }]
    expect(read(sim, { spots: inside }).readings.map((r) => r.outsideWindow)).toEqual([undefined, undefined, undefined])
  })

  it("is not given a frame it cannot use when the batch is unmeasured", () => {
    const sim = simulatePhoto(WARM)
    const nothing: Batch = { code: "NEW-LOT", patches: [] }
    const attempt = () => read(sim, { batch: nothing })
    expect(attempt).toThrow(UnmeasuredBatchError)
    expect(attempt).toThrow("This frame's batch (NEW-LOT) has not been measured yet, so the colors of its patches are not known and it can't be used as a Card.")
    // Partly measured is refused too, and says which patches are missing.
    const partly: Batch = { code: "NEW-LOT", patches: sim.frame!.batch.patches.filter((p) => !["G3", "S02"].includes(p.id)) }
    expect(() => read(sim, { batch: partly })).toThrow("only partly measured (not yet: G3, S02)")
  })
})

describe("warnings on the frame card", () => {
  it("flags glare on a patch as glare on the Card, with advice, and nothing else", () => {
    const clean = simulatePhoto(WARM)
    const at = clean.frame!.patches.S05
    const quality = read(simulatePhoto({ ...WARM, glare: [{ at, radius: 40, strength: 1.5 }] }), {}).quality
    expect(quality.map((q) => [q.kind, q.where])).toEqual([["glare", "card"]])
    expect(quality[0].advice).toContain("Tilt the Card or move into shade to lose the reflection")
  })

  it("flags glare on the soil in the window as glare on that Spot", () => {
    const clean = simulatePhoto(WARM)
    const quality = read(simulatePhoto({ ...WARM, glare: [{ at: { x: clean.spot.x + 20, y: clean.spot.y }, radius: 50, strength: 1.5 }] })).quality
    expect(quality.map((q) => [q.kind, q.where])).toEqual([["glare", 0]])
  })

  it("flags a shadow across the frame as uneven light, read from the black base", () => {
    const quality = read(simulatePhoto({ ...WARM, shadow: { from: 250, to: 700, gain: 0.3 } })).quality
    expect(quality.map((q) => [q.kind, q.where])).toEqual([["uneven-light", "card"]])
  })

  it("flags a frame that is too small in the Photo", () => {
    // Far enough back that a patch is under 24 pixels from the next.
    const sim = simulatePhoto({ ...WARM, tilt: { yaw: 0, pitch: 0, distance: 2800 } })
    const quality = read(sim).quality
    expect(quality.map((q) => [q.kind, q.where])).toEqual([["card-too-small", "card"]])
    // And at the distance the other frame Photos are taken from, it is not.
    expect(read(simulatePhoto({ ...WARM, tilt: { yaw: 0, pitch: 0, distance: FRAME_DISTANCE } })).quality).toEqual([])
  })

  it("flags the outline as off the frame when the grays come out in the wrong order", () => {
    const sim = simulatePhoto(WARM)
    const [tl, tr, br, bl] = sim.frame!.outline
    // Turned a quarter either way, flipped, or moved across the Photo: the grays are read in the wrong places.
    for (const outline of [[tr, br, bl, tl], [bl, tl, tr, br], [tr, tl, bl, br]] as Corners[]) {
      expect(read(sim, { outline }).offCard).toBe(true)
    }
    expect(read(sim, { outline: sim.frame!.outline.map(({ x, y }) => ({ x: x - 160, y: y + 20 })) as Corners }).offCard).toBe(true)
    // Turned a half: the Card check fails, but the grays land on soil patches that run from light to dark too.
    expect(read(sim, { outline: [br, bl, tl, tr] }).offCard).toBeUndefined()
    // And on the frame, they are in order.
    expect(read(sim).offCard).toBeUndefined()
  })

  it("raises none through noise and heavy JPEG compression", () => {
    for (const seed of [1, 2]) {
      expect(read(simulatePhoto({ ...WARM, noise: 3, jpeg: 50, seed })).quality).toEqual([])
    }
  }, 60_000)
})

describe("a batch file", () => {
  const batch = simFrameBatch()

  it("is read back as the batch it was made from", () => {
    const parsed = parseBatch("sim-1", csvOf(batch))
    expect(parsed.code).toBe("SIM-1")
    expect(parsed.patches).toEqual(batch.patches)
    expect(batchProblem(parsed)).toBeNull()
  })

  it("is the same batch whatever the line endings, the case of the header and a byte-order mark", () => {
    const windows = "﻿" + csvOf(batch).replace(/^patch,L,a,b,sd,n,method,date/, "Patch,l,A,B,SD,N,Method,Date").replace(/\n/g, "\r\n") + "\r\n\r\n"
    expect(parseBatch("SIM-1", windows).patches).toEqual(batch.patches)
  })

  it("reads a Card the same as the batch it came from", () => {
    const sim = simulatePhoto(WARM)
    expect(corrected(sim, { batch: parseBatch("SIM-1", csvOf(batch)) })).toBe(corrected(sim))
  })

  it("counts patches that are listed but blank as not measured yet", () => {
    const parsed = parseBatch("SIM-1", csvOf(batch, { leave: ["G2", "S07"], blank: true }))
    expect(parsed.patches.map((p) => p.id)).not.toContain("G2")
    expect(batchProblem(parsed)).toContain("not yet: G2, S07")
    expect(batchProblem(parseBatch("SIM-1", csvOf(batch, { leave: ["G2"] })))).toContain("not yet: G2")
  })

  it("is refused as a Card until every patch is measured", () => {
    const header = "patch,L,a,b,sd,n,method,date"
    expect(batchProblem(parseBatch("NEW", header))).toContain("has not been measured yet")
    expect(batchProblem(parseBatch("NEW", header + "\nG1,,,,,,,\nS01,,,,,,,"))).toContain("has not been measured yet")
  })

  it.each([
    ["is empty", "", "line 1: it is empty"],
    ["has the wrong columns", "patch,L,a,b\nG1,50,0,0", "line 1: the first line must be patch,L,a,b,sd,n,method,date"],
    ["names a patch the frame does not have", "patch,L,a,b,sd,n,method,date\nX9,50,0,0,0.2,3,m,2026-01-01", 'line 2: "X9" is not a patch on this frame'],
    ["names a reserved patch", "patch,L,a,b,sd,n,method,date\nR1,50,0,0,0.2,3,m,2026-01-01", 'line 2: "R1" is not a patch on this frame'],
    ["lists a patch twice", "patch,L,a,b,sd,n,method,date\nG1,50,0,0,0.2,3,m,2026-01-01\nG1,50,0,0,0.2,3,m,2026-01-01", "line 3: patch G1 is listed twice"],
    ["has a row with too few columns", "patch,L,a,b,sd,n,method,date\nG1,50,0,0", "line 2: expected 8 columns, found 4"],
    ["has a color that is not a number", "patch,L,a,b,sd,n,method,date\nG1,fifty,0,0,0.2,3,m,2026-01-01", "line 2: L, a and b of G1 must be numbers"],
    ["has some of a color blank", "patch,L,a,b,sd,n,method,date\nG1,50,,0,0.2,3,m,2026-01-01", "line 2: L, a and b of G1 must be numbers, or all blank"],
    ["has a lightness past 100", "patch,L,a,b,sd,n,method,date\nG1,101,0,0,0.2,3,m,2026-01-01", "line 2: the color of G1 is not a CIELAB color"],
    ["has no spread", "patch,L,a,b,sd,n,method,date\nG1,50,0,0,,3,m,2026-01-01", "line 2: sd of G1 must be a number"],
    ["has no shots", "patch,L,a,b,sd,n,method,date\nG1,50,0,0,0.2,0,m,2026-01-01", "line 2: n of G1 must be a whole number"],
    ["has no method", "patch,L,a,b,sd,n,method,date\nG1,50,0,0,0.2,3,,2026-01-01", "line 2: say how G1 was measured"],
    ["has a date that is not a date", "patch,L,a,b,sd,n,method,date\nG1,50,0,0,0.2,3,m,Jan 1", "line 2: the date of G1 must be YYYY-MM-DD"],
  ])("is refused, with the line and the reason, when it %s", (_name, csv, message) => {
    expect(() => parseBatch("SIM-1", csv)).toThrow(BatchFormatError)
    expect(() => parseBatch("SIM-1", csv)).toThrow(message)
  })
})
