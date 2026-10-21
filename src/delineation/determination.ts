// Summary conclusions share the existing page answers. Only the overall determination is new.
// No observation or confirmation is inferred. This module is pure, including its edits to a point.
import type { Form } from "./formFor"
import { emptyHydrology, vegetationOf, type Project, type SamplingPoint } from "./model"
import { regionOf } from "./regions"

export const PARAMETERS = ["vegetation", "soil", "hydrology"] as const
export const CONCLUSIONS = [...PARAMETERS, "wetland"] as const
export type Parameter = (typeof PARAMETERS)[number]
export type ConclusionId = (typeof CONCLUSIONS)[number]
export type Answer = "yes" | "no"

export interface DeterminationChoice {
  answer: Answer
  remark?: string
  /** The evidence and conditions when the human confirmed. Changes flag review, never change the answer. */
  basis: string
}

export interface SummaryConclusion {
  id: ConclusionId
  question: string
  page: string
  suggested: Answer | null
  confirmed: Answer | null
  because: string
  remark: string
  review: string
}

export interface Determination {
  conclusions: Record<ConclusionId, SummaryConclusion>
  pending: SummaryConclusion[]
  remarks: string[]
  basis: string
}

type Evidence = Pick<Form, "vegetation" | "hydric" | "suggestions">

const QUESTIONS: Record<ConclusionId, string> = {
  vegetation: "Hydrophytic Vegetation Present?",
  soil: "Hydric Soil Present?",
  hydrology: "Wetland Hydrology Present?",
  wetland: "Is the Sampled Area within a Wetland?",
}
const PAGES: Record<ConclusionId, string> = {
  vegetation: "Page 2 - Vegetation; page 1 summary",
  soil: "Page 3 - Soil; page 1 summary",
  hydrology: "Page 1 - Hydrology and summary",
  wetland: "Page 1 - Summary of findings",
}
export const answerText = (answer: Answer): string => answer === "yes" ? "Yes" : "No"

/** The evidence that an overall confirmation refers to, excluding that confirmation itself. */
function basisFor(project: Project, point: SamplingPoint): string {
  return JSON.stringify({
    normal: project.header.normalCircumstances,
    disturbed: project.header.disturbed,
    problematic: project.header.problematic,
    layers: point.layers,
    indicators: point.indicators ?? {},
    soil: point.hydricSoilPresent ?? null,
    vegetation: vegetationOf(point),
    hydrology: point.hydrology ?? emptyHydrology,
  })
}

/** Suggestions and confirmed answers for the summary, using the existing page engines' evidence. */
export function determinationFor(project: Project, point: SamplingPoint, evidence: Evidence): Determination {
  const { vegetation, hydric, suggestions } = evidence
  const basis = basisFor(project, point)
  const answers: Record<Parameter, Answer | null> = {
    vegetation: vegetation.conclusion.confirmed ?? null,
    soil: hydric.conclusion.confirmed ?? null,
    hydrology: typeof point.hydrology?.present === "boolean" ? (point.hydrology.present ? "yes" : "no") : null,
  }
  const confirmedPlants = vegetation.indicators.filter((i) => i.ticked && i.id !== "problematic")
  const confirmedSoil = regionOf(project.region).indicators.filter((i) => point.indicators?.[i.id]?.state === "confirmed")
  const hasHydrologyIndicator = regionOf(project.region).hydrology.indicators.some((i) => point.hydrology?.ticked.includes(i.id))
  const hydrology = hasHydrologyIndicator ? suggestions.find((s) => s.id === "hydrology.present") : undefined
  const parameterSuggestions: Record<Parameter, { answer: Answer | null; because: string }> = {
    vegetation: {
      answer: confirmedPlants.length > 0 ? vegetation.conclusion.suggested : null,
      because: confirmedPlants.length > 0
        ? `${confirmedPlants.map((i) => i.printed).join(", ")} confirmed. ${vegetation.conclusion.because}`
        : `No applicable vegetation indicator is confirmed. ${vegetation.conclusion.because}`,
    },
    soil: {
      answer: confirmedSoil.some((i) => i.list === "hydric") ? hydric.conclusion.suggested : null,
      because: hydric.conclusion.because,
    },
    hydrology: {
      answer: hydrology ? (hydrology.answer ? "yes" : "no") : null,
      because: hydrology ? `${hydrology.text} ${hydrology.citation}` : "No hydrology indicator is recorded; absence of a tick is not an observation of absence.",
    },
  }
  const conclusions = {} as Record<ConclusionId, SummaryConclusion>
  for (const id of PARAMETERS) {
    const saved = point.conclusionRemarks?.[id]
    const remark = saved?.answer === answers[id] ? saved.remark.trim() : ""
    const { answer: suggested, because } = parameterSuggestions[id]
    conclusions[id] = {
      id, question: QUESTIONS[id], page: PAGES[id], suggested, because, confirmed: answers[id], remark,
      review: answers[id] !== null && answers[id] !== suggested && !remark
        ? "The retained answer is not supported by the current indicator suggestion. Review it or explain it with a remark."
        : "",
    }
  }

  const exceptions = [
    ...(project.header.normalCircumstances === "no" ? ["normal circumstances are not present"] : []),
    ...PARAMETERS.flatMap((id) => [
      ...(project.header.disturbed[id] === "yes" ? [`${id} is significantly disturbed`] : []),
      ...(project.header.problematic[id] === "yes" ? [`${id} is naturally problematic`] : []),
    ]),
    ...(confirmedSoil.some((i) => i.list === "problematic") ? ["a problematic-soil indicator is confirmed"] : []),
    ...(vegetation.indicators.some((i) => i.id === "problematic" && i.ticked) ? ["problematic vegetation is confirmed"] : []),
  ]
  const missing = PARAMETERS.filter((id) => answers[id] === null)
  let suggested: Answer | null = null
  let because: string
  if (exceptions.length > 0) {
    because = `Human judgment required: ${exceptions.join("; ")}. Explain the alternative procedure in Remarks; the three-parameter rule does not decide this case.`
  } else if (missing.length > 0) {
    because = `Awaiting confirmed ${missing.join(", ")} conclusions. Unknown is not No.`
  } else if (project.header.normalCircumstances !== "yes") {
    because = "Normal circumstances have not been answered. Record them in the project header, or use human judgment with a remark."
  } else {
    suggested = PARAMETERS.every((id) => answers[id] === "yes") ? "yes" : "no"
    because = suggested === "yes"
      ? "All three parameters are confirmed Yes under normal circumstances: hydrophytic vegetation, hydric soil and wetland hydrology."
      : `The three-parameter rule is not met under normal circumstances: ${PARAMETERS.filter((id) => answers[id] === "no").join(", ")} confirmed No.`
  }
  const choice = point.determination
  conclusions.wetland = {
    id: "wetland", question: QUESTIONS.wetland, page: PAGES.wetland, suggested, because,
    confirmed: choice?.answer ?? null,
    remark: choice?.remark?.trim() ?? "",
    review: choice && choice.basis !== basis
      ? "Recorded evidence or conditions changed after confirmation. The human-confirmed wetland answer is retained; review and confirm it again or undo it."
      : "",
  }
  return {
    conclusions,
    pending: CONCLUSIONS.map((id) => conclusions[id]).filter((c) => c.confirmed === null),
    remarks: CONCLUSIONS.flatMap((id) => {
      const c = conclusions[id]
      return c.remark && c.confirmed ? [`${c.question} ${answerText(c.confirmed)}: ${c.remark}`] : []
    }),
    basis,
  }
}

/** Confirm or clear one shared answer. Unsupported answers require the human's explanation. */
export function confirmConclusion(
  point: SamplingPoint, summary: Determination, id: ConclusionId, answer: Answer | null, remark = "",
): SamplingPoint {
  const reason = remark.trim()
  if (answer !== null && answer !== summary.conclusions[id].suggested && !reason) {
    throw new Error("Add a remark in Summary of findings to confirm an override or an answer requiring human judgment.")
  }
  if (id === "wetland") {
    return { ...point, determination: answer ? { answer, basis: summary.basis, ...(reason ? { remark: reason } : {}) } : undefined }
  }
  const { [id]: _removed, ...remarks } = point.conclusionRemarks ?? {}
  const updated = {
    ...point,
    conclusionRemarks: answer && reason ? { ...remarks, [id]: { answer, remark: reason } } : remarks,
  }
  if (id === "vegetation") return { ...updated, vegetation: { ...vegetationOf(point), present: answer ?? undefined } }
  if (id === "soil") return { ...updated, hydricSoilPresent: answer ?? undefined }
  return { ...updated, hydrology: { ...(point.hydrology ?? emptyHydrology), present: answer === null ? null : answer === "yes" } }
}
