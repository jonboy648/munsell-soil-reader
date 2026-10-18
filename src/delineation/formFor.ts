// The form engine: the values of every printed field of a form, for one sampling point. Pure: no
// UI, no files. The on-screen preview and the PDF both draw from what this returns.
//
// The Soil page is filled so far: its profile description table (`soil.profile.<row>.<column>`, rows
// from 0), a tick for each confirmed hydric soil indicator (`soil.indicator.<id>`), and the answer to
// "Hydric Soil Present?" once the user has confirmed it (`soil.hydric.yes` or `.no`). Every one is in
// `fields`, blank when unknown. Nothing is ticked that the user has not confirmed: the app's suggestions
// are in `suggestions`, and the ones left unconfirmed go on the cover note.
import { regionOf } from "./regions"
import { PROFILE_COLUMNS, type ProfileColumn } from "./regions/types"
import { topToBottom, type LayerColor, type Project, type SamplingPoint } from "./model"
import { indicatorLabel, suggest, type Suggestions } from "./rules/suggest"

export type FieldId = `soil.profile.${number}.${ProfileColumn}` | `soil.indicator.${string}` | `soil.hydric.${"yes" | "no"}`

export interface FormWarning {
  kind: "no-matrix" | "bad-depth" | "overlap" | "gap" | "too-many-rows"
  /** The Layer it is about, counting from 0 down from the surface. */
  layer?: number
  text: string
}

/** The form's yes or no conclusion that follows from the indicators, suggested for the user to confirm. */
export interface Conclusion {
  id: "hydricSoilPresent"
  question: string
  /** What the app suggests: yes when an indicator is confirmed, nothing otherwise. */
  suggested: "yes" | null
  /** Why, in words. */
  because: string
  /** What the user answered. Only a confirmed answer is printed. */
  confirmed?: "yes" | "no"
}

/** The cover note that goes with the Soil page: what is not on the form, and why. */
export interface CoverNote {
  /** Indicators the app suggested that the user has not confirmed: they print blank. */
  unconfirmed: Suggestions["suggestions"]
  /** Indicators the user ticked that the app did not suggest, with their remarks. */
  ticked: Suggestions["ticked"]
}

export interface Form {
  /** Every printed field of the Soil page, as the text printed in it. Blank when unknown. */
  fields: Record<FieldId, string>
  /** The indicators the data satisfies, for the user to confirm, and what the others need. */
  suggestions: Suggestions["suggestions"]
  needs: Suggestions["needs"]
  ticked: Suggestions["ticked"]
  /** The yes or no conclusions of the form. */
  conclusions: Conclusion[]
  cover: CoverNote
  warnings: FormWarning[]
}

export const fieldId = (row: number, column: ProfileColumn): FieldId => `soil.profile.${row}.${column}`
export const indicatorFieldId = (id: string): FieldId => `soil.indicator.${id}`

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

  const fields = {} as Record<FieldId, string>
  for (let r = 0; r < rowCount; r++) {
    for (const column of PROFILE_COLUMNS) fields[fieldId(r, column)] = rows[r]?.[column] ?? ""
  }

  // Indicators: a tick for each one the user confirmed, whether the app suggested it or not.
  const found = suggest(project, point)
  const choices = point.indicators ?? {}
  for (const indicator of region.indicators) fields[indicatorFieldId(indicator.id)] = choices[indicator.id]?.state === "confirmed" ? "X" : ""
  const confirmed = region.indicators.filter((i) => choices[i.id]?.state === "confirmed")
  fields["soil.hydric.yes"] = point.hydricSoilPresent === "yes" ? "X" : ""
  fields["soil.hydric.no"] = point.hydricSoilPresent === "no" ? "X" : ""
  const conclusions: Conclusion[] = [
    {
      id: "hydricSoilPresent",
      question: "Hydric Soil Present?",
      suggested: confirmed.length > 0 ? "yes" : null,
      because:
        confirmed.length > 0
          ? `Yes: ${confirmed.map(indicatorLabel).join(", ")} ${confirmed.length === 1 ? "is" : "are"} confirmed.`
          : "No indicator is confirmed yet.",
      ...(point.hydricSoilPresent ? { confirmed: point.hydricSoilPresent } : {}),
    },
  ]
  return {
    fields,
    suggestions: found.suggestions,
    needs: found.needs,
    ticked: found.ticked,
    conclusions,
    cover: { unconfirmed: found.suggestions.filter((s) => s.decision === "pending"), ticked: found.ticked },
    warnings,
  }
}
