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

// Page 1's header is measured the same way: each line to write on is a filled rectangle about a point
// thick, and each value sits just above its rule. The Y or N and tick blanks are the 22-point rules.
// `page1.pdf` is the page cut from the official PDF as `soil-page.pdf` is; `privacy-page.pdf` is page 5,
// the Privacy Act page, which has nothing to fill. The Hydrology section is measured the same way: each tick is a 15 point rule (38.3 to 53.4,
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
    fields: {
      site: { left: 86.5, right: 305.3, rule: 98.4 },
      county: { left: 352.7, right: 465.7, rule: 98.4 },
      date: { left: 533.5, right: 575.5, rule: 98.4 },
      applicant: { left: 115.7, right: 405.7, rule: 113.6 },
      state: { left: 435.6, right: 473.6, rule: 113.6 },
      samplingPoint: { left: 541.4, right: 575.5, rule: 113.6 },
      investigators: { left: 93.6, right: 337.0, rule: 128.9 },
      sectionTownshipRange: { left: 435.6, right: 575.5, rule: 128.9 },
      landform: { left: 161.5, right: 280.0, rule: 144.1 },
      localRelief: { left: 413.5, right: 511.6, rule: 144.1 },
      slope: { left: 549.4, right: 575.5, rule: 144.1 },
      subregion: { left: 139.4, right: 216.8, rule: 159.4 },
      lat: { left: 238.8, right: 352.8, rule: 159.4 },
      long: { left: 382.7, right: 489.5, rule: 159.4 },
      datum: { left: 533.5, right: 575.5, rule: 159.4 },
      soilMapUnit: { left: 115.7, right: 397.8, rule: 174.6 },
      nwi: { left: 473.5, right: 575.5, rule: 174.6 },
      normalYes: { left: 511.4, right: 533.6, rule: 205.1 },
      normalNo: { left: 549.4, right: 571.6, rule: 205.1 },
      disturbedVegetation: { left: 93.6, right: 115.8, rule: 205.1 },
      disturbedSoil: { left: 139.4, right: 161.6, rule: 205.1 },
      disturbedHydrology: { left: 216.7, right: 238.9, rule: 205.1 },
      problematicVegetation: { left: 93.6, right: 115.8, rule: 220.3 },
      problematicSoil: { left: 139.4, right: 161.6, rule: 220.3 },
      problematicHydrology: { left: 216.7, right: 238.9, rule: 220.3 },
    },
    // The Summary of Findings' Remarks box: where its first line of writing starts, under its label.
    summaryRemarks: { left: 40, right: 571.4, baseline: 311 },
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
