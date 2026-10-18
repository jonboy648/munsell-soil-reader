// The look-ups by location: each service's response parsed from a recorded fixture of its real shape,
// the request each one is sent, and how an answer is written into a Sampling point without losing
// what the user typed.
//   nwi-hit.json, nwi-none.json   recorded live on 2026-10-18 from the FWS Wetlands MapServer (a point
//                                 inside a PEM1A polygon in central Iowa, and a point with none).
//   sda-hit.from-docs.json        SHAPE FROM DOCS, NOT YET RECORDED LIVE (see sda.ts).
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { newPoint, type SamplingPoint } from "../model"
import { describeLookups, lookUp, withLookups, type Lookups } from "./index"
import { nwiUrl, parseNwi } from "./nwi"
import { typedPosition, written } from "./position"
import { parseSda, sdaBody } from "./sda"

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"))
const WHERE = { lat: 41.5, long: -93.6 }

describe("NWI", () => {
  test("asks the Wetlands layer for the polygons at the point, longitude first, as a plain GET", () => {
    const url = new URL(nwiUrl(WHERE))
    expect(url.origin + url.pathname).toBe("https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query")
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      f: "json",
      geometry: "-93.6,41.5",
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      returnGeometry: "false",
    })
  })

  test("reads the Cowardin code and the wetland type from a recorded hit", () => {
    expect(parseNwi(fixture("nwi-hit.json"))).toEqual({ code: "PEM1A", type: "Freshwater Emergent Wetland" })
  })

  test("a point with no wetland polygon is none, not an error", () => {
    expect(parseNwi(fixture("nwi-none.json"))).toBeNull()
  })

  test("two overlapping polygons give both codes, once each", () => {
    const attributes = (ATTRIBUTE: string, WETLAND_TYPE: string) => ({ attributes: { ATTRIBUTE, WETLAND_TYPE } })
    expect(parseNwi({ features: [attributes("PEM1A", "Freshwater Emergent Wetland"), attributes("PFO1A", "Freshwater Forested/Shrub Wetland"), attributes("PEM1A", "Freshwater Emergent Wetland")] })).toEqual({
      code: "PEM1A, PFO1A",
      type: "Freshwater Emergent Wetland, Freshwater Forested/Shrub Wetland",
    })
  })

  test("an error object (ArcGIS sends those with a 200) or a page that is not a feature list is refused", () => {
    expect(() => parseNwi({ error: { code: 400, message: "Unable to complete operation." } })).toThrow()
    expect(() => parseNwi({})).toThrow()
    expect(() => parseNwi(null)).toThrow()
  })
})

describe("Soil Data Access", () => {
  test("posts a JSON body: the map unit name at the point (longitude first) in the JSON+COLUMNNAME format", () => {
    const body = JSON.parse(sdaBody(WHERE))
    expect(body.format).toBe("JSON+COLUMNNAME")
    expect(body.query).toContain("SDA_Get_Mukey_from_intersection_with_WktWgs84('point (-93.6 41.5)')")
    expect(body.query).toContain("mu.muname")
  })

  test("reads the map unit name from the second row, under the column names of the first (shape from docs)", () => {
    expect(parseSda(fixture("sda-hit.from-docs.json"))).toBe("Clarion loam, 2 to 5 percent slopes")
  })

  test("finds the column by its name, not its place", () => {
    expect(parseSda({ Table: [["mukey", "muname"], ["123", "Webster clay loam"]] })).toBe("Webster clay loam")
  })

  test("no rows is none, whether the service sends a header-only table, an empty object or nothing", () => {
    expect(parseSda({ Table: [["muname"]] })).toBeNull()
    expect(parseSda({})).toBeNull()
    expect(parseSda(null)).toBeNull()
  })

  test("an answer that is not a table with a muname column is refused", () => {
    expect(() => parseSda({ Table: "x" })).toThrow()
    expect(() => parseSda({ Table: [["mukey"], ["123"]] })).toThrow()
    expect(() => parseSda({ ServiceException: "bad query" })).toThrow()
  })
})

describe("asking both services", () => {
  const answer = (body: string, ok = true): Promise<Response> => Promise.resolve(new Response(body, { status: ok ? 200 : 500 }))
  const text = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

  test("fills both from their answers, sending the position only to those two hosts", async () => {
    const asked: { url: string; method: string }[] = []
    const lookups = await lookUp(WHERE, (url, init) => {
      asked.push({ url: String(url), method: init?.method ?? "GET" })
      return answer(String(url).includes("wetlandsmapservice") ? text("nwi-hit.json") : text("sda-hit.from-docs.json"))
    })
    expect(lookups).toEqual({
      soilMapUnit: { state: "found", value: "Clarion loam, 2 to 5 percent slopes" },
      nwi: { state: "found", value: "PEM1A", detail: "Freshwater Emergent Wetland" },
    })
    expect(asked.map((a) => new URL(a.url).host).sort()).toEqual(["fwspublicservices.wim.usgs.gov", "sdmdataaccess.sc.egov.usda.gov"])
    expect(asked.find((a) => a.url.includes("sdmdataaccess"))?.method).toBe("POST")
  })

  test("one service failing leaves the other's answer alone", async () => {
    const lookups = await lookUp(WHERE, (url) => (String(url).includes("wetlandsmapservice") ? answer(text("nwi-hit.json")) : Promise.reject(new TypeError("Failed to fetch"))))
    expect(lookups.nwi.state).toBe("found")
    expect(lookups.soilMapUnit).toEqual({ state: "unavailable" })
  })

  test("an HTTP error or an answer in the wrong shape is unavailable, not a thrown error", async () => {
    expect(await lookUp(WHERE, () => answer("down", false))).toEqual({ soilMapUnit: { state: "unavailable" }, nwi: { state: "unavailable" } })
    expect(await lookUp(WHERE, () => answer("<html>not json</html>"))).toEqual({ soilMapUnit: { state: "unavailable" }, nwi: { state: "unavailable" } })
  })
})

describe("writing the answers into a point", () => {
  const found = (value: string): Lookups["nwi"] => ({ state: "found", value })
  const both: Lookups = { soilMapUnit: found("Clarion loam"), nwi: found("PEM1A") }
  const point = (): SamplingPoint => newPoint("JF-1")

  test("fills the blank fields and remembers what it wrote", () => {
    const { point: filled, kept } = withLookups(point(), both)
    expect(kept).toEqual([])
    expect(filled).toMatchObject({ soilMapUnit: "Clarion loam", nwi: "PEM1A", lookedUp: { soilMapUnit: "Clarion loam", nwi: "PEM1A" } })
  })

  test("a value the user typed wins over a look-up, and a later look-up does not replace it", () => {
    const typed = { ...withLookups(point(), both).point, nwi: "PFO1C" }
    const { point: again, kept } = withLookups(typed, { soilMapUnit: found("Webster clay loam"), nwi: found("PEM1A") })
    expect(again.nwi).toBe("PFO1C")
    expect(kept).toEqual(["nwi"])
    // The soil map unit was still what the look-up wrote, so the new position's answer replaces it.
    expect(again.soilMapUnit).toBe("Webster clay loam")
  })

  test("a field the user typed before any look-up is left alone", () => {
    const { point: after, kept } = withLookups({ ...point(), soilMapUnit: "my own name" }, both)
    expect(after.soilMapUnit).toBe("my own name")
    expect(kept).toEqual(["soilMapUnit"])
  })

  test("none and unavailable change nothing", () => {
    const before = withLookups(point(), both).point
    const { point: after, kept } = withLookups(before, { soilMapUnit: { state: "none" }, nwi: { state: "unavailable" } })
    expect(after).toEqual(before)
    expect(kept).toEqual([])
  })
})

describe("the words", () => {
  const found: Lookups["nwi"] = { state: "found", value: "x" }
  test("says lookup is unavailable when nothing was tried or neither service answered", () => {
    expect(describeLookups(null)[0]).toMatch(/^Lookup unavailable/)
    expect(describeLookups({ soilMapUnit: { state: "unavailable" }, nwi: { state: "unavailable" } })[0]).toMatch(/^Lookup unavailable/)
  })
  test("says what was filled, what is not mapped and what could not be asked", () => {
    const notes = describeLookups({ soilMapUnit: found, nwi: { state: "none" } })
    expect(notes).toEqual(["Filled in the soil map unit from this position. Edit it if it is wrong.", "No NWI wetland is mapped at this position."])
    expect(describeLookups({ soilMapUnit: { state: "unavailable" }, nwi: found })).toEqual([
      "Filled in the NWI class from this position. Edit it if it is wrong.",
      "Lookup unavailable for the soil map unit: type it, or try again.",
    ])
    // What the user typed was kept, and the note does not claim it was filled in.
    expect(describeLookups({ soilMapUnit: found, nwi: found }, ["nwi"])).toEqual([
      "Filled in the soil map unit from this position. Edit it if it is wrong.",
      "Kept what you typed for the NWI class.",
    ])
  })
})

describe("positions", () => {
  test("six decimals, as the form is written", () => {
    expect(written(41.5)).toBe("41.500000")
    expect(written(-93.123456789)).toBe("-93.123457")
  })
  test("the typed Lat and Long are a position only when both are usable coordinates", () => {
    expect(typedPosition("41.5", "-93.6")).toEqual({ lat: 41.5, long: -93.6 })
    expect(typedPosition("", "-93.6")).toBeNull()
    expect(typedPosition("91", "-93.6")).toBeNull()
    expect(typedPosition("41.5", "abc")).toBeNull()
  })
})
