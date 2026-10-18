// Cuts one page out of an official ENG Form 6116 PDF into its own one-page PDF, for a region
// package (src/delineation/regions/<region>/). The forms are flat PDFs, so the page is all there is.
//
//   node scripts/extract-form-page.mjs <form.pdf> <page number, from 1> <out.pdf>
//
// The page image the preview shows is made from the result with Poppler:
//   pdftoppm -r 144 -png -singlefile <out.pdf> <out-without-extension>
import { readFile, writeFile } from "node:fs/promises"
import { PDFDocument } from "pdf-lib"

const [, , source, pageNumber, out] = process.argv
if (!source || !pageNumber || !out) throw new Error("usage: extract-form-page.mjs <form.pdf> <page> <out.pdf>")

const from = await PDFDocument.load(await readFile(source))
const to = await PDFDocument.create()
const [page] = await to.copyPages(from, [Number(pageNumber) - 1])
to.addPage(page)
await writeFile(out, await to.save())
console.log(`wrote ${out}: page ${pageNumber} of ${from.getPageCount()}`)
