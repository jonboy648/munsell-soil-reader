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

export interface SamplingPoint {
  id: string
  name: string
  layers: Layer[]
}

export interface Project {
  id: string
  name: string
  region: RegionId
  /** Milliseconds since 1970. */
  createdAt: number
  points: SamplingPoint[]
}

export const newProject = (name: string, region: RegionId): Project => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  region,
  createdAt: Date.now(),
  points: [],
})

export const newPoint = (name: string): SamplingPoint => ({ id: crypto.randomUUID(), name: name.trim(), layers: [] })

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
