// A delineation: a Project, its Sampling points, and each point's Layers. Plain data kept in the
// Log on the device. Depths are inches everywhere.
import type { SavedReading } from "@/lib/log"
import type { RegionId } from "./regions"

/** A color on a Layer: the Munsell notation, and how much of the Layer it covers. */
export interface LayerColor {
  /** `10YR 4/2`, as it prints on the form. */
  notation: string
  /** Percent of the Layer, 0 to 100. */
  percent: number
  /** The saved Reading it came from. Absent when the color was typed in. */
  reading?: SavedReading
}

export interface Layer {
  id: string
  /** Inches from the surface to the top of the Layer. */
  top: number
  /** Inches from the surface to the bottom of the Layer. */
  bottom: number
  matrix: LayerColor | null
  redox: LayerColor[]
  remarks: string
}

/** The two halves of a pair of Sampling points: the one in the wetland and the one in the upland. */
export type PairRole = "wetland" | "upland"

/** A Sampling point's pair, kept on one of the two: this point's own role, and the other's id. */
export interface Pair {
  with: string
  role: PairRole
}

/** One of the three Field Observations: whether it was seen, and how deep (inches) when it was. */
export interface Observation {
  /** Yes, No, or null while it has not been answered. */
  present: boolean | null
  depth: number | null
}

/** What was recorded at a sampling point for the Hydrology section of page 1. */
export interface Hydrology {
  /** The indicators ticked, by id (`A1`, `B6`), and "other" for Other (Explain in Remarks). */
  ticked: string[]
  surfaceWater: Observation
  waterTable: Observation
  saturation: Observation
  /** Describe Recorded Data (stream gauge, monitoring well, aerial photos, previous inspections). */
  describe: string
  remarks: string
  /**
   * Wetland Hydrology Present?, as the delineator answered it. The rule only suggests an answer; null
   * until it is confirmed, and a form with no answer prints neither Yes nor No.
   */
  present: boolean | null
}

const noObservation = (): Observation => ({ present: null, depth: null })

export const emptyHydrology: Hydrology = {
  ticked: [],
  surfaceWater: noObservation(),
  waterTable: noObservation(),
  saturation: noObservation(),
  describe: "",
  remarks: "",
  present: null,
}

export interface SamplingPoint {
  id: string
  name: string
  layers: Layer[]
  /** Latitude and longitude as typed, and the datum they are in (WGS84 for a phone's GPS). */
  lat: string
  long: string
  datum: string
  /** Set on one point of a pair; the other one's form shows it too. */
  pair?: Pair
  /** Absent until something is recorded for the Hydrology section. */
  hydrology?: Hydrology
}

export type YesNo = "" | "yes" | "no"

/** The answer for each of vegetation, soil and hydrology. */
export interface Conditions {
  vegetation: YesNo
  soil: YesNo
  hydrology: YesNo
}

/** The fields at the top of page 1 that are the same for every Sampling point of a Project. */
export interface ProjectHeader {
  /** Project/Site. */
  site: string
  applicant: string
  county: string
  state: string
  investigators: string
  /** The sampling date, `yyyy-mm-dd` as a date field gives it, or blank. */
  date: string
  /** Section, Township, Range, typed as the user writes it. */
  sectionTownshipRange: string
  landform: string
  localRelief: string
  slope: string
  /** The LRR or MLRA. */
  subregion: string
  soilMapUnit: string
  /** The NWI classification. */
  nwi: string
  /** Are "Normal Circumstances" present? */
  normalCircumstances: YesNo
  /** Are vegetation, soil or hydrology significantly disturbed? */
  disturbed: Conditions
  /** Are vegetation, soil or hydrology naturally problematic? */
  problematic: Conditions
}

export interface Project {
  id: string
  name: string
  region: RegionId
  /** Milliseconds since 1970. */
  createdAt: number
  header: ProjectHeader
  points: SamplingPoint[]
}

const NO_CONDITIONS: Conditions = { vegetation: "", soil: "", hydrology: "" }

export const emptyHeader = (site = ""): ProjectHeader => ({
  site,
  applicant: "",
  county: "",
  state: "",
  investigators: "",
  date: "",
  sectionTownshipRange: "",
  landform: "",
  localRelief: "",
  slope: "",
  subregion: "",
  soilMapUnit: "",
  nwi: "",
  normalCircumstances: "",
  disturbed: NO_CONDITIONS,
  problematic: NO_CONDITIONS,
})

export const newProject = (name: string, region: RegionId): Project => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  region,
  createdAt: Date.now(),
  // The site starts as the project's name, and can be changed.
  header: emptyHeader(name.trim()),
  points: [],
})

export const newPoint = (name: string): SamplingPoint => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  layers: [],
  lat: "",
  long: "",
  datum: "",
})

/** A Project as stored by an earlier version, with the fields added since filled in blank. */
export function normalizeProject(project: Project): Project {
  const stored: Partial<ProjectHeader> = project.header ?? {}
  return {
    ...project,
    header: {
      ...emptyHeader(),
      ...stored,
      disturbed: { ...NO_CONDITIONS, ...stored.disturbed },
      problematic: { ...NO_CONDITIONS, ...stored.problematic },
    },
    points: project.points.map((point) => ({ ...point, lat: point.lat ?? "", long: point.long ?? "", datum: point.datum ?? "" })),
  }
}

/** The Project with one Sampling point changed. */
export const withPoint = (project: Project, pointId: string, change: (point: SamplingPoint) => SamplingPoint): Project => ({
  ...project,
  points: project.points.map((point) => (point.id === pointId ? change(point) : point)),
})

/**
 * What a Sampling point is in its pair, and who the other half is: the role on its own record, or
 * the opposite of the role on the record of a point that names it. Null when it is not in a pair, or
 * when the other half has been deleted.
 */
export function pairOf(project: Project, point: SamplingPoint): { role: PairRole; other: SamplingPoint } | null {
  const opposite = (role: PairRole): PairRole => (role === "wetland" ? "upland" : "wetland")
  if (point.pair) {
    const other = project.points.find((p) => p.id === point.pair?.with)
    return other ? { role: point.pair.role, other } : null
  }
  const owner = project.points.find((p) => p.pair?.with === point.id)
  return owner?.pair ? { role: opposite(owner.pair.role), other: owner } : null
}

/** The Layers from the surface down. */
export const topToBottom = (layers: readonly Layer[]): Layer[] => [...layers].sort((a, b) => a.top - b.top)

const STANDARD = /^(\d+(?:\.\d+)?(?:R|YR|Y|GY|G|BG|B|PB|P|RP))\s*(\d+(?:\.\d+)?\/\d+)$/
const NEUTRAL = /^N\s*(\d+(?:\.\d+)?)\/?$/
const GLEY = /^(GLEY[12])\s*(\d+(?:\.\d+)?\/(?:\d+[A-Z]+|N))$/

/** `10yr 4/2` as the notation prints (`10YR 4/2`), or null when it is not a soil-book notation. */
export function notationOf(text: string): string | null {
  const t = text.trim().toUpperCase()
  const standard = STANDARD.exec(t) ?? GLEY.exec(t)
  if (standard) return `${standard[1]} ${standard[2]}`
  const neutral = NEUTRAL.exec(t)
  return neutral ? `N ${neutral[1]}/` : null
}

/** What is wrong with a Layer's depths, in plain words, or null when they are fine. */
export function depthProblem(top: number, bottom: number): string | null {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return "Give the top and the bottom depth, in inches."
  if (top < 0) return "Depths are in inches from the surface, zero or more."
  if (bottom <= top) return "The bottom must be deeper than the top."
  return null
}

/** What is wrong with a percent, or null. */
export const percentProblem = (percent: number): string | null =>
  Number.isFinite(percent) && percent > 0 && percent <= 100 ? null : "A percent is more than 0 and at most 100."
