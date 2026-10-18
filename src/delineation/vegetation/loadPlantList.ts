// Loads a region's plant list when the Vegetation entry first needs it: a chunk of its own, not part
// of what loads at start-up, and cached by the service worker with the rest of the app, so the lookup
// works offline.
import type { RegionId } from "../regions"
import { buildPlantList, type PlantList, type RawPlantList } from "./plantList"

const files: Record<RegionId, () => Promise<{ default: unknown }>> = {
  NCNE: () => import("../regions/ncne/plants.json"),
}

const loaded = new Map<RegionId, Promise<PlantList>>()

export function loadPlantList(region: RegionId): Promise<PlantList> {
  let list = loaded.get(region)
  if (!list) {
    list = files[region]().then((file) => buildPlantList(file.default as RawPlantList))
    loaded.set(region, list)
    list.catch(() => loaded.delete(region)) // a failed load is tried again next time
  }
  return list
}
