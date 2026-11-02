// A region package: everything that differs between the USACE regional supplements, as data. The
// form version, where each printed field sits on the official page, and room for the indicators,
// rules and plant list that later tickets fill. No assets are named here, so the engine that reads
// it stays pure; the page files are in each region's own assets module.
import type { VegIndicatorId } from "../vegetation/hydrophytic"
import type { Status } from "../vegetation/status"
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
  /** The Restrictive Layer box: the rules its Type and Depth are written on. */
  restrictive: { type: TickBlank; depth: TickBlank }
  /** The top of the rule each row's values sit on, from the top of the page, first row first. */
  rowRules: readonly number[]
  /** The left and right ends of each column's rule. */
  columns: Record<ProfileColumn, readonly [number, number]>
  /** The blanks after "Yes" and "No" of "Hydric Soil Present?". */
  hydricPresent: { yes: Box; no: Box }
  /** Where a tick (an X) sits on its blank: its size, and the gap from the line up to its baseline. */
  tick: { size: number; aboveRule: number }
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
  /** The worksheets, the indicators and the conclusion at the right of the Vegetation page. The Continued page has none. */
  worksheets: {
    /** The Dominance Test worksheet: dominants that are OBL, FACW or FAC (A), all dominants (B), and A/B. */
    dominance: { a: Box; b: Box; percent: Box }
    /** The Prevalence Index worksheet: each status's total cover and its product with the weight, the column totals, and B/A. */
    prevalence: {
      rows: Record<Status, { cover: Box; product: Box }>
      totals: { a: Box; b: Box }
      index: Box
    }
    /** The blank before each Hydrophytic Vegetation Indicator. */
    indicators: Record<VegIndicatorId, Box>
    /** The blanks after "Yes" and "No" of "Hydrophytic Vegetation Present?". */
    present: { yes: Box; no: Box }
    /** Where a tick (an X) sits on its blank: its size, and the gap from the line up to its baseline. */
    tick: { size: number; aboveRule: number }
  }
}

/** The blank line printed before an indicator's label on the Soil page, where its tick goes. Points, as above. */
export interface Box {
  /** The left and right ends of the printed line. */
  x: readonly [number, number]
  /** The top of the printed line, from the top of the page. */
  rule: number
}

/** A published source, and where in it. */
export interface Citation {
  document: string
  page: string
}

/**
 * Where an indicator applies, as the form prints it: in any of these LRRs or MLRAs, or (`outsideMlra`)
 * everywhere except those MLRAs. An indicator with no scope applies in every subregion of the region.
 */
export interface Scope {
  lrr?: readonly string[]
  mlra?: readonly string[]
  outsideMlra?: readonly string[]
}

/** What an indicator needs beyond depths and colors, and why the app cannot suggest it without. */
export interface Need {
  kind: "texture" | "field"
  text: string
}

/** Which kind of soil an indicator is for, as the book groups them. */
export type TextureGroup = "any" | "sandy" | "loamy"

/**
 * The criteria of an indicator, as data: the numbers the rules test, by the family of test they
 * go through (rules/families.ts). `quote` carries the same criteria in the document's words.
 * Depths are inches. A `kind: "field"` indicator has no color test the app can make.
 */
export type Criteria =
  | { kind: "gleyed"; texture: TextureGroup; startsWithin: number; share: number }
  | { kind: "depleted"; texture: TextureGroup; share: number; variants: readonly { thickness: number; startsWithin: number }[] }
  | { kind: "sandyRedox"; texture: TextureGroup; share: number; startsWithin: number; thickness: number; redox: number }
  | {
      kind: "darkRedox"
      texture: TextureGroup
      feature: "concentration" | "depletion"
      startsWithin: number
      thickness: number
      valueMax: number
      variants: readonly { chromaMax: number; redox: number }[]
    }
  | {
      kind: "belowDark"
      share: number
      thickness: number
      /** A11: the layer starts at this depth or less. A12: deeper than this. */
      starts: { within: number } | { below: number }
      /** The dark layers above it must start less than this deep. */
      darkStartsWithin: number
      /** Value and chroma of the layers above, by the depth they start at; the first that fits applies. */
      above: readonly { startsWithin: number; valueMax: number; chromaMax: number }[]
      /** What is required of any layer above that starts deeper than the last entry of `above`. */
      aboveRest: { valueMax: number; chromaMax: number }
    }
  | { kind: "mucky"; texture: TextureGroup; thickness: number; startsWithin: number }
  | {
      kind: "organic"
      terms: readonly ("muck" | "mucky peat" | "peat")[]
      thickness: number
      startsWithin: number
      valueMax: number
      chromaMax: number
      /** A3: the hue is this one or yellower. */
      hueYellowerThan?: string
      /** A3: the mineral layer below has a chroma of this or less. S3: the layer below is sandy. */
      below?: { mineralChromaMax: number } | { sandy: true }
    }
  | { kind: "field" }

/** One hydric soil indicator of a region's form: one box on the Soil page. */
export interface Indicator {
  /** Unique on the form. The same code printed twice (S8, S9, F21) has one id for each box. */
  id: string
  /** As printed: A12, S8. Empty for "Other". */
  code: string
  name: string
  /** Which column of the form it is in. */
  list: "hydric" | "problematic"
  /** The label as the form prints it. */
  printed: string
  scope?: Scope
  needs: readonly Need[]
  criteria: Criteria
  /** The criteria in the document's own words (the technical description, without the "for use" sentence). */
  quote: string
  citations: readonly Citation[]
  box: Box
}

/** A Land Resource Region of a region's form, and the MLRAs in it that the form's indicators name. */
export interface Lrr {
  id: string
  name: string
  mlras: readonly string[]
}

/** One wetland hydrology indicator: a tick on page 1 of the form, with its definition and where it comes from. */
export interface HydrologyIndicator {
  /** `A1`, `B13`. */
  id: string
  /** The text printed beside its tick on the form. */
  label: string
  /** Its title in the regional supplement. */
  name: string
  kind: "primary" | "secondary"
  /** The supplement's General Description of it, verbatim, without the references to its figures. */
  definition: string
  citation: string
}

/** How many indicators of each kind show that wetland hydrology is present, and where that is said. */
export interface HydrologyRule {
  primaryNeeded: number
  secondaryNeeded: number
  text: string
  citation: string
}

/** The blank a tick is drawn on: the left and right ends of its rule, and the rule's top. */
export interface TickBlank {
  column: readonly [number, number]
  rule: number
}

/** Lines of free text: the left and right limits of a line, and the baseline of each line, top first. */
export interface TextBox {
  column: readonly [number, number]
  baselines: readonly number[]
}

export const OBSERVATIONS = ["surfaceWater", "waterTable", "saturation"] as const
export type Observation = (typeof OBSERVATIONS)[number]

/** Where the Hydrology section sits on page 1. Points from the top left of the page. */
export interface HydrologyPage {
  /** The tick of each indicator by id, and of "other" (Other, explain in Remarks). */
  ticks: Record<string, TickBlank>
  /** Field Observations: the top of each row's rules, and the ends of the Yes, No and Depth rules. */
  observations: {
    rows: Record<Observation, number>
    yes: readonly [number, number]
    no: readonly [number, number]
    depth: readonly [number, number]
  }
  /** "Wetland Hydrology Present?": the top of its rules, and the ends of the Yes and No rules. */
  present: { rule: number; yes: readonly [number, number]; no: readonly [number, number] }
  describe: TextBox
  remarks: TextBox
}

/** Page 1 of the official form. Each section's own positions are in its own entry. */
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
  /** The size of the X that ticks a blank. */
  tickSize: number
  /** The header's lines: the ones that take text and the short blanks that take a letter. */
  fields: Record<Page1Field, Rule>
  /** The Summary of Findings' Remarks box: its text's left and right edges and the baseline of its first line. */
  summaryRemarks: { left: number; right: number; baseline: number; baselines: readonly number[] }
  /** Summary Yes/No blanks, measured from the official page's drawing. */
  summary: Record<"vegetation" | "soil" | "hydrology" | "wetland", { yes: TickBlank; no: TickBlank }>
  hydrology: HydrologyPage
}

export interface Region {
  id: "NCNE"
  name: string
  /** The official form this region's projects fill. */
  form: { name: string; version: string }
  page1: Page1
  soil: SoilPage
  vegetation: VegetationPage
  indicators: readonly Indicator[]
  /** The subregions a project can be in, which decide which indicators apply. */
  subregions: readonly Lrr[]
  /** The wetland hydrology indicators printed on the form, and the rule that says when they show wetland hydrology. */
  hydrology: { indicators: readonly HydrologyIndicator[]; rule: HydrologyRule }
}
