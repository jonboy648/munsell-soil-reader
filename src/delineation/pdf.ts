// The form as a PDF: the official pages with each value drawn at its measured position, in the form's
// own text size. Runs on the device; nothing is uploaded. The drawing lists are the same ones the
// on-screen previews use.
import type { PDFDocument as Doc, PDFFont, PDFPage } from "pdf-lib"
import { formFor, type Form } from "./formFor"
import type { Project, SamplingPoint } from "./model"
import { page1Placements } from "./page1"
import { regionOf } from "./regions"
import { soilPlacements, type Placement } from "./soilPage"

type Bytes = ArrayBuffer | Uint8Array

// Loaded when a PDF is made, not at start-up: the app does not need it to read a color.
const pdfLib = () => import("pdf-lib")

async function drawPlaced(page: PDFPage, font: PDFFont, placements: Placement[]) {
  const { rgb } = await pdfLib()
  const { height } = page.getSize()
  for (const p of placements) {
    page.drawText(p.text, { x: p.x, y: height - p.baseline, size: p.size, font, color: rgb(0, 0, 0) })
  }
}

function describe(doc: Doc, title: string) {
  doc.setTitle(title)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
}

/** `blank` is the official one-page PDF of the region's Soil page. */
export async function soilPagePdf(blank: Bytes, project: Project, point: SamplingPoint, form: Form): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await pdfLib()
  const doc = await PDFDocument.load(blank)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  await drawPlaced(doc.getPage(0), font, soilPlacements(project, form))
  describe(doc, `Wetland Determination Data Form, Soil: ${project.name}, ${point.name}`)
  return doc.save()
}

/** The official one-page PDFs of the pages a point's form is made of, in the order they print. */
export interface Blanks {
  page1: Bytes
  soil: Bytes
  privacy: Bytes
}

/**
 * The forms of these Sampling points as one PDF, in the order given: for each point, page 1, the Soil
 * page and the Privacy Act page. Each official page is embedded once and shown for every point, so the
 * file does not grow by a whole copy of the form for each.
 */
export async function formsPdf(blanks: Blanks, project: Project, points: readonly SamplingPoint[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await pdfLib()
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const [page1] = await doc.embedPdf(blanks.page1)
  const [soil] = await doc.embedPdf(blanks.soil)
  const [privacy] = await doc.embedPdf(blanks.privacy)
  const { size } = regionOf(project.region).page1

  for (const point of points) {
    const form = formFor(project, point)
    for (const [embedded, placements] of [
      [page1, page1Placements(project, form)],
      [soil, soilPlacements(project, form)],
      [privacy, []],
    ] as const) {
      const page = doc.addPage([size.width, size.height])
      page.drawPage(embedded, { x: 0, y: 0, width: size.width, height: size.height })
      await drawPlaced(page, font, [...placements])
    }
  }
  describe(
    doc,
    `Wetland Determination Data Form: ${project.name}${points.length === 1 ? `, ${points[0].name}` : ""}`,
  )
  return doc.save()
}
