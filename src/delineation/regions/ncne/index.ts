// Northcentral and Northeast: ENG Form 6116-8, Sep 2024. The positions were measured from the
// official PDF's own drawing, page 3 (the Soil page): its profile table is 11 rows of rules, one
// filled rectangle per column per row, about 1 point thick and 18.1 points apart, and the first
// rule under the column headings is not a row. The Sampling Point box at the top is one more rule. `soil-page.pdf` is that page cut from the official
// PDF with scripts/extract-form-page.mjs.
import type { Region } from "../types"
import { NCNE_HYDROLOGY_INDICATORS } from "./hydrologyIndicators"

// Page 1's Hydrology section is measured the same way: each tick is a 15 point rule (38.3 to 53.4,
// 201.7 to 216.8 and 382.7 to 397.8 across, 12.36 points apart down); the Field Observations,
// "Wetland Hydrology Present?" and the two boxes of free text are rules and the boxes' borders.
const TICK_LEFT = [38.3, 53.4] as const
const TICK_MIDDLE = [201.7, 216.8] as const
const TICK_RIGHT = [382.7, 397.8] as const
const rows = (first: number, count: number) => Array.from({ length: count }, (_, i) => Math.round((first + i * 12.36) * 100) / 100)

/** The ticks of one column, top to bottom, in the order the form prints them. */
const column = (ids: string[], x: readonly [number, number], first: number) =>
  Object.fromEntries(ids.map((id, i) => [id, { column: x, rule: rows(first, ids.length)[i] }]))

export const NCNE: Region = {
  id: "NCNE",
  name: "Northcentral and Northeast",
  form: { name: "ENG Form 6116-8", version: "Sep 2024" },
  page1: {
    size: { width: 612, height: 792 },
    pageNumber: 1,
    fontSize: 8,
    inset: 2,
    aboveRule: 2.5,
    tickSize: 10,
    hydrology: {
      ticks: {
        ...column(["A1", "A2", "A3", "B1", "B2", "B3", "B4", "B5", "B7", "B8"], TICK_LEFT, 431.76),
        ...column(["B9", "B13", "B15", "C1", "C3", "C4", "C6", "C7", "other"], TICK_MIDDLE, 431.76),
        ...column(["B6", "B10", "B16", "C2", "C8", "C9", "D1", "D2", "D3", "D4", "D5"], TICK_RIGHT, 419.4),
      },
      observations: {
        rows: { surfaceWater: 570.6, waterTable: 582.96, saturation: 595.32 },
        yes: [161.5, 183.7],
        no: [216.7, 238.9],
        depth: [305.2, 337.0],
      },
      present: { rule: 595.32, yes: [511.4, 533.6], no: [549.4, 571.6] },
      // The writing lines of the two boxes: the Describe box has room for two under its label, the
      // Remarks box for nine under its own.
      describe: { column: [40, 571], baselines: [630.5, 641] },
      remarks: { column: [40, 571], baselines: Array.from({ length: 9 }, (_, i) => 667 + i * 10.5) },
    },
  },
  soil: {
    size: { width: 612, height: 792 },
    pageNumber: 3,
    fontSize: 8,
    inset: 2,
    aboveRule: 2.5,
    samplingPoint: { column: [512.8, 571.2], rule: 53.8 },
    restrictive: { type: { column: [83.4, 224.3], rule: 535.8 }, depth: { column: [114.2, 224.3], rule: 551.04 } },
    rowRules: [111.1, 129.2, 147.4, 165.5, 183.6, 201.7, 219.8, 238.0, 256.1, 274.2, 292.3],
    columns: {
      depth: [38.3, 83.5],
      matrixColor: [90.5, 157.1],
      matrixPercent: [164.0, 186.4],
      redoxColor: [193.3, 259.9],
      redoxPercent: [266.9, 289.2],
      redoxType: [296.2, 318.5],
      redoxLoc: [325.4, 347.8],
      texture: [354.7, 425.2],
      remarks: [432.1, 571.2],
    },
  },
  indicators: [],
  hydrology: {
    indicators: NCNE_HYDROLOGY_INDICATORS,
    rule: {
      primaryNeeded: 1,
      secondaryNeeded: 2,
      text:
        "One primary indicator from any group is sufficient to conclude that wetland hydrology is present. " +
        "In the absence of a primary indicator, two or more secondary indicators from any group are required.",
      citation: "ERDC/EL TR-12-1 (2012), p. 81",
    },
  },
}
