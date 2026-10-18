// Northcentral and Northeast: ENG Form 6116-8, Sep 2024. The positions were measured from the
// official PDF's own drawing. Page 3 (the Soil page): its profile table is 11 rows of rules, one
// filled rectangle per column per row, about 1 point thick and 18.1 points apart, and the first
// rule under the column headings is not a row. The Sampling Point box at the top is one more rule. `soil-page.pdf` is that page cut from the official
// PDF with scripts/extract-form-page.mjs.
import type { Region } from "../types"

export const NCNE: Region = {
  id: "NCNE",
  name: "Northcentral and Northeast",
  form: { name: "ENG Form 6116-8", version: "Sep 2024" },
  // Page 1, the header: each line is one filled rectangle about 1 point thick, and each value sits
  // just above its rule. The Y or N and tick blanks are the 22-point rules. `page1.pdf` is the page cut
  // from the official PDF as `soil-page.pdf` is; `privacy-page.pdf` is page 5, the Privacy Act page,
  // which has nothing to fill.
  page1: {
    size: { width: 612, height: 792 },
    pageNumber: 1,
    fontSize: 8,
    inset: 2,
    aboveRule: 2.5,
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
    remarks: { left: 40, right: 571.4, baseline: 311 },
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
  },
  indicators: [],
}
