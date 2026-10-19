// The soil map unit of a point, from the USDA NRCS Soil Data Access web service: public and keyless.
//
// The request and response shapes here come from the service's own documentation, not from a live
// call. NOT YET RECORDED LIVE: the host could not be reached from the machine this was written on, so
// the fixture is named `sda-hit.from-docs.json` and whether the service answers a browser on
// soil.joncackler.com (CORS) is unconfirmed. A failed call degrades to the "lookup unavailable" note.
//   Web service help: https://sdmdataaccess.sc.egov.usda.gov/webservicehelp.aspx
//     the Tabular REST endpoint is POST https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest with a
//     JSON body of `query` (SQL) and `format`; with "JSON+COLUMNNAME" the first row returned holds the
//     column names and the data starts on the second row.
//   Advanced queries: https://sdmdataaccess.sc.egov.usda.gov/documents/AdvancedQueries.html
//     SDA_Get_Mukey_from_intersection_with_WktWgs84 takes a WKT geometry in WGS84, longitude first.
import { LookupError, type Position } from "./position"

export const SDA_URL = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest"

/** The POST body: the name of the map unit that contains the position. */
export function sdaBody({ lat, long }: Position): string {
  return JSON.stringify({
    query:
      "SELECT mu.muname FROM mapunit AS mu WHERE mu.mukey IN " +
      `(SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point (${long} ${lat})'))`,
    format: "JSON+COLUMNNAME",
  })
}

/** The Soil Map Unit Name at the point, or null where no map unit is mapped. */
export function parseSda(response: unknown): string | null {
  // No rows comes back as nothing at all or as a table with only its header; both mean no map unit.
  if (response === null || response === undefined || response === "") return null
  const table = (response as { Table?: unknown })?.Table
  if (table === undefined && typeof response === "object" && Object.keys(response as object).length === 0) return null
  if (!Array.isArray(table) || !table.every(Array.isArray)) {
    throw new LookupError("The soil survey service sent an answer this app does not understand.")
  }
  const [header, first] = table as unknown[][]
  const column = header?.indexOf("muname") ?? -1
  if (first === undefined) return null
  const name = column >= 0 ? first[column] : undefined
  if (typeof name !== "string") throw new LookupError("The soil survey service sent an answer this app does not understand.")
  return name.trim() || null
}
