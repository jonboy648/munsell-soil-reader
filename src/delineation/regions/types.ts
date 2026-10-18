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
  /** The top of the rule each row's values sit on, from the top of the page, first row first. */
  rowRules: readonly number[]
  /** The left and right ends of each column's rule. */
  columns: Record<ProfileColumn, readonly [number, number]>
  /** The blanks after "Yes" and "No" of "Hydric Soil Present?". */
  hydricPresent: { yes: Box; no: Box }
  /** Where a tick (an X) sits on its blank: its size, and the gap from the line up to its baseline. */
  tick: { size: number; aboveRule: number }
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

export interface Region {
  id: "NCNE"
  name: string
  /** The official form this region's projects fill. */
  form: { name: string; version: string }
  soil: SoilPage
  indicators: readonly Indicator[]
  /** The subregions a project can be in, which decide which indicators apply. */
  subregions: readonly Lrr[]
}
