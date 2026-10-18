// The official blank pages of the NCNE form that the app draws on: each a PDF to draw on and, where
// it is previewed, a PNG of the same page. Vite turns each into a file the app ships and caches.
import page1Image from "./page1.png"
import page1Pdf from "./page1.pdf?url"
import privacyPdf from "./privacy-page.pdf?url"
import soilPageImage from "./soil-page.png"
import soilPagePdf from "./soil-page.pdf?url"

export const NCNE_PAGES = {
  page1: { pdf: page1Pdf, image: page1Image },
  soil: { pdf: soilPagePdf, image: soilPageImage },
  /** The Privacy Act page: nothing to fill, so nothing to preview. */
  privacy: { pdf: privacyPdf },
}
