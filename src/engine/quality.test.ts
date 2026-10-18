// Seam 1, Photo quality: one simulated Photo per problem raises that warning and no other,
// and a clean Photo raises none. Every test builds a Photo, calls readPhoto and reads
// `quality`; nothing here reaches into the engine's helpers.
import { describe, expect, it } from "vitest"
import { readPhoto } from "./index"
import type { Card, XY } from "./index"
import { LIGHTS, PHONE_TONE_CURVE, SIM_CORNERS, SIM_SPOT, simPatchCenter as patch, simulatePhoto, type SimScene } from "./simulate"

const phone = (light: (typeof LIGHTS)[keyof typeof LIGHTS]) => ({ light, toneCurve: PHONE_TONE_CURVE })
const WARM: SimScene = { camera: phone(LIGHTS.warm) }
/** The same light for every scene, scaled: more than 1 is over-exposed, less than 1 under. */
const exposed = (gain: number): SimScene => ({
  camera: { light: (lin) => [lin[0] * gain, lin[1] * gain, lin[2] * gain], toneCurve: PHONE_TONE_CURVE },
})

/** Bare ground below the Card, a different soil from the one in the middle of the Photo. */
const GROUND: XY = { x: 300, y: 560 }
/** A bright reflection on soil that covers part of the Spot and spills past it. */
const SPOT_SHINE = { at: { x: SIM_SPOT.x + 25, y: SIM_SPOT.y }, radius: 50, strength: 1.5 }

function problems(scene: SimScene, opts: { spots?: XY[]; card?: Card } = {}) {
  const sim = simulatePhoto(scene)
  const card = opts.card ?? (scene.card === false ? { kind: "none" as const } : { kind: "colorchecker" as const, corners: sim.corners })
  const result = readPhoto({ pixels: sim.pixels, card, spots: opts.spots ?? [sim.spot] })
  return result.quality
}
/** What was flagged, and where: just the kinds and places, for comparing. */
const flagged = (quality: ReturnType<typeof problems>) => quality.map((q) => [q.kind, q.where])

describe("a clean Photo", () => {
  it.each([
    ["camera color shift", LIGHTS.shift],
    ["warm light", LIGHTS.warm],
    ["dim light", LIGHTS.dim],
    ["a camera that sees the scene as it is", LIGHTS.neutral],
  ])("raises no warning: %s", (_name, light) => {
    expect(problems({ camera: phone(light) }, { spots: [SIM_SPOT, GROUND] })).toEqual([])
  })

  it("raises none with no Card in the shot", () => {
    expect(problems({ ...WARM, card: false })).toEqual([])
  })
})

describe("glare", () => {
  it("on the Card is flagged on the Card, with advice to lose the reflection", () => {
    const quality = problems({ ...WARM, glare: [{ at: patch(1, 4), radius: 45, strength: 1.5 }] })
    expect(flagged(quality)).toEqual([["glare", "card"]])
    expect(quality[0].advice).toContain("Tilt the Card or move into shade to lose the reflection")
  })

  it("on soil is flagged on that Spot and no other", () => {
    const quality = problems({ ...WARM, glare: [SPOT_SHINE] }, { spots: [GROUND, SIM_SPOT] })
    expect(flagged(quality)).toEqual([["glare", 1]])
    expect(quality[0].advice).toContain("lose the reflection")
  })

  it("on a Spot is still glare when it covers the whole Spot", () => {
    const quality = problems({ ...WARM, glare: [{ ...SPOT_SHINE, at: SIM_SPOT, radius: 90 }] })
    expect(flagged(quality)).toEqual([["glare", 0]])
  })

  it("on a Spot is glare, not clipping, when there is no Card", () => {
    expect(flagged(problems({ ...WARM, card: false, glare: [SPOT_SHINE] }))).toEqual([["glare", 0]])
  })
})

describe("clipping", () => {
  it("blown highlights are flagged on the Card, and not as glare", () => {
    const quality = problems(exposed(2))
    expect(flagged(quality)).toEqual([["clipped", "card"]])
    expect(quality[0].advice).toContain("lower the exposure")
  })

  it("crushed blacks are flagged on the Card", () => {
    const quality = problems(exposed(0.03))
    expect(flagged(quality)).toEqual([["clipped", "card"]])
    expect(quality[0].advice).toContain("raise the exposure")
  })

  it("a Spot lost in black is flagged on that Spot as well", () => {
    expect(flagged(problems(exposed(0.005)))).toEqual([["clipped", "card"], ["clipped", 0]])
  })

  it("a Spot that is washed out with no Card to compare is flagged as clipped", () => {
    const wash = { ...SPOT_SHINE, at: SIM_SPOT, radius: 90 }
    expect(flagged(problems({ ...WARM, card: false, glare: [wash] }))).toEqual([["clipped", 0]])
  })
})

describe("uneven light", () => {
  it("a shadow across the Card is flagged on the Card", () => {
    const quality = problems({ ...WARM, shadow: { x0: 60, x1: 500, gain: 0.5 } })
    expect(flagged(quality)).toEqual([["uneven-light", "card"]])
    expect(quality[0].advice).toContain("Move into even light")
  })

  it("a shadow across half the Card is flagged too", () => {
    const quality = problems({ ...WARM, shadow: { x0: 250, x1: 280, gain: 0.7 } })
    expect(flagged(quality)).toEqual([["uneven-light", "card"]])
  })
})

describe("a Card too small", () => {
  it("is flagged on the Card, with advice to move closer", () => {
    const quality = problems({ ...WARM, cardScale: 0.25 })
    expect(flagged(quality)).toEqual([["card-too-small", "card"]])
    expect(quality[0].advice).toContain("Move closer")
  })

  it("is not flagged for a Card a bit more than twice that size", () => {
    expect(problems({ ...WARM, cardScale: 0.5 })).toEqual([])
  })
})

describe("corners tapped in the wrong order", () => {
  it("fail the Card check without also blaming the light", () => {
    const [tl, tr, br, bl] = SIM_CORNERS
    const sim = simulatePhoto(WARM)
    const result = readPhoto({
      pixels: sim.pixels,
      card: { kind: "colorchecker", corners: [bl, tl, tr, br] }, // started on the white patch
      spots: [SIM_SPOT],
    })
    expect(result.cardCheck?.ok).toBe(false)
    expect(result.quality).toEqual([])
  })
})

describe("several problems at once", () => {
  it("are all reported, the Card's first", () => {
    const quality = problems(
      { ...WARM, shadow: { x0: 60, x1: 500, gain: 0.5 }, glare: [SPOT_SHINE, { at: patch(0, 4), radius: 45, strength: 1.5 }] },
      { spots: [SIM_SPOT] },
    )
    expect(flagged(quality)).toEqual([["glare", "card"], ["uneven-light", "card"], ["glare", 0]])
  })
})
