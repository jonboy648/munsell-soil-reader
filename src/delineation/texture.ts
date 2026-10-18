// What a layer's texture can be, from the NRCS Field Book for Describing and Sampling Soils, v4.0
// (Nov 2024): the 21 texture classes (p. 2-36), the "mucky" modifier for mineral soil (p. 2-40), and
// the organic terms used in lieu of texture, muck, mucky peat and peat (p. 2-42). A layer's
// `texture` is the term as one lowercase string ("silt loam", "mucky silt loam", "muck"); the
// indicator rules read it from there.
export const TEXTURE_SOURCE =
  "NRCS Field Book for Describing and Sampling Soils, v4.0 (Nov 2024), pp. 2-36, 2-40 and 2-42"

export interface TextureTerm {
  term: string
  /** The Field Book's NASIS code. */
  code: string
}

/** The Field Book's 21 texture classes and subclasses, coarse to fine as it lists them (p. 2-36). */
export const TEXTURE_CLASSES: readonly TextureTerm[] = [
  { term: "coarse sand", code: "COS" },
  { term: "sand", code: "S" },
  { term: "fine sand", code: "FS" },
  { term: "very fine sand", code: "VFS" },
  { term: "loamy coarse sand", code: "LCOS" },
  { term: "loamy sand", code: "LS" },
  { term: "loamy fine sand", code: "LFS" },
  { term: "loamy very fine sand", code: "LVFS" },
  { term: "coarse sandy loam", code: "COSL" },
  { term: "sandy loam", code: "SL" },
  { term: "fine sandy loam", code: "FSL" },
  { term: "very fine sandy loam", code: "VFSL" },
  { term: "loam", code: "L" },
  { term: "silt loam", code: "SIL" },
  { term: "silt", code: "SI" },
  { term: "sandy clay loam", code: "SCL" },
  { term: "clay loam", code: "CL" },
  { term: "silty clay loam", code: "SICL" },
  { term: "sandy clay", code: "SC" },
  { term: "silty clay", code: "SIC" },
  { term: "clay", code: "C" },
]

/** The organic terms used in lieu of a texture (p. 2-42). They take no modifier. */
export const ORGANIC_TERMS: readonly TextureTerm[] = [
  { term: "muck", code: "MUCK" },
  { term: "mucky peat", code: "MPT" },
  { term: "peat", code: "PEAT" },
]

/** The "mucky" compositional modifier (p. 2-40): mineral soil with more than 10 percent organic matter and less than 17 percent fibers. */
export const MUCKY = { term: "mucky", code: "MK" }

const ALL = [...TEXTURE_CLASSES, ...ORGANIC_TERMS]

/** True for a term the pick list offers with no modifier: a class or an organic term. */
export const isBaseTerm = (term: string): boolean => ALL.some((t) => t.term === term)

/** The term for a class and the modifier. Organic terms and the empty class take no modifier. */
export function textureTerm(base: string, mucky: boolean): string {
  const mineral = TEXTURE_CLASSES.some((t) => t.term === base)
  return mucky && mineral ? `${MUCKY.term} ${base}` : base
}

/** A stored term taken apart again for the form, or null when the pick list does not offer it. */
export function parseTextureTerm(term: string): { base: string; mucky: boolean } | null {
  if (isBaseTerm(term)) return { base: term, mucky: false }
  if (term.startsWith(`${MUCKY.term} `)) {
    const base = term.slice(MUCKY.term.length + 1)
    if (TEXTURE_CLASSES.some((t) => t.term === base)) return { base, mucky: true }
  }
  return null
}

/** The Field Book's code for a term, for where the full term is too long for the column: `SICL`, `MK-SICL`, `MUCK`. */
export function textureCode(term: string): string {
  const parsed = parseTextureTerm(term)
  if (!parsed) return term.toUpperCase()
  const { code } = ALL.find((t) => t.term === parsed.base)!
  return parsed.mucky ? `${MUCKY.code}-${code}` : code
}
