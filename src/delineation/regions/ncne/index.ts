// Northcentral and Northeast: ENG Form 6116-8, Sep 2024. The positions were measured from the
// official PDF's own drawing, page 3 (the Soil page): its profile table is 11 rows of rules, one
// filled rectangle per column per row, about 1 point thick and 18.1 points apart, and the first
// rule under the column headings is not a row. `soil-page.pdf` is that page cut from the official
// PDF with scripts/extract-form-page.mjs. The Vegetation pages (2 and 4) were measured the same
// way: the rules of the rows, the totals, the Plot size and Sampling Point fields, and the top of
// the Remarks box (page 2).
import type { Region } from "../types"

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
  indicators: [],
}
