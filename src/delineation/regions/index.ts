import type { Region } from "./types"
import { NCNE } from "./ncne"

export type RegionId = Region["id"]

export const REGIONS: readonly Region[] = [NCNE]

export const regionOf = (id: RegionId): Region => REGIONS.find((r) => r.id === id) ?? NCNE
