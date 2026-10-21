// The indicators in the supplement's order, when the prevalence index is applied, and what is suggested.
import { describe, expect, test } from "vitest"
import type { PlantEntry, Vegetation } from "./entry"
import { emptyVegetation } from "./entry"
import { hydrophyticVegetation, type VegContext } from "./hydrophytic"
import type { Status } from "./status"
import type { Stratum } from "./strata"

let counter = 0
const plant = (stratum: Stratum, name: string, status: Status, cover: number, extra: Partial<PlantEntry> = {}): PlantEntry => ({
  id: `p${++counter}`,
  stratum,
  typed: name,
  name,
  status,
  listed: status,
  note: "",
  identified: "species",
  symbol: "",
  cover,
  ...extra,
})

const veg = (plants: PlantEntry[], extra: Partial<Vegetation> = {}): Vegetation => ({ ...emptyVegetation, plants, ...extra })
const NEITHER: VegContext = { hydricSoil: false, hydrology: false }
const BOTH: VegContext = { hydricSoil: true, hydrology: true }
const stateOf = (result: ReturnType<typeof hydrophyticVegetation>, id: string) => result.indicators.find((i) => i.id === id)!

/** Dominants are 2 of 5 wetland: 40 percent, so the dominance test fails. The index is 3.8. */
const failing = () => [
  plant("herb", "A", "FAC", 20),
  plant("herb", "B", "FACU", 20),
  plant("herb", "C", "UPL", 20),
  plant("herb", "D", "FACU", 20),
  plant("herb", "E", "FAC", 20),
]
/** Dominance test fails (1 of 4 dominants is wet), but the cover is mostly OBL: the prevalence index is 2.0. */
const failingButWet = () => [
  plant("tree", "T1", "UPL", 10),
  plant("tree", "T2", "FACU", 10),
  plant("tree", "T3", "FACU", 10),
  plant("herb", "H", "OBL", 70),
]

describe("the order", () => {
  test("rapid test, dominance test, prevalence index, morphological adaptations, then problematic", () => {
    const result = hydrophyticVegetation(veg(failing()), NEITHER)
    expect(result.indicators.map((i) => [i.id, i.printed])).toEqual([
      ["rapid", "1 - Rapid Test for Hydrophytic Vegetation"],
      ["dominance", "2 - Dominance Test is >50%"],
      ["prevalence", "3 - Prevalence Index is 3.0 or less"],
      ["morphological", "4 - Morphological Adaptations"],
      ["problematic", "Problematic Hydrophytic Vegetation"],
    ])
  })

  test("each carries the supplement's rule and where it is", () => {
    for (const i of hydrophyticVegetation(veg(failing()), NEITHER).indicators) {
      expect(i.rule.length).toBeGreaterThan(20)
      expect(i.citation).toContain("ERDC/EL TR-12-1")
    }
    expect(stateOf(hydrophyticVegetation(veg([]), NEITHER), "dominance").rule).toBe("More than 50 percent of the dominant plant species across all strata are rated OBL, FACW, or FAC.")
  })
})

describe("the rapid test and the dominance test", () => {
  test("all dominants OBL or FACW: the rapid test is satisfied, and so is the dominance test", () => {
    const result = hydrophyticVegetation(veg([plant("herb", "Panicum", "FACW", 50), plant("herb", "Setaria", "FAC", 10)]), NEITHER)
    expect(stateOf(result, "rapid")).toMatchObject({ state: "satisfied", reason: "All 1 dominant species is OBL or FACW." })
    expect(stateOf(result, "dominance")).toMatchObject({ state: "satisfied", reason: "1 of 1 dominant species is OBL, FACW or FAC: 100 percent. It must be more than 50." })
  })

  test("a FAC dominant fails the rapid test and not the dominance test", () => {
    const result = hydrophyticVegetation(veg([plant("herb", "Setaria", "FAC", 50), plant("herb", "Phalaris", "FACW", 40)]), NEITHER)
    expect(stateOf(result, "rapid")).toMatchObject({ state: "not met", reason: "1 of 2 dominant species is FAC, FACU or UPL." })
    expect(stateOf(result, "dominance").state).toBe("satisfied")
  })

  test("exactly half fails the dominance test", () => {
    const plants = [plant("herb", "A", "FAC", 20), plant("herb", "B", "UPL", 20), plant("herb", "C", "FAC", 20), plant("herb", "D", "UPL", 20)]
    expect(stateOf(hydrophyticVegetation(veg(plants), NEITHER), "dominance").state).toBe("not met")
  })
})

describe("the prevalence index is applied only where the supplement's order applies it", () => {
  test("not when the dominance test is satisfied: not needed, with the index for information", () => {
    const result = hydrophyticVegetation(veg([plant("herb", "A", "OBL", 50), plant("herb", "B", "FACU", 5)]), BOTH)
    expect(result.prevalenceApplied).toBe(false)
    expect(stateOf(result, "prevalence")).toMatchObject({ state: "not applied" })
    expect(stateOf(result, "prevalence").reason).toContain("Not needed: the dominance test is satisfied. The prevalence index is 1.27")
  })

  test("not when the dominance test fails and hydric soil and hydrology are not both present: it says what is missing", () => {
    const plants = failingButWet()
    for (const [context, missing] of [
      [NEITHER, "a hydric soil indicator and wetland hydrology indicators"],
      [{ hydricSoil: true, hydrology: false }, "wetland hydrology indicators"],
      [{ hydricSoil: false, hydrology: true }, "a hydric soil indicator"],
    ] as const) {
      const result = hydrophyticVegetation(veg(plants), context)
      expect(result.prevalenceApplied).toBe(false)
      expect(stateOf(result, "prevalence").state).toBe("not applied")
      expect(stateOf(result, "prevalence").reason).toContain(`Missing: ${missing}.`)
    }
  })

  test("when the dominance test fails and both are present: applied, and satisfied at 3.0 or less", () => {
    const result = hydrophyticVegetation(veg(failingButWet()), BOTH)
    expect(result.prevalenceApplied).toBe(true)
    expect(stateOf(result, "dominance").state).toBe("not met")
    expect(stateOf(result, "prevalence")).toMatchObject({ state: "satisfied" })
    expect(stateOf(result, "prevalence").reason).toBe("The prevalence index is 2.00 (200 / 100), 3.0 or less.")
  })

  test("applied and over 3.0: not met", () => {
    const result = hydrophyticVegetation(veg(failing()), BOTH)
    expect(stateOf(result, "prevalence")).toMatchObject({ state: "not met" })
    expect(stateOf(result, "prevalence").reason).toBe("The prevalence index is 3.80 (380 / 100), over 3.0.")
  })

  test("just over 3.0: not met, and written so it reads over 3.0 (751 / 250 is 3.004)", () => {
    const plants = [plant("herb", "F1", "FAC", 99), plant("herb", "F2", "FAC", 100), plant("herb", "F3", "FAC", 50), plant("herb", "U", "FACU", 1)]
    const result = hydrophyticVegetation(veg(plants, { prevalenceReason: "Check" }), NEITHER)
    expect(stateOf(result, "prevalence")).toMatchObject({ state: "not met" })
    expect(stateOf(result, "prevalence").reason).toContain("The prevalence index is 3.004 (751 / 250), over 3.0.")
  })

  test("applied by the user with a reason, though soil and hydrology are not there", () => {
    const result = hydrophyticVegetation(veg(failingButWet(), { prevalenceReason: "Hydric soil indicator not yet confirmed" }), NEITHER)
    expect(result.prevalenceApplied).toBe(true)
    expect(stateOf(result, "prevalence").state).toBe("satisfied")
    expect(stateOf(result, "prevalence").reason).toContain("Applied at your request: Hydric soil indicator not yet confirmed.")
  })

  test("a reason that is only spaces is no reason", () => {
    expect(hydrophyticVegetation(veg(failingButWet(), { prevalenceReason: "   " }), NEITHER).prevalenceApplied).toBe(false)
  })

  test("an index that is not valid, under 80 percent identified, is not satisfied and says so", () => {
    const plants = [plant("herb", "A", "OBL", 50), plant("herb", "Mystery", "UPL", 50, { identified: "none" })]
    const result = hydrophyticVegetation(veg(plants, { prevalenceReason: "Check" }), BOTH)
    expect(stateOf(result, "prevalence").state).toBe("not met")
    expect(stateOf(result, "prevalence").reason).toContain("Only 50 percent of the cover is identified and rated, and 80 percent is needed")
  })
})

describe("morphological adaptations and problematic vegetation are the user's", () => {
  test("they are listed as the user's and are not satisfied by the app", () => {
    const result = hydrophyticVegetation(veg(failing()), BOTH)
    expect(stateOf(result, "morphological").state).toBe("yours")
    expect(stateOf(result, "problematic").state).toBe("yours")
    expect(result.conclusion.suggested).toBeNull()
  })

  test("a confirmed morphological tick makes Yes the suggestion; a problematic one does not", () => {
    const withMorph = hydrophyticVegetation(veg(failing(), { indicators: { morphological: { state: "confirmed", manual: true, remark: "Adventitious roots on Cirsium" } } }), BOTH)
    expect(stateOf(withMorph, "morphological")).toMatchObject({ decision: "confirmed", remark: "Adventitious roots on Cirsium" })
    expect(withMorph.conclusion.suggested).toBe("yes")
    const withProblematic = hydrophyticVegetation(veg(failing(), { indicators: { problematic: { state: "confirmed", manual: true, remark: "Recently logged" } } }), BOTH)
    expect(withProblematic.conclusion.suggested).toBeNull()
  })

  test("without hydric soil and hydrology, a confirmed morphological tick is printed but does not make Yes the suggestion (pp. 24, 30)", () => {
    const morph = { indicators: { morphological: { state: "confirmed" as const, manual: true, remark: "Adventitious roots on Cirsium" } } }
    for (const [context, missing] of [
      [NEITHER, "a hydric soil indicator and wetland hydrology indicators"],
      [{ hydricSoil: true, hydrology: false }, "wetland hydrology indicators"],
      [{ hydricSoil: false, hydrology: true }, "a hydric soil indicator"],
    ] as const) {
      const result = hydrophyticVegetation(veg(failing(), morph), context)
      expect(stateOf(result, "morphological")).toMatchObject({ decision: "confirmed", ticked: true })
      expect(stateOf(result, "morphological").reason).toContain(`It does not count towards the suggested Yes: the supplement assumes a hydric soil indicator and wetland hydrology for it (pp. 24, 30). Missing: ${missing}.`)
      expect(result.conclusion.suggested).toBeNull()
    }
    expect(stateOf(hydrophyticVegetation(veg(failing(), morph), BOTH), "morphological").reason).not.toContain("does not count")
  })

  test("the user's reason for applying the prevalence index anyway lets a morphological tick count", () => {
    const result = hydrophyticVegetation(
      veg(failing(), { prevalenceReason: "Hydric soil on the paired point", indicators: { morphological: { state: "confirmed", manual: true, remark: "Adventitious roots" } } }),
      NEITHER,
    )
    expect(result.conclusion.suggested).toBe("yes")
  })
})

describe("Hydrophytic Vegetation Present?", () => {
  test("Yes, with the reason, when an indicator is satisfied", () => {
    const result = hydrophyticVegetation(veg([plant("herb", "Panicum", "FACW", 50)]), NEITHER)
    expect(result.conclusion).toEqual({
      suggested: "yes",
      because: "Yes: Rapid Test for Hydrophytic Vegetation and Dominance Test is >50% are satisfied. Any one is enough (supplement p. 22).",
    })
  })

  test("nothing suggested when none is satisfied, with why, and chapter 5 mentioned", () => {
    const result = hydrophyticVegetation(veg(failing()), NEITHER)
    expect(result.conclusion.suggested).toBeNull()
    expect(result.conclusion.because).toContain("No indicator is satisfied. 2 of 5 dominant species are OBL, FACW or FAC: 40 percent.")
    expect(result.conclusion.because).toContain("The prevalence index is not applied yet.")
    expect(result.conclusion.because).toContain("Chapter 5")
  })

  test("nothing suggested with no plants", () => {
    expect(hydrophyticVegetation(veg([]), BOTH).conclusion).toEqual({ suggested: null, because: "No plants are recorded yet." })
  })

  test("the user's answer is carried and is separate from the suggestion", () => {
    const result = hydrophyticVegetation(veg([plant("herb", "Panicum", "FACW", 50)], { present: "no" }), NEITHER)
    expect(result.conclusion).toMatchObject({ suggested: "yes", confirmed: "no" })
  })
})

describe("what the user decided about each", () => {
  test("a confirmed or rejected choice is carried on the indicator", () => {
    const result = hydrophyticVegetation(veg([plant("herb", "Panicum", "FACW", 50)], { indicators: { rapid: { state: "confirmed" }, dominance: { state: "rejected", remark: "Plot too small" } } }), NEITHER)
    expect(stateOf(result, "rapid").decision).toBe("confirmed")
    expect(stateOf(result, "dominance")).toMatchObject({ decision: "rejected", remark: "Plot too small" })
    expect(stateOf(result, "prevalence").decision).toBe("pending")
  })
})

describe("dominants that are not identified to species", () => {
  test("are named: a dominant must be identified to species (p. 26)", () => {
    const plants = [plant("herb", "Sonchus spp.", "FACU", 40, { identified: "genus" }), plant("herb", "Carex stricta", "OBL", 10)]
    expect(hydrophyticVegetation(veg(plants), NEITHER).notIdentified).toEqual(["Sonchus spp."])
    expect(hydrophyticVegetation(veg([plant("herb", "Carex stricta", "OBL", 10)]), NEITHER).notIdentified).toEqual([])
  })
})
