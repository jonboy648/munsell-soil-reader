// A page of the form as a PDF: the official page with each value drawn at its measured position, in
// the form's own text size. Runs on the device; nothing is uploaded. The drawing list is the same one
// the on-screen preview uses.
import type { Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { indicatorLabel } from "./rules/suggest"
import { soilPlacements, type Placement } from "./soilPage"
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

/**
 * The cover note that goes after a page of the form: what is not on the page, and why. Pages are added to
 * `doc` as the text needs them.
 */
export async function addCoverNote(doc: import("pdf-lib").PDFDocument, title: string, lead: string, sections: NoteSection[]) {
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

/** The Soil page's cover note: the hydric soil indicators the app suggested that are not ticked, and the ticks that are the user's own. */
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

/** `blank` is the official one-page PDF of the page; `placements` are the values to draw on it, and `after` may add pages. */
export async function drawPage(
  blank: ArrayBuffer | Uint8Array,
  placements: Placement[],
  title: string,
  after?: (doc: import("pdf-lib").PDFDocument) => Promise<void>,
): Promise<Uint8Array> {
  // Loaded when a PDF is made, not at start-up: the app does not need it to read a color.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.load(blank)
  const page = doc.getPage(0)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const { height } = page.getSize()
  for (const p of placements) {
    page.drawText(p.text, { x: p.x, y: height - p.baseline, size: p.size, font, color: rgb(0, 0, 0) })
  }
  await after?.(doc)
  doc.setTitle(title)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}

const title = (page: string, project: Project, point: SamplingPoint) =>
  `Wetland Determination Data Form, ${page}: ${project.name}, ${point.name}`

/** `blank` is the official one-page PDF of the region's Soil page. A cover note follows it when something is not on it. */
export function soilPagePdf(blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) {
  const sections = soilNote(form)
  return drawPage(
    blank,
    soilPlacements(project, form),
    title("Soil", project, point),
    sections.length > 0
      ? (doc) =>
          addCoverNote(
            doc,
            "Cover note: hydric soil indicators",
            `${project.name}, sampling point ${point.name}. This page goes with the Soil page of the Wetland Determination Data Form. It lists what is not ticked there.`,
            sections,
          )
      : undefined,
  )
}

/** `blank` is the official one-page PDF of the region's page 1. */
export const page1Pdf = (blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) =>
  drawPage(blank, page1Placements(project, form), title("Page 1", project, point))
