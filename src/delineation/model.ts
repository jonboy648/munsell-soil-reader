// A delineation: a Project, its Sampling points, and each point's Layers. Plain data kept in the
// Log on the device. Depths are inches everywhere.
import type { SavedReading } from "@/lib/log"
import type { RegionId } from "./regions"
import { emptyVegetation, type Vegetation } from "./vegetation/entry"

/** The form's own codes for a redox feature: Concentration, Depletion, Reduced Matrix, Masked Sand grains. */
export type RedoxType = "C" | "D" | "RM" | "MS"
/** Where it is: Pore Lining or Matrix. */
export type RedoxLocation = "PL" | "M"

/** A color on a Layer: the Munsell notation, and how much of the Layer it covers. */
export interface LayerColor {
  /** `10YR 4/2`, as it prints on the form. */
  notation: string
  /** Percent of the Layer, 0 to 100. */
  percent: number
  /** The saved Reading it came from. Absent when the color was typed in. */
  reading?: SavedReading
  /** A redox feature's type and location, when recorded. The indicator rules infer the type when it is not. */
  type?: RedoxType
  location?: RedoxLocation
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
  /** The texture term from the Field Book's classes ("silt loam", "mucky sand", "muck"), when recorded. */
  texture?: string
}

/** What the user decided about one indicator of the form. */
export interface IndicatorChoice {
  state: "confirmed" | "rejected"
  /** The user's own words. A tick the app did not suggest carries the reason. */
  remark?: string
  /** True when the user ticked an indicator the app did not suggest. */
  manual?: boolean
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
  /** The vegetation plot. Absent on a point saved before the Vegetation page existed: read it with `vegetationOf`. */
  vegetation?: Vegetation
  /** The user's decisions, by the indicator's id on the form. An indicator not in here is undecided. */
  indicators?: Record<string, IndicatorChoice>
  /** The user's answer to "Hydric Soil Present?". Unset until they confirm it. */
  hydricSoilPresent?: "yes" | "no"
  /** Absent until something is recorded for the Hydrology section. */
  hydrology?: Hydrology
}

/** The Land Resource Region (and MLRA, when it matters) a project lies in. Decides which indicators apply. */
export interface Subregion {
  lrr: string
  mlra?: string
}

export interface Project {
  id: string
  name: string
  region: RegionId
  /** Milliseconds since 1970. */
  createdAt: number
  points: SamplingPoint[]
  /** Picked once for the project. Until it is, an indicator that is limited to some subregions is not suggested. */
  subregion?: Subregion
}

export const newProject = (name: string, region: RegionId): Project => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  region,
  createdAt: Date.now(),
  points: [],
})

export const newPoint = (name: string): SamplingPoint => ({ id: crypto.randomUUID(), name: name.trim(), layers: [] })

/** The Project with one Sampling point changed. */
export const withPoint = (project: Project, pointId: string, change: (point: SamplingPoint) => SamplingPoint): Project => ({
  ...project,
  points: project.points.map((point) => (point.id === pointId ? change(point) : point)),
})

/** The point's vegetation, empty when none is recorded. */
export const vegetationOf = (point: SamplingPoint): Vegetation => point.vegetation ?? emptyVegetation

/** The point with its vegetation changed. */
export const withVegetation = (point: SamplingPoint, change: (vegetation: Vegetation) => Vegetation): SamplingPoint => ({
  ...point,
  vegetation: change(vegetationOf(point)),
})

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
