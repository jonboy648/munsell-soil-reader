// The form engine: the values of every printed field of a form, for one sampling point. Pure: no
// UI, no files. The on-screen preview and the PDF both draw from what this returns.
//
// The Soil page: the Sampling Point box (`soil.samplingPoint`), its profile description table
// (`soil.profile.<row>.<column>`, rows from 0), a tick for each confirmed hydric soil indicator
// (`soil.indicator.<id>`), and the answer to "Hydric Soil Present?" once the user has confirmed it
// (`soil.hydric.yes` or `.no`). Page 1: the header (`page1.<line>`, and `page1.summaryRemarks` for the
// note of a pair) and the Hydrology section (`page1.hydrology.*`). The Vegetation pages are filled from
// the plants (vegetation/vegetationFields.ts): `veg.<stratum>.<row>.<column>`, the stratum's `plotSize`
// and `total`, `veg.samplingPoint` and `veg.remarks`. Every field is in `fields`, blank when unknown,
// and every value is already text the PDF's font can print. Nothing is ticked that the user has not
// confirmed: the app's hydric soil suggestions are in `hydric`, and the ones left unconfirmed go on the
// cover note.
import { PROJECT_FIELDS, POINT_FIELDS, subregionText, writtenDate } from "./headerFields"
import { regionOf } from "./regions"
import {
  PAGE1_MARK_FIELDS,
  PAGE1_TEXT_FIELDS,
  PROFILE_COLUMNS,
  type Page1,
  type Page1Field,
  type ProfileColumn,
  type SoilPage,
} from "./regions/types"
import { hydrologyFor, suggestWetlandHydrology } from "./hydrology"
import { fit, printable, truncate, widthOf, wrap, written } from "./text"
import { pairOf, topToBottom, type LayerColor, type Project, type ProjectHeader, type SamplingPoint, type YesNo } from "./model"
import { indicatorLabel, suggest, type Suggestions } from "./rules/suggest"
import type { HydrophyticVegetation, VegIndicator } from "./vegetation/hydrophytic"
import { vegetationFields, type VegFieldId, type VegWarning } from "./vegetation/vegetationFields"

type Page1Id = `page1.${Page1Field}` | "page1.summaryRemarks"
export type FieldId =
  | `soil.profile.${number}.${ProfileColumn}`
  | "soil.samplingPoint"
  | "soil.restrictive.type"
  | "soil.restrictive.depth"
  | `soil.indicator.${string}`
  | `soil.hydric.${"yes" | "no"}`
  | Page1Id
  | `page1.hydrology.${string}`
  | VegFieldId

export interface FormWarning {
  kind:
    | "no-matrix"
    | "bad-depth"
    | "overlap"
    | "gap"
    | "too-many-rows"
    | "remarks-cut"
    | "text-changed"
    | "field-cut"
    | "hydrology-observation"
    | "hydrology-answer"
    | VegWarning["kind"]
    | "color-not-a-chip"
  /** The Layer it is about, counting from 0 down from the surface. */
  layer?: number
  text: string
}

/** The Soil page's "Hydric Soil Present?", suggested from the indicators the user confirmed. */
export interface HydricConclusion {
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

/** The hydric soil indicators of the Soil page, for one sampling point. */
export interface HydricSoil {
  /** The indicators the layers satisfy, for the user to confirm. */
  suggestions: Suggestions["suggestions"]
  /** The ones not suggested, and what each needs. */
  needs: Suggestions["needs"]
  /** The ones the user ticked that the app did not suggest. */
  ticked: Suggestions["ticked"]
  conclusion: HydricConclusion
  cover: CoverNote
}

/** The cover note's part for the Vegetation page: what is not on the page, and why. */
export interface VegetationCover {
  /** Indicators the app found satisfied that the user has not confirmed: they print blank. */
  unconfirmed: VegIndicator[]
  /** Indicators the user ticked that the arithmetic does not satisfy (morphological adaptations, problematic vegetation), with their remarks. */
  ticked: VegIndicator[]
  /** Why the prevalence index was applied where the supplement's order would not apply it. Empty when it was not. */
  prevalenceReason: string
}

/** What the Vegetation page's worksheets and indicators say for one sampling point. */
export interface VegetationForm extends HydrophyticVegetation {
  cover: VegetationCover
}

export interface Form {
  /** Every printed field, as the text printed in it. Blank when unknown. */
  fields: Record<FieldId, string>
  /** What the recorded data suggests for the Hydrology section, with the rule it used, for the user to confirm. */
  suggestions: readonly Suggestion[]
  /** The Hydrology answers the user has confirmed. */
  conclusions: readonly Conclusion[]
  /** The hydric soil indicators of the Soil page: what the layers satisfy, and what the user decided. */
  hydric: HydricSoil
  /** The Vegetation page's dominance test, prevalence index and hydrophytic vegetation indicators. */
  vegetation: VegetationForm
  warnings: FormWarning[]
}

/** A suggested answer, shown with the rule behind it. It is not printed until the user confirms it. */
export interface Suggestion {
  id: "hydrology.present"
  answer: boolean
  text: string
  citation: string
}

/** A yes or no answer the user confirmed. */
export interface Conclusion {
  id: "hydrology.present"
  answer: boolean
}

export const fieldId = (row: number, column: ProfileColumn): FieldId => `soil.profile.${row}.${column}`
export const indicatorFieldId = (id: string): FieldId => `soil.indicator.${id}`

/** How wide a column's text may be: the rule less a gap at each end. */
export const columnRoom = (soil: SoilPage, column: ProfileColumn): number => {
  const [left, right] = soil.columns[column]
  return right - left - 2 * soil.inset
}

/** How wide a line of page 1 takes text: the rule less a gap at each end. */
export const ruleRoom = (page1: Page1, field: Page1Field): number => {
  const { left, right } = page1.fields[field]
  return right - left - 2 * page1.inset
}

const FLAG = { yes: "Y", no: "N", "": "" } as const satisfies Record<YesNo, string>

/** Page 1's header as printed: the Project's lines, the Sampling point's, the Y, N and tick blanks. */
function page1Fields(project: Project, point: SamplingPoint, warnings: FormWarning[]): Record<Page1Id, string> {
  const { page1 } = regionOf(project.region)
  const header: ProjectHeader = project.header
  const out = {} as Record<Page1Id, string>
  for (const field of [...PAGE1_TEXT_FIELDS, ...PAGE1_MARK_FIELDS]) out[`page1.${field}`] = ""

  const put = (field: (typeof PAGE1_TEXT_FIELDS)[number], label: string, value: string) => {
    const { text, replaced } = printable(value)
    if (replaced) warnings.push({ kind: "text-changed", text: `${label}: the text has characters the form cannot print; they were replaced.` })
    const shown = fit(text, ruleRoom(page1, field), page1.fontSize).text
    if (shown !== text) warnings.push({ kind: "field-cut", text: `${label} is too long for its line on the form, so it is cut there.` })
    out[`page1.${field}`] = shown
  }
  for (const { key, field, label } of PROJECT_FIELDS) {
    put(field, label, key === "date" ? writtenDate(header.date) : String(header[key]))
  }
  put("subregion", "Subregion", subregionText(project.subregion))
  for (const { key, field, label } of POINT_FIELDS) put(field, label, String(point[key]))

  if (header.normalCircumstances === "yes") out["page1.normalYes"] = "X"
  if (header.normalCircumstances === "no") out["page1.normalNo"] = "X"
  out["page1.disturbedVegetation"] = FLAG[header.disturbed.vegetation]
  out["page1.disturbedSoil"] = FLAG[header.disturbed.soil]
  out["page1.disturbedHydrology"] = FLAG[header.disturbed.hydrology]
  out["page1.problematicVegetation"] = FLAG[header.problematic.vegetation]
  out["page1.problematicSoil"] = FLAG[header.problematic.soil]
  out["page1.problematicHydrology"] = FLAG[header.problematic.hydrology]

  // The Summary Remarks box starts with the pair, so both forms of a pair say so.
  const pair = pairOf(project, point)
  if (pair) {
    const [mine, theirs] = pair.role === "wetland" ? ["Wetland", "upland"] : ["Upland", "wetland"]
    out["page1.summaryRemarks"] = printable(`${mine} point, paired with the ${theirs} point ${pair.other.name}.`).text
  } else {
    out["page1.summaryRemarks"] = ""
  }
  return out
}

type Row = Partial<Record<ProfileColumn, string>>

/** The note on the last printed row when layers were left off, kept within the Remarks column. */
function withNote(existing: string, note: string, room: number, size: number): string {
  if (!existing) return note
  const tail = ` - ${note}`
  return truncate(existing, room - widthOf(tail, size), size) + tail
}

export function formFor(project: Project, point: SamplingPoint): Form {
  const region = regionOf(project.region)
  const { soil } = region
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
      c ? { redoxColor: c.notation, redoxPercent: written(c.percent), redoxType: c.type ?? "", redoxLoc: c.location ?? "" } : {}

    // A color typed in that the soil book does not print is printed as typed, with a note.
    for (const [name, color] of [["matrix", layer.matrix], ...layer.redox.map((c, k) => [`redox ${k + 1}`, c] as const)] as const) {
      if (color?.exact) {
        warnings.push({ kind: "color-not-a-chip", layer: i, text: `Layer ${i + 1}: the ${name} color ${color.notation} is not a Chip in the soil book. It is printed as entered.` })
      }
    }

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
        ...(layer.texture ? { texture: layer.texture } : {}),
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

  // Whether the sampling point has the hydric soil and wetland hydrology indicators that the prevalence index assumes.
  const hydricSoil = region.indicators.some((i) => i.id !== "other" && point.indicators?.[i.id]?.state === "confirmed")
  const hydrologyMet = suggestWetlandHydrology(region, point.hydrology?.ticked ?? []).answer
  const vegetation = vegetationFields(project, point, name.text, { hydricSoil, hydrology: hydrologyMet })
  const restrictive = point.restrictive
  const restrictiveType = printable(restrictive?.type ?? "")
  if (restrictiveType.replaced) {
    warnings.push({ kind: "text-changed", text: "The restrictive layer type has characters the form cannot print; they were replaced." })
  }
  const fields = {
    ...vegetation.fields,
    ...page1Fields(project, point, warnings),
    "soil.samplingPoint": name.text,
    "soil.restrictive.type": restrictiveType.text,
    "soil.restrictive.depth": restrictive?.depth == null ? "" : written(restrictive.depth),
  } as Record<FieldId, string>
  for (let r = 0; r < rowCount; r++) {
    for (const column of PROFILE_COLUMNS) fields[fieldId(r, column)] = rows[r]?.[column] ?? ""
  }

  // Hydric soil indicators: a tick for each one the user confirmed, whether the app suggested it or not.
  const found = suggest(project, point)
  const choices = point.indicators ?? {}
  for (const indicator of region.indicators) fields[indicatorFieldId(indicator.id)] = choices[indicator.id]?.state === "confirmed" ? "X" : ""
  const confirmed = region.indicators.filter((i) => choices[i.id]?.state === "confirmed")
  for (const t of found.ticked) {
    if (printable(t.remark).replaced) {
      warnings.push({ kind: "text-changed", text: `The remark on ${indicatorLabel(t)} has characters the form cannot print; they were replaced on the cover note.` })
    }
  }
  fields["soil.hydric.yes"] = point.hydricSoilPresent === "yes" ? "X" : ""
  fields["soil.hydric.no"] = point.hydricSoilPresent === "no" ? "X" : ""
  const hydric: HydricSoil = {
    suggestions: found.suggestions,
    needs: found.needs,
    ticked: found.ticked,
    conclusion: {
      id: "hydricSoilPresent",
      question: "Hydric Soil Present?",
      suggested: confirmed.length > 0 ? "yes" : null,
      because:
        confirmed.length > 0
          ? `Yes: ${confirmed.map(indicatorLabel).join(", ")} ${confirmed.length === 1 ? "is" : "are"} confirmed.`
          : "No indicator is confirmed yet.",
      ...(point.hydricSoilPresent ? { confirmed: point.hydricSoilPresent } : {}),
    },
    cover: { unconfirmed: found.suggestions.filter((s) => s.decision === "pending"), ticked: found.ticked },
  }

  const hydrology = hydrologyFor(regionOf(project.region), point.hydrology)
  Object.assign(fields, hydrology.fields)
  warnings.push(...hydrology.warnings, ...vegetation.warnings)
  const present = point.hydrology?.present
  return {
    fields,
    suggestions: hydrology.suggestion
      ? [{ id: "hydrology.present", answer: hydrology.suggestion.answer, text: hydrology.suggestion.text, citation: hydrology.suggestion.citation }]
      : [],
    conclusions: typeof present === "boolean" ? [{ id: "hydrology.present", answer: present }] : [],
    hydric,
    vegetation: {
      ...vegetation.analysis,
      cover: {
        unconfirmed: vegetation.analysis.indicators.filter((i) => i.state === "satisfied" && i.decision === "pending"),
        ticked: vegetation.analysis.indicators.filter((i) => i.decision === "confirmed" && i.state !== "satisfied"),
        prevalenceReason: (point.vegetation?.prevalenceReason ?? "").trim(),
      },
    },
    warnings,
  }
}
