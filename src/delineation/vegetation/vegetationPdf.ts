// The Vegetation page as a PDF: the official page with each value drawn at its measured position, in
// the form's own text size, and the Vegetation Continued page after it when a stratum has more plants
// than the first page holds. Runs on the device; nothing is uploaded. The drawing list is the one the
// on-screen preview uses.
import type { Form } from "../formFor"
import type { Project, SamplingPoint } from "../model"
import { addVegetationCoverNote } from "../coverNote"
import type { Placement } from "../soilPage"
import { vegetationPlacements } from "./vegetationPage"

type Pdf = ArrayBuffer | Uint8Array

/** `blank` holds the official Vegetation page and Continued page of the region, each a one-page PDF. */
export async function vegetationPdf(
  blank: { vegetation: Pdf; continued: Pdf },
  project: Project,
  point: SamplingPoint,
  form: Form,
): Promise<Uint8Array> {
  // Loaded when a PDF is made, not at start-up: the app does not need it to read a color.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")
  const doc = await PDFDocument.load(blank.vegetation)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const placements = vegetationPlacements(project, form)

  const draw = (page: ReturnType<typeof doc.getPage>, list: Placement[]) => {
    const { height } = page.getSize()
    for (const p of list) page.drawText(p.text, { x: p.x, y: height - p.baseline, size: p.size, font, color: rgb(0, 0, 0) })
  }
  draw(doc.getPage(0), placements.vegetation)
  if (placements.continued) {
    const [continued] = await doc.copyPages(await PDFDocument.load(blank.continued), [0])
    draw(doc.addPage(continued), placements.continued)
  }
  await addVegetationCoverNote(doc, project, point, form)
  doc.setTitle(`Wetland Determination Data Form, Vegetation: ${project.name}, ${point.name}`)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}
