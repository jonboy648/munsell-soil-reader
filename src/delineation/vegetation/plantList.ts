// The plant list: the 2022 National Wetland Plant List with USDA PLANTS names, built into a
// searchable index, and what typing a plant's name does to it. Pure: no UI, no files. The list is
// data (src/delineation/regions/<region>/plants.json, made by scripts/make_plant_list.py), loaded
// when the Vegetation entry is opened, and bundled so it works offline.
//
// A name typed by the delineator is resolved, in this order, and only an exact, single match
// resolves by itself; anything less is shown as candidates for the user to pick, so a wrong plant
// never lands on the form silently:
//   1. a field abbreviation (RCG) or a USDA symbol (PHAR3)
//   2. a scientific name, or a synonym of one
//   3. a common name, as the NWPL, PLANTS or an alias spells it ("fall panicgrass", "Fall Panic Grass")
//   4. words of a name ("lady's thumb"): one plant resolves, a genus whose plants agree on a status
//      resolves to the genus, anything else is candidates
//   5. a near miss (a typo): candidates
// A name that finds nothing is not on the list: UPL, with a note, as the supplement directs.
import type { Status } from "./status"

/** What a list says of a plant in one region: a status, or that the list gave none (NI) or knows of none (NO). */
export type ListStatus = Status | "NI" | "NO"

export interface Plant {
  /** The scientific name as the NWPL writes it. */
  name: string
  /** The NWPL's common name, which may be empty. */
  common: string
  /** The USDA PLANTS symbol, when the plant has one. */
  symbol: string
  /** The USDA PLANTS common name, when it differs from the NWPL's. */
  plantsCommon: string
  /** Other scientific names for the plant (PLANTS synonyms the NWPL does not rate itself). */
  synonyms: readonly string[]
  /** Its status in each region of the list. A region the list does not rate it in is absent. */
  ratings: Readonly<Record<string, ListStatus>>
}

/** The file `scripts/make_plant_list.py` writes. */
export interface RawPlantList {
  list: string
  names: string
  /** The list's own region first, then the regions next to it, nearest first. */
  regions: string[]
  abbreviations: Record<string, string>
  aliases: Record<string, string>
  /** [name, ratings, common, symbol, plantsCommon, synonyms]: ratings is a character per region, 1 to 5 for OBL to UPL, i NI, o NO, - none. */
  plants: [string, string, string?, string?, string?, string[]?][]
}

export interface PlantList {
  list: string
  /** The list's own region, then its neighbours, nearest first. */
  regions: readonly string[]
  plants: readonly Plant[]
  /** The plant a field abbreviation or an alias means, by what is typed, in capitals. */
  abbreviations: ReadonlyMap<string, Plant>
  aliases: ReadonlyMap<string, Plant>
  bySymbol: ReadonlyMap<string, Plant[]>
  /** Plants by scientific name: `genus species`, lower case, a hybrid's X left out. */
  bySci: ReadonlyMap<string, Plant[]>
  bySynonym: ReadonlyMap<string, Plant[]>
  /** Plants by common name with everything but letters and digits left out. */
  byCommon: ReadonlyMap<string, Plant[]>
  genera: ReadonlySet<string>
  /** Each plant's words, for matching part of a name. */
  words: ReadonlyMap<Plant, readonly string[]>
}

const RATING: Record<string, ListStatus | undefined> = { "1": "OBL", "2": "FACW", "3": "FAC", "4": "FACU", "5": "UPL", i: "NI", o: "NO" }

/** Lower-case letters and digits only: what two spellings of a name share ("Fall Panic Grass", "fall panicgrass"). */
export const compact = (text: string): string => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "")

/** The words of a name, lower case, apostrophes dropped: "Spotted Lady's-Thumb" is spotted, ladys, thumb. */
const wordsOf = (text: string): string[] =>
  text.toLowerCase().normalize("NFKD").replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean)

/** `genus species` of a scientific name, lower case, without author, hybrid sign or variety; null when it has no two words. */
export function binomialOf(text: string): string | null {
  const w = text.toLowerCase().replace(/×/g, " ").split(/\s+/).filter((word) => word !== "" && word !== "x")
  return w.length >= 2 && /^[a-z-]+$/.test(w[0]) && /^[a-z-]+$/.test(w[1]) ? `${w[0]} ${w[1]}` : null
}

const add = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key)
  if (list) {
    if (!list.includes(value)) list.push(value)
  } else map.set(key, [value])
}

export function buildPlantList(raw: RawPlantList): PlantList {
  const plants: Plant[] = raw.plants.map(([name, ratings, common = "", symbol = "", plantsCommon = "", synonyms = []]) => ({
    name,
    common,
    symbol,
    plantsCommon,
    synonyms,
    ratings: Object.fromEntries(
      [...ratings].flatMap((c, i) => {
        const status = RATING[c]
        return status ? [[raw.regions[i], status]] : []
      }),
    ),
  }))
  const bySymbol = new Map<string, Plant[]>()
  const bySci = new Map<string, Plant[]>()
  const bySynonym = new Map<string, Plant[]>()
  const byCommon = new Map<string, Plant[]>()
  const genera = new Set<string>()
  const words = new Map<Plant, string[]>()
  for (const plant of plants) {
    if (plant.symbol) add(bySymbol, plant.symbol.toUpperCase(), plant)
    const own = binomialOf(plant.name)
    if (own) {
      add(bySci, own, plant)
      genera.add(own.split(" ")[0])
    }
    for (const synonym of plant.synonyms) {
      const key = binomialOf(synonym)
      if (key) add(bySynonym, key, plant)
    }
    for (const common of [plant.common, plant.plantsCommon]) if (common) add(byCommon, compact(common), plant)
    words.set(plant, [...wordsOf(plant.name), ...wordsOf(plant.common), ...wordsOf(plant.plantsCommon)])
  }
  const named = (name: string): Plant => {
    const found = bySci.get(binomialOf(name) ?? "")?.[0]
    if (!found) throw new Error(`The plant list names ${name} in its abbreviations or aliases but does not list it.`)
    return found
  }
  return {
    list: raw.list,
    regions: raw.regions,
    plants,
    abbreviations: new Map(Object.entries(raw.abbreviations).map(([abbreviation, name]) => [abbreviation.toUpperCase(), named(name)])),
    aliases: new Map(Object.entries(raw.aliases).map(([alias, name]) => [compact(alias), named(name)])),
    bySymbol,
    bySci,
    bySynonym,
    byCommon,
    genera,
    words,
  }
}

// ---- status ----
export interface StatusResult {
  /** The status the vegetation arithmetic uses; null when the plant is not to be used in it. */
  status: Status | null
  /** What the list says in the list's own region: a status, NI, NO, or empty when it does not rate the plant there. */
  listed: string
  /** What was done, in words, when it was not simply the list's own status. Empty otherwise. */
  note: string
}

/**
 * The status to use for a plant (supplement, pp. 22-23): its own region's, with the plus and minus
 * modifiers already gone. If the region lists it as NI (reviewed, no status) or NO (not known to
 * occur there), or does not rate it, the status of the nearest adjacent region that rates it. A plant
 * the region marks NI or NO that no adjacent region rates is not used in the calculations (status null).
 * A plant that is not rated at all is not in the list, and is UPL (see `resolvePlant`).
 */
export function statusFor(list: PlantList, plant: Plant): StatusResult {
  const [home, ...adjacent] = list.regions
  const own = plant.ratings[home]
  if (own && own !== "NI" && own !== "NO") return { status: own, listed: own, note: "" }
  const said = own === "NI" ? "NI (no status given)" : own === "NO" ? "NO (not known to occur)" : "not rated"
  for (const region of adjacent) {
    const rating = plant.ratings[region]
    if (rating && rating !== "NI" && rating !== "NO") {
      return { status: rating, listed: own ?? "", note: `${home} has it as ${said}, so the nearest adjacent region that rates it, ${region}, gives ${rating} (supplement pp. 22-23).` }
    }
  }
  if (own) {
    return { status: null, listed: own, note: `${home} has it as ${said} and no adjacent region rates it, so it is left out of the calculations (supplement pp. 22-23).` }
  }
  return { status: "UPL", listed: "", note: `Not rated in ${home} or next to it: recorded as UPL (supplement pp. 22-23).` }
}

// ---- resolving a typed name ----
export type Matched = "abbreviation" | "symbol" | "scientific name" | "synonym" | "common name" | "alias" | "part of a name" | "picked"

export type Resolution =
  | { kind: "empty" }
  /** One plant, found by an exact name or the only plant whose name has these words. */
  | { kind: "resolved"; plant: Plant; matched: Matched; status: StatusResult }
  /** Several plants of one genus that all have the same status: recorded as the genus. */
  | { kind: "genus"; genus: string; plants: Plant[]; status: StatusResult }
  /** Not one plant: the user picks. */
  | { kind: "candidates"; candidates: Plant[] }
  /** Not on the list, but it reads as a scientific name of a genus the list knows: UPL, identified. */
  | { kind: "unlisted"; name: string; note: string }
  /** Not found at all: UPL, and identified, as a plant the user named; one entered as unknown ("Unknown forb") is not identified (entry.ts). */
  | { kind: "unknown"; name: string; note: string }

const MAX_CANDIDATES = 8

const resolved = (list: PlantList, plant: Plant, matched: Matched): Resolution => ({ kind: "resolved", plant, matched, status: statusFor(list, plant) })

/** The plant the user picked from candidates, as a resolution. */
export const pickPlant = (list: PlantList, plant: Plant): Resolution => resolved(list, plant, "picked")

/** Edit distance, stopping early once it is over `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    if (Math.min(...row) > limit) return limit + 1
    previous = row
  }
  return previous[b.length]
}

/**
 * Plants whose words include each of the typed words, the last one possibly begun and not finished (so
 * "fall panic gra" finds "Fall Panic Grass"), most specific first.
 */
function byWords(list: PlantList, typed: string[]): Plant[] {
  const matches = list.plants.flatMap((plant) => {
    const words = list.words.get(plant) ?? []
    const exact = typed.filter((t) => words.includes(t)).length
    const found = typed.every((t, i) => (i === typed.length - 1 ? words.some((w) => w.startsWith(t)) : words.includes(t)))
    return found ? [{ plant, exact, size: words.length }] : []
  })
  return matches.sort((a, b) => b.exact - a.exact || a.size - b.size || a.plant.name.localeCompare(b.plant.name)).map((m) => m.plant)
}

export function resolvePlant(list: PlantList, typed: string): Resolution {
  const text = typed.trim().replace(/\s+/g, " ")
  if (text === "") return { kind: "empty" }
  const upper = text.toUpperCase().replace(/\s+/g, "")

  // 1. A field abbreviation or a USDA symbol, written without spaces.
  const abbreviation = !text.includes(" ") ? list.abbreviations.get(upper) : undefined
  if (abbreviation) return resolved(list, abbreviation, "abbreviation")
  const symbol = !text.includes(" ") && /^[A-Z]{2,}[0-9]{0,2}$/i.test(text) ? list.bySymbol.get(upper) : undefined
  if (symbol?.length === 1) return resolved(list, symbol[0], "symbol")

  // 2. A scientific name: the plant's own name before anyone's synonym.
  const sci = binomialOf(text)
  const own = sci ? list.bySci.get(sci) : undefined
  if (own?.length === 1) return resolved(list, own[0], "scientific name")
  if (own) return { kind: "candidates", candidates: own.slice(0, MAX_CANDIDATES) }
  const synonym = sci ? list.bySynonym.get(sci) : undefined
  if (synonym?.length === 1) return resolved(list, synonym[0], "synonym")
  if (synonym) return { kind: "candidates", candidates: synonym.slice(0, MAX_CANDIDATES) }

  // 3. A common name, spelled as any source spells it.
  const key = compact(text)
  const alias = list.aliases.get(key)
  if (alias) return resolved(list, alias, "alias")
  const common = list.byCommon.get(key)
  if (common?.length === 1) return resolved(list, common[0], "common name")
  if (common) return { kind: "candidates", candidates: common.slice(0, MAX_CANDIDATES) }

  // 4. The words of a name.
  const typedWords = wordsOf(text)
  if (key.length >= 3) {
    const found = byWords(list, typedWords)
    if (found.length === 1) return resolved(list, found[0], "part of a name")
    if (found.length > 1) {
      const genus = binomialOf(found[0].name)?.split(" ")[0]
      const sameGenus = found.every((p) => binomialOf(p.name)?.split(" ")[0] === genus)
      const statuses = new Set(found.map((p) => statusFor(list, p).status))
      if (sameGenus && genus && statuses.size === 1) {
        return { kind: "genus", genus: genus[0].toUpperCase() + genus.slice(1), plants: found, status: statusFor(list, found[0]) }
      }
      return { kind: "candidates", candidates: found.slice(0, MAX_CANDIDATES) }
    }
  }

  // 5. A near miss.
  if (key.length >= 6) {
    const limit = key.length >= 10 ? 2 : 1
    const near = list.plants
      .map((plant) => ({
        plant,
        d: Math.min(...[plant.name, plant.common, plant.plantsCommon].filter(Boolean).map((n) => distance(key, compact(n), limit))),
      }))
      .filter((m) => m.d <= limit)
      .sort((a, b) => a.d - b.d)
    if (near.length > 0) return { kind: "candidates", candidates: near.slice(0, MAX_CANDIDATES).map((m) => m.plant) }
  }

  // Not found. A scientific name of a genus the list knows says so; either way it is a plant not on the list.
  if (sci && /^[A-Z]/.test(text) && list.genera.has(sci.split(" ")[0])) {
    return { kind: "unlisted", name: text, note: "Not on the plant list. Recorded as UPL, as the supplement directs for a plant that is not listed (pp. 22-23). Check the spelling." }
  }
  return {
    kind: "unknown",
    name: text,
    note: "Not found on the plant list. Counted as UPL, as the supplement directs for a plant that is not listed (pp. 22-23). Check the spelling, or mark it not identified if you could not identify it.",
  }
}
