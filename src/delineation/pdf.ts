// A page of the form as a PDF: the official page with each value drawn at its measured position, in
// the form's own text size. Runs on the device; nothing is uploaded. The drawing list is the same one
// the on-screen preview uses. Also the forms of a whole Project as one PDF.
import { addDeterminationCoverNote, addSoilCoverNote, addVegetationCoverNote } from "./coverNote"
import { formFor, type Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { regionOf } from "./regions"
import { soilPlacements, type Placement } from "./soilPage"
import { vegetationPlacements } from "./vegetation/vegetationPage"

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
  drawPage(blank, soilPlacements(project, form), title("Soil", project, point), (doc) => addSoilCoverNote(doc, project, point, form, true))

/** `blank` is the official one-page PDF of the region's page 1. */
export const page1Pdf = (blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) =>
  drawPage(blank, page1Placements(project, form), title("Page 1", project, point), (doc) => addDeterminationCoverNote(doc, project, point, form))

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
 * Vegetation Continued page when a stratum has more plants than the Vegetation page holds (and the
 * vegetation cover note after it, when something is not ticked on the Vegetation page), then the Privacy
 * Act page once, at the end. That is the official form's own order, with the cover notes beside the pages they explain. Each official page is embedded once and shown for every point, so the file does not grow
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
    await addSoilCoverNote(doc, project, point, form)
    if (veg.continued) addPage(continued, veg.continued)
    await addVegetationCoverNote(doc, project, point, form)
    await addDeterminationCoverNote(doc, project, point, form)
  }
  addPage(privacy, [])
  doc.setTitle(`Wetland Determination Data Form: ${project.name}${points.length === 1 ? `, ${points[0].name}` : ""}`)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}
