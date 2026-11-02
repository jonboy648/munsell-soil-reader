// Test helper: the text of a PDF's first page as it is drawn, in drawing order, with where each piece
// sits (points from the top left of the page). Used by the engine tests and the browser tests to
// read a made PDF back.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

export interface DrawnText {
  text: string
  x: number
  /** Points from the top of the page to the baseline. */
  baseline: number
}

export async function pdfText(bytes: Uint8Array, pageNumber = 1): Promise<DrawnText[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise
  const page = await doc.getPage(pageNumber)
  const height = page.getViewport({ scale: 1 }).height
  const { items } = await page.getTextContent()
  return items.flatMap((item) =>
    "str" in item && item.str.trim() !== ""
      ? [{ text: item.str, x: item.transform[4], baseline: height - item.transform[5] }]
      : [],
  )
}
