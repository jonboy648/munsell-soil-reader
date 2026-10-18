// The form engine: the values of every printed field of a form, for one sampling point. Pure: no
// UI, no files. The on-screen preview and the PDF both draw from what this returns.
//
// The Soil page is filled from the Layers: the Sampling Point box (`soil.samplingPoint`) and the profile
// description table, whose fields are named `soil.profile.<row>.<column>`, rows from 0; every one is in
// `fields`, blank when unknown. The Vegetation pages are filled from the plants
// (vegetation/vegetationFields.ts): `veg.<stratum>.<row>.<column>`, the stratum's `plotSize` and `total`,
// `veg.samplingPoint` and `veg.remarks`. Every value is already text the PDF's font can print.
import { regionOf } from "./regions"
import { PROFILE_COLUMNS, type ProfileColumn, type SoilPage } from "./regions/types"
import { printable, truncate, widthOf, wrap } from "./text"
import { topToBottom, type LayerColor, type Project, type SamplingPoint } from "./model"
import { vegetationFields, type VegFieldId, type VegWarning } from "./vegetation/vegetationFields"

export type FieldId = `soil.profile.${number}.${ProfileColumn}` | "soil.samplingPoint" | VegFieldId

export interface FormWarning {
  kind: "no-matrix" | "bad-depth" | "overlap" | "gap" | "too-many-rows" | "remarks-cut" | "text-changed" | VegWarning["kind"]
  /** The Layer it is about, counting from 0 down from the surface. */
  layer?: number
  text: string
}

export interface Form {
  /** Every printed field, as the text printed in it. Blank when unknown. */
  fields: Record<FieldId, string>
  /** Indicators the data satisfies, for the user to confirm. None yet. */
  suggestions: readonly never[]
  /** The yes or no conclusions of the form. None yet. */
  conclusions: readonly never[]
  warnings: FormWarning[]
}

export const fieldId = (row: number, column: ProfileColumn): FieldId => `soil.profile.${row}.${column}`

/** How wide a column's text may be: the rule less a gap at each end. */
export const columnRoom = (soil: SoilPage, column: ProfileColumn): number => {
  const [left, right] = soil.columns[column]
  return right - left - 2 * soil.inset
}

/** A number as it is written on a form: 20, 2.5, not 20.0. */
const written = (n: number): string => String(Math.round(n * 100) / 100)

type Row = Partial<Record<ProfileColumn, string>>

/** The note on the last printed row when layers were left off, kept within the Remarks column. */
function withNote(existing: string, note: string, room: number, size: number): string {
  if (!existing) return note
  const tail = ` - ${note}`
  return truncate(existing, room - widthOf(tail, size), size) + tail
}

export function formFor(project: Project, point: SamplingPoint): Form {
  const { soil } = regionOf(project.region)
  const rowCount = soil.rowRules.length
  const room = columnRoom(soil, "remarks")
  const warnings: FormWarning[] = []

  const name = printable(point.name)
  if (name.replaced) warnings.push({ kind: "text-changed", text: "The sampling point name has characters the form cannot print; they were replaced." })

  const layers = topToBottom(point.layers)
  const rows: Row[] = []
  let deepest: number | null = null
  let leftOff = 0

  layers.forEach((layer, i) => {
    const redox = (c: LayerColor | undefined): Row =>
      c ? { redoxColor: c.notation, redoxPercent: written(c.percent) } : {}

    if (layer.bottom <= layer.top) {
      warnings.push({ kind: "bad-depth", layer: i, text: `Layer ${i + 1}: the bottom is not deeper than the top.` })
    }
    if (!layer.matrix) {
      warnings.push({ kind: "no-matrix", layer: i, text: `Layer ${i + 1} (${written(layer.top)}-${written(layer.bottom)} in) has no matrix color.` })
    }
    // Against the deepest bottom so far, not just the layer before, so a layer inside another
    // is an overlap and not a gap.
    if (deepest !== null && layer.top > deepest) {
      warnings.push({ kind: "gap", layer: i, text: `There is a gap between layers ${i} and ${i + 1}.` })
    } else if (deepest !== null && layer.top < deepest) {
      warnings.push({ kind: "overlap", layer: i, text: `Layers ${i} and ${i + 1} overlap.` })
    }
    deepest = Math.max(deepest ?? layer.bottom, layer.bottom)

    const remarks = printable(layer.remarks)
    if (remarks.replaced) {
      warnings.push({ kind: "text-changed", layer: i, text: `Layer ${i + 1}: the remarks have characters the form cannot print; they were replaced.` })
    }

    // The layer's rows: its first holds the depth and matrix; more redox colors take the rows below.
    const [first, ...more] = layer.redox
    const block: Row[] = [
      {
        depth: `${written(layer.top)}-${written(layer.bottom)}`,
        ...(layer.matrix ? { matrixColor: layer.matrix.notation, matrixPercent: written(layer.matrix.percent) } : {}),
        ...redox(first),
      },
      ...more.map(redox),
    ]
    // Remarks that do not fit the column go onto the rows below, as many as the layer already has; the
    // last layer may also use the rows below it. What still does not fit is cut, with a warning.
    const lines = wrap(remarks.text, room, soil.fontSize)
    const free = rows.length + block.length >= rowCount ? 0 : rowCount - rows.length - block.length
    const available = block.length + (i === layers.length - 1 ? free : 0)
    if (lines.length > available) {
      lines.length = available
      lines[available - 1] = truncate(`${lines[available - 1]} ...`, room, soil.fontSize)
      warnings.push({ kind: "remarks-cut", layer: i, text: `Layer ${i + 1}: the remarks are longer than the rows they have, so they are cut.` })
    }
    while (block.length < lines.length) block.push({})
    lines.forEach((line, k) => (block[k].remarks = line))

    // A layer is printed whole or not at all; the first one is cut to the page if it must be.
    if (leftOff > 0 || (rows.length + block.length > rowCount && rows.length > 0)) {
      leftOff++
    } else {
      rows.push(...block.slice(0, rowCount - rows.length))
    }
  })

  if (leftOff > 0) {
    const note = `continued: ${leftOff} more layer${leftOff === 1 ? "" : "s"}`
    const last = rows[rows.length - 1]
    last.remarks = withNote(last.remarks ?? "", note, room, soil.fontSize)
    warnings.push({
      kind: "too-many-rows",
      text: `The profile needs more rows than the form has. The last ${leftOff} layer${leftOff === 1 ? " is" : "s are"} left off the page, and the last row says so.`,
    })
  } else if (layers.some((l) => 1 + Math.max(0, l.redox.length - 1) > rowCount)) {
    warnings.push({ kind: "too-many-rows", text: "A layer has more redox colors than the form has rows. The rest are left off the page." })
  }

  const vegetation = vegetationFields(project, point, name.text)
  const fields = { ...vegetation.fields, "soil.samplingPoint": name.text } as Record<FieldId, string>
  for (let r = 0; r < rowCount; r++) {
    for (const column of PROFILE_COLUMNS) fields[fieldId(r, column)] = rows[r]?.[column] ?? ""
  }
  return { fields, suggestions: [], conclusions: [], warnings: [...warnings, ...vegetation.warnings] }
}
