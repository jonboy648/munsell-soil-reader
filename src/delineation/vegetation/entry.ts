// What the Log keeps of a sampling point's vegetation: the plants, each in a stratum with its cover and
// the status the supplement's rules gave it. The list's answer is copied in when a plant is added, with
// the reason in words, so a plant's row reads the same later whatever the list says then.
import type { Resolution } from "./plantList"
import type { Status } from "./status"
import type { Stratum } from "./strata"

export interface PlantEntry {
  id: string
  stratum: Stratum
  /** What the delineator typed. */
  typed: string
  /** The scientific name the form prints; for a plant not found, what was typed. */
  name: string
  /** The status the dominance test and prevalence index use; null when the plant is left out of them (NI or NO, no adjacent status). */
  status: Status | null
  /** What the list itself says in the region: a status, NI, NO, or empty. Printed when `status` is null. */
  listed: string
  /** How the status was reached, when it was not simply the list's own: the supplement's rule, in words. Empty otherwise. */
  note: string
  /** How far the plant is identified: to species, to genus only ("Sonchus spp."), or not at all (the name was not found). */
  identified: "species" | "genus" | "none"
  /** The USDA PLANTS symbol, when known. */
  symbol: string
  /** Absolute percent cover in the stratum, more than 0 and at most 100. */
  cover: number
}

export interface Vegetation {
  /** The plot size of each stratum as written on the form, where the user has changed it from the supplement's suggestion. */
  plotSizes: Partial<Record<Stratum, string>>
  plants: PlantEntry[]
  /** The form's Remarks: bare ground, photo numbers, anything the page does not hold. */
  remarks: string
}

export const emptyVegetation: Vegetation = { plotSizes: {}, plants: [], remarks: "" }

/** What is wrong with a cover, in plain words, or null. */
export const coverProblem = (cover: number): string | null =>
  Number.isFinite(cover) && cover > 0 && cover <= 100 ? null : "Absolute percent cover is more than 0 and at most 100."

/**
 * The plant a resolution gives, ready for the Log, or null when it is not one plant yet (nothing typed, or
 * candidates to pick from). A plant that is not on the list is recorded as UPL with a note.
 */
export function plantEntryOf(resolution: Resolution, id: string, stratum: Stratum, typed: string, cover: number): PlantEntry | null {
  const common = { id, stratum, typed: typed.trim(), cover }
  switch (resolution.kind) {
    case "resolved": {
      const { plant, status, matched } = resolution
      const reworded = matched === "synonym" ? `${common.typed} is listed as ${plant.name}. ` : ""
      return { ...common, name: plant.name, status: status.status, listed: status.listed, note: reworded + status.note, identified: "species", symbol: plant.symbol }
    }
    case "genus":
      return {
        ...common,
        name: `${resolution.genus} spp.`,
        status: resolution.status.status,
        listed: resolution.status.listed,
        note: `Several ${resolution.genus} species, all ${resolution.status.status}. The form wants a species, and a dominant must be identified to species (supplement p. 26).`,
        identified: "genus",
        symbol: "",
      }
    case "unlisted":
      return { ...common, name: resolution.name, status: "UPL", listed: "", note: resolution.note, identified: "species", symbol: "" }
    case "unknown":
      return { ...common, name: resolution.name, status: "UPL", listed: "", note: resolution.note, identified: "none", symbol: "" }
    default:
      return null
  }
}
