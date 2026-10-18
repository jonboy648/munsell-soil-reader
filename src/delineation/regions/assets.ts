// The official blank pages each region ships, by region. Kept apart from the region data so that
// the form engine, which reads the data, never touches a file.
import { NCNE_PAGE1, NCNE_PRIVACY_PAGE, NCNE_SOIL_PAGE } from "./ncne/assets"
import type { RegionId } from "./index"

type PageAssets = { pdf: string; image: string }

/** Page 1: the header, the summary of findings and the Hydrology section. */
export const page1Assets: Record<RegionId, PageAssets> = { NCNE: NCNE_PAGE1 }
export const soilPageAssets: Record<RegionId, PageAssets> = { NCNE: NCNE_SOIL_PAGE }
/** The Privacy Act page, which has nothing to fill and so no image. */
export const privacyPageAssets: Record<RegionId, { pdf: string }> = { NCNE: NCNE_PRIVACY_PAGE }
