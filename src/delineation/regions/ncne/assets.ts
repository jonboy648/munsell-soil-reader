// The official blank Soil page of the NCNE form: the PDF the export draws on, and an image of the
// same page for the on-screen preview. Vite turns each into a file the app ships and caches.
import soilPageImage from "./soil-page.png"
import soilPagePdf from "./soil-page.pdf?url"

export const NCNE_SOIL_PAGE = { pdf: soilPagePdf, image: soilPageImage }
