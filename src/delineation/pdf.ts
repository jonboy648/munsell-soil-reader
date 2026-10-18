// The Soil page as a PDF: the official page with each value drawn at its measured position, in the
// form's own text size. Runs on the device; nothing is uploaded. The drawing list is the same one the
// on-screen preview uses.
import type { Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { soilPlacements } from "./soilPage"

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
  doc.setTitle(`Wetland Determination Data Form, Soil: ${project.name}, ${point.name}`)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}
