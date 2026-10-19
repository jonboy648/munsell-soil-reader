// The plant list: typing a name resolves it to a plant and its status, or shows candidates, or records the
// plant as UPL with a note. The real 2022 NWPL for NCNE (with the USDA PLANTS names) is the data; the NI and NO
// rules, which the 2022 list no longer contains, are run on a small list of made-up plants.
import { beforeAll, describe, expect, test } from "vitest"
import { JF1_PLANTS_EXPECTED, JF1_PLANTS_TYPED } from "../fixtures/jf1"
import { plantEntryOf, plantNote } from "./entry"
import { loadPlantList } from "./loadPlantList"
import { buildPlantList, pickPlant, resolvePlant, statusFor, type PlantList, type RawPlantList, type Resolution } from "./plantList"

let list: PlantList
beforeAll(async () => {
  list = await loadPlantList("NCNE")
})

/** One line saying what a resolution came to, for comparing. */
function said(r: Resolution): string {
  switch (r.kind) {
    case "resolved": return `${r.plant.name} ${r.status.status}`
    case "genus": return `${r.genus} spp. ${r.status.status}`
    case "candidates": return `candidates ${r.candidates.map((p) => p.name).join(", ")}`
    default: return r.kind
  }
}

describe("resolving what is typed", () => {
  test.each([
    ["fall panicgrass", "Panicum dichotomiflorum FACW"],
    ["Fall Panic Grass", "Panicum dichotomiflorum FACW"],
    ["FALL PANICGRASS", "Panicum dichotomiflorum FACW"],
    ["Panicum dichotomiflorum", "Panicum dichotomiflorum FACW"],
    ["panicum dichotomiflorum Michx.", "Panicum dichotomiflorum FACW"],
    ["RCG", "Phalaris arundinacea FACW"],
    ["rcg", "Phalaris arundinacea FACW"],
    ["PHAR3", "Phalaris arundinacea FACW"],
    ["reed canary grass", "Phalaris arundinacea FACW"],
    ["Reed canarygrass", "Phalaris arundinacea FACW"],
    ["Canada thistle", "Cirsium arvense FACU"],
    ["Polygonum persicaria", "Persicaria maculosa FAC"], // PLANTS' name for lady's thumb; the NWPL rates it as Persicaria maculosa
    ["Echinochloa crus-galli", "Echinochloa crus-galli FAC"], // not Echinochloa frumentacea, which PLANTS lists it under
  ])("%s is %s", (typed, expected) => {
    expect(said(resolvePlant(list, typed))).toBe(expected)
  })

  test("how a name was matched is said", () => {
    const matched = (typed: string) => {
      const r = resolvePlant(list, typed)
      return r.kind === "resolved" ? r.matched : r.kind
    }
    expect([matched("RCG"), matched("PHAR3"), matched("Phalaris arundinacea"), matched("Polygonum persicaria"), matched("fall panicgrass"), matched("Creeping thistle")]).toEqual([
      "abbreviation", "symbol", "scientific name", "synonym", "common name", "alias",
    ])
  })

  test("part of a name finds the one plant that has those words, and a typo is offered as a candidate, not guessed", () => {
    expect(said(resolvePlant(list, "dichotomiflorum"))).toBe("Panicum dichotomiflorum FACW")
    expect(said(resolvePlant(list, "fall panic gra"))).toBe("Panicum dichotomiflorum FACW")
    expect(said(resolvePlant(list, "fal panicgrass"))).toBe("candidates Panicum dichotomiflorum")
  })

  test("a genus whose plants all have one status is recorded as the genus; if they differ, the user picks", () => {
    expect(said(resolvePlant(list, "sow thistle"))).toBe("Sonchus spp. FACU")
    const r = resolvePlant(list, "phalaris")
    expect(r.kind).toBe("candidates")
    if (r.kind === "candidates") expect(r.candidates.map((p) => p.name)).toContain("Phalaris arundinacea")
  })

  test("an ambiguous common name shows candidates, and picking one resolves it", () => {
    const r = resolvePlant(list, "barnyard")
    expect(r.kind).toBe("candidates")
    if (r.kind !== "candidates") return
    // "Barnyard grass" alone is the PLANTS name of one species; "barnyard" is in two: a large and a rough one.
    expect(r.candidates.map((p) => p.name).sort()).toEqual(["Echinochloa crus-galli", "Echinochloa muricata"])
    const rough = r.candidates.find((p) => p.name === "Echinochloa muricata")!
    expect(said(pickPlant(list, rough))).toBe("Echinochloa muricata OBL")
    const maple = resolvePlant(list, "maple")
    expect(maple.kind).toBe("candidates")
    if (maple.kind === "candidates") expect(maple.candidates.length).toBeGreaterThan(1)
  })

  test("nothing typed resolves to nothing", () => {
    expect(resolvePlant(list, "   ").kind).toBe("empty")
  })
})

describe("a plant that is not on the list is UPL, with a note", () => {
  test("a name the user gave that is found nowhere is UPL, identified, and not on the list", () => {
    const r = resolvePlant(list, "Stiff greenthread")
    expect(r.kind).toBe("unknown")
    const entry = plantEntryOf(r, "p1", "herb", "Stiff greenthread", 1)!
    expect(entry).toMatchObject({ name: "Stiff greenthread", status: "UPL", identified: "species", unlisted: true, cover: 1 })
    expect(entry.note).toContain("Not found on the plant list")
    expect(entry.note).toContain("pp. 22-23")
    expect(plantNote(entry)).toBe("Not on the plant list: counted as UPL (supplement pp. 22-23).")
  })

  test.each(["Zea mays", "Glycine max", "Triticum aestivum", "Beta vulgaris", "Thelesperma filifolium"])("%s, a crop or plant not on the list, counts as identified UPL", (name) => {
    expect(plantEntryOf(resolvePlant(list, name), "p1", "herb", name, 10)).toMatchObject({ status: "UPL", identified: "species", unlisted: true })
  })

  test.each(["Unknown forb", "unidentified grass", "Unid. sedge", "Unk shrub", "Mystery seedling?"])("%s defaults to not identified", (name) => {
    const r = resolvePlant(list, name)
    if (r.kind !== "unknown" && r.kind !== "unlisted") return expect.fail(`${name} resolved as ${r.kind}`)
    const entry = plantEntryOf(r, "p1", "herb", name, 10)!
    expect(entry).toMatchObject({ identified: "none", unlisted: true })
    expect(plantNote(entry)).toContain("Not identified: left out of the prevalence index")
  })

  test("a scientific name of a genus the list knows, for a species it does not list, is UPL and identified", () => {
    const r = resolvePlant(list, "Carex nonexistentus")
    expect(r.kind).toBe("unlisted")
    expect(plantEntryOf(r, "p1", "herb", "Carex nonexistentus", 2)).toMatchObject({ name: "Carex nonexistentus", status: "UPL", identified: "species" })
  })

  test("candidates are not a plant until one is picked", () => {
    expect(plantEntryOf(resolvePlant(list, "phalaris"), "p1", "herb", "phalaris", 5)).toBeNull()
  })
})

describe("NI, NO and plants the region does not rate (supplement pp. 22-23)", () => {
  // Regions: NCNE, then MW and EMP, nearest first. Ratings: a digit is OBL to UPL, i is NI, o is NO, - is not rated.
  const raw: RawPlantList = {
    list: "made up",
    names: "made up",
    regions: ["NCNE", "MW", "EMP"],
    abbreviations: {},
    aliases: {},
    plants: [
      ["Testus rated", "32-"], //            FAC in NCNE, FACW in MW: the region's own rating wins
      ["Testus noinfo", "i32"], //           NI in NCNE: the nearest adjacent region, MW, gives FAC (EMP's FACW is not used)
      ["Testus nooccur", "o-4"], //          NO in NCNE, none in MW: EMP gives FACU
      ["Testus nowhere", "i--"], //          NI in NCNE and no adjacent rating: left out of the calculations
      ["Testus nonocur", "o--"], //          NO in NCNE and no adjacent rating: left out
      ["Testus unrated", "-2-"], //          not rated in NCNE (as the 2022 list has it), FACW in MW
    ],
  }
  const made = buildPlantList(raw)
  const status = (name: string) => statusFor(made, made.plants.find((p) => p.name === name)!)

  test("a plant the region rates uses the region's rating", () => {
    expect(status("Testus rated")).toEqual({ status: "FAC", listed: "FAC", note: "" })
  })

  test("NI takes the status of the nearest adjacent region that rates the plant", () => {
    const s = status("Testus noinfo")
    expect(s.status).toBe("FAC") // MW, the nearest, not EMP's FACW
    expect(s.listed).toBe("NI")
    expect(s.note).toContain("NI (no status given)")
    expect(s.note).toContain("MW, gives FAC ")
  })

  test("NO takes the status of the nearest adjacent region that rates it, skipping one that does not", () => {
    const s = status("Testus nooccur")
    expect(s.status).toBe("FACU")
    expect(s.listed).toBe("NO")
    expect(s.note).toContain("NO (not known to occur)")
    expect(s.note).toContain("EMP, gives FACU")
  })

  test("NI or NO with no adjacent rating leaves the plant out of the calculations", () => {
    for (const name of ["Testus nowhere", "Testus nonocur"]) {
      const s = status(name)
      expect(s.status, name).toBeNull()
      expect(s.note, name).toContain("left out of the calculations")
    }
    const entry = plantEntryOf(resolvePlant(made, "Testus nowhere"), "p1", "herb", "Testus nowhere", 4)!
    expect(entry).toMatchObject({ name: "Testus nowhere", status: null, listed: "NI", identified: "species" })
  })

  test("a plant the region does not rate, that an adjacent region does, uses that region's status, as the 2022 NWPL's user note says", () => {
    const s = status("Testus unrated")
    expect(s.status).toBe("FACW")
    expect(s.note).toContain("not rated")
    expect(s.note).toContain("MW, gives FACW")
  })

  test("on the real list: a plant NCNE does not rate takes its neighbour's status", () => {
    const r = resolvePlant(list, "Gulf cock's-spur grass")
    expect(r.kind).toBe("resolved")
    if (r.kind !== "resolved") return
    expect(r.plant.name).toBe("Echinochloa crus-pavonis")
    expect(r.status.status).toBe("FACW") // Midwest, the nearest neighbour that rates it
    expect(r.status.note).toContain("MW")
  })
})

describe("JF-1's herb plants, as Jon wrote them on the paper form", () => {
  test.each(JF1_PLANTS_TYPED.map((typed, i) => [typed[0], typed[1], JF1_PLANTS_EXPECTED[i]] as const))(
    "%s (%s percent) is %j",
    (typed, cover, [name, status, identified]) => {
      const entry = plantEntryOf(resolvePlant(list, typed), `jf1-${typed}`, "herb", typed, cover)!
      expect(entry).toMatchObject({ name, status, identified, stratum: "herb", cover })
    },
  )

  test("stiff greenthread is recorded as UPL with the supplement's rule in the note", () => {
    const entry = plantEntryOf(resolvePlant(list, "Stiff greenthread"), "p1", "herb", "Stiff greenthread", 1)!
    expect(entry.status).toBe("UPL")
    expect(entry.note).toMatch(/not listed.*pp\. 22-23/)
  })
})
