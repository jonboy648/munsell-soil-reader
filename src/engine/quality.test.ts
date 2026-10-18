// Seam 1, Photo quality: one simulated Photo per problem raises that warning and no other,
// and a clean Photo raises none. Every test builds a Photo, calls readPhoto and reads
// `quality`; nothing here reaches into the engine's helpers.
import { describe, expect, it } from "vitest"
import { readPhoto } from "./index"
import type { Card, Corners, XY } from "./index"
import {
  ANGLED_TILT,
  LIGHTS,
  PHONE_TONE_CURVE,
  SIM_CORNERS,
  SIM_SPOT,
  simPatchCenter as patch,
  simulatePhoto,
  type SimCamera,
  type SimScene,
} from "./simulate"

const camera = (light: SimCamera["light"] = LIGHTS.warm, toneCurve = PHONE_TONE_CURVE): SimCamera => ({ light, toneCurve })
const WARM: SimScene = { camera: camera() }
/** The same light, scaled: more than 1 is over-exposed, less than 1 under. */
const exposed = (gain: number, base: SimCamera["light"] = LIGHTS.warm): SimCamera["light"] => (lin) => {
  const [r, g, b] = base(lin)
  return [r * gain, g * gain, b * gain]
}

/** Bare ground below the Card, a different soil from the one in the middle of the Photo. */
const GROUND: XY = { x: 300, y: 560 }
/** A bright reflection on soil that covers part of the Spot and spills past it. */
const SPOT_SHINE = { at: { x: SIM_SPOT.x + 25, y: SIM_SPOT.y }, radius: 50, strength: 1.5 }
const shine = (at: XY, radius = 45, strength = 1.5) => ({ at, radius, strength })

function problems(scene: SimScene, opts: { spots?: XY[]; card?: Card } = {}) {
  const sim = simulatePhoto(scene)
  const card: Card = opts.card ?? (scene.card === false ? { kind: "none" } : { kind: "colorchecker", corners: sim.corners })
  return readPhoto({ pixels: sim.pixels, card, spots: opts.spots ?? [sim.spot] }).quality
}
/** What was flagged, and where: just the kinds and places, for comparing. */
const flagged = (quality: ReturnType<typeof problems>) => quality.map((q) => [q.kind, q.where])

describe("a clean Photo", () => {
  describe.each([
    ["camera color shift", LIGHTS.shift],
    ["warm light", LIGHTS.warm],
    ["dim light", LIGHTS.dim],
    ["a camera that sees the scene as it is", LIGHTS.neutral],
  ])("%s", (_name, light) => {
    it.each([0.3, 0.5, 0.7])("raises no warning through a tone curve of %f", (toneCurve) => {
      expect(problems({ camera: camera(light, toneCurve) }, { spots: [SIM_SPOT, GROUND] })).toEqual([])
    })
  })

  it.each([0.5, 0.25])("raises none when exposed at %f", (gain) => {
    expect(problems({ camera: camera(exposed(gain)) })).toEqual([])
  })

  it.each([
    ["noisy and compressed", { noise: 2, jpeg: 75 }],
    ["very noisy and heavily compressed", { noise: 3, jpeg: 50 }],
  ])("raises none when %s", (_name, rough) => {
    expect(problems({ ...WARM, ...rough })).toEqual([])
  })

  it("raises none with the corners tapped a few pixels off", () => {
    const off = [[7, -6], [-8, 5], [6, 7], [-5, -8]]
    const corners = SIM_CORNERS.map((c, i) => ({ x: c.x + off[i][0], y: c.y + off[i][1] })) as Corners
    expect(problems(WARM, { card: { kind: "colorchecker", corners } })).toEqual([])
  })

  it("raises none with no Card in the shot", () => {
    expect(problems({ ...WARM, card: false })).toEqual([])
  })
})

describe("glare", () => {
  it("on the Card is flagged on the Card, with advice to lose the reflection", () => {
    const quality = problems({ ...WARM, glare: [shine(patch(1, 4))] })
    expect(flagged(quality)).toEqual([["glare", "card"]])
    expect(quality[0].advice).toContain("Tilt the Card or move into shade to lose the reflection")
  })

  it.each([
    ["two adjacent patches", [shine(patch(1, 3)), shine(patch(1, 4))]],
    ["a row of patches", [0, 1, 2, 3, 4, 5].map((c) => shine(patch(1, c)))],
    ["the gray patches", [1, 2, 3, 4].map((c) => shine(patch(3, c)))],
    ["six patches at once", [shine(patch(1, 2), 130)]],
    ["a broad sheen", [shine(patch(1, 3), 200, 1)]],
  ])("over %s is still flagged, even though the Card check fails", (_name, glare) => {
    const sim = simulatePhoto({ ...WARM, glare })
    const result = readPhoto({ pixels: sim.pixels, card: { kind: "colorchecker", corners: sim.corners }, spots: [SIM_SPOT] })
    expect(result.cardCheck?.ok).toBe(false)
    expect(flagged(result.quality)).toEqual([["glare", "card"]])
  })

  it("on soil is flagged on that Spot and no other", () => {
    const quality = problems({ ...WARM, glare: [SPOT_SHINE] }, { spots: [GROUND, SIM_SPOT] })
    expect(flagged(quality)).toEqual([["glare", 1]])
    expect(quality[0].advice).toContain("lose the reflection")
  })

  it("on a Spot is still glare when it covers the whole Spot", () => {
    expect(flagged(problems({ ...WARM, glare: [shine(SIM_SPOT, 90)] }))).toEqual([["glare", 0]])
  })

  it("on a Spot is glare, not clipping, when there is no Card", () => {
    expect(flagged(problems({ ...WARM, card: false, glare: [SPOT_SHINE] }))).toEqual([["glare", 0]])
  })

  it("on a Spot is glare, not clipping, even when the exposure has clipped the Card's white", () => {
    const scene = { camera: camera(exposed(1.15, LIGHTS.neutral)), glare: [SPOT_SHINE] }
    expect(flagged(problems(scene))).toEqual([["clipped", "card"], ["glare", 0]])
  })

  it("a speck under 5% of a patch or a Spot is not flagged", () => {
    expect(problems({ ...WARM, glare: [shine(patch(1, 4), 4, 2.5), shine(SIM_SPOT, 8, 2.5)] })).toEqual([])
  })
})

describe("clipping", () => {
  it("blown highlights are flagged on the Card, and not as glare", () => {
    const quality = problems({ camera: camera(exposed(2)) })
    expect(flagged(quality)).toEqual([["clipped", "card"]])
    expect(quality[0].advice).toContain("lower the exposure")
  })

  it("crushed blacks are flagged on the Card", () => {
    const quality = problems({ camera: camera(exposed(0.03)) })
    expect(flagged(quality)).toEqual([["clipped", "card"]])
    expect(quality[0].advice).toContain("raise the exposure")
  })

  it("a Spot lost in black is flagged on that Spot as well", () => {
    expect(flagged(problems({ camera: camera(exposed(0.005)) }))).toEqual([["clipped", "card"], ["clipped", 0]])
  })

  it("a white blown in two channels is flagged, a white that only touches the top in one is not", () => {
    // Shift light puts the white at about 247/250/255 and warm light at 254/236/188.
    expect(problems({ camera: camera(LIGHTS.shift, 0.5) })).toEqual([])
    expect(flagged(problems({ camera: camera(exposed(1.3, LIGHTS.warm)) }))).toEqual([["clipped", "card"]])
  })

  it("a Spot that is partly blown because the exposure is too bright is clipped, not glare", () => {
    const scene = { camera: camera(exposed(1.64, LIGHTS.neutral)), soil: "10YR 8/1" }
    expect(flagged(problems(scene))).toEqual([["clipped", "card"], ["clipped", 0]])
  })

  it("the same Spot with no Card to compare is still clipped, not glare", () => {
    const scene = { camera: camera(exposed(1.64, LIGHTS.neutral)), soil: "10YR 8/1", card: false }
    expect(flagged(problems(scene))).toEqual([["clipped", 0]])
  })
})

describe("uneven light", () => {
  it.each([
    ["a shadow across the Card", { from: 60, to: 500, gain: 0.7 }],
    ["a shadow edge down the middle", { from: 250, to: 280, gain: 0.7 }],
    ["a shadow over the top rows", { from: 270, to: 260, gain: 0.7, axis: "y" as const }],
    ["a shadow along the gray row", { from: 330, to: 340, gain: 0.7, axis: "y" as const }],
    ["a deep shadow edge", { from: 250, to: 280, gain: 0.3 }],
  ])("%s is flagged on the Card, with advice to move into even light", (_name, shadow) => {
    const quality = problems({ ...WARM, shadow })
    expect(flagged(quality)).toEqual([["uneven-light", "card"]])
    expect(quality[0].advice).toContain("Move into even light")
  })

  it("is flagged just over its limit and not just under it", () => {
    const across = (gain: number) => problems({ ...WARM, shadow: { from: 60, to: 500, gain } })
    expect(across(0.9)).toEqual([])
    expect(flagged(across(0.8))).toEqual([["uneven-light", "card"]])
  })

  it("is flagged with glare on the Card as well, each in its own place", () => {
    const quality = problems({
      ...WARM,
      shadow: { from: 270, to: 260, gain: 0.5, axis: "y" },
      glare: [shine(patch(3, 3)), shine(patch(3, 4)), shine(patch(0, 5)), SPOT_SHINE],
    })
    expect(flagged(quality)).toEqual([["glare", "card"], ["uneven-light", "card"], ["glare", 0]])
  })
})

describe("a Card too small", () => {
  it("is flagged on the Card, with advice to move closer", () => {
    const quality = problems({ ...WARM, cardScale: 0.25 })
    expect(flagged(quality)).toEqual([["card-too-small", "card"]])
    expect(quality[0].advice).toContain("Move closer")
  })

  it("is flagged just under its limit and not just over it", () => {
    expect(flagged(problems({ ...WARM, cardScale: 0.3 }))).toEqual([["card-too-small", "card"]])
    expect(problems({ ...WARM, cardScale: 0.35 })).toEqual([])
  })
})

describe("corners tapped in the wrong order", () => {
  const perms = (a: number[]): number[][] =>
    a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]))
  const wrong = perms([0, 1, 2, 3]).filter((p) => p.join("") !== "0123")

  it("fail the Card check without blaming the light or the Card's size, in every order", () => {
    for (const scale of [1, 0.5]) {
      const sim = simulatePhoto({ ...WARM, cardScale: scale })
      for (const order of wrong) {
        const corners = order.map((i) => sim.corners[i]) as Corners
        const result = readPhoto({ pixels: sim.pixels, card: { kind: "colorchecker", corners }, spots: [SIM_SPOT] })
        expect(result.cardCheck?.ok, order.join("")).toBe(false)
        expect(result.quality, order.join("")).toEqual([])
      }
    }
  })

  it("still flag a clipped white, which does not depend on where the corners are", () => {
    const [tl, tr, br, bl] = SIM_CORNERS
    // Turned a quarter, and tapped the other way around. (With the taps crossed over, the map
    // puts every patch at one point, and the references see nothing.)
    for (const corners of [[bl, tl, tr, br], [tl, bl, br, tr]] as Corners[]) {
      const quality = problems({ camera: camera(exposed(1.3)) }, { card: { kind: "colorchecker", corners } })
      expect(flagged(quality)).toEqual([["clipped", "card"]])
    }
  })
})

describe("a Card seen at an angle", () => {
  const tilted = (extra: Partial<SimScene> = {}) => {
    const sim = simulatePhoto({ ...WARM, tilt: ANGLED_TILT, ...extra })
    return readPhoto({ pixels: sim.pixels, card: { kind: "colorchecker", corners: sim.corners }, spots: [sim.spot] }).quality
  }

  it("raises no warning when the light is even", () => {
    expect(tilted()).toEqual([])
  })

  it("still shows a shadow across the Card", () => {
    expect(flagged(tilted({ shadow: { from: 60, to: 700, gain: 0.5 } }))).toEqual([["uneven-light", "card"]])
  })

  it("still shows glare on the Card", () => {
    const sim = simulatePhoto({ ...WARM, tilt: ANGLED_TILT })
    const glare = shine(sim.patches[10], 40)
    expect(flagged(tilted({ glare: [glare] }))).toEqual([["glare", "card"]])
  })
})
