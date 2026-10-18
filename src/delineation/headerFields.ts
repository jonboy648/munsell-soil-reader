// The header of page 1 in the form's own words: what each line is called, which Project or Sampling
// point value fills it, and how that value is written on the form. Shared by the form engine and the
// screens that collect the values, so a line is called the same thing everywhere.
import type { ProjectHeader, SamplingPoint } from "./model"
import type { Page1TextField } from "./regions/types"

export interface HeaderField {
  field: Page1TextField
  /** The line's name on the form. */
  label: string
  /** The form's own words in brackets after it, when it has them. */
  hint?: string
}

/** The lines the same for every Sampling point of a Project, in the order of the form. */
export const PROJECT_FIELDS: readonly (HeaderField & { key: keyof ProjectHeader })[] = [
  { key: "site", field: "site", label: "Project/Site" },
  { key: "applicant", field: "applicant", label: "Applicant/Owner" },
  { key: "county", field: "county", label: "City/County" },
  { key: "state", field: "state", label: "State" },
  { key: "investigators", field: "investigators", label: "Investigator(s)" },
  { key: "date", field: "date", label: "Sampling Date" },
  { key: "sectionTownshipRange", field: "sectionTownshipRange", label: "Section, Township, Range" },
  { key: "landform", field: "landform", label: "Landform", hint: "hillside, terrace, etc." },
  { key: "localRelief", field: "localRelief", label: "Local relief", hint: "concave, convex, none" },
  { key: "slope", field: "slope", label: "Slope %" },
  { key: "subregion", field: "subregion", label: "Subregion", hint: "LRR or MLRA" },
  { key: "soilMapUnit", field: "soilMapUnit", label: "Soil Map Unit Name" },
  { key: "nwi", field: "nwi", label: "NWI classification" },
]

/** The lines that belong to one Sampling point. */
export const POINT_FIELDS: readonly (HeaderField & { key: keyof SamplingPoint })[] = [
  { key: "name", field: "samplingPoint", label: "Sampling Point" },
  { key: "lat", field: "lat", label: "Lat" },
  { key: "long", field: "long", label: "Long" },
  { key: "datum", field: "datum", label: "Datum" },
]

/** A `yyyy-mm-dd` date as the form is written in the United States, `mm/dd/yyyy`; anything else as typed. */
export function writtenDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  return match ? `${match[2]}/${match[3]}/${match[1]}` : date
}
