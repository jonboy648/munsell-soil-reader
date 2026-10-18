// The official blank pages each region ships, by region. Kept apart from the region data so that
// the form engine, which reads the data, never touches a file.
import { NCNE_SOIL_PAGE } from "./ncne/assets"
import type { RegionId } from "./index"

export const soilPageAssets: Record<RegionId, { pdf: string; image: string }> = { NCNE: NCNE_SOIL_PAGE }
