// Test helper: the text of a PDF's first page as it is drawn, in drawing order, with where each piece
// sits (points from the top left of the page). Used by the engine tests and the browser tests to
// read a made PDF back.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs"

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

export interface DrawnRule {
  x: [number, number]
  /** Points from the top of the page to the top of the rule. */
  top: number
}

type Matrix = [number, number, number, number, number, number]

/** `m` then `n`, as a PDF `cm` concatenates. */
const then = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
]

/**
 * The blanks of a form page: every filled rectangle under 2 points thick and over 10 wide, where the page
 * draws a line to write on. Read from the page's own drawing, with the transforms applied, so a test can
 * check measured positions against the file and not against another measurement.
 */
export async function pdfRules(bytes: Uint8Array, pageNumber = 1): Promise<DrawnRule[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise
  const page = await doc.getPage(pageNumber)
  const height = page.getViewport({ scale: 1 }).height
  const { fnArray, argsArray } = await page.getOperatorList()
  const found: DrawnRule[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  const saved: Matrix[] = []
  fnArray.forEach((fn, i) => {
    const args = argsArray[i]
    if (fn === OPS.save) saved.push(ctm)
    else if (fn === OPS.restore) ctm = saved.pop() ?? ctm
    else if (fn === OPS.transform) ctm = then(args as Matrix, ctm)
    else if (fn === OPS.constructPath && args[0] === OPS.fill) {
      const [x0, y0, x1, y1] = Array.from(args[2] as ArrayLike<number>)
      const [a, b] = [[x0, y0], [x1, y1]].map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]])
      const [left, right] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
      const [top, bottom] = [height - Math.max(a[1], b[1]), height - Math.min(a[1], b[1])]
      if (right - left > 10 && bottom - top < 2) found.push({ x: [left, right], top })
    }
  })
  return found
}
