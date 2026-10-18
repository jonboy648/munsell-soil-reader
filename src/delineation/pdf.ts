// A page of the form as a PDF: the official page with each value drawn at its measured position, in
// the form's own text size. Runs on the device; nothing is uploaded. The drawing list is the same one
// the on-screen preview uses. Also the forms of a whole Project as one PDF.
import { formFor, type Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { regionOf } from "./regions"
import { indicatorLabel } from "./rules/suggest"
import { soilPlacements, type Placement } from "./soilPage"
import { printable, wrap } from "./text"
import { vegetationPlacements } from "./vegetation/vegetationPage"

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
  if (form.hydric.cover.unconfirmed.length > 0) {
    write("Suggested by the app, not confirmed", { bold: true })
    write("These are suggestions from the recorded layers. None is ticked on the Soil page, because none has been confirmed.", { gap: 4 })
    for (const s of form.hydric.cover.unconfirmed) {
      write(`${s.code} ${s.name}`, { bold: true })
      for (const line of s.evidence) write(line, { indent: 12 })
      write(`Rule: ${s.rule}`, { indent: 12 })
      write(`Source: ${s.citations.map((c) => `${c.document}, ${c.page}`).join("; ")}`, { indent: 12, gap: 6 })
    }
  }
  if (form.hydric.cover.ticked.length > 0) {
    write("Ticked by the user, not suggested by the app", { bold: true, gap: 0 })
    for (const t of form.hydric.cover.ticked) write(`${indicatorLabel(t)}${t.remark ? `: ${t.remark}` : ""}`, { indent: 12, gap: 4 })
  }
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
export const soilPagePdf = (blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) =>
  drawPage(
    blank,
    soilPlacements(project, form),
    title("Soil", project, point),
    form.hydric.cover.unconfirmed.length > 0 || form.hydric.cover.ticked.length > 0 ? (doc) => addCoverNote(doc, project, point, form) : undefined,
  )

/** `blank` is the official one-page PDF of the region's page 1. */
export const page1Pdf = (blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) =>
  drawPage(blank, page1Placements(project, form), title("Page 1", project, point))

/** The official one-page PDFs of the pages a form is made of. */
export interface Blanks {
  page1: ArrayBuffer | Uint8Array
  vegetation: ArrayBuffer | Uint8Array
  soil: ArrayBuffer | Uint8Array
  /** The Vegetation Continued page: used for a point only when a stratum has more plants than the Vegetation page holds. */
  continued: ArrayBuffer | Uint8Array
  privacy: ArrayBuffer | Uint8Array
}

/**
 * The forms of these Sampling points as one PDF, in the order given: for each point, page 1, the Vegetation
 * page and the Soil page (and the cover note after it, when something is not ticked there), then the
 * Vegetation Continued page when a stratum has more plants than the Vegetation page holds, then the Privacy
 * Act page once, at the end. That is the official form's own order, with the cover note beside the Soil page. Each official page is embedded once and shown for every point, so the file does not grow
 * by a whole copy of the form for each.
 */
export async function formsPdf(blanks: Blanks, project: Project, points: readonly SamplingPoint[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const [page1] = await doc.embedPdf(blanks.page1)
  const [vegetation] = await doc.embedPdf(blanks.vegetation)
  const [soil] = await doc.embedPdf(blanks.soil)
  const [continued] = await doc.embedPdf(blanks.continued)
  const [privacy] = await doc.embedPdf(blanks.privacy)
  const { size } = regionOf(project.region).page1

  const addPage = (embedded: typeof page1, placements: readonly Placement[]) => {
    const page = doc.addPage([size.width, size.height])
    page.drawPage(embedded, { x: 0, y: 0, width: size.width, height: size.height })
    for (const p of placements) page.drawText(p.text, { x: p.x, y: size.height - p.baseline, size: p.size, font, color: rgb(0, 0, 0) })
  }
  for (const point of points) {
    const form = formFor(project, point)
    const veg = vegetationPlacements(project, form)
    addPage(page1, page1Placements(project, form))
    addPage(vegetation, veg.vegetation)
    addPage(soil, soilPlacements(project, form))
    if (form.hydric.cover.unconfirmed.length > 0 || form.hydric.cover.ticked.length > 0) await addCoverNote(doc, project, point, form)
    if (veg.continued) addPage(continued, veg.continued)
  }
  addPage(privacy, [])
  doc.setTitle(`Wetland Determination Data Form: ${project.name}${points.length === 1 ? `, ${points[0].name}` : ""}`)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}
