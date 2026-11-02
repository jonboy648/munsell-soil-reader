// What a layer's texture term says to the indicators: sandy (loamy fine sand or coarser) or loamy and
// clayey (loamy very fine sand and finer), and whether it is organic or mucky. Texture is recorded
// as a term from the NRCS Field Book's classes; an unrecorded or unfamiliar term is `unknown`, and the
// rules treat that as "ask", not as either answer. Sources: Field Indicators v9.3 p. 7, 20, 25.

export interface Texture {
  group: "sandy" | "loamy" | "unknown"
  /** Muck, mucky peat or peat: organic soil material, not a mineral texture. */
  organic?: "muck" | "mucky peat" | "peat"
  /** A mineral texture with the "mucky" modifier (mucky sand, mucky silt loam). */
  mucky?: boolean
}

/** The sand textures from loamy fine sand coarser (USDA); everything finer is loamy or clayey. */
const SANDY = ["coarse sand", "sand", "fine sand", "very fine sand", "loamy coarse sand", "loamy sand", "loamy fine sand"]

const FRAGMENTS = /\b(?:(?:extremely|very|fine)\s+)?(?:gravelly|cobbly|stony|bouldery|channery|flaggy|shaly)\b/g

export function textureOf(term: string | undefined): Texture {
  const text = (term ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  if (text === "") return { group: "unknown" }
  if (/\bpeat\b/.test(text)) return { group: "unknown", organic: /\bmucky\b/.test(text) ? "mucky peat" : "peat" }
  if (/^muck\b/.test(text) || /\bmuck$/.test(text)) return { group: "unknown", organic: "muck" }
  const mucky = /\bmucky\b/.test(text)
  const base = text.replace(/\bmucky\b/g, "").replace(/\bmodified\b/g, "").replace(FRAGMENTS, "").replace(/\s+/g, " ").trim()
  if (SANDY.includes(base)) return { group: "sandy", ...(mucky ? { mucky } : {}) }
  const LOAMY = /\b(?:loam|clay|silt)\b|^very fine sandy|sandy loam$|sandy clay/.test(base) || base === "loamy very fine sand"
  return LOAMY ? { group: "loamy", ...(mucky ? { mucky } : {}) } : { group: "unknown" }
}

export const isOrganic = (t: Texture): boolean => t.organic !== undefined
