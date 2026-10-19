// The arithmetic of the Vegetation page, as the NCNE regional supplement prescribes it (ERDC/EL TR-12-1,
// Version 2.0, 2012): the dominant species of each stratum by the 50/20 rule (pp. 25-26), the Dominance
// Test worksheet (A, B, A/B) and the Prevalence Index worksheet (pp. 27-29). Pure.
//
// Covers are compared in thousandths of a percent, as whole numbers, so that 0.1 + 0.2 and the like never
// decide whether a plant is over a threshold.
import type { PlantEntry } from "./entry"
import { STATUSES, type Status } from "./status"
import { STRATA, type Stratum } from "./strata"

/** Statuses that count towards the Dominance Test (p. 25). */
export const WETLAND_STATUSES: readonly Status[] = ["OBL", "FACW", "FAC"]

/** The weight each status has in the Prevalence Index (p. 28). */
export const WEIGHT: Record<Status, number> = { OBL: 1, FACW: 2, FAC: 3, FACU: 4, UPL: 5 }

/** A stratum with less than this cover is recorded but not used in the Dominance Test, unless it is the only one (p. 18). */
export const STRATUM_MINIMUM = 5

const milli = (cover: number): number => Math.round(cover * 1000)
const sum = (plants: readonly PlantEntry[]): number => plants.reduce((total, p) => total + milli(p.cover), 0)

export interface StratumResult {
  stratum: Stratum
  /** Total cover of the plants the tests can use. */
  total: number
  /** The 50 and 20 percent thresholds of the stratum's total. */
  half: number
  fifth: number
  /** Whether the stratum goes into the Dominance Test: 5 percent cover or more, or the only stratum there is. */
  used: boolean
  /** Why it does not, in words. Empty when it does. */
  note: string
  /** The ids of its dominant plants, most abundant first. */
  dominants: string[]
}

export interface DominanceResult {
  /** The strata that have a plant the tests can use, in the form's order. */
  strata: StratumResult[]
  /** Every dominant, by stratum, in the form's order: a species dominant in two strata is in twice (p. 25). */
  dominants: { id: string; stratum: Stratum }[]
  /** A: dominants rated OBL, FACW or FAC. */
  a: number
  /** B: dominants across all strata. */
  b: number
  /** A/B as a percentage. Null when there is no dominant. */
  percent: number | null
  /** More than 50 percent. Null when there is no dominant to tell it by. */
  passes: boolean | null
}

/**
 * The plants of a stratum that are dominant: ranked by cover, taken until the running total is more than
 * half the stratum's total (every plant tied with the one that crosses the line too), plus any plant that is
 * 20 percent or more of the total by itself (p. 26, steps 2 to 7).
 */
function dominantsOf(plants: readonly PlantEntry[]): PlantEntry[] {
  const total = sum(plants)
  const ranked = [...plants].sort((a, b) => b.cover - a.cover)
  const chosen = new Set<PlantEntry>()
  let running = 0
  for (let i = 0; i < ranked.length && 2 * running <= total; ) {
    let end = i
    while (end < ranked.length && milli(ranked[end].cover) === milli(ranked[i].cover)) end++
    for (const tied of ranked.slice(i, end)) {
      chosen.add(tied)
      running += milli(tied.cover)
    }
    i = end
  }
  for (const plant of ranked) if (5 * milli(plant.cover) >= total) chosen.add(plant)
  return ranked.filter((p) => chosen.has(p))
}

/**
 * The Dominance Test. A plant with no status to use (NI or NO with nothing in the neighbouring regions,
 * p. 22-23) is left out of everything. A dominant that is not identified counts as UPL, which is what it was
 * recorded as, and the caller says it must be identified (p. 26).
 */
export function dominanceTest(plants: readonly PlantEntry[]): DominanceResult {
  const usable = plants.filter((p) => p.status !== null)
  const present = STRATA.filter((stratum) => usable.some((p) => p.stratum === stratum))
  const strata = present.map((stratum): StratumResult => {
    const here = usable.filter((p) => p.stratum === stratum)
    const total = sum(here)
    const used = total >= milli(STRATUM_MINIMUM) || present.length === 1
    return {
      stratum,
      total: total / 1000,
      half: total / 2000,
      fifth: total / 5000,
      used,
      note: used ? "" : `Under ${STRATUM_MINIMUM} percent cover, so it is recorded but not used (supplement p. 18).`,
      dominants: used ? dominantsOf(here).map((p) => p.id) : [],
    }
  })
  const dominants = strata.flatMap((s) => s.dominants.map((id) => ({ id, stratum: s.stratum })))
  const statusOf = (id: string) => plants.find((p) => p.id === id)!.status
  const a = dominants.filter((d) => WETLAND_STATUSES.includes(statusOf(d.id)!)).length
  const b = dominants.length
  return { strata, dominants, a, b, percent: b > 0 ? (100 * a) / b : null, passes: b > 0 ? 2 * a > b : null }
}

/**
 * The index as it is written: two decimals, or as many more as it takes to show that an index over 3.0 is
 * over it (751 / 250 is 3.004, not "3.00").
 */
export function writtenIndex(index: number, passes: boolean): string {
  let digits = 2
  while (!passes && digits < 10 && Number(index.toFixed(digits)) <= 3) digits++
  return index.toFixed(digits)
}

export interface PrevalenceRow {
  status: Status
  /** Total cover of the plants of this status, summed across strata. */
  cover: number
  weight: number
  product: number
}

export interface PrevalenceResult {
  rows: PrevalenceRow[]
  /** A: total cover of the plants counted. B: the sum of cover times weight. */
  a: number
  b: number
  /** B/A. Null when the index cannot be told: nothing counted, or too little of the cover is identified. */
  index: number | null
  /** The share of all the plot's cover that is identified and has a status, or is not listed and assumed UPL, in percent. At least 80 is needed (p. 27-28). */
  identified: number
  /** The 80 percent test. */
  valid: boolean
  /** 3.0 or less. Null when the index cannot be told. */
  passes: boolean | null
}

/**
 * The Prevalence Index. Every stratum counts, whatever its cover (Table 4, footnote 2). A plant the user named
 * that is not on the plant list counts as UPL (pp. 22-23, 27-28). A plant marked not identified is left out of
 * the sums, and so is one with no status; both count against the 80 percent of the cover that must be
 * identified and rated. A plant identified to its genus only counts: the plant list gave it a status because
 * every species of the genus has the same one.
 */
export function prevalenceIndex(plants: readonly PlantEntry[]): PrevalenceResult {
  const counted = plants.filter((p) => p.status !== null && p.identified !== "none")
  const rows = STATUSES.map((status): PrevalenceRow => {
    const cover = sum(counted.filter((p) => p.status === status))
    return { status, cover: cover / 1000, weight: WEIGHT[status], product: (cover * WEIGHT[status]) / 1000 }
  })
  const a = sum(counted)
  const b = counted.reduce((total, p) => total + milli(p.cover) * WEIGHT[p.status!], 0)
  const all = sum(plants)
  const valid = all > 0 && 100 * a >= 80 * all
  const index = valid && a > 0 ? b / a : null
  return {
    rows,
    a: a / 1000,
    b: b / 1000,
    index,
    identified: all > 0 ? (100 * a) / all : 0,
    valid,
    passes: index === null ? null : b <= 3 * a,
  }
}
