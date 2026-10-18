// A region package: everything that differs between the USACE regional supplements, as data. The
// form version, where each printed field sits on the official page, and room for the indicators,
// rules and plant list that later tickets fill. No assets are named here, so the engine that reads
// it stays pure; the page files are in each region's own assets module.

/** The columns of the Soil page's profile description table, left to right. */
export const PROFILE_COLUMNS = [
  "depth",
  "matrixColor",
  "matrixPercent",
  "redoxColor",
  "redoxPercent",
  "redoxType",
  "redoxLoc",
  "texture",
  "remarks",
] as const
export type ProfileColumn = (typeof PROFILE_COLUMNS)[number]

/**
 * Where the Soil page's profile table sits on the official page. Points (1/72 inch), measured from
 * the top left of the page, as in the PDF's own page box.
 */
export interface SoilPage {
  /** The page's size in points. */
  size: { width: number; height: number }
  /** The page of the official form this is, counting from 1. */
  pageNumber: number
  /** The size of the form's own text, which the filled-in values match. */
  fontSize: number
  /** The gap from a column's left end to its text. */
  inset: number
  /** The gap from the bottom of a value's letters up to the rule it sits on. */
  aboveRule: number
  /** The "Sampling Point" box at the top of the page: its rule's left and right ends, and its top. */
  samplingPoint: { column: readonly [number, number]; rule: number }
  /** The top of the rule each row's values sit on, from the top of the page, first row first. */
  rowRules: readonly number[]
  /** The left and right ends of each column's rule. */
  columns: Record<ProfileColumn, readonly [number, number]>
}

/** The header lines of page 1 that take typed text. */
export const PAGE1_TEXT_FIELDS = [
  "site",
  "county",
  "date",
  "applicant",
  "state",
  "samplingPoint",
  "investigators",
  "sectionTownshipRange",
  "landform",
  "localRelief",
  "slope",
  "subregion",
  "lat",
  "long",
  "datum",
  "soilMapUnit",
  "nwi",
] as const

/** The short blanks of page 1 that take one letter: a tick, or Y or N. */
export const PAGE1_MARK_FIELDS = [
  "normalYes",
  "normalNo",
  "disturbedVegetation",
  "disturbedSoil",
  "disturbedHydrology",
  "problematicVegetation",
  "problematicSoil",
  "problematicHydrology",
] as const

export type Page1TextField = (typeof PAGE1_TEXT_FIELDS)[number]
export type Page1MarkField = (typeof PAGE1_MARK_FIELDS)[number]
export type Page1Field = Page1TextField | Page1MarkField

/** A line to write on: the left and right ends of its rule, and the top of the rule from the top of the page. */
export interface Rule {
  left: number
  right: number
  rule: number
}

/**
 * Where the header of page 1 takes its values. Points, from the top left of the page. The Hydrology
 * section and the rest of the page are not here yet.
 */
export interface Page1 {
  size: { width: number; height: number }
  /** The page of the official form this is, counting from 1. */
  pageNumber: number
  /** The size of the form's own text, which the filled-in values match. */
  fontSize: number
  /** The gap from a rule's left end to its text. */
  inset: number
  /** The gap from the bottom of a value's letters up to the rule it sits on. */
  aboveRule: number
  fields: Record<Page1Field, Rule>
  /** The Remarks box of the Summary of Findings: its text's left and right edges and the baseline of its first line. */
  remarks: { left: number; right: number; baseline: number }
}

/** One hydric soil indicator of a region's form. Empty until the indicators ticket. */
export interface Indicator {
  id: string
  name: string
}

export interface Region {
  id: "NCNE"
  name: string
  /** The official form this region's projects fill. */
  form: { name: string; version: string }
  page1: Page1
  soil: SoilPage
  indicators: readonly Indicator[]
}
