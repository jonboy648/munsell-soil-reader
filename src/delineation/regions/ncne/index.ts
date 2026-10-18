// Northcentral and Northeast: ENG Form 6116-8, Sep 2024. The positions were measured from the
// official PDF's own drawing, page 3 (the Soil page): its profile table is 11 rows of rules, one
// filled rectangle per column per row, about 1 point thick and 18.1 points apart, and the first
// rule under the column headings is not a row. The hydric soil indicators' blanks, and the blanks after
// "Yes" and "No" of "Hydric Soil Present?", are filled rectangles of the same kind (see indicatorsLeft.ts). `soil-page.pdf` is that page cut from the official
// PDF with scripts/extract-form-page.mjs.
import type { Region } from "../types"
import { LEFT_COLUMN } from "./indicatorsLeft"
import { MIDDLE_COLUMN } from "./indicatorsMiddle"
import { RIGHT_COLUMN } from "./indicatorsRight"

export const NCNE: Region = {
  id: "NCNE",
  name: "Northcentral and Northeast",
  form: { name: "ENG Form 6116-8", version: "Sep 2024" },
  soil: {
    size: { width: 612, height: 792 },
    pageNumber: 3,
    fontSize: 8,
    inset: 2,
    aboveRule: 2.5,
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
}
