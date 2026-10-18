// The Log: Samples saved on this device, each holding the Readings saved to it. Plain data and
// plain functions; the IndexedDB side is in logStore.ts and the CSV side in logCsv.ts.
// Photos are never stored, only what the engine returned for each Spot.
import type { Card, CardCheck, QualityWarning, ReadPhotoResult, Reading } from "@/engine"

export type Condition = "moist" | "dry"

export interface Location {
  lat: number
  lon: number
  /** Meters, as the device reported it. */
  accuracy: number
}

export interface SavedReading {
  id: string
  /** Exactly what the engine returned for the Spot, raw and corrected. */
  reading: Reading
  cardCheck?: CardCheck
  /** The Photo's warnings that apply to this Spot or to the Card. */
  quality: QualityWarning[]
  card: { kind: Card["kind"]; hue?: string }
}

export interface Sample {
  id: string
  name: string
  /** Centimeters; null when not recorded. */
  depthTop: number | null
  depthBottom: number | null
  condition: Condition
  notes: string
  /** Taken once, when the Sample was first saved, and only if the user had switched it on. */
  location: Location | null
  /** Milliseconds since 1970. */
  createdAt: number
  readings: SavedReading[]
}

/** The Sample fields as typed into the form. */
export interface SampleDraft {
  name: string
  depthTop: string
  depthBottom: string
  condition: Condition | ""
  notes: string
}

export const emptyDraft: SampleDraft = { name: "", depthTop: "", depthBottom: "", condition: "", notes: "" }

export const draftOf = (s: Sample): SampleDraft => ({
  name: s.name,
  depthTop: s.depthTop === null ? "" : String(s.depthTop),
  depthBottom: s.depthBottom === null ? "" : String(s.depthBottom),
  condition: s.condition,
  notes: s.notes,
})

const depthOf = (text: string): number | null => (text.trim() === "" ? null : Number(text))

/** What is wrong with the form, in plain words, or null when it can be saved. */
export function problemWith(d: SampleDraft): string | null {
  if (d.name.trim() === "") return "Give the Sample a name or number."
  if (d.condition === "") return "Pick moist or dry."
  const top = depthOf(d.depthTop)
  const bottom = depthOf(d.depthBottom)
  if ((top !== null && !(top >= 0)) || (bottom !== null && !(bottom >= 0))) {
    return "Depths are in centimeters, zero or more."
  }
  if (top !== null && bottom !== null && bottom < top) return "The bottom depth must be below the top."
  return null
}

/** "0-15 cm", "from 20 cm", "to 40 cm", or "" when no depth was recorded. */
export function depthText(s: Pick<Sample, "depthTop" | "depthBottom">): string {
  const { depthTop: top, depthBottom: bottom } = s
  if (top !== null && bottom !== null) return `${top}-${bottom} cm`
  if (top !== null) return `from ${top} cm`
  if (bottom !== null) return `to ${bottom} cm`
  return ""
}

export type SampleFields = Pick<Sample, "name" | "depthTop" | "depthBottom" | "condition" | "notes">

/** The Sample's own fields from a form that passed `problemWith`. */
export const fieldsOf = (d: SampleDraft): SampleFields => ({
  name: d.name.trim(),
  depthTop: depthOf(d.depthTop),
  depthBottom: depthOf(d.depthBottom),
  condition: d.condition as Condition,
  notes: d.notes.trim(),
})

/** A SavedReading for each of the Photo's Spots listed in `which` (indexes into the Spots). */
export function savedReadings(result: ReadPhotoResult, card: Card, which: number[]): SavedReading[] {
  return which.map((i) => ({
    id: crypto.randomUUID(),
    reading: result.readings[i],
    cardCheck: result.cardCheck,
    quality: result.quality.filter((w) => w.where === "card" || w.where === i),
    card: { kind: card.kind, ...(card.kind === "page" && { hue: card.hue }) },
  }))
}

// Location is a setting, off by default. Nothing here touches the geolocation API unless the
// user has switched it on.
const LOCATION_KEY = "munsell-soil-reader.log-location"

export function locationSetting(): boolean {
  try {
    return localStorage.getItem(LOCATION_KEY) === "on"
  } catch {
    return false
  }
}

export function setLocationSetting(on: boolean): void {
  try {
    localStorage.setItem(LOCATION_KEY, on ? "on" : "off")
  } catch {
    // Without storage the setting simply stays off next time.
  }
}

/** The device's position, or null when it is denied, unavailable or slow. */
export function currentLocation(): Promise<Location | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  })
}
