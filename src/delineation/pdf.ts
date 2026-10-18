// The Soil page as a PDF: the official page with each value drawn at its measured position, in the
// form's own text size. Runs on the device; nothing is uploaded. The drawing list is the same one the
// on-screen preview uses.
import type { Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { indicatorLabel } from "./rules/suggest"
import { soilPlacements } from "./soilPage"
import { printable, wrap } from "./text"

/** The cover note's page: letter size, with a margin. */
const NOTE = { width: 612, height: 792, margin: 54, size: 10, line: 13 }

/** The cover note: the indicators the app suggested that are not ticked, and the ticks that are the user's own. */
async function addCoverNote(doc: import("pdf-lib").PDFDocument, project: Project, point: SamplingPoint, form: Form) {
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

  write("Cover note: hydric soil indicators", { bold: true, gap: 2 })
  write(`${project.name}, sampling point ${point.name}. This page goes with the Soil page of the Wetland Determination Data Form. It lists what is not ticked there.`, { gap: 8 })
  if (form.cover.unconfirmed.length > 0) {
    write("Suggested by the app, not confirmed", { bold: true })
    write("These are suggestions from the recorded layers. None is ticked on the Soil page, because none has been confirmed.", { gap: 4 })
    for (const s of form.cover.unconfirmed) {
      write(`${s.code} ${s.name}`, { bold: true })
      for (const line of s.evidence) write(line, { indent: 12 })
      write(`Rule: ${s.rule}`, { indent: 12 })
      write(`Source: ${s.citations.map((c) => `${c.document}, ${c.page}`).join("; ")}`, { indent: 12, gap: 6 })
    }
  }
  if (form.cover.ticked.length > 0) {
    write("Ticked by the user, not suggested by the app", { bold: true, gap: 0 })
    for (const t of form.cover.ticked) write(`${indicatorLabel(t)}${t.remark ? `: ${t.remark}` : ""}`, { indent: 12, gap: 4 })
  }
}

/** `blank` is the official one-page PDF of the region's Soil page. */
export async function soilPagePdf(
  blank: ArrayBuffer | Uint8Array,
  project: Project,
  point: SamplingPoint,
  form: Form,
): Promise<Uint8Array> {
  // Loaded when a PDF is made, not at start-up: the app does not need it to read a color.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.load(blank)
  const page = doc.getPage(0)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const { height } = page.getSize()
  for (const p of soilPlacements(project, form)) {
    page.drawText(p.text, { x: p.x, y: height - p.baseline, size: p.size, font, color: rgb(0, 0, 0) })
  }
  if (form.cover.unconfirmed.length > 0 || form.cover.ticked.length > 0) await addCoverNote(doc, project, point, form)
  doc.setTitle(`Wetland Determination Data Form, Soil: ${project.name}, ${point.name}`)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}
