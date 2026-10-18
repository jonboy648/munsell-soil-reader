// The official blank pages of the NCNE form: for each, the PDF the export draws on and an image of
// the same page for the on-screen preview. Vite turns each into a file the app ships and caches.
import page1Image from "./page1.png"
import page1Pdf from "./page1.pdf?url"
import privacyPdf from "./privacy-page.pdf?url"
import soilPageImage from "./soil-page.png"
import soilPagePdf from "./soil-page.pdf?url"

import vegetationContinuedImage from "./vegetation-continued-page.png"
import vegetationContinuedPdf from "./vegetation-continued-page.pdf?url"
import vegetationImage from "./vegetation-page.png"
import vegetationPdf from "./vegetation-page.pdf?url"

export const NCNE_PAGE1 = { pdf: page1Pdf, image: page1Image }
export const NCNE_SOIL_PAGE = { pdf: soilPagePdf, image: soilPageImage }
export const NCNE_VEGETATION_PAGES = {
  vegetation: { pdf: vegetationPdf, image: vegetationImage },
  continued: { pdf: vegetationContinuedPdf, image: vegetationContinuedImage },
}
/** The Privacy Act page: nothing to fill, so nothing to preview. */
export const NCNE_PRIVACY_PAGE = { pdf: privacyPdf }
