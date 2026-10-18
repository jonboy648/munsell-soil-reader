// Profiles for testing the color-and-depth indicators: for each one a profile that satisfies it exactly
// at the edge of every number in its rule, and profiles that miss it by one step (a depth, a thickness,
// a chroma, a percentage). The documents give worked numbers only for the combinations (NCNE Tables 8 and 9,
// p. 43-44); the rest are built from each indicator's own quoted thresholds.
//
// Each case also carries the edits to the rule record that the profiles pin down: `tighten` makes the
// rule one step stricter, which must stop the satisfying profile qualifying; a miss's `loosen` makes the
// rule one step looser, which must let that miss qualify. A threshold typed wrong in the data (a depth or
// a chroma off by one) therefore turns a test red. See indicators.test.ts.
import type { Layer } from "../model"
import type { Criteria } from "../regions/types"

type Redox = [notation: string, percent: number, type?: "C" | "D"]

/** A Layer, from the surface down: depth, matrix, and optionally its share, redox features and texture. */
export const L = (top: number, bottom: number, matrix: string, extra: { pct?: number; redox?: Redox[]; texture?: string } = {}): Layer => ({
  id: `${top}-${bottom}`,
  top,
  bottom,
  matrix: { notation: matrix, percent: extra.pct ?? 100 },
  redox: (extra.redox ?? []).map(([notation, percent, type]) => ({ notation, percent, ...(type ? { type } : {}) })),
  remarks: "",
  ...(extra.texture ? { texture: extra.texture } : {}),
})

/** An edit to a rule's criteria. */
export type Edit = (c: Criteria) => Criteria

/** Edit the criteria of one kind: the edit says what it expects. */
function edit<K extends Criteria["kind"]>(kind: K, change: (c: Extract<Criteria, { kind: K }>) => Extract<Criteria, { kind: K }>): Edit {
  return (c) => {
    if (c.kind !== kind) throw new Error(`expected ${kind} criteria, got ${c.kind}`)
    return change(c as Extract<Criteria, { kind: K }>)
  }
}

export interface Miss {
  /** What it misses by, in a few words. */
  by: string
  layers: Layer[]
  /** The rule one step looser on exactly that point, which the layers then satisfy. Absent when the point is not in the record. */
  loosen?: Edit
}

export interface Case {
  /** The indicator's id on the form. */
  id: string
  /** What the satisfying profile is at the edge of. */
  name: string
  yes: Layer[]
  /** One step stricter on a number the satisfying profile sits exactly on: it then fails. */
  tighten: Record<string, Edit>
  misses: Miss[]
}

const SILT = { texture: "silt loam" }
const SAND = { texture: "loamy sand" }
const PROMINENT = "7.5YR 4/6" // against a matrix of value 3 or 4 and chroma 1 or 2, one hue step away: prominent

export const CASES: Case[] = [
  {
    id: "A11",
    name: "gleyed layer 6 in thick starting at 12 in, under dark layers",
    yes: [L(0, 6, "10YR 2/1"), L(6, 12, "10YR 3/2"), L(12, 18, "10YR 5/1")],
    tighten: {
      "start 11": edit("belowDark", (c) => ({ ...c, starts: { within: 11 } })),
      "thickness 7": edit("belowDark", (c) => ({ ...c, thickness: 7 })),
    },
    misses: [
      { by: "starts at 13", layers: [L(0, 6, "10YR 2/1"), L(6, 13, "10YR 3/2"), L(13, 19, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, starts: { within: 13 } })) },
      { by: "5 in thick", layers: [L(0, 6, "10YR 2/1"), L(6, 12, "10YR 3/2"), L(12, 17, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, thickness: 5 })) },
      { by: "dark layer chroma 3", layers: [L(0, 6, "10YR 2/1"), L(6, 12, "10YR 3/3"), L(12, 18, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, aboveRest: { ...c.aboveRest, chromaMax: 3 } })) },
      { by: "dark layer value 4", layers: [L(0, 6, "10YR 2/1"), L(6, 12, "10YR 4/2"), L(12, 18, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, aboveRest: { ...c.aboveRest, valueMax: 4 } })) },
    ],
  },
  {
    id: "A12",
    name: "gleyed layer 6 in thick starting just below 12 in, under a value 2 and chroma 1 surface",
    yes: [L(0, 13, "10YR 2/1"), L(13, 19, "10YR 5/1")],
    tighten: {
      "starts below 13": edit("belowDark", (c) => ({ ...c, starts: { below: 13 } })),
      "thickness 7": edit("belowDark", (c) => ({ ...c, thickness: 7 })),
    },
    misses: [
      { by: "starts at 12, not below it", layers: [L(0, 12, "10YR 2/1"), L(12, 18, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, starts: { below: 11 } })) },
      { by: "5 in thick", layers: [L(0, 13, "10YR 2/1"), L(13, 18, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, thickness: 5 })) },
      { by: "surface value 3, not 2.5", layers: [L(0, 13, "10YR 3/1"), L(13, 19, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, above: [{ ...c.above[0], valueMax: 3 }] })) },
      { by: "surface chroma 2, not 1", layers: [L(0, 13, "10YR 2/2"), L(13, 19, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, above: [{ ...c.above[0], chromaMax: 2 }] })) },
      { by: "a layer above with chroma 2, not 1", layers: [L(0, 13, "10YR 2/1"), L(13, 16, "10YR 3/2"), L(16, 22, "10YR 5/1")], loosen: edit("belowDark", (c) => ({ ...c, aboveRest: { ...c.aboveRest, chromaMax: 2 } })) },
    ],
  },
  {
    id: "S4",
    name: "sandy gleyed matrix starting at 6 in",
    yes: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "5GY 5/1", SAND)],
    tighten: { "start 5": edit("gleyed", (c) => ({ ...c, startsWithin: 5 })) },
    misses: [
      { by: "starts at 7", layers: [L(0, 7, "10YR 3/1", SAND), L(7, 11, "5GY 5/1", SAND)], loosen: edit("gleyed", (c) => ({ ...c, startsWithin: 7 })) },
      { by: "gley chroma 2", layers: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "5GY 5/2", SAND)] },
      { by: "gleyed on 55%, not 60%", layers: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "5GY 5/1", { ...SAND, pct: 55, redox: [["10YR 5/6", 45]] })], loosen: edit("gleyed", (c) => ({ ...c, share: 55 })) },
    ],
  },
  {
    id: "F2",
    name: "loamy gleyed matrix starting at 12 in",
    yes: [L(0, 12, "10YR 3/1", SILT), L(12, 16, "10Y 5/1", SILT)],
    tighten: { "start 11": edit("gleyed", (c) => ({ ...c, startsWithin: 11 })) },
    misses: [
      { by: "starts at 13", layers: [L(0, 13, "10YR 3/1", SILT), L(13, 17, "10Y 5/1", SILT)], loosen: edit("gleyed", (c) => ({ ...c, startsWithin: 13 })) },
      { by: "gley chroma 2", layers: [L(0, 12, "10YR 3/1", SILT), L(12, 16, "10Y 5/2", SILT)] },
      { by: "gleyed on 55%, not 60%", layers: [L(0, 12, "10YR 3/1", SILT), L(12, 16, "10Y 5/1", { ...SILT, pct: 55, redox: [["10YR 5/6", 45]] })], loosen: edit("gleyed", (c) => ({ ...c, share: 55 })) },
    ],
  },
  {
    id: "F3",
    name: "depleted matrix 2 in thick starting at 4 in (first variant)",
    yes: [L(0, 4, "10YR 3/1", SILT), L(4, 6, "10YR 6/1", SILT)],
    tighten: {
      "start 3": edit("depleted", (c) => ({ ...c, variants: [{ ...c.variants[0], startsWithin: 3 }, c.variants[1]] })),
      "thickness 3": edit("depleted", (c) => ({ ...c, variants: [{ ...c.variants[0], thickness: 3 }, c.variants[1]] })),
    },
    misses: [
      { by: "starts at 5", layers: [L(0, 5, "10YR 3/1", SILT), L(5, 7, "10YR 6/1", SILT)], loosen: edit("depleted", (c) => ({ ...c, variants: [{ ...c.variants[0], startsWithin: 5 }, c.variants[1]] })) },
      { by: "1 in thick", layers: [L(0, 4, "10YR 3/1", SILT), L(4, 5, "10YR 6/1", SILT)], loosen: edit("depleted", (c) => ({ ...c, variants: [{ ...c.variants[0], thickness: 1 }, c.variants[1]] })) },
      { by: "depleted on 55%, not 60%", layers: [L(0, 4, "10YR 3/1", SILT), L(4, 6, "10YR 6/1", { ...SILT, pct: 55, redox: [["7.5YR 5/6", 45]] })], loosen: edit("depleted", (c) => ({ ...c, share: 55 })) },
      { by: "chroma 3, not depleted", layers: [L(0, 4, "10YR 3/1", SILT), L(4, 6, "10YR 6/3", SILT)] },
    ],
  },
  {
    id: "F3",
    name: "depleted matrix 6 in thick starting at 10 in (second variant)",
    yes: [L(0, 10, "10YR 3/1", SILT), L(10, 16, "10YR 6/1", SILT)],
    tighten: {
      "start 9": edit("depleted", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], startsWithin: 9 }] })),
      "thickness 7": edit("depleted", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], thickness: 7 }] })),
    },
    misses: [
      { by: "starts at 11", layers: [L(0, 11, "10YR 3/1", SILT), L(11, 17, "10YR 6/1", SILT)], loosen: edit("depleted", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], startsWithin: 11 }] })) },
      { by: "5 in thick", layers: [L(0, 10, "10YR 3/1", SILT), L(10, 15, "10YR 6/1", SILT)], loosen: edit("depleted", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], thickness: 5 }] })) },
    ],
  },
  {
    id: "S5",
    name: "sandy redox 4 in thick starting at 6 in, 2 percent prominent concentrations",
    yes: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "10YR 4/2", { ...SAND, pct: 98, redox: [[PROMINENT, 2]] })],
    tighten: {
      "start 5": edit("sandyRedox", (c) => ({ ...c, startsWithin: 5 })),
      "thickness 5": edit("sandyRedox", (c) => ({ ...c, thickness: 5 })),
      "redox 3": edit("sandyRedox", (c) => ({ ...c, redox: 3 })),
    },
    misses: [
      { by: "starts at 7", layers: [L(0, 7, "10YR 3/1", SAND), L(7, 11, "10YR 4/2", { ...SAND, pct: 98, redox: [[PROMINENT, 2]] })], loosen: edit("sandyRedox", (c) => ({ ...c, startsWithin: 7 })) },
      { by: "3 in thick", layers: [L(0, 6, "10YR 3/1", SAND), L(6, 9, "10YR 4/2", { ...SAND, pct: 98, redox: [[PROMINENT, 2]] })], loosen: edit("sandyRedox", (c) => ({ ...c, thickness: 3 })) },
      { by: "1 percent concentrations", layers: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "10YR 4/2", { ...SAND, pct: 99, redox: [[PROMINENT, 1]] })], loosen: edit("sandyRedox", (c) => ({ ...c, redox: 1 })) },
      { by: "matrix chroma 3", layers: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "10YR 4/3", { ...SAND, pct: 98, redox: [[PROMINENT, 2]] })] },
      { by: "faint concentrations", layers: [L(0, 6, "10YR 3/1", SAND), L(6, 10, "10YR 4/2", { ...SAND, pct: 98, redox: [["10YR 4/3", 2]] })] },
    ],
  },
  {
    id: "F6",
    name: "redox dark surface 4 in thick starting at 8 in, chroma 1 and 2 percent",
    yes: [L(0, 8, "10YR 3/1", SILT), L(8, 12, "10YR 3/1", { ...SILT, pct: 98, redox: [[PROMINENT, 2]] })],
    tighten: {
      "start 7": edit("darkRedox", (c) => ({ ...c, startsWithin: 7 })),
      "thickness 5": edit("darkRedox", (c) => ({ ...c, thickness: 5 })),
      "redox 3": edit("darkRedox", (c) => ({ ...c, variants: [{ ...c.variants[0], redox: 3 }, c.variants[1]] })),
    },
    misses: [
      { by: "starts at 9", layers: [L(0, 9, "10YR 3/1", SILT), L(9, 13, "10YR 3/1", { ...SILT, pct: 98, redox: [[PROMINENT, 2]] })], loosen: edit("darkRedox", (c) => ({ ...c, startsWithin: 9 })) },
      { by: "3 in thick", layers: [L(0, 8, "10YR 3/1", SILT), L(8, 11, "10YR 3/1", { ...SILT, pct: 98, redox: [[PROMINENT, 2]] })], loosen: edit("darkRedox", (c) => ({ ...c, thickness: 3 })) },
      { by: "1 percent concentrations", layers: [L(0, 8, "10YR 3/1", SILT), L(8, 12, "10YR 3/1", { ...SILT, pct: 99, redox: [[PROMINENT, 1]] })], loosen: edit("darkRedox", (c) => ({ ...c, variants: [{ ...c.variants[0], redox: 1 }, c.variants[1]] })) },
      { by: "matrix value 4", layers: [L(0, 8, "10YR 3/1", SILT), L(8, 12, "10YR 4/1", { ...SILT, pct: 98, redox: [[PROMINENT, 2]] })], loosen: edit("darkRedox", (c) => ({ ...c, valueMax: 4 })) },
      { by: "faint concentrations", layers: [L(0, 8, "10YR 3/1", SILT), L(8, 12, "10YR 3/1", { ...SILT, pct: 98, redox: [["10YR 3/2", 2]] })] },
    ],
  },
  {
    id: "F6",
    name: "redox dark surface, chroma 2 and 5 percent",
    yes: [L(0, 4, "10YR 3/2", { ...SILT, pct: 95, redox: [[PROMINENT, 5]] })],
    tighten: { "redox 6": edit("darkRedox", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], redox: 6 }] })) },
    misses: [
      { by: "4 percent concentrations", layers: [L(0, 4, "10YR 3/2", { ...SILT, pct: 96, redox: [[PROMINENT, 4]] })], loosen: edit("darkRedox", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], redox: 4 }] })) },
      { by: "matrix chroma 3", layers: [L(0, 4, "10YR 3/3", { ...SILT, pct: 95, redox: [[PROMINENT, 5]] })], loosen: edit("darkRedox", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], chromaMax: 3 }] })) },
    ],
  },
  {
    id: "F7",
    name: "depleted dark surface 4 in thick starting at 8 in, chroma 1 and 10 percent",
    yes: [L(0, 8, "10YR 2/1", SILT), L(8, 12, "10YR 2/1", { ...SILT, pct: 90, redox: [["10YR 6/1", 10, "D"]] })],
    tighten: {
      "start 7": edit("darkRedox", (c) => ({ ...c, startsWithin: 7 })),
      "thickness 5": edit("darkRedox", (c) => ({ ...c, thickness: 5 })),
      "depletions 11": edit("darkRedox", (c) => ({ ...c, variants: [{ ...c.variants[0], redox: 11 }, c.variants[1]] })),
    },
    misses: [
      { by: "starts at 9", layers: [L(0, 9, "10YR 2/1", SILT), L(9, 13, "10YR 2/1", { ...SILT, pct: 90, redox: [["10YR 6/1", 10, "D"]] })], loosen: edit("darkRedox", (c) => ({ ...c, startsWithin: 9 })) },
      { by: "3 in thick", layers: [L(0, 8, "10YR 2/1", SILT), L(8, 11, "10YR 2/1", { ...SILT, pct: 90, redox: [["10YR 6/1", 10, "D"]] })], loosen: edit("darkRedox", (c) => ({ ...c, thickness: 3 })) },
      { by: "9 percent depletions", layers: [L(0, 8, "10YR 2/1", SILT), L(8, 12, "10YR 2/1", { ...SILT, pct: 91, redox: [["10YR 6/1", 9, "D"]] })], loosen: edit("darkRedox", (c) => ({ ...c, variants: [{ ...c.variants[0], redox: 9 }, c.variants[1]] })) },
      { by: "depletion value 4, not 5", layers: [L(0, 8, "10YR 2/1", SILT), L(8, 12, "10YR 2/1", { ...SILT, pct: 90, redox: [["10YR 4/1", 10, "D"]] })] },
    ],
  },
  {
    id: "F7",
    name: "depleted dark surface, chroma 2 and 20 percent",
    yes: [L(0, 4, "10YR 3/2", { ...SILT, pct: 80, redox: [["10YR 6/1", 20, "D"]] })],
    tighten: { "depletions 21": edit("darkRedox", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], redox: 21 }] })) },
    misses: [
      { by: "19 percent depletions", layers: [L(0, 4, "10YR 3/2", { ...SILT, pct: 81, redox: [["10YR 6/1", 19, "D"]] })], loosen: edit("darkRedox", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], redox: 19 }] })) },
      { by: "matrix chroma 3", layers: [L(0, 4, "10YR 3/3", { ...SILT, pct: 80, redox: [["10YR 6/1", 20, "D"]] })], loosen: edit("darkRedox", (c) => ({ ...c, variants: [c.variants[0], { ...c.variants[1], chromaMax: 3 }] })) },
    ],
  },
]
