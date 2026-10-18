// Test helper: the thin filled rectangles a form page draws for its lines to write on, as the PDF
// draws them (points from the top left of the page). The form's lines are rectangles about a point
// thick, so a region package's measured positions can be checked against the page itself.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs"

export interface DrawnRule {
  left: number
  right: number
  /** The top of the rule, from the top of the page. */
  top: number
}

// pdfjs 6 hands a path as one flat array: an op code and then its coordinates.
const MOVE = 0
const LINE = 1
const CURVE = 2
const QUAD = 3

export async function pdfRules(bytes: Uint8Array, pageNumber = 1): Promise<DrawnRule[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise
  const page = await doc.getPage(pageNumber)
  const height = page.getViewport({ scale: 1 }).height
  const { fnArray, argsArray } = await page.getOperatorList()
  const rules: DrawnRule[] = []
  let ctm = [1, 0, 0, 1, 0, 0]
  const saved: number[][] = []
  const apply = (x: number, y: number): [number, number] => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]

  fnArray.forEach((fn, i) => {
    const args = argsArray[i]
    if (fn === OPS.save) saved.push(ctm)
    else if (fn === OPS.restore) ctm = saved.pop() ?? ctm
    else if (fn === OPS.transform) {
      const [a, b, c, d, e, f] = args as number[]
      ctm = [
        ctm[0] * a + ctm[2] * b, ctm[1] * a + ctm[3] * b,
        ctm[0] * c + ctm[2] * d, ctm[1] * c + ctm[3] * d,
        ctm[0] * e + ctm[2] * f + ctm[4], ctm[1] * e + ctm[3] * f + ctm[5],
      ]
    } else if (fn === OPS.constructPath) {
      const [, [data]] = args as [number, [ArrayLike<number>]]
      let at = 0
      let points: [number, number][] = []
      const flush = () => {
        const xs = points.map((p) => p[0])
        const ys = points.map((p) => height - p[1])
        // A thin, wide one: a line to write on, not a box or a border.
        if (points.length >= 4 && Math.max(...ys) - Math.min(...ys) < 2.2 && Math.max(...xs) - Math.min(...xs) > 8) {
          rules.push({ left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys) })
        }
        points = []
      }
      while (at < data.length) {
        const op = data[at++]
        if (op === MOVE) {
          flush()
          points = [apply(data[at], data[at + 1])]
          at += 2
        } else if (op === LINE) {
          points.push(apply(data[at], data[at + 1]))
          at += 2
        } else if (op === CURVE) at += 6
        else if (op === QUAD) at += 4
      }
      flush()
    }
  })
  return rules
}
