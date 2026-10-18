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
  /** The Restrictive Layer box: the rules its Type and Depth are written on. */
  restrictive: { type: TickBlank; depth: TickBlank }
  /** The top of the rule each row's values sit on, from the top of the page, first row first. */
  rowRules: readonly number[]
  /** The left and right ends of each column's rule. */
  columns: Record<ProfileColumn, readonly [number, number]>
}

/** One hydric soil indicator of a region's form. Empty until the indicators ticket. */
export interface Indicator {
  id: string
  name: string
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
  hydrology: HydrologyPage
}

export interface Region {
  id: "NCNE"
  name: string
  /** The official form this region's projects fill. */
  form: { name: string; version: string }
  page1: Page1
  soil: SoilPage
  indicators: readonly Indicator[]
  /** The wetland hydrology indicators printed on the form, and the rule that says when they show wetland hydrology. */
  hydrology: { indicators: readonly HydrologyIndicator[]; rule: HydrologyRule }
}
