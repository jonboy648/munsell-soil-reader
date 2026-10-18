// The form engine: the values of every printed field of a form, for one sampling point. Pure: no
// UI, no files. The on-screen preview and the PDF both draw from what this returns.
//
// The Soil page's profile description table is filled from the Layers. Its fields are named
// `soil.profile.<row>.<column>`, rows from 0, and every one is in `fields`, blank when unknown. The
// Vegetation pages are filled from the plants (vegetation/vegetationFields.ts): `veg.<stratum>.<row>.<column>`
// and the stratum's `plotSize` and `total`, `veg.samplingPoint` and `veg.remarks`.
import { regionOf } from "./regions"
import { PROFILE_COLUMNS, type ProfileColumn } from "./regions/types"
import { topToBottom, type LayerColor, type Project, type SamplingPoint } from "./model"
import { vegetationFields, type VegFieldId, type VegWarning } from "./vegetation/vegetationFields"

export type FieldId = `soil.profile.${number}.${ProfileColumn}` | VegFieldId

export interface FormWarning {
  kind: "no-matrix" | "bad-depth" | "overlap" | "gap" | "too-many-rows" | VegWarning["kind"]
  /** The Layer it is about, counting from 0 down from the surface. */
  layer?: number
  text: string
}

export interface Form {
  /** Every printed field of the profile table, as the text printed in it. Blank when unknown. */
  fields: Record<FieldId, string>
  /** Indicators the data satisfies, for the user to confirm. None yet. */
  suggestions: readonly never[]
  /** The yes or no conclusions of the form. None yet. */
  conclusions: readonly never[]
  warnings: FormWarning[]
}

export const fieldId = (row: number, column: ProfileColumn): FieldId => `soil.profile.${row}.${column}`

/** A number as it is written on a form: 20, 2.5, not 20.0. */
const written = (n: number): string => String(Math.round(n * 100) / 100)

type Row = Partial<Record<ProfileColumn, string>>

export function formFor(project: Project, point: SamplingPoint): Form {
  const region = regionOf(project.region)
  const rowCount = region.soil.rowRules.length
  const warnings: FormWarning[] = []
  const rows: Row[] = []

  const layers = topToBottom(point.layers)
  layers.forEach((layer, i) => {
    const [first, ...more] = layer.redox
    const redox = (c: LayerColor | undefined): Row =>
      c ? { redoxColor: c.notation, redoxPercent: written(c.percent) } : {}

    if (layer.bottom <= layer.top) {
      warnings.push({ kind: "bad-depth", layer: i, text: `Layer ${i + 1}: the bottom is not deeper than the top.` })
    }
    if (!layer.matrix) {
      warnings.push({ kind: "no-matrix", layer: i, text: `Layer ${i + 1} (${written(layer.top)}-${written(layer.bottom)} in) has no matrix color.` })
    }
    const previous = layers[i - 1]
    if (previous && layer.top > previous.bottom) {
      warnings.push({ kind: "gap", layer: i, text: `There is a gap between layers ${i} and ${i + 1}.` })
    } else if (previous && layer.top < previous.bottom) {
      warnings.push({ kind: "overlap", layer: i, text: `Layers ${i} and ${i + 1} overlap.` })
    }

    rows.push({
      depth: `${written(layer.top)}-${written(layer.bottom)}`,
      ...(layer.matrix ? { matrixColor: layer.matrix.notation, matrixPercent: written(layer.matrix.percent) } : {}),
      ...redox(first),
      remarks: layer.remarks,
    })
    // More redox features than the row holds go on the rows below it, under the same Layer.
    for (const extra of more) rows.push(redox(extra))
  })
  if (rows.length > rowCount) {
    warnings.push({
      kind: "too-many-rows",
      text: `The profile needs ${rows.length} rows and the form has ${rowCount}. The rest is left off the page.`,
    })
  }

  const vegetation = vegetationFields(project, point)
  const fields = { ...vegetation.fields } as Record<FieldId, string>
  for (let r = 0; r < rowCount; r++) {
    for (const column of PROFILE_COLUMNS) fields[fieldId(r, column)] = rows[r]?.[column] ?? ""
  }
  return { fields, suggestions: [], conclusions: [], warnings: [...warnings, ...vegetation.warnings] }
}
