// A Layer as it is typed into the form, and back. Everything the user types is text; this turns it
// into a Layer, or says in plain words what is wrong.
import { checkColor } from "./colorCheck"
import { REDOX_LOCATIONS, REDOX_TYPES } from "./codes"
import { depthProblem, percentProblem, type Layer, type LayerColor, type RedoxLocation, type RedoxType } from "./model"
import { parseTextureTerm, textureTerm } from "./texture"

export interface RedoxDraft {
  color: string
  percent: string
  /** A redox type code, or "" while it is not recorded. */
  type: string
  /** A redox location code, or "" while it is not recorded. */
  location: string
}

export interface LayerDraft {
  top: string
  bottom: string
  matrix: string
  matrixPercent: string
  redox: RedoxDraft[]
  /** A texture class or organic term from the pick list, or "" while it is not recorded. */
  textureBase: string
  /** The "mucky" modifier on a mineral texture class. */
  mucky: boolean
  remarks: string
}

export const emptyRedoxDraft: RedoxDraft = { color: "", percent: "", type: "", location: "" }

export const emptyLayerDraft: LayerDraft = {
  top: "",
  bottom: "",
  matrix: "",
  matrixPercent: "100",
  redox: [],
  textureBase: "",
  mucky: false,
  remarks: "",
}

export const draftOfLayer = (layer: Layer): LayerDraft => ({
  top: String(layer.top),
  bottom: String(layer.bottom),
  matrix: layer.matrix?.notation ?? "",
  matrixPercent: String(layer.matrix?.percent ?? 100),
  redox: layer.redox.map((c) => ({ color: c.notation, percent: String(c.percent), type: c.type ?? "", location: c.location ?? "" })),
  textureBase: (layer.texture && parseTextureTerm(layer.texture)?.base) || "",
  mucky: (layer.texture && parseTextureTerm(layer.texture)?.mucky) || false,
  remarks: layer.remarks,
})

type Parsed<T> = { value: T } | { problem: string }

/** A color and its percent. The Reading it came from is kept while its notation is left as it was. */
function colorOf(label: string, text: string, percentText: string, previous?: LayerColor): Parsed<LayerColor> {
  const check = checkColor(text)
  if (check.kind === "bad") return { problem: `${label}: ${check.problem}` }
  const percent = percentText.trim() === "" ? NaN : Number(percentText)
  const problem = percentProblem(percent)
  if (problem) return { problem: `${label}: ${problem}` }
  return {
    value: {
      notation: check.notation,
      percent,
      ...(check.kind === "exact" && { exact: true as const }),
      ...(previous?.notation === check.notation && previous.reading && { reading: previous.reading }),
    },
  }
}

/** The Layer the form describes. `previous` is the Layer being edited, if any, and keeps its id. */
export function layerOfDraft(draft: LayerDraft, previous?: Layer): Parsed<Layer> {
  const top = draft.top.trim() === "" ? NaN : Number(draft.top)
  const bottom = draft.bottom.trim() === "" ? NaN : Number(draft.bottom)
  const depth = depthProblem(top, bottom)
  if (depth) return { problem: depth }

  let matrix: LayerColor | null = null
  if (draft.matrix.trim() !== "") {
    const parsed = colorOf("Matrix", draft.matrix, draft.matrixPercent, previous?.matrix ?? undefined)
    if ("problem" in parsed) return parsed
    matrix = parsed.value
  }

  const redox: LayerColor[] = []
  for (const [i, row] of draft.redox.entries()) {
    if (row.color.trim() === "" && row.percent.trim() === "") continue
    const parsed = colorOf(`Redox ${i + 1}`, row.color, row.percent, previous?.redox[i])
    if ("problem" in parsed) return parsed
    const type = REDOX_TYPES.find((t) => t.code === row.type)?.code as RedoxType | undefined
    const location = REDOX_LOCATIONS.find((l) => l.code === row.location)?.code as RedoxLocation | undefined
    redox.push({ ...parsed.value, ...(type && { type }), ...(location && { location }) })
  }

  const texture = draft.textureBase ? textureTerm(draft.textureBase, draft.mucky) : undefined
  return {
    value: {
      id: previous?.id ?? crypto.randomUUID(),
      top,
      bottom,
      matrix,
      redox,
      remarks: draft.remarks.trim(),
      ...(texture && { texture }),
    },
  }
}
