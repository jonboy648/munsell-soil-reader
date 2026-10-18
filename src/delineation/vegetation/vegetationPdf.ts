// The Vegetation page as a PDF: the official page with each value drawn at its measured position, in
// the form's own text size, and the Vegetation Continued page after it when a stratum has more plants
// than the first page holds. Runs on the device; nothing is uploaded. The drawing list is the one the
// on-screen preview uses.
import type { Form } from "../formFor"
import type { Project, SamplingPoint } from "../model"
import { addCoverNote, type NoteSection } from "../pdf"
import type { Placement } from "../soilPage"
import { vegetationPlacements } from "./vegetationPage"

type Pdf = ArrayBuffer | Uint8Array

/** The cover note's parts for the Vegetation page: what is not ticked on it, and why the prevalence index was applied. */
function vegetationNote(form: Form): NoteSection[] {
  const { unconfirmed, ticked, prevalenceReason } = form.vegetation.cover
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
            items: ticked.map((i) => ({
              title: i.printed,
              lines: [i.remark ? `The user's reason: ${i.remark}` : "No reason was given.", ...(i.state === "yours" ? [] : [`The plants do not satisfy it now: ${i.reason}`])],
            })),
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
  const note = vegetationNote(form)
  if (note.length > 0) {
    await addCoverNote(
      doc,
      "Cover note: hydrophytic vegetation",
      `${project.name}, sampling point ${point.name}. This page goes with the Vegetation page of the Wetland Determination Data Form. It lists what is not ticked there, and why.`,
      note,
    )
  }
  doc.setTitle(`Wetland Determination Data Form, Vegetation: ${project.name}, ${point.name}`)
  doc.setProducer("Munsell Soil Reader")
  doc.setCreator("Munsell Soil Reader")
  return doc.save()
}
