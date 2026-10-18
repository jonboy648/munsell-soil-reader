// Northcentral and Northeast: ENG Form 6116-8, Sep 2024. The positions were measured from the
// official PDF's own drawing, page 3 (the Soil page): its profile table is 11 rows of rules, one
// filled rectangle per column per row, about 1 point thick and 18.1 points apart, and the first
// rule under the column headings is not a row. `soil-page.pdf` is that page cut from the official
// PDF with scripts/extract-form-page.mjs.
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
  indicators: [],
}
