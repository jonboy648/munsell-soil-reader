// The words that say why a Page's Reading is or is not trusted, driven by what readPhoto returns
// for a simulated Page.
import { describe, expect, it } from "vitest"
import { readPhoto } from "@/engine"
import { LIGHTS, PHONE_TONE_CURVE, simulatePhoto, type SimScene } from "@/engine/simulate"
import { shownReading } from "./verdict"

function shown(scene: Partial<SimScene>, taps = (c: ReturnType<typeof simulatePhoto>["corners"]) => c) {
  const sim = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE }, page: "10YR", ...scene })
  const result = readPhoto({
    pixels: sim.pixels,
    card: { kind: "page", hue: "10YR", taps: taps(sim.corners) },
    spots: [sim.holes[10]],
  })
  const cardWarnings = result.quality.filter((w) => w.where === "card")
  return { result, shown: shownReading(result.readings[0], result.cardCheck, cardWarnings, result.offCard, { kind: "page", hue: "10YR" }) }
}

describe("a Page's Card check", () => {
  it("is trusted when it is good, and says Chips, not patches", () => {
    const { shown: s } = shown({})
    expect(s.verdict).toBe("good")
    expect(s.why).toContain("Chip on the Page")
    expect(s.why).not.toContain("24")
  })

  it("is not trusted when two Chips of one value row were left out, and says which row", () => {
    const { result, shown: s } = shown({ smudged: { "10YR 3/3": 0.4, "10YR 3/4": 0.4 } })
    expect(result.cardCheck!.ok).toBe(false)
    expect(s.verdict).toBe("failed")
    expect(s.main).toBe(result.readings[0].raw) // never the corrected Reading
    expect(s.why).toContain("3/ row")
    expect(s.why).toContain("3/1 Chip")
  })

  it("sends the user back to the first Chip when the taps are out of order", () => {
    const { shown: s } = shown({}, ([tl, tr, br, bl]) => [bl, tl, tr, br])
    expect(s.verdict).toBe("failed")
    expect(s.why).toContain("begin at the 8/1 Chip")
  })
})
