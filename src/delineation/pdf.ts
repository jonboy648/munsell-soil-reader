// A page of the form as a PDF: the official page with each value drawn at its measured position, in
// the form's own text size. Runs on the device; nothing is uploaded. The drawing list is the same one
// the on-screen preview uses.
import type { Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { soilPlacements, type Placement } from "./soilPage"

/** `blank` is the official one-page PDF of the page; `placements` are the values to draw on it. */
export async function drawPage(blank: ArrayBuffer | Uint8Array, placements: Placement[], title: string): Promise<Uint8Array> {
  // Loaded when a PDF is made, not at start-up: the app does not need it to read a color.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.load(blank)
  const page = doc.getPage(0)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const { height } = page.getSize()
  for (const p of placements) {
    page.drawText(p.text, { x: p.x, y: height - p.baseline, size: p.size, font, color: rgb(0, 0, 0) })
  }
  doc.setTitle(title)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}

const title = (page: string, project: Project, point: SamplingPoint) =>
  `Wetland Determination Data Form, ${page}: ${project.name}, ${point.name}`

/** `blank` is the official one-page PDF of the region's Soil page. */
export const soilPagePdf = (blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) =>
  drawPage(blank, soilPlacements(project, form), title("Soil", project, point))

/** `blank` is the official one-page PDF of the region's page 1. */
export const page1Pdf = (blank: ArrayBuffer | Uint8Array, project: Project, point: SamplingPoint, form: Form) =>
  drawPage(blank, page1Placements(project, form), title("Page 1", project, point))
