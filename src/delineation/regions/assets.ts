// The official blank pages each region ships, by region. Kept apart from the region data so that
// the form engine, which reads the data, never touches a file.
import { NCNE_PAGES } from "./ncne/assets"
import type { RegionId } from "./index"

export const pageAssets: Record<RegionId, typeof NCNE_PAGES> = { NCNE: NCNE_PAGES }
