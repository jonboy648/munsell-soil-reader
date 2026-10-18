// The NWI classification of a point, from the US Fish and Wildlife Service's National Wetlands
// Inventory map service: public, keyless, and it answers cross-origin requests. A point query on its
// Wetlands layer returns the wetland polygons that contain the point, each with its Cowardin code.
import { LookupError, type Position } from "./position"

const LAYER = "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query"

/** A plain GET (no headers, so no preflight): the wetland polygons that contain the position. */
export function nwiUrl({ lat, long }: Position): string {
  const query = new URLSearchParams({
    f: "json",
    geometry: `${long},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "ATTRIBUTE,WETLAND_TYPE,ACRES",
    returnGeometry: "false",
  })
  return `${LAYER}?${query}`
}

/** What the map says at a point: the code that goes on the form, and the wetland type in words. */
export interface Nwi {
  code: string
  type: string
}

/** The wetland the map shows at the point, or null where it maps none (NWI maps wetlands only). */
export function parseNwi(response: unknown): Nwi | null {
  const body = response as { features?: { attributes?: { ATTRIBUTE?: unknown; WETLAND_TYPE?: unknown } }[]; error?: unknown } | null
  // ArcGIS reports a failed query as a 200 with an error object, not as an HTTP error.
  if (!body || typeof body !== "object" || body.error || !Array.isArray(body.features)) {
    throw new LookupError("The wetlands service sent an answer this app does not understand.")
  }
  const hits = body.features.flatMap((f) => {
    const { ATTRIBUTE: code, WETLAND_TYPE: type } = f.attributes ?? {}
    return typeof code === "string" && code.trim() ? [{ code: code.trim(), type: typeof type === "string" ? type.trim() : "" }] : []
  })
  if (hits.length === 0) return null
  // Two polygons can overlap at a point; the form line takes both codes.
  const distinct = (values: string[]) => [...new Set(values)]
  return { code: distinct(hits.map((h) => h.code)).join(", "), type: distinct(hits.map((h) => h.type).filter(Boolean)).join(", ") }
}
