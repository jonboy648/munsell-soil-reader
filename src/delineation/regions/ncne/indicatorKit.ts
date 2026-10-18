// Helpers for the indicator records of the NCNE Soil page: the sources, the three columns' x positions,
// and a constructor. The records are in indicatorsLeft.ts, indicatorsMiddle.ts and indicatorsRight.ts.
import type { Box, Citation, Criteria, Indicator, Need, Scope } from "../types"

export const FI = "NRCS Field Indicators of Hydric Soils in the United States, Version 9.3 (2026)"
export const ERRATA = "NRCS Errata for the Field Indicators of Hydric Soils, Version 9.0, updated February 2026"
export const NCNE = "Northcentral and Northeast Regional Supplement, ERDC/EL TR-12-1, Version 2.0 (2012)"
export const fi = (page: string): Citation => ({ document: FI, page })
export const supplement = (page: string): Citation => ({ document: NCNE, page })

export const LEFT: readonly [number, number] = [38.3, 53.4]
export const MIDDLE: readonly [number, number] = [193.3, 208.4]
export const RIGHT: readonly [number, number] = [386.3, 401.4]
export const box = (x: readonly [number, number], rule: number): Box => ({ x, rule })

export const texture = (text: string): Need => ({ kind: "texture", text })
export const field = (text: string): Need => ({ kind: "field", text })
export const FIELD: Criteria = { kind: "field" }

export const MASKED = field("At least 70 percent of the visible soil particles masked with organic material, seen with a 10x or 15x hand lens.")

interface Entry {
  id: string
  code: string
  name: string
  list: Indicator["list"]
  printed: string
  scope?: Scope
  needs?: readonly Need[]
  criteria: Criteria
  quote: string
  citations: readonly Citation[]
  box: Box
}
export const entry = (e: Entry): Indicator => ({ ...e, needs: e.needs ?? [] })

