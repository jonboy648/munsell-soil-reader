// A sampling point's layers as the indicator rules read them: parsed colors, redox features with a
// kind, a texture group, and where depth starts. Pure. Anything a rule had to assume because the Log
// does not record it (a redox type, a texture) is noted, so a suggestion can say so.
import type { Layer } from "../model"
import type { TextureGroup } from "../regions/types"
import { contrast, isGleyed, parseColor, type Color } from "./munsell"
import { isOrganic, textureOf, type Texture } from "./texture"

export interface Feature {
  color: Color
  percent: number
  kind: "concentration" | "depletion" | "reduced matrix" | "masked sand"
  /** The Log recorded no type, so the kind was read from the colors. */
  inferred: boolean
}

export interface Seg {
  /** The Layer's place counting down from the surface, from 1. */
  n: number
  top: number
  bottom: number
  thickness: number
  matrix: Color | null
  matrixPercent: number
  features: Feature[]
  texture: Texture
  /** The texture term as recorded. */
  term: string
}

/** Where depth is measured from: the soil surface, the top of the muck or mineral, or the top of the mineral. */
export type Surface = "soil" | "muckOrMineral" | "mineral"

export interface Profile {
  segs: Seg[]
  /** Inches of organic material at the top that each reference leaves out. */
  offset: Record<Surface, number>
  /** A feature's type was read from its colors. */
  inferredType: boolean
  /** At least one layer has a texture the rules could read. */
  textured: boolean
}

const kindOf = (color: Color, type: string | undefined): Pick<Feature, "kind" | "inferred"> => {
  if (type === "C") return { kind: "concentration", inferred: false }
  if (type === "D") return { kind: "depletion", inferred: false }
  if (type === "RM") return { kind: "reduced matrix", inferred: false }
  if (type === "MS") return { kind: "masked sand", inferred: false }
  // No type recorded: a light, weak color is a depletion, anything else a concentration.
  return { kind: color.value >= 5 && color.chroma <= 2 ? "depletion" : "concentration", inferred: true }
}

/** The layers from the surface down, with their colors and textures read. Layers with no depth or a bad one are kept. */
export function buildProfile(layers: readonly Layer[]): Profile {
  const sorted = [...layers].sort((a, b) => a.top - b.top)
  let inferredType = false
  const segs = sorted.map((layer, i): Seg => {
    const features = layer.redox.flatMap((c): Feature[] => {
      const color = parseColor(c.notation)
      if (!color) return []
      const kind = kindOf(color, c.type)
      if (kind.inferred) inferredType = true
      return [{ color, percent: c.percent, ...kind }]
    })
    return {
      n: i + 1,
      top: layer.top,
      bottom: layer.bottom,
      thickness: layer.bottom - layer.top,
      matrix: layer.matrix ? parseColor(layer.matrix.notation) : null,
      matrixPercent: layer.matrix?.percent ?? 0,
      features,
      texture: textureOf(layer.texture),
      term: layer.texture ?? "",
    }
  })
  // Organic layers at the top: peat and mucky peat (fibric and hemic) are left out of most depths, and
  // muck as well for the mineral surface. Only a run that starts at the soil surface counts.
  const leading = (organic: (t: Texture) => boolean) => {
    let bottom = 0
    for (const seg of segs) {
      if (seg.top > bottom + 1e-9 || !organic(seg.texture)) break
      bottom = seg.bottom
    }
    return bottom
  }
  return {
    segs,
    offset: {
      soil: 0,
      muckOrMineral: leading((t) => t.organic === "peat" || t.organic === "mucky peat"),
      mineral: leading(isOrganic),
    },
    inferredType,
    textured: segs.some((s) => s.texture.group !== "unknown" || isOrganic(s.texture)),
  }
}

/** Depth from the chosen surface. */
export const depth = (profile: Profile, surface: Surface, d: number): number => d - profile.offset[surface]

/** Does a texture group requirement hold for a layer: yes, no, or maybe (the texture is not recorded)? */
export function fits(group: TextureGroup, texture: Texture): "yes" | "no" | "maybe" {
  if (group === "any") return "yes"
  if (isOrganic(texture)) return "no"
  if (texture.group === "unknown") return "maybe"
  return texture.group === group ? "yes" : "no"
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** The share of a layer, in percent, with chroma 2 or less: the matrix, and any feature that weak. */
export const lowChromaShare = (seg: Seg): number =>
  (seg.matrix && seg.matrix.chroma <= 2 ? seg.matrixPercent : 0) +
  sum(seg.features.filter((f) => f.color.chroma <= 2).map((f) => f.percent))

/** Percent of the layer in redox concentrations that are distinct or prominent against the matrix. */
export const concentrationShare = (seg: Seg): number =>
  seg.matrix
    ? sum(
        seg.features
          .filter((f) => f.kind === "concentration" && contrast(seg.matrix!, f.color) !== "faint")
          .map((f) => f.percent),
      )
    : 0

/** Percent of the layer in redox depletions (value 5 or more, chroma 2 or less). */
export const depletionShare = (seg: Seg): number =>
  sum(seg.features.filter((f) => f.kind === "depletion" && f.color.value >= 5 && f.color.chroma <= 2).map((f) => f.percent))

/**
 * A depleted matrix (glossary p. 38-39): value 5 or more with chroma 1 or less, or value 6 or more with
 * chroma 2 or less, with or without redox; or value 4 or 5 with chroma 2, or value 4 with chroma 1 or
 * less, with 2 percent or more distinct or prominent redox concentrations.
 */
export function isDepleted(seg: Seg): boolean {
  const m = seg.matrix
  if (!m) return false
  if (m.value >= 5 && m.chroma <= 1) return true
  if (m.value >= 6 && m.chroma <= 2) return true
  const wetnessFeatures = concentrationShare(seg) >= 2
  if ((m.value === 4 || m.value === 5) && m.chroma === 2) return wetnessFeatures
  return m.value === 4 && m.chroma <= 1 && wetnessFeatures
}

/** A gleyed matrix that takes up this share of the layer, in percent. */
export const gleyedShare = (seg: Seg): number => (seg.matrix && isGleyed(seg.matrix) ? seg.matrixPercent : 0)

/** A depleted or gleyed matrix with 60 percent or more chroma of 2 or less. */
export const isLowChromaMatrix = (seg: Seg, share: number): boolean =>
  (isDepleted(seg) || gleyedShare(seg) >= share) && lowChromaShare(seg) >= share

/** Runs of layers that satisfy `test`, each layer starting where the one above it ends. */
export function runs(segs: readonly Seg[], test: (seg: Seg) => boolean): Seg[][] {
  const found: Seg[][] = []
  let current: Seg[] = []
  for (const seg of segs) {
    if (!test(seg)) {
      if (current.length) found.push(current)
      current = []
    } else if (current.length && seg.top > current[current.length - 1].bottom + 1e-9) {
      found.push(current)
      current = [seg]
    } else current.push(seg)
  }
  if (current.length) found.push(current)
  return found
}
