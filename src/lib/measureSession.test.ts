// Measurement mode's session: which swatch a tap names, and how shots pile up.
import { describe, expect, it } from "vitest"
import { LIGHTS, simSwatchLabs, simulatePhoto } from "@/engine/simulate"
import { initialMeasure, measureReducer, type MeasureAction, type MeasureState } from "@/lib/measureSession"

const sim = simulatePhoto({ camera: { light: LIGHTS.neutral }, swatches: simSwatchLabs() })
const photo = { name: "swatch card", pixels: sim.pixels as unknown as ImageData }

const run = (actions: MeasureAction[], from: MeasureState = initialMeasure) => actions.reduce(measureReducer, from)
const taps = (points: { x: number; y: number }[]): MeasureAction[] => points.map((point) => ({ type: "tap", point }))
/** The Photo loaded and the four corners tapped. */
const marked = () => run([{ type: "load", photo }, ...taps(sim.corners)])

describe("tapping swatches", () => {
  it("names them swatch_01, swatch_02 ... in the order they are tapped", () => {
    const state = run(taps(sim.swatches.slice(0, 3)), marked())
    expect(state.labels).toEqual(["swatch_01", "swatch_02", "swatch_03"])
    expect(state.next).toBe("swatch_04")
    expect(state.session.spots).toEqual(sim.swatches.slice(0, 3))
  })

  it("names the one picked from the list, then carries on from the first not yet tapped", () => {
    const state = run([{ type: "pick", id: "swatch_10" }, ...taps([sim.swatches[9]])], marked())
    expect(state.labels).toEqual(["swatch_10"])
    expect(state.next).toBe("swatch_01")
  })

  it("moves a swatch that is tapped again instead of adding another", () => {
    const state = run([...taps(sim.swatches.slice(0, 2)), { type: "pick", id: "swatch_01" }, ...taps([sim.swatches[5]])], marked())
    expect(state.labels).toEqual(["swatch_01", "swatch_02"])
    expect(state.session.spots).toEqual([sim.swatches[5], sim.swatches[1]])
    expect(state.next).toBe("swatch_03")
  })

  it("does not name the corner taps", () => {
    const state = run([{ type: "load", photo }, ...taps(sim.corners.slice(0, 2))])
    expect(state.labels).toEqual([])
    expect(state.session.corners).toHaveLength(2)
  })

  it("takes back the last swatch with Undo and offers its name again; with none, takes back a corner", () => {
    let state = run(taps(sim.swatches.slice(0, 2)), marked())
    state = measureReducer(state, { type: "undo" })
    expect(state.labels).toEqual(["swatch_01"])
    expect(state.next).toBe("swatch_02")
    state = measureReducer(measureReducer(state, { type: "undo" }), { type: "undo" })
    expect(state.session.corners).toHaveLength(3)
  })
})

describe("shots", () => {
  it("adds the shot, measured, and starts the next one with no Photo and the first swatch next", () => {
    const state = run([...taps(sim.swatches.slice(0, 4)), { type: "addShot" }], marked())
    expect(state.shots).toHaveLength(1)
    expect(state.shots[0].name).toBe("swatch card")
    expect(state.shots[0].swatches.map((s) => s.id)).toEqual(["swatch_01", "swatch_02", "swatch_03", "swatch_04"])
    expect(state.shots[0].cardCheck.ok).toBe(true)
    expect(state.session.photo).toBeNull()
    expect(state.labels).toEqual([])
    expect(state.next).toBe("swatch_01")
  })

  it("adds nothing before the corners are marked or any swatch is tapped", () => {
    expect(run([{ type: "load", photo }, { type: "addShot" }]).shots).toEqual([])
    expect(run([{ type: "addShot" }], marked()).shots).toEqual([])
  })

  it("keeps the shots through Start over and a new Photo, and drops one on request", () => {
    let state = run([...taps(sim.swatches.slice(0, 1)), { type: "addShot" }], marked())
    state = run([{ type: "load", photo }, { type: "restart" }], state)
    expect(state.shots).toHaveLength(1)
    state = run([...taps(sim.corners), ...taps(sim.swatches.slice(0, 1)), { type: "addShot" }], state)
    expect(state.shots).toHaveLength(2)
    expect(measureReducer(state, { type: "dropShot", index: 0 }).shots).toHaveLength(1)
  })
})
