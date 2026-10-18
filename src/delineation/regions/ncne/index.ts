// Northcentral and Northeast: ENG Form 6116-8, Sep 2024. The positions were measured from the
// official PDF's own drawing, page 3 (the Soil page): its profile table is 11 rows of rules, one
// filled rectangle per column per row, about 1 point thick and 18.1 points apart, and the first
// rule under the column headings is not a row. The Sampling Point box at the top is one more rule. The
// hydric soil indicators' blanks, and the blanks after "Yes" and "No" of "Hydric Soil Present?", are filled
// rectangles of the same kind (see indicatorsLeft.ts). `soil-page.pdf` is that page cut from the official
// PDF with scripts/extract-form-page.mjs. The Vegetation pages (2 and 4) were measured the same way: the
// rules of the rows, the totals, the Plot size and Sampling Point fields, and the top of the Remarks box
// (page 2).
import type { Region } from "../types"
import { LEFT_COLUMN } from "./indicatorsLeft"
import { MIDDLE_COLUMN } from "./indicatorsMiddle"
import { RIGHT_COLUMN } from "./indicatorsRight"
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
    // The blanks after "Yes" and "No", each a filled rectangle 22.2 points wide on one rule.
    hydricPresent: {
      yes: { x: [490.7, 512.9], rule: 551.0 },
      no: { x: [536.5, 558.7], rule: 551.0 },
    },
    tick: { size: 9, aboveRule: 1 },
  },
  vegetation: {
    size: { width: 612, height: 792 },
    pageNumber: 2,
    continuedPageNumber: 4,
    fontSize: 8,
    inset: 2,
    aboveRule: 2.5,
    columns: { name: [54.1, 223.7], cover: [231.5, 271.2], dominant: [279, 318.7], status: [326.5, 366.2] },
    strata: {
      tree: {
        rowRules: [92.2, 107.4, 122.6, 137.9, 153.1, 168.4, 183.4],
        totalRule: 198.6,
        plotSize: { rule: 76.9, span: [133.3, 188.9] },
      },
      saplingShrub: {
        rowRules: [229.1, 244.3, 259.6, 274.8, 290, 305.3, 320.3],
        totalRule: 335.5,
        plotSize: { rule: 213.8, span: [165, 220.6] },
      },
      herb: {
        rowRules: [366, 381.2, 396.5, 411.7, 427, 442.2, 457.4, 472.7, 487.9, 503.2, 518.4, 533.6],
        totalRule: 548.9,
        plotSize: { rule: 350.8, span: [133.3, 188.9] },
      },
      woodyVine: {
        rowRules: [579.4, 594.6, 609.8, 625.1],
        totalRule: 640.3,
        plotSize: { rule: 564.1, span: [165, 220.6] },
      },
    },
    samplingPoint: { rule: 53.8, span: [513.2, 567.1] },
    remarks: { left: 40, right: 571, firstBaseline: 668, lastBaseline: 745, leading: 11 },
    // The worksheets, the indicators' blanks and the Yes and No blanks at the right of page 2, measured the same way.
    worksheets: {
      dominance: {
        a: { x: [497.4, 551.3], rule: 107.4 },
        b: { x: [497.4, 551.3], rule: 137.88 },
        percent: { x: [497.4, 551.3], rule: 168.36 },
      },
      prevalence: {
        rows: {
          OBL: { cover: { x: [434.2, 481.7], rule: 213.84 }, product: { x: [513.2, 559.2], rule: 213.84 } },
          FACW: { cover: { x: [434.2, 481.7], rule: 229.08 }, product: { x: [513.2, 559.2], rule: 229.08 } },
          FAC: { cover: { x: [434.2, 481.7], rule: 244.32 }, product: { x: [513.2, 559.2], rule: 244.32 } },
          FACU: { cover: { x: [434.2, 481.7], rule: 259.56 }, product: { x: [513.2, 559.2], rule: 259.56 } },
          UPL: { cover: { x: [434.2, 481.7], rule: 274.8 }, product: { x: [513.2, 559.2], rule: 274.8 } },
        },
        totals: { a: { x: [434.2, 481.7], rule: 290.04 }, b: { x: [513.2, 559.2], rule: 290.04 } },
        index: { x: [505.3, 559.2], rule: 305.28 },
      },
      // Each indicator's blank is a filled rectangle 15.1 points wide, as on the Soil page.
      indicators: {
        rapid: { x: [378, 393.1], rule: 335.52 },
        dominance: { x: [378, 393.1], rule: 350.76 },
        prevalence: { x: [378, 393.1], rule: 366 },
        morphological: { x: [378, 393.1], rule: 381.24 },
        problematic: { x: [378, 393.1], rule: 411.72 },
      },
      present: {
        yes: { x: [459.5, 481.7], rule: 625.08 },
        no: { x: [513.2, 535.4], rule: 625.08 },
      },
      tick: { size: 9, aboveRule: 1 },
    },
  },
  // In the order the form prints them: the left column, then the middle, then the right.
  indicators: [...LEFT_COLUMN, ...MIDDLE_COLUMN, ...RIGHT_COLUMN],
  // The LRRs of the region, and the MLRAs in them that the form's indicators name.
  subregions: [
    { id: "K", name: "LRR K (Northcentral Forests)", mlras: [] },
    { id: "L", name: "LRR L (Central Great Lakes Forests)", mlras: [] },
    { id: "M", name: "LRR M", mlras: [] },
    { id: "R", name: "LRR R", mlras: ["144A", "145"] },
    { id: "S", name: "LRR S", mlras: ["149B"] },
  ],
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
