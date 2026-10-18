// The words that say why a Reading is or is not trusted, driven by what readPhoto returns for
// a simulated Photo. The glare example is the case that matters: its Card check fails because
// of the glare, unless the corners are also in the wrong order.
import { describe, expect, it } from "vitest"
import { readPhoto, type Corners } from "@/engine"
import { EXAMPLES, SIM_SPOT, simulatePhoto } from "@/engine/simulate"
import { shownReading } from "./verdict"

function shown(corners: (sim: Corners) => Corners = (c) => c) {
  const example = EXAMPLES.find((e) => e.id === "glare")!
  const sim = simulatePhoto(example.scene)
  const result = readPhoto({
    pixels: sim.pixels,
    card: { kind: "colorchecker", corners: corners(sim.corners) },
    spots: [SIM_SPOT],
  })
  const cardWarnings = result.quality.filter((w) => w.where === "card")
  return { result, shown: shownReading(result.readings[0], result.cardCheck, cardWarnings, result.offCard) }
}

describe("a failed Card check", () => {
  it("blames the glare flagged on the Card, and does not send the user back to the corners", () => {
    const { result, shown: s } = shown()
    expect(result.quality.some((w) => w.where === "card" && w.kind === "glare")).toBe(true)
    expect(s.verdict).toBe("failed")
    expect(s.why).toContain("problem flagged below")
    expect(s.why).not.toContain("Start over")
  })

  it.each([
    ["flipped", ([tl, tr, br, bl]: Corners): Corners => [tr, tl, bl, br]], // order 1032
    ["turned a half", ([tl, tr, br, bl]: Corners): Corners => [br, bl, tl, tr]], // order 2301
    ["started on the white patch", ([tl, tr, br, bl]: Corners): Corners => [bl, br, tr, tl]], // order 3210
  ])("blames the corner order, not the Card's problems, when the corners are %s", (_name, order) => {
    const { result, shown: s } = shown(order)
    expect(result.offCard).toBe(true)
    expect(result.quality.length).toBeGreaterThan(0) // the glare and a clipped white are still reported
    expect(s.verdict).toBe("failed")
    expect(s.why).toContain("tapped out of order")
    expect(s.why).toContain("Start over")
  })
})
