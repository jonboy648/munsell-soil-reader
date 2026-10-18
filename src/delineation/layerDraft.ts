// A Layer as it is typed into the form, and back. Everything the user types is text; this turns it
// into a Layer, or says in plain words what is wrong.
import { depthProblem, notationOf, percentProblem, type Layer, type LayerColor } from "./model"

export interface RedoxDraft {
  color: string
  percent: string
}

export interface LayerDraft {
  top: string
  bottom: string
  matrix: string
  matrixPercent: string
  redox: RedoxDraft[]
  remarks: string
}

export const emptyLayerDraft: LayerDraft = { top: "", bottom: "", matrix: "", matrixPercent: "100", redox: [], remarks: "" }

export const draftOfLayer = (layer: Layer): LayerDraft => ({
  top: String(layer.top),
  bottom: String(layer.bottom),
  matrix: layer.matrix?.notation ?? "",
  matrixPercent: String(layer.matrix?.percent ?? 100),
  redox: layer.redox.map((c) => ({ color: c.notation, percent: String(c.percent) })),
  remarks: layer.remarks,
})

type Parsed<T> = { value: T } | { problem: string }

/** A color and its percent. The Reading it came from is kept while its notation is left as it was. */
function colorOf(label: string, text: string, percentText: string, previous?: LayerColor): Parsed<LayerColor> {
  const notation = notationOf(text)
  if (!notation) return { problem: `${label}: type a soil-book color such as 10YR 4/2.` }
  const percent = percentText.trim() === "" ? NaN : Number(percentText)
  const problem = percentProblem(percent)
  if (problem) return { problem: `${label}: ${problem}` }
  return { value: { notation, percent, ...(previous?.notation === notation && previous.reading && { reading: previous.reading }) } }
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
    redox.push(parsed.value)
  }

  return { value: { id: previous?.id ?? crypto.randomUUID(), top, bottom, matrix, redox, remarks: draft.remarks.trim() } }
}
