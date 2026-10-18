// A region package: everything that differs between the USACE regional supplements, as data. The
// form version, where each printed field sits on the official page, and room for the indicators,
// rules and plant list that later tickets fill. No assets are named here, so the engine that reads
// it stays pure; the page files are in each region's own assets module.
import type { Stratum } from "../vegetation/strata"

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

/** The columns of a Vegetation page's rows, left to right. "dominant" is the form's Dominant Species? column. */
export const VEG_COLUMNS = ["name", "cover", "dominant", "status"] as const
export type VegColumn = (typeof VEG_COLUMNS)[number]

/**
 * Where the Vegetation page, and its Continued page, take values. The two pages have the same rows at
 * the same places, so the Continued page's rows are the Vegetation page's rows again, numbered on
 * from them. Points, from the top left of the page, as for the Soil page.
 */
export interface VegetationPage {
  size: { width: number; height: number }
  /** The pages of the official form, counting from 1. */
  pageNumber: number
  continuedPageNumber: number
  fontSize: number
  inset: number
  aboveRule: number
  /** The left and right ends of each column's rule. */
  columns: Record<VegColumn, readonly [number, number]>
  strata: Record<Stratum, {
    /** The top of the rule each row's values sit on, first row first. */
    rowRules: readonly number[]
    /** The rule of the stratum's total cover, under the cover column. */
    totalRule: number
    /** The Plot size rule, on the Vegetation page only. */
    plotSize: { rule: number; span: readonly [number, number] }
  }>
  /** The Sampling Point rule at the top right. */
  samplingPoint: { rule: number; span: readonly [number, number] }
  /** The Remarks box of the Vegetation page: the text's left end, the right end it wraps at, the baselines of the first and last lines. */
  remarks: { left: number; right: number; firstBaseline: number; lastBaseline: number; leading: number }
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
  soil: SoilPage
  vegetation: VegetationPage
  indicators: readonly Indicator[]
}
