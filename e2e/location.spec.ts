// Seam 2: location and the look-ups by it, through the built page. The phone's position and the two
// public services are replaced in the browser (a spy on the Geolocation API, routes for the two hosts),
// so what the app sends, and when, can be counted.
import { readFileSync } from "node:fs"
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test"

const fixture = (name: string) => readFileSync(new URL(`../src/delineation/lookup/fixtures/${name}`, import.meta.url), "utf8")
const SERVICES = /fwspublicservices\.wim\.usgs\.gov|sdmdataaccess\.sc\.egov\.usda\.gov/
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" }
const POSITION = { latitude: 41.5, longitude: -93.6 }

interface Asked {
  method: string
  url: string
  body: string | null
}

/**
 * Counts every call to the Geolocation API (on the prototype, which every engine keeps), and grants it.
 * `delay` holds the answer back that many milliseconds, as a slow GPS fix would.
 */
async function watchPosition(context: BrowserContext, { delay = 0 }: { delay?: number } = {}) {
  await context.addInitScript((wait) => {
    const w = window as unknown as { __geolocationCalls: number; __geolocationDelivered: number }
    w.__geolocationCalls = 0
    w.__geolocationDelivered = 0
    const current = Geolocation.prototype.getCurrentPosition
    Geolocation.prototype.getCurrentPosition = function (this: Geolocation, ok, fail, options) {
      w.__geolocationCalls++
      return current.call(this, (position) => setTimeout(() => { w.__geolocationDelivered++; ok(position) }, wait), fail, options)
    }
    const watch = Geolocation.prototype.watchPosition
    Geolocation.prototype.watchPosition = function (this: Geolocation, ...args: Parameters<Geolocation["watchPosition"]>) {
      w.__geolocationCalls++
      return watch.apply(this, args)
    }
  }, delay)
  await context.grantPermissions(["geolocation"])
  await context.setGeolocation(POSITION)
}
const geolocationCalls = (page: Page) => page.evaluate(() => (window as unknown as { __geolocationCalls: number }).__geolocationCalls)

/** The position near Nowhere, NE, where the wetlands map has no wetland and the soil survey no map unit. */
const BARE = { latitude: 40, longitude: -95 }

/**
 * The two services, answering with the recorded fixtures. `sda: "down"` makes the soil survey
 * unreachable, `delay` holds both answers back, and a position at BARE has no wetland and no map unit.
 */
async function mockServices(context: BrowserContext, { sda = "up", delay = 0 }: { sda?: "up" | "down"; delay?: number } = {}) {
  const asked: Asked[] = []
  await context.route(SERVICES, async (route) => {
    const request = route.request()
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS })
    asked.push({ method: request.method(), url: request.url(), body: request.postData() })
    if (delay) await new Promise((r) => setTimeout(r, delay))
    const isNwi = request.url().includes("wetlandsmapservice")
    const bare = isNwi ? new URL(request.url()).searchParams.get("geometry") === `${BARE.longitude},${BARE.latitude}` : (request.postData() ?? "").includes(`point (${BARE.longitude} ${BARE.latitude})`)
    const body = isNwi ? fixture(bare ? "nwi-none.json" : "nwi-hit.json") : bare ? "{}" : fixture("sda-hit.from-docs.json")
    try {
      // The page may have given up on the request while it was held back.
      if (!isNwi && sda === "down") await route.abort()
      else await route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body })
    } catch {
      /* cancelled by the page */
    }
  })
  return asked
}

/** Every request that leaves the app's own origin. */
function watchOutside(page: Page, baseURL: string | undefined) {
  const outside: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(baseURL ?? "http://localhost").origin) outside.push(request.url())
  })
  return outside
}

const projectsSheet = (page: Page) => page.getByRole("dialog", { name: "Projects", exact: true })
const LOCATION = /Use this phone's location in this project/

/** A project (with location turned on or not), a sampling point, and the point open. */
async function openPoint(page: Page, { locationOn }: { locationOn: boolean }) {
  await page.goto("/")
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const sheet = projectsSheet(page)
  await sheet.getByLabel("Project name").fill("Cedar Creek")
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
  // Off until the project turns it on.
  await expect(sheet.getByLabel(LOCATION)).not.toBeChecked()
  if (locationOn) await sheet.getByLabel(LOCATION).check()
  await sheet.getByLabel("Sampling point name").fill("JF-1")
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  await sheet.getByRole("button", { name: "Open point" }).click()
  return sheet
}

const printed = (sheet: Locator, field: "soilMapUnit" | "nwi" | "lat" | "long" | "datum") =>
  sheet.locator(`[data-testid="page1-preview-text"][data-field="page1.${field}"]`)

async function editDetails(sheet: Locator, values: Record<string, string>) {
  await sheet.getByRole("button", { name: "Edit location and pair" }).click()
  for (const [label, value] of Object.entries(values)) await sheet.getByLabel(label, { exact: true }).fill(value)
  await sheet.getByRole("button", { name: "Save details" }).click()
  await expect(sheet.getByTestId("point-details")).toBeVisible() // the form closes once it is saved
}

test("with location off the app never asks for the position and sends nothing, however the point is filled in by hand", async ({ page, context, baseURL }) => {
  await watchPosition(context)
  const asked = await mockServices(context)
  const outside = watchOutside(page, baseURL)
  const sheet = await openPoint(page, { locationOn: false })

  await expect(sheet.getByTestId("location-off")).toBeVisible()
  await expect(sheet.getByRole("button", { name: "Use my location" })).toHaveCount(0)
  await expect(sheet.getByRole("button", { name: "Look up this position" })).toHaveCount(0)

  // Typing the header lines by hand, as without the feature, reads nothing and asks nothing.
  await editDetails(sheet, { Lat: "41.5", Long: "-93.6", Datum: "WGS84", "Soil Map Unit Name": "Clarion loam", "NWI classification": "PEM1C" })
  await expect(printed(sheet, "nwi")).toHaveText("PEM1C")
  await expect(sheet.getByRole("button", { name: "Look up this position" })).toHaveCount(0)

  // A reload starts the page's count again, so it is read before and after.
  expect(await geolocationCalls(page)).toBe(0)
  await page.reload()
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  await projectsSheet(page).getByRole("button", { name: "Open project" }).click()
  await expect(projectsSheet(page).getByLabel(LOCATION)).not.toBeChecked()

  expect(await geolocationCalls(page)).toBe(0)
  expect(asked).toEqual([])
  expect(outside).toEqual([])
})

test("with location on and a signal, the position comes from the phone and both lookups fill their lines", async ({ page, context, baseURL }) => {
  await watchPosition(context)
  const asked = await mockServices(context)
  const outside = watchOutside(page, baseURL)
  const sheet = await openPoint(page, { locationOn: true })
  // Turning it on read nothing and asked nothing; only the tap does.
  expect(await geolocationCalls(page)).toBe(0)
  expect(asked).toEqual([])

  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("point-details")).toContainText("Lat 41.500000, Long -93.600000, WGS84")
  await expect(sheet.getByTestId("point-lookups")).toHaveText("Soil map unit: Clarion loam, 2 to 5 percent slopes. NWI: PEM1A")
  await expect(sheet.getByTestId("location-note")).toContainText("Filled in the soil map unit and the NWI class")
  expect(await geolocationCalls(page)).toBe(1)

  // The position goes to those two services and nowhere else.
  expect(asked.map((a) => new URL(a.url).host).sort()).toEqual(["fwspublicservices.wim.usgs.gov", "sdmdataaccess.sc.egov.usda.gov"])
  const nwi = asked.find((a) => a.url.includes("wetlandsmapservice"))!
  expect(nwi.method).toBe("GET")
  expect(new URL(nwi.url).searchParams.get("geometry")).toBe("-93.6,41.5")
  const sda = asked.find((a) => a.url.includes("sdmdataaccess"))!
  expect(sda.method).toBe("POST")
  expect(JSON.parse(sda.body ?? "{}").query).toContain("point (-93.6 41.5)")
  expect(new Set(outside.map((u) => new URL(u).host))).toEqual(new Set(["fwspublicservices.wim.usgs.gov", "sdmdataaccess.sc.egov.usda.gov"]))

  // Page 1 prints them, in place of the header's blank lines.
  await expect(printed(sheet, "soilMapUnit")).toHaveText("Clarion loam, 2 to 5 percent slopes")
  await expect(printed(sheet, "nwi")).toHaveText("PEM1A")
  await expect(printed(sheet, "lat")).toHaveText("41.500000")

  // They are the point's own lines, editable, and an edit wins over a later look-up.
  await editDetails(sheet, { "NWI classification": "PFO1C" })
  await expect(printed(sheet, "nwi")).toHaveText("PFO1C")
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("location-note")).toContainText("Kept what you typed for the NWI class.")
  await expect(sheet.getByTestId("location-note")).not.toContainText("Filled in the soil map unit and the NWI class")
  await expect(printed(sheet, "nwi")).toHaveText("PFO1C")
  await expect(printed(sheet, "soilMapUnit")).toHaveText("Clarion loam, 2 to 5 percent slopes")

  // The setting and the values are kept on the device.
  await page.reload()
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const again = projectsSheet(page)
  await again.getByRole("button", { name: "Open project" }).click()
  await expect(again.getByLabel(LOCATION)).toBeChecked()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(again.getByTestId("point-lookups")).toHaveText("Soil map unit: Clarion loam, 2 to 5 percent slopes. NWI: PFO1C")
})

test("without a signal the position still comes from the phone, the lookups say they are unavailable, and the lines stay editable", async ({ page, context }) => {
  await watchPosition(context)
  // Offline: the services cannot be reached, whether or not this engine's navigator.onLine knows it.
  await context.route(SERVICES, (route) => route.abort("internetdisconnected"))
  const sheet = await openPoint(page, { locationOn: true })
  await context.setOffline(true)

  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("location-note")).toContainText("Lookup unavailable")
  await expect(sheet.getByTestId("point-details")).toContainText("Lat 41.500000, Long -93.600000, WGS84")
  await expect(sheet.getByTestId("point-lookups")).toHaveCount(0)

  // The position is typed over with one unlike the phone's, so what is looked up can only be the point's own.
  await editDetails(sheet, { Lat: "42.1234", Long: "-92.4321", "Soil Map Unit Name": "Webster clay loam", "NWI classification": "PEM1C" })
  await expect(sheet.getByTestId("point-lookups")).toHaveText("Soil map unit: Webster clay loam. NWI: PEM1C")

  // Back on, "Look up this position" asks about the position already on the point, and keeps what was typed.
  await context.setOffline(false)
  await context.unroute(SERVICES)
  const asked = await mockServices(context)
  const reads = await geolocationCalls(page)
  await sheet.getByRole("button", { name: "Look up this position" }).click()
  await expect(sheet.getByTestId("location-note")).toContainText("Kept what you typed for the soil map unit.")
  await expect(sheet.getByTestId("point-lookups")).toHaveText("Soil map unit: Webster clay loam. NWI: PEM1C")
  expect(asked.length).toBe(2)
  expect(await geolocationCalls(page)).toBe(reads) // that button does not read the position again
  const nwi = asked.find((a) => a.url.includes("wetlandsmapservice"))!
  expect(new URL(nwi.url).searchParams.get("geometry")).toBe("-92.4321,42.1234")
  expect(JSON.parse(asked.find((a) => a.url.includes("sdmdataaccess"))!.body ?? "{}").query).toContain("point (-92.4321 42.1234)")
})

test("a point moved to a place with no wetland and no map unit loses the values the first look-up wrote, and keeps the ones typed", async ({ page, context }) => {
  await watchPosition(context)
  await mockServices(context)
  const sheet = await openPoint(page, { locationOn: true })
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("point-lookups")).toHaveText("Soil map unit: Clarion loam, 2 to 5 percent slopes. NWI: PEM1A")
  await editDetails(sheet, { "NWI classification": "PFO1C" }) // typed over

  await context.setGeolocation(BARE)
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("point-details")).toContainText("Lat 40.000000, Long -95.000000")
  await expect(sheet.getByTestId("location-note")).toContainText("No soil map unit is mapped at this position.")
  await expect(sheet.getByTestId("location-note")).toContainText("Cleared the soil map unit that came from the earlier position.")
  // The form no longer prints the old place's map unit beside the new Lat and Long; the typed NWI class stays.
  await expect(sheet.getByTestId("point-lookups")).toHaveText("NWI: PFO1C")
  await expect(sheet.getByTestId("page1-preview-text").filter({ hasText: "Clarion" })).toHaveCount(0)
  await expect(printed(sheet, "nwi")).toHaveText("PFO1C")

  // Without a signal the services cannot say, so a new position clears the old place's values too.
  await context.setGeolocation(POSITION)
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("point-lookups")).toHaveText("Soil map unit: Clarion loam, 2 to 5 percent slopes. NWI: PFO1C")
  await context.unroute(SERVICES)
  await context.route(SERVICES, (route) => route.abort("internetdisconnected"))
  await context.setOffline(true)
  await context.setGeolocation(BARE)
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("location-note")).toContainText("Lookup unavailable")
  await expect(sheet.getByTestId("location-note")).toContainText("Cleared the soil map unit that came from the earlier position.")
  await expect(sheet.getByTestId("point-lookups")).toHaveText("NWI: PFO1C")
})

test("looking up a typed position that has no wetland and no map unit clears what the last look-up wrote", async ({ page, context }) => {
  await watchPosition(context)
  await mockServices(context)
  const sheet = await openPoint(page, { locationOn: true })
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("point-lookups")).toContainText("NWI: PEM1A")

  await editDetails(sheet, { Lat: String(BARE.latitude), Long: String(BARE.longitude) })
  await sheet.getByRole("button", { name: "Look up this position" }).click()
  await expect(sheet.getByTestId("location-note")).toContainText("Cleared the NWI class that came from the earlier position.")
  await expect(sheet.getByTestId("point-lookups")).toHaveCount(0)
})

test("turning location off while the position is being found stops everything: nothing is requested and nothing is written", async ({ page, context }) => {
  await watchPosition(context, { delay: 1500 })
  const asked = await mockServices(context)
  const sheet = await openPoint(page, { locationOn: true })

  await sheet.getByRole("button", { name: "Use my location" }).click()
  // The details form saves a snapshot of the point, so it waits for the look-up that writes into it.
  await expect(sheet.getByRole("button", { name: "Edit location and pair" })).toBeDisabled()
  // Back to the project and the switch off, before the phone has its position.
  await sheet.getByRole("button", { name: "Cedar Creek" }).click()
  await sheet.getByLabel(LOCATION).uncheck()
  await page.waitForFunction(() => (window as unknown as { __geolocationDelivered: number }).__geolocationDelivered === 1)
  await page.waitForTimeout(600) // long enough for a request to go out, had one been going to
  expect(asked).toEqual([])
  await sheet.getByRole("button", { name: "Open point" }).click()
  await expect(sheet.getByTestId("point-details")).toContainText("No latitude or longitude yet.")
  await expect(sheet.getByTestId("point-lookups")).toHaveCount(0)
})

test("turning location off while the services are being asked drops their answers", async ({ page, context }) => {
  await watchPosition(context)
  const asked = await mockServices(context, { delay: 1500 })
  const sheet = await openPoint(page, { locationOn: true })

  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect.poll(() => asked.length).toBe(2) // both requests are out, and held back
  await sheet.getByRole("button", { name: "Cedar Creek" }).click()
  await sheet.getByLabel(LOCATION).uncheck()
  await page.waitForTimeout(2200) // past the held-back answers
  await sheet.getByRole("button", { name: "Open point" }).click()
  await expect(sheet.getByTestId("point-lookups")).toHaveCount(0)
  await expect(sheet.getByTestId("location-off")).toBeVisible()
})

test("a longitude typed without its minus is caught and nothing is sent; the Long box can type a minus", async ({ page, context }) => {
  await watchPosition(context)
  const asked = await mockServices(context)
  const sheet = await openPoint(page, { locationOn: true })

  await sheet.getByRole("button", { name: "Edit location and pair" }).click()
  // The iPhone's decimal keypad has no minus key, so the Long box asks for the full keyboard.
  await expect(sheet.getByLabel("Long", { exact: true })).toHaveAttribute("inputmode", "text")
  await sheet.getByRole("button", { name: "Cancel" }).click()

  await editDetails(sheet, { Lat: "41.5", Long: "93.6" })
  await expect(sheet.getByTestId("position-problem")).toContainText("West longitudes are negative")
  await expect(sheet.getByRole("button", { name: "Look up this position" })).toHaveCount(0)
  await editDetails(sheet, { Lat: "41.5", Long: "abc" })
  await expect(sheet.getByTestId("position-problem")).toContainText("Nothing to look up yet")
  expect(asked).toEqual([])

  await editDetails(sheet, { Lat: "41.5", Long: "-93.6" })
  await expect(sheet.getByTestId("position-problem")).toHaveCount(0)
  await sheet.getByRole("button", { name: "Look up this position" }).click()
  await expect(sheet.getByTestId("point-lookups")).toContainText("NWI: PEM1A")
  expect(await geolocationCalls(page)).toBe(0)
})

test("when only the soil survey cannot be reached, the wetland class still fills and the soil map unit is left to type", async ({ page, context }) => {
  await watchPosition(context)
  await mockServices(context, { sda: "down" })
  const sheet = await openPoint(page, { locationOn: true })

  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("point-lookups")).toHaveText("NWI: PEM1A")
  await expect(sheet.getByTestId("location-note")).toContainText("Lookup unavailable for the soil map unit")

  await editDetails(sheet, { "Soil Map Unit Name": "Clarion loam" })
  await expect(printed(sheet, "soilMapUnit")).toHaveText("Clarion loam")
  await expect(printed(sheet, "nwi")).toHaveText("PEM1A")
})

test("a refused position permission says so and leaves the point as it was", async ({ page, context }) => {
  const asked = await mockServices(context)
  // The engines differ in how they answer an ungranted permission (Firefox waits on a prompt), so the refusal is the API's own error.
  await context.addInitScript(() => {
    Geolocation.prototype.getCurrentPosition = function (_ok, fail) {
      fail?.({ code: 1, message: "User denied Geolocation", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
    }
  })
  const sheet = await openPoint(page, { locationOn: true })
  await sheet.getByRole("button", { name: "Use my location" }).click()
  await expect(sheet.getByTestId("location-note")).toContainText("Location permission was refused")
  await expect(sheet.getByTestId("point-details")).toContainText("No latitude or longitude yet.")
  await expect(sheet.getByRole("button", { name: "Use my location" })).toBeEnabled()
  expect(asked).toEqual([])
})
