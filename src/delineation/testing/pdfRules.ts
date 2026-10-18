// Test helper: the thin horizontal rules a PDF page draws (the form's underlines and box edges), where
// each sits (points from the top left of the page). A region package's measured positions are checked
// against them, so a number mistyped from the measurement shows up as a rule that is not there.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs"

export interface Rule {
  x0: number
  x1: number
  /** Points from the top of the page to the top edge of the rule. */
  top: number
}

export async function pdfRules(bytes: Uint8Array, pageNumber = 1): Promise<Rule[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise
  const page = await doc.getPage(pageNumber)
  const height = page.getViewport({ scale: 1 }).height
  const list = await page.getOperatorList()
  const rules: Rule[] = []
  list.fnArray.forEach((fn, i) => {
    if (fn !== OPS.constructPath) return
    // The path's bounding box is the last argument: minX, minY, maxX, maxY in the page's own y-up space.
    const box = list.argsArray[i][2] as ArrayLike<number>
    const [x0, y0, x1, y1] = [box[0], box[1], box[2], box[3]]
    if (y1 - y0 < 2 && x1 - x0 > 8) rules.push({ x0, x1, top: height - y1 })
  })
  return rules
}
