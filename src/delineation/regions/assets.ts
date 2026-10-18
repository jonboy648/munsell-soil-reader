// The official blank pages each region ships, by region. Kept apart from the region data so that
// the form engine, which reads the data, never touches a file.
import { NCNE_PAGE1, NCNE_SOIL_PAGE, NCNE_VEGETATION_PAGES } from "./ncne/assets"
import type { RegionId } from "./index"

type PageAssets = { pdf: string; image: string }

/** Page 1: the header, the summary of findings and the Hydrology section. */
export const page1Assets: Record<RegionId, PageAssets> = { NCNE: NCNE_PAGE1 }
export const soilPageAssets: Record<RegionId, PageAssets> = { NCNE: NCNE_SOIL_PAGE }
/** Pages 2 and 4: the Vegetation page, and the Vegetation Continued page. */
export const vegetationPageAssets: Record<RegionId, { vegetation: PageAssets; continued: PageAssets }> = { NCNE: NCNE_VEGETATION_PAGES }
