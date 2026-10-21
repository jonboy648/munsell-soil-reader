// The cover note that goes after a page of the form: what is not on the page, and why. The Soil page's
// holds the hydric soil indicators the app suggested that are not ticked and the ticks that are the user's
// own; the Vegetation page's holds the hydrophytic vegetation indicators in the same way, and why the
// prevalence index was applied where the supplement's order would not apply it.
import type { PDFDocument } from "pdf-lib"
import type { Form } from "./formFor"
import { CONCLUSIONS } from "./determination"
import type { Project, SamplingPoint } from "./model"
import { indicatorLabel } from "./rules/suggest"
import { printable, wrap } from "./text"

/** The cover note's page: letter size, with a margin. */
const NOTE = { width: 612, height: 792, margin: 54, size: 10, line: 13 }

/** One thing a cover note says: a title in bold and the lines under it. */
export interface NoteItem {
  title: string
  lines: string[]
}

/** A part of a cover note: a heading, a sentence about it, and its items. */
export interface NoteSection {
  heading: string
  intro: string
  items: NoteItem[]
}

/** Pending conclusions, retained decisions needing review, and complete human explanations. */
export async function addDeterminationCoverNote(doc: PDFDocument, project: Project, point: SamplingPoint, form: Form) {
  const { pending, conclusions, remarks } = form.determination
  const review = CONCLUSIONS.map((id) => conclusions[id]).filter((c) => c.review)
  const sections: NoteSection[] = []
  if (pending.length) sections.push({
    heading: "Unconfirmed conclusions by page",
    intro: "These conclusions remain blank on the form. Suggestions are not confirmations; missing observations are not No.",
    items: pending.map((c) => ({ title: `${c.page}: ${c.question}`, lines: [c.because] })),
  })
  if (review.length) sections.push({
    heading: "Retained human confirmations to review", intro: "The stored answers have not been changed by the app.",
    items: review.map((c) => ({ title: `${c.page}: ${c.question}`, lines: [c.review, c.because] })),
  })
  if (remarks.length) sections.push({
    heading: "Summary Remarks", intro: "The complete explanations, including any text continuing beyond the page 1 Remarks box.",
    items: [{ title: form.fields["page1.summaryRemarks"], lines: [] }],
  })
  if (sections.length) await addCoverNote(doc, "Cover note: wetland determination", `${project.name}, sampling point ${point.name}.`, sections)
}

/**
 * The cover note that goes after a page of the form: what is not on the page, and why. Pages are added to
 * `doc` as the text needs them.
 */
export async function addCoverNote(doc: PDFDocument, title: string, lead: string, sections: NoteSection[]) {
  const { StandardFonts, rgb } = await import("pdf-lib")
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([NOTE.width, NOTE.height])
  let y = NOTE.height - NOTE.margin
  const room = NOTE.width - 2 * NOTE.margin
  const write = (text: string, options: { bold?: boolean; indent?: number; gap?: number } = {}) => {
    const indent = options.indent ?? 0
    for (const line of wrap(printable(text).text, room - indent, NOTE.size)) {
      if (y < NOTE.margin) {
        page = doc.addPage([NOTE.width, NOTE.height])
        y = NOTE.height - NOTE.margin
      }
      page.drawText(line, { x: NOTE.margin + indent, y, size: NOTE.size, font: options.bold ? bold : font, color: rgb(0, 0, 0) })
      y -= NOTE.line
    }
    y -= options.gap ?? 0
  }

  write(title, { bold: true, gap: 2 })
  write(lead, { gap: 8 })
  for (const section of sections) {
    write(section.heading, { bold: true })
    if (section.intro) write(section.intro, { gap: 4 })
    for (const item of section.items) {
      write(item.title, { bold: true })
      item.lines.forEach((line, i) => write(line, { indent: 12, gap: i === item.lines.length - 1 ? 6 : 0 }))
      if (item.lines.length === 0) y -= 4
    }
  }
}

/** The parts of the Soil page's cover note. */
function soilNote(form: Form): NoteSection[] {
  const { unconfirmed, ticked } = form.hydric.cover
  return [
    ...(unconfirmed.length > 0
      ? [
          {
            heading: "Suggested by the app, not confirmed",
            intro: "These are suggestions from the recorded layers. None is ticked on the Soil page, because none has been confirmed.",
            items: unconfirmed.map((s) => ({
              title: `${s.code} ${s.name}`,
              lines: [...s.evidence, `Rule: ${s.rule}`, `Source: ${s.citations.map((c) => `${c.document}, ${c.page}`).join("; ")}`],
            })),
          },
        ]
      : []),
    ...(ticked.length > 0
      ? [{ heading: "Ticked by the user, not suggested by the app", intro: "", items: ticked.map((t) => ({ title: `${indicatorLabel(t)}${t.remark ? `: ${t.remark}` : ""}`, lines: [] })) }]
      : []),
  ]
}

/** Add the Soil page's cover note to `doc`, when something on the Soil page is not ticked. */
export async function addSoilCoverNote(doc: PDFDocument, project: Project, point: SamplingPoint, form: Form) {
  const sections = soilNote(form)
  if (sections.length === 0) return
  await addCoverNote(
    doc,
    "Cover note: hydric soil indicators",
    `${project.name}, sampling point ${point.name}. This page goes with the Soil page of the Wetland Determination Data Form. It lists what is not ticked there.`,
    sections,
  )
}

/** The cover note's parts for the Vegetation page: what is not ticked on it, and why the prevalence index was applied. */
function vegetationNote(form: Form): NoteSection[] {
  const { unconfirmed, ticked, stale, prevalenceReason } = form.vegetation.cover
  return [
    ...(unconfirmed.length > 0
      ? [
          {
            heading: "Suggested by the app, not confirmed",
            intro: "These are suggestions from the plants recorded. None is ticked on the Vegetation page, because none has been confirmed.",
            items: unconfirmed.map((i) => ({ title: i.printed, lines: [i.reason, `Rule: ${i.rule}`, `Source: ${i.citation}`] })),
          },
        ]
      : []),
    ...(ticked.length > 0
      ? [
          {
            heading: "Ticked by the user",
            intro: "",
            items: ticked.map((i) => ({ title: i.printed, lines: [i.remark ? `The user's reason: ${i.remark}` : "No reason was given."] })),
          },
        ]
      : []),
    ...(stale.length > 0
      ? [
          {
            heading: "Confirmed earlier, no longer satisfied",
            intro: "The user confirmed these, but what is recorded now does not satisfy them, so they are not ticked on the Vegetation page.",
            items: stale.map((i) => ({ title: i.printed, lines: [i.reason, `Rule: ${i.rule}`, `Source: ${i.citation}`] })),
          },
        ]
      : []),
    ...(prevalenceReason
      ? [
          {
            heading: "Prevalence index applied by the user",
            intro: "The supplement applies the prevalence index only where the dominance test fails and hydric soil and wetland hydrology indicators are both present (p. 24). It was applied here because:",
            items: [{ title: prevalenceReason, lines: [] }],
          },
        ]
      : []),
  ]
}


/** Add the Vegetation page's cover note to `doc`, when something on the Vegetation page is not ticked or was applied by the user's choice. */
export async function addVegetationCoverNote(doc: PDFDocument, project: Project, point: SamplingPoint, form: Form) {
  const sections = vegetationNote(form)
  if (sections.length === 0) return
  await addCoverNote(
    doc,
    "Cover note: hydrophytic vegetation",
    `${project.name}, sampling point ${point.name}. This page goes with the Vegetation page of the Wetland Determination Data Form. It lists what is not ticked there, and why.`,
    sections,
  )
}
