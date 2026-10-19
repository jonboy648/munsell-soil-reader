// The arithmetic of the dominance test and the prevalence index. The reference is the regional
// supplement's own worked example (NCNE Table 3, p. 27, and Table 4, p. 29): 5 dominant species, 80 percent
// of them OBL, FACW or FAC, A = 164, B = 451, prevalence index 2.75.
import { describe, expect, test } from "vitest"
import type { PlantEntry } from "./entry"
import { dominanceTest, prevalenceIndex } from "./dominance"
import type { Status } from "./status"
import type { Stratum } from "./strata"

let counter = 0
const plant = (stratum: Stratum, name: string, status: Status | null, cover: number, extra: Partial<PlantEntry> = {}): PlantEntry => ({
  id: `p${++counter}`,
  stratum,
  typed: name,
  name,
  status,
  listed: status ?? "NI",
  note: "",
  identified: "species",
  symbol: "",
  cover,
  ...extra,
})

/** Table 3. */
const table3 = (): PlantEntry[] => [
  plant("herb", "Impatiens capensis", "FACW", 15),
  plant("herb", "Geranium carolinianum", "UPL", 7),
  plant("herb", "Toxicodendron radicans", "FAC", 5),
  plant("herb", "Lonicera tatarica", "FACU", 2),
  plant("herb", "Glyceria striata", "OBL", 2),
  plant("herb", "Parthenocissus quinquefolia", "FACU", 1),
  plant("herb", "Arisaema triphyllum", "FACW", 0.5),
  plant("herb", "Carex laxiflora", "FACU", 0.5),
  plant("saplingShrub", "Carpinus caroliniana", "FAC", 35),
  plant("saplingShrub", "Carya ovata", "FACU", 10),
  plant("saplingShrub", "Acer saccharum", "FACU", 5),
  plant("saplingShrub", "Quercus rubra", "FACU", 5),
  plant("tree", "Quercus bicolor", "FACW", 40),
  plant("tree", "Fraxinus pennsylvanica", "FACW", 17),
  plant("tree", "Ulmus americana", "FACW", 10),
  plant("tree", "Carya ovata", "FACU", 8),
  plant("woodyVine", "Toxicodendron radicans", "FAC", 1),
]

const namesOf = (plants: PlantEntry[], result: ReturnType<typeof dominanceTest>, stratum: Stratum) =>
  result.strata.find((s) => s.stratum === stratum)!.dominants.map((id) => plants.find((p) => p.id === id)!.name)

describe("the supplement's worked example (Tables 3 and 4)", () => {
  const plants = table3()
  const test3 = dominanceTest(plants)

  test("the thresholds of each stratum", () => {
    expect(test3.strata.map((s) => [s.stratum, s.total, s.half, s.fifth])).toEqual([
      ["tree", 75, 37.5, 15],
      ["saplingShrub", 55, 27.5, 11],
      ["herb", 33, 16.5, 6.6],
      ["woodyVine", 1, 0.5, 0.2],
    ])
  })

  test("the dominant species of each stratum", () => {
    expect(namesOf(plants, test3, "tree")).toEqual(["Quercus bicolor", "Fraxinus pennsylvanica"])
    expect(namesOf(plants, test3, "saplingShrub")).toEqual(["Carpinus caroliniana"])
    expect(namesOf(plants, test3, "herb")).toEqual(["Impatiens capensis", "Geranium carolinianum"])
  })

  test("the woody vine stratum, under 5 percent, is recorded but not used", () => {
    const vine = test3.strata.find((s) => s.stratum === "woodyVine")!
    expect(vine).toMatchObject({ used: false, dominants: [] })
    expect(vine.note).toContain("Under 5 percent")
  })

  test("5 dominant species, 80 percent of them OBL, FACW or FAC", () => {
    expect(test3).toMatchObject({ a: 4, b: 5, percent: 80, passes: true })
  })

  test("the prevalence index: A = 164, B = 451, 2.75", () => {
    const pi = prevalenceIndex(plants)
    expect(pi.rows.map((r) => [r.status, r.cover, r.weight, r.product])).toEqual([
      ["OBL", 2, 1, 2],
      ["FACW", 82.5, 2, 165],
      ["FAC", 41, 3, 123],
      ["FACU", 31.5, 4, 126],
      ["UPL", 7, 5, 35],
    ])
    expect(pi).toMatchObject({ a: 164, b: 451, valid: true, passes: true })
    expect(pi.index!.toFixed(2)).toBe("2.75")
  })

  test("the prevalence index includes the stratum the dominance test leaves out (Table 4, footnote 2)", () => {
    const without = prevalenceIndex(plants.filter((p) => p.stratum !== "woodyVine"))
    expect(without.a).toBe(163)
  })
})

describe("the 50/20 rule", () => {
  const dominant = (covers: number[], stratum: Stratum = "herb") => {
    const plants = covers.map((c, i) => plant(stratum, `Plant ${i}`, "FAC", c))
    return namesOf(plants, dominanceTest(plants), stratum)
  }

  test("plants are taken until the running total is MORE than half: exactly half is not enough", () => {
    // Total 100: the first plant is exactly half, so the second is taken as well, though it is under 20 percent.
    expect(dominant([50, 16, 14, 10, 10])).toEqual(["Plant 0", "Plant 1"])
    // 51 is more than half by itself.
    expect(dominant([51, 16, 14, 10, 9])).toEqual(["Plant 0"])
  })

  test("a plant that is 20 percent of the total by itself is dominant, 19.9 is not", () => {
    // The first plant is over half, so the others come in only by the 20 percent rule.
    expect(dominant([55, 20, 15, 10])).toEqual(["Plant 0", "Plant 1"])
    expect(dominant([55, 19.9, 15.1, 10])).toEqual(["Plant 0"])
  })

  test("a plant tied with the one that crosses the line is taken too", () => {
    // Total 100. 30 + 20 = 50 is not more than half, then three plants tie at 15: all three are taken.
    expect(dominant([30, 20, 15, 15, 15, 5])).toEqual(["Plant 0", "Plant 1", "Plant 2", "Plant 3", "Plant 4"])
  })

  test("equal covers all dominant", () => {
    expect(dominant([20, 20, 20, 20, 20])).toHaveLength(5)
  })

  test("a one-plant stratum has that plant as its dominant", () => {
    expect(dominant([3])).toEqual(["Plant 0"])
  })

  test("covers that do not add up in floating point still compare exactly", () => {
    // 0.1 + 0.2 + 0.3 + ... : the total is 1.5 in whole thousandths, and a plant of 0.3 is exactly 20 percent of it.
    expect(dominant([0.3, 0.3, 0.3, 0.3, 0.3])).toHaveLength(5)
    expect(dominant([0.7, 0.3, 0.2, 0.1, 0.2])).toEqual(["Plant 0", "Plant 1"])
  })

  test("a species dominant in two strata is counted in each (p. 25)", () => {
    const plants = [plant("tree", "Acer rubrum", "FAC", 40), plant("saplingShrub", "Acer rubrum", "FAC", 30)]
    expect(dominanceTest(plants)).toMatchObject({ a: 2, b: 2, percent: 100 })
  })
})

describe("strata under 5 percent", () => {
  test("a stratum under 5 percent is left out of the dominance test but its plants are recorded", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 60), plant("tree", "Ulmus americana", "FACU", 4)]
    const result = dominanceTest(plants)
    expect(result.strata.map((s) => [s.stratum, s.used])).toEqual([["tree", false], ["herb", true]])
    expect(result).toMatchObject({ a: 1, b: 1, passes: true })
  })

  test("exactly 5 percent is a stratum", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 60), plant("tree", "Ulmus americana", "FACU", 5)]
    expect(dominanceTest(plants).strata.find((s) => s.stratum === "tree")!.used).toBe(true)
  })

  test("the only stratum present is used however little cover it has", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 3), plant("herb", "Poa pratensis", "FACU", 1)]
    const result = dominanceTest(plants)
    expect(result.strata[0]).toMatchObject({ used: true, total: 4 })
    // Carex is over half by itself, and Poa at 1 of 4 is over 20 percent, so both are dominant: 1 of 2 is not more than half.
    expect(result).toMatchObject({ a: 1, b: 2, percent: 50, passes: false })
  })

  test("when every stratum is under 5 percent and there are several, none is used and the test cannot be told", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 3), plant("tree", "Ulmus americana", "FACW", 2)]
    expect(dominanceTest(plants)).toMatchObject({ b: 0, percent: null, passes: null })
  })

  test("the prevalence index uses a stratum under 5 percent", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 60), plant("tree", "Ulmus americana", "FACU", 4)]
    expect(prevalenceIndex(plants)).toMatchObject({ a: 64, b: 60 + 16 })
  })
})

describe("the test itself", () => {
  test("more than half: exactly half fails", () => {
    const plants = [plant("herb", "A", "FAC", 20), plant("herb", "B", "UPL", 20), plant("herb", "C", "FAC", 20), plant("herb", "D", "UPL", 20), plant("herb", "E", "OBL", 20)]
    expect(dominanceTest(plants)).toMatchObject({ a: 3, b: 5, passes: true })
    expect(dominanceTest(plants.slice(0, 4))).toMatchObject({ a: 2, b: 4, percent: 50, passes: false })
  })

  test("an unidentified dominant counts as UPL, as recorded", () => {
    const plants = [plant("herb", "Mystery", "UPL", 60, { identified: "none" }), plant("herb", "Carex stricta", "OBL", 10)]
    expect(dominanceTest(plants)).toMatchObject({ a: 0, b: 1, passes: false })
  })

  test("a plant with no status to use is left out of the stratum's total and ranking", () => {
    const plants = [plant("herb", "Unrated", null, 80), plant("herb", "Carex stricta", "OBL", 10), plant("herb", "Poa pratensis", "FACU", 10)]
    const result = dominanceTest(plants)
    expect(result.strata[0].total).toBe(20)
    expect(result.dominants).toHaveLength(2)
  })

  test("no plants, no result", () => {
    expect(dominanceTest([])).toMatchObject({ strata: [], b: 0, percent: null, passes: null })
  })
})

describe("the prevalence index", () => {
  test("the limit is 3.0 or less: exactly 3.0 passes, a little over does not", () => {
    const at = prevalenceIndex([plant("herb", "A", "FAC", 10)])
    expect(at.index).toBe(3)
    expect(at.passes).toBe(true)
    const over = prevalenceIndex([plant("herb", "A", "FAC", 10), plant("herb", "B", "FACU", 0.5)])
    expect(over.index! > 3).toBe(true)
    expect(over.passes).toBe(false)
  })

  test("a plant that is not identified is left out of the sums and counts against the 80 percent", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 80), plant("herb", "Mystery", "UPL", 20, { identified: "none" })]
    const pi = prevalenceIndex(plants)
    expect(pi).toMatchObject({ a: 80, b: 80, identified: 80, valid: true, passes: true })
    expect(pi.index).toBe(1)
  })

  test("under 80 percent of the cover identified, the index is not valid and is not told", () => {
    const plants = [plant("herb", "Carex stricta", "OBL", 79), plant("herb", "Mystery", "UPL", 21, { identified: "none" })]
    const pi = prevalenceIndex(plants)
    expect(pi).toMatchObject({ valid: false, index: null, passes: null })
    expect(pi.identified).toBe(79)
    // The sums are still there to print.
    expect(pi.a).toBe(79)
  })

  test("a plant identified to its genus only counts, and one with no status does not", () => {
    const plants = [plant("herb", "Sonchus spp.", "FACU", 30, { identified: "genus" }), plant("herb", "Unrated", null, 10), plant("herb", "Carex stricta", "OBL", 60)]
    const pi = prevalenceIndex(plants)
    expect(pi).toMatchObject({ a: 90, b: 60 + 120, valid: true })
  })

  test("no plants, no index", () => {
    expect(prevalenceIndex([])).toMatchObject({ a: 0, b: 0, index: null, valid: false, passes: null })
  })
})

describe("JF-1's herb stratum", () => {
  // The Vegetation entry's resolution of Jon's plants: see fixtures/jf1.ts.
  const jf1 = [
    plant("herb", "Panicum dichotomiflorum", "FACW", 50),
    plant("herb", "Setaria pumila", "FAC", 10),
    plant("herb", "Phalaris arundinacea", "FACW", 3),
    plant("herb", "Cirsium arvense", "FACU", 10),
    plant("herb", "Abutilon theophrasti", "FACU", 1),
    plant("herb", "Echinochloa crus-galli", "FAC", 5),
    plant("herb", "Sonchus spp.", "FACU", 2, { identified: "genus" }),
    plant("herb", "Persicaria maculosa", "FAC", 3),
    plant("herb", "Stiff greenthread", "UPL", 1, { unlisted: true }),
  ]

  test("fall panicgrass is the only dominant: 50 of 85, over the 42.5 line, and nothing else reaches 17", () => {
    const result = dominanceTest(jf1)
    expect(result.strata).toHaveLength(1)
    expect(result.strata[0]).toMatchObject({ total: 85, half: 42.5, fifth: 17, used: true })
    expect(namesOf(jf1, result, "herb")).toEqual(["Panicum dichotomiflorum"])
    expect(result).toMatchObject({ a: 1, b: 1, percent: 100, passes: true })
  })

  test("the prevalence index, with the FACW total 53", () => {
    const pi = prevalenceIndex(jf1)
    expect(pi.rows.map((r) => [r.status, r.cover, r.product])).toEqual([
      ["OBL", 0, 0],
      ["FACW", 53, 106],
      ["FAC", 18, 54],
      ["FACU", 13, 52],
      ["UPL", 1, 5],
    ])
    // Stiff greenthread is not on the plant list, so it counts as UPL (pp. 22-23): all 85 is counted.
    expect(pi).toMatchObject({ a: 85, b: 217, valid: true, passes: true, identified: 100 })
    expect(pi.index!.toFixed(2)).toBe("2.55")
  })

  test("marked not identified, stiff greenthread is left out: 84 of 85 is identified", () => {
    const marked = jf1.map((p) => (p.name === "Stiff greenthread" ? { ...p, identified: "none" as const } : p))
    const pi = prevalenceIndex(marked)
    expect(pi).toMatchObject({ a: 84, b: 212, valid: true, passes: true })
    expect(pi.index!.toFixed(2)).toBe("2.52")
    expect(pi.identified).toBeCloseTo(98.82, 2)
  })
})

test("a named plant that is not on the list counts as UPL: Setaria pumila 90 and Thelesperma filifolium 10 is 3.20, over 3.0", () => {
  const plants = [plant("herb", "Setaria pumila", "FAC", 90), plant("herb", "Thelesperma filifolium", "UPL", 10, { unlisted: true })]
  const pi = prevalenceIndex(plants)
  expect(pi).toMatchObject({ a: 100, b: 320, identified: 100, passes: false })
  expect(pi.index).toBeCloseTo(3.2, 10)
})

test("the weights are the supplement's: OBL 1 to UPL 5", () => {
  const all = (["OBL", "FACW", "FAC", "FACU", "UPL"] as const).map((s) => plant("herb", s, s, 1))
  expect(prevalenceIndex(all).rows.map((r) => r.weight)).toEqual([1, 2, 3, 4, 5])
})
