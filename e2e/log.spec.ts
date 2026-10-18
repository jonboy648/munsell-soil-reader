// Seam 2: the Log, driven through the built page. Saving, reloading, exporting the CSV and
// the location setting are all visible there, so nothing here looks inside the components.
import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

const [TL, TR, BR, BL] = SIM_CORNERS
// Bare ground below the Card, a different soil from the one in the middle of the Photo.
const GROUND: XY = { x: 300, y: 560 }

const CSV_HEADER =
  "Sample,Depth top (cm),Depth bottom (cm),Condition,Notes,Latitude,Longitude,Location accuracy (m)," +
  "Saved,UTC offset,Spot x,Spot y,Chip,Chip name,Exact,Top 3,Card,Page hue,Card check,Card check mean DE,Warnings"
const COLUMNS = CSV_HEADER.split(",")

/** Tap a place on the Photo, given in Photo pixels. */
async function tapPhoto(page: Page, point: XY) {
  await page.evaluate(() => window.scrollTo(0, 0)) // clicking buttons further down may have scrolled it
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  await page.touchscreen.tap(
    box.x + (point.x * box.width) / SIM_WIDTH,
    box.y + (point.y * box.height) / SIM_HEIGHT,
  )
}

/** Opens the app, picks the warm-light example, marks the Card and taps the given Spots. */
async function readSpots(page: Page, ...spots: XY[]) {
  await page.goto("/")
  await page.getByRole("button", { name: /Warm shop light/ }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
  for (const corner of [TL, TR, BR, BL]) await tapPhoto(page, corner)
  for (const spot of spots) await tapPhoto(page, spot)
  await expect(page.getByTestId("reading-notation")).toBeVisible()
}

interface SampleFields {
  name: string
  top?: string
  bottom?: string
  condition: "moist" | "dry"
  notes?: string
}

const saveSheet = (page: Page) => page.getByRole("dialog", { name: "Save to Log", exact: true })
const logScreen = (page: Page) => page.getByRole("dialog", { name: "Log", exact: true })
const saveButton = (sheet: ReturnType<typeof saveSheet>) => sheet.getByRole("button", { name: /^Save \d+ Readings?$/ })

/** Save to Log into a new Sample, the way a user fills the form. */
async function saveToNewSample(page: Page, sample: SampleFields) {
  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = saveSheet(page)
  await sheet.getByLabel("Sample name or number").fill(sample.name)
  if (sample.top) await sheet.getByLabel("Depth top (cm)").fill(sample.top)
  if (sample.bottom) await sheet.getByLabel("Depth bottom (cm)").fill(sample.bottom)
  await sheet.getByRole("radio", { name: sample.condition }).click()
  if (sample.notes) await sheet.getByLabel("Notes").fill(sample.notes)
  await saveButton(sheet).click()
  await expect(sheet).toHaveCount(0)
}

/** Save to Log into a Sample that is already in the Log, picked by the text of its option. */
async function saveToExistingSample(page: Page, option: string) {
  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = saveSheet(page)
  await sheet.getByLabel("Add to").selectOption({ label: option })
  await saveButton(sheet).click()
  await expect(sheet).toHaveCount(0)
}

const openLog = async (page: Page) => {
  await page.getByRole("button", { name: "Open Log" }).click()
  return logScreen(page)
}

/** Presses Export CSV; returns the downloaded file's name, bytes, and text without the byte-order mark. */
async function exportCsv(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    logScreen(page).getByRole("button", { name: "Export CSV" }).click(),
  ])
  const bytes = readFileSync(await download.path())
  return { filename: download.suggestedFilename(), bytes, text: bytes.toString("utf8").replace(String.fromCharCode(0xfeff), "") }
}

/** A small RFC 4180 reader: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c !== '"') {
        cell += c
      } else if (text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        quoted = false
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ",") {
      row.push(cell)
      cell = ""
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      i++
    } else {
      cell += c
    }
  }
  return rows
}

/** The rows after the header, each as column name to text. */
const csvRows = (text: string): Record<string, string>[] =>
  parseCsv(text)
    .slice(1)
    .map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])))

/** A sheet that closes takes its history entry off the stack a moment later; wait for that. */
const historySettled = (page: Page) => expect.poll(() => page.evaluate(() => history.state)).toBeNull()

const near = (value: string, expected: number) => Math.abs(Number(value) - expected) < 5

/** Counts calls to the geolocation API, so a test can say whether the page ever asked. */
async function spyOnGeolocation(page: Page) {
  await page.addInitScript(() => {
    const spy = window as unknown as { geoCalls: number }
    spy.geoCalls = 0
    const geo = navigator.geolocation as unknown as Record<string, (...args: unknown[]) => unknown>
    for (const method of ["getCurrentPosition", "watchPosition"]) {
      const original = geo[method].bind(geo)
      geo[method] = (...args) => (spy.geoCalls++, original(...args))
    }
  })
}
const geoCalls = (page: Page) => page.evaluate(() => (window as unknown as { geoCalls: number }).geoCalls)

// The Log must never open a native confirm; deletes ask in the page.
const nativeDialogs: string[] = []
test.beforeEach(({ page }) => {
  nativeDialogs.length = 0
  page.on("dialog", (dialog) => {
    nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`)
    void dialog.dismiss()
  })
})
test.afterEach(() => {
  expect(nativeDialogs).toEqual([])
})

test("a saved Reading is still in the Log after a reload, and the Log says it lives on this device", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", top: "0", bottom: "15", condition: "moist", notes: "dark topsoil" })
  await expect(page.getByRole("status")).toHaveText("Saved 1 Reading to A1.")

  await page.reload()
  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 1 Reading in the Log on this device")

  const log = await openLog(page)
  await expect(log).toContainText("The Log lives only on this device")
  await expect(log).toContainText("Your browser can also erase it on its own")
  await expect(log).toContainText("export a CSV after each trip")
  const sample = log.getByRole("region", { name: "Sample A1" })
  await expect(sample).toContainText("0-15 cm · moist")
  await expect(sample).toContainText("dark topsoil")
  await expect(sample.getByTestId("log-notation")).toHaveText("10YR 4/3")
  await expect(sample).toContainText("Card check good")
})

test("the CSV has the header and one row per Reading, with the Sample repeated and fields quoted", async ({ page }) => {
  const notes = 'Dark, "mottled" topsoil on a 10° slope; it’s “wet”\nsecond line'
  await readSpots(page, SIM_SPOT, GROUND)
  await saveToNewSample(page, { name: "Pit 3, north", top: "0", bottom: "15", condition: "moist", notes })
  await openLog(page)
  const { filename, bytes, text } = await exportCsv(page)

  expect(filename).toMatch(/^soil-log-\d{4}-\d{2}-\d{2}\.csv$/)
  // Excel reads a file as UTF-8 only when it starts with the byte-order mark.
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  expect(text.startsWith(`${CSV_HEADER}\r\n`)).toBe(true)
  expect(text).toContain('\r\n"Pit 3, north",0,15,moist,"Dark, ""mottled"" topsoil on a 10° slope; it’s “wet”\nsecond line",')

  // Despite the commas, quotes and line break, the file is a header and two rows.
  const parsed = parseCsv(text)
  expect(parsed).toHaveLength(3)
  expect(parsed[0]).toEqual(COLUMNS)
  const [first, second] = csvRows(text)

  for (const r of [first, second]) {
    expect(r["Sample"]).toBe("Pit 3, north")
    expect(r["Depth top (cm)"]).toBe("0")
    expect(r["Depth bottom (cm)"]).toBe("15")
    expect(r["Condition"]).toBe("moist")
    expect(r["Notes"]).toBe(notes)
    expect(r["Latitude"]).toBe("")
    expect(r["Longitude"]).toBe("")
    expect(r["Saved"]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(r["UTC offset"]).toMatch(/^UTC[+-]\d{2}:\d{2}$/)
    expect(r["Card"]).toBe("colorchecker")
    expect(r["Card check"]).toBe("good")
    expect(Number(r["Card check mean DE"])).toBeLessThan(3)
    expect(r["Top 3"]).toContain(r["Chip"])
  }
  expect(first["Chip"]).toBe("10YR 4/3")
  expect(second["Chip"]).not.toBe(first["Chip"])
  expect(near(first["Spot x"], SIM_SPOT.x) && near(first["Spot y"], SIM_SPOT.y)).toBe(true)
  expect(near(second["Spot x"], GROUND.x) && near(second["Spot y"], GROUND.y)).toBe(true)
})

test("text Excel would run as a formula or turn into a number or date is marked as text", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "001", condition: "moist", notes: "- slight effervescence" })
  await tapPhoto(page, GROUND)
  await saveToNewSample(page, { name: "3/4", condition: "dry", notes: '=HYPERLINK("http://example.com")' })
  await tapPhoto(page, { x: 600, y: 520 })
  await saveToNewSample(page, { name: "A1", condition: "dry", notes: "@home, 5 m from the road" })

  await openLog(page)
  const { text } = await exportCsv(page)
  const rows = csvRows(text)
  expect(rows.map((r) => [r["Sample"], r["Notes"]])).toEqual([
    ["'001", "'- slight effervescence"],
    ["'3/4", `'=HYPERLINK("http://example.com")`],
    ["A1", "'@home, 5 m from the road"],
  ])
})

test.describe("in the evening in Chicago", () => {
  test.use({ timezoneId: "America/Chicago" })

  test("the CSV dates and the file name use local time, with the offset in its own column", async ({ page }) => {
    // 19:30 on 18 October in Chicago is already 19 October in UTC.
    await page.clock.setFixedTime(new Date("2026-10-19T00:30:00Z"))
    await readSpots(page, SIM_SPOT)
    await saveToNewSample(page, { name: "A1", condition: "moist" })
    await openLog(page)
    const { filename, text } = await exportCsv(page)

    expect(filename).toBe("soil-log-2026-10-18.csv")
    const [row] = csvRows(text)
    expect(row["Saved"]).toBe("2026-10-18 19:30")
    expect(row["UTC offset"]).toBe("UTC-05:00")
  })
})

test("no location is asked for unless the user switches it on", async ({ page }) => {
  await spyOnGeolocation(page)
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "dry" })
  const log = await openLog(page)
  await expect(log.getByRole("region", { name: "Sample A1" })).toBeVisible()
  const { text } = await exportCsv(page)

  expect(await geoCalls(page)).toBe(0)
  expect(csvRows(text)[0]["Latitude"]).toBe("")
})

test.describe("with location switched on", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 41.5, longitude: -93.6, accuracy: 12 } })

  /** Reads one Spot and saves it to a Sample B2 with the location switch on. */
  async function saveLocated(page: Page) {
    await spyOnGeolocation(page)
    await readSpots(page, SIM_SPOT)
    await page.getByRole("button", { name: "Save to Log" }).click()
    const sheet = saveSheet(page)
    const location = sheet.getByRole("switch", { name: "Save my location with this Sample" })
    await expect(location).not.toBeChecked()
    await location.click()
    await sheet.getByLabel("Sample name or number").fill("B2")
    await sheet.getByRole("radio", { name: "dry" }).click()
    await saveButton(sheet).click()
    await expect(page.getByRole("status")).toHaveText("Saved 1 Reading to B2.")
  }

  test("the Sample keeps one location, and the setting stays on", async ({ page }) => {
    await saveLocated(page)
    expect(await geoCalls(page)).toBe(1)

    const log = await openLog(page)
    await expect(log.getByRole("region", { name: "Sample B2" })).toContainText("41.50000, -93.60000 (within 12 m)")
    const [row] = csvRows((await exportCsv(page)).text)
    expect(row["Latitude"]).toBe("41.500000")
    expect(row["Longitude"]).toBe("-93.600000")
    expect(row["Location accuracy (m)"]).toBe("12")

    await readSpots(page, SIM_SPOT)
    await page.getByRole("button", { name: "Save to Log" }).click()
    await expect(page.getByRole("switch", { name: "Save my location with this Sample" })).toBeChecked()
  })

  test("a Sample's location can be removed, and then the CSV has none", async ({ page }) => {
    await saveLocated(page)
    const log = await openLog(page)
    const sample = log.getByRole("region", { name: "Sample B2" })

    // Keep leaves it alone.
    await sample.getByRole("button", { name: "Remove location" }).click()
    await expect(log.getByRole("group", { name: /Confirm: remove this Sample's location/ })).toBeVisible()
    await log.getByRole("button", { name: "Keep" }).click()
    await expect(sample).toContainText("41.50000, -93.60000")

    await sample.getByRole("button", { name: "Remove location" }).click()
    await log.getByRole("button", { name: "Yes, remove" }).click()
    await expect(sample).not.toContainText("41.50000")
    await expect(sample.getByRole("button", { name: "Remove location" })).toHaveCount(0)

    const [row] = csvRows((await exportCsv(page)).text)
    expect(row["Sample"]).toBe("B2")
    expect([row["Latitude"], row["Longitude"], row["Location accuracy (m)"]]).toEqual(["", "", ""])

    await page.reload()
    await openLog(page)
    await expect(logScreen(page).getByRole("region", { name: "Sample B2" })).not.toContainText("41.50000")
  })
})

test("saving again adds only the Spots not yet in the Log, until Start over", async ({ page }) => {
  const pending = page.getByTestId("log-pending")
  const status = page.getByRole("status")
  await readSpots(page, SIM_SPOT)
  await expect(pending).toHaveText("1 new Reading to save.")
  await saveToNewSample(page, { name: "A1", condition: "moist" })
  await expect(status).toHaveText("Saved 1 Reading to A1.")
  await expect(pending).toHaveText("The Reading from this Photo is already saved.")
  await expect(page.getByRole("button", { name: "Save to Log" })).toBeDisabled()

  // A second Spot: only it is new, and the message about the first one goes away.
  await tapPhoto(page, GROUND)
  await expect(status).toHaveCount(0)
  await expect(pending).toHaveText("1 new Reading to save; 1 already saved.")
  await saveToExistingSample(page, "A1, moist")
  await expect(status).toHaveText("Saved 1 Reading to A1.")
  await expect(pending).toHaveText("All 2 Readings from this Photo are already saved.")
  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 2 Readings")

  // Each Spot is in the Log once, and in the CSV once.
  const log = await openLog(page)
  await expect(log.getByTestId("log-reading")).toHaveCount(2)
  const rows = csvRows((await exportCsv(page)).text)
  expect(rows).toHaveLength(2)
  expect(near(rows[0]["Spot x"], SIM_SPOT.x) && near(rows[0]["Spot y"], SIM_SPOT.y)).toBe(true)
  expect(near(rows[1]["Spot x"], GROUND.x) && near(rows[1]["Spot y"], GROUND.y)).toBe(true)
  await log.getByRole("button", { name: "Close Log", exact: true }).click()

  // Start over is a new reading of the Photo: the same place is a new Spot again.
  await page.getByRole("button", { name: "Start over" }).click()
  for (const corner of [TL, TR, BR, BL]) await tapPhoto(page, corner)
  await tapPhoto(page, SIM_SPOT)
  await expect(pending).toHaveText("1 new Reading to save.")
  await expect(page.getByRole("button", { name: "Save to Log" })).toBeEnabled()
})

test("a Sample needs a name and a Condition before it is saved", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = saveSheet(page)
  const save = sheet.getByRole("button", { name: "Save 1 Reading" })

  await save.click()
  await expect(sheet.getByRole("alert")).toHaveText("Give the Sample a name or number.")
  await sheet.getByLabel("Sample name or number").fill("A1")
  await save.click()
  await expect(sheet.getByRole("alert")).toHaveText("Pick moist or dry.")
  await sheet.getByRole("radio", { name: "moist" }).click()
  await sheet.getByLabel("Depth top (cm)").fill("20")
  await sheet.getByLabel("Depth bottom (cm)").fill("10")
  await save.click()
  await expect(sheet.getByRole("alert")).toHaveText("The bottom depth must be below the top.")
  await sheet.getByRole("button", { name: "Cancel" }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByTestId("log-summary")).toContainText("Nothing in the Log yet")
})

test("Sample fields can be edited and the edit survives a reload", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "moist" })
  await page.reload()

  const log = await openLog(page)
  await log.getByRole("button", { name: "Edit Sample" }).click()
  await log.getByLabel("Sample name or number").fill("A1 (north pit)")
  await log.getByLabel("Depth top (cm)").fill("30")
  await log.getByLabel("Depth bottom (cm)").fill("45")
  await log.getByRole("radio", { name: "dry" }).click()
  await log.getByLabel("Notes").fill("clay loam")
  await log.getByRole("button", { name: "Save changes" }).click()
  await expect(log.getByRole("region", { name: "Sample A1 (north pit)" })).toContainText("30-45 cm · dry")

  await page.reload()
  const again = await openLog(page)
  const sample = again.getByRole("region", { name: "Sample A1 (north pit)" })
  await expect(sample).toContainText("30-45 cm · dry")
  await expect(sample).toContainText("clay loam")
})

test("deleting a Reading or a Sample asks in the page first", async ({ page }) => {
  await readSpots(page, SIM_SPOT, GROUND)
  await saveToNewSample(page, { name: "A1", condition: "moist" })
  const log = await openLog(page)
  const readings = log.getByTestId("log-reading")
  await expect(readings).toHaveCount(2)

  // Keep leaves it alone.
  await readings.first().getByRole("button", { name: "Delete Reading" }).click()
  await expect(log.getByRole("group", { name: /Confirm: delete this Reading/ })).toBeVisible()
  await log.getByRole("button", { name: "Keep" }).click()
  await expect(readings).toHaveCount(2)

  // Yes removes just that Reading, and the removal survives a reload.
  await readings.first().getByRole("button", { name: "Delete Reading" }).click()
  await log.getByRole("button", { name: "Yes, delete" }).click()
  await expect(readings).toHaveCount(1)
  await page.reload()
  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 1 Reading")

  // Deleting the Sample takes the rest with it.
  const again = await openLog(page)
  await again.getByRole("button", { name: "Delete Sample" }).click()
  await expect(again.getByRole("group", { name: /Confirm: delete Sample A1/ })).toBeVisible()
  await again.getByRole("button", { name: "Yes, delete" }).click()
  await expect(again.getByTestId("log-sample")).toHaveCount(0)
  await expect(again).toContainText("Nothing saved yet")
  await expect(again.getByRole("button", { name: "Export CSV" })).toBeDisabled()
  await page.reload()
  await expect(page.getByTestId("log-summary")).toContainText("Nothing in the Log yet")
})

test("the Log closes from a button in the thumb zone and with Back, never leaving the app", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "moist" })

  // The Close Log button: full width and tall enough for a thumb.
  let log = await openLog(page)
  const close = log.getByRole("button", { name: "Close Log", exact: true })
  const box = await close.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.width).toBeGreaterThan(300)
  await close.click()
  await expect(log).toHaveCount(0)
  await historySettled(page)

  // Back closes the sheet, and the app stays where it is.
  log = await openLog(page)
  await page.goBack()
  await expect(log).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open Log" })).toBeVisible()
  expect(page.url()).toContain("localhost")

  // Cancel closes the Save sheet, and Back closes it too.
  await tapPhoto(page, GROUND)
  await page.getByRole("button", { name: "Save to Log" }).click()
  await saveSheet(page).getByRole("button", { name: "Cancel" }).click()
  await expect(saveSheet(page)).toHaveCount(0)
  await historySettled(page)
  await page.getByRole("button", { name: "Save to Log" }).click()
  await expect(saveSheet(page)).toBeVisible()
  await page.goBack()
  await expect(saveSheet(page)).toHaveCount(0)
  await expect(page.getByTestId("photo")).toBeVisible()
})

test("closing a sheet any other way takes its history entry off, so Back then leaves the app", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await (await openLog(page)).getByRole("button", { name: "Close Log", exact: true }).click()
  await expect(logScreen(page)).toHaveCount(0)
  await historySettled(page)
  await page.goBack()
  await expect.poll(() => page.url()).toBe("about:blank")
})

test("a save in one tab shows up in another without a reload", async ({ page, context }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "moist" })

  const other = await context.newPage()
  await other.goto("/")
  await expect(other.getByTestId("log-summary")).toContainText("1 Sample, 1 Reading")
  await readSpots(page, SIM_SPOT, GROUND)
  await saveToNewSample(page, { name: "B2", condition: "dry" })

  await expect(other.getByTestId("log-summary")).toContainText("2 Samples, 3 Readings")
})

test("an edit from a tab that has gone stale leaves the other tab's Readings alone", async ({ page, context }) => {
  // This tab never hears about changes, so what it shows goes stale on purpose.
  await page.addInitScript(() => {
    Object.defineProperty(window, "BroadcastChannel", { value: undefined })
  })
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "moist" })
  const log = await openLog(page)
  await expect(log.getByTestId("log-reading")).toHaveCount(1)
  await log.getByRole("button", { name: "Close Log", exact: true }).click()

  // The other tab adds a Reading to the same Sample.
  const other = await context.newPage()
  await readSpots(other, GROUND)
  await saveToExistingSample(other, "A1, moist")
  await expect(other.getByTestId("log-summary")).toContainText("1 Sample, 2 Readings")
  await other.close()

  // The stale tab still thinks the Sample has one Reading. Editing it and deleting its own
  // Reading must change only those things.
  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 1 Reading")
  await openLog(page)
  await log.getByRole("button", { name: "Edit Sample" }).click()
  await log.getByLabel("Sample name or number").fill("A1 (north pit)")
  await log.getByRole("button", { name: "Save changes" }).click()
  await expect(log.getByRole("region", { name: "Sample A1 (north pit)" })).toBeVisible()
  await expect(log.getByTestId("log-reading")).toHaveCount(2)

  await page.reload()
  await openLog(page)
  await expect(log.getByTestId("log-reading")).toHaveCount(2)
  await expect(log.getByRole("region", { name: "Sample A1 (north pit)" })).toBeVisible()
})

test("the Log keeps working after the browser drops its connection to the database", async ({ page, context }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "moist" })

  // Clearing the site's data closes open IndexedDB connections, as iOS does to a backgrounded app.
  const cdp = await context.newCDPSession(page)
  await cdp.send("Storage.clearDataForOrigin", { origin: new URL(page.url()).origin, storageTypes: "indexeddb" })

  await tapPhoto(page, GROUND)
  await saveToNewSample(page, { name: "B2", condition: "dry" })
  await expect(page.getByRole("status")).toHaveText("Saved 1 Reading to B2.")
  await page.reload()
  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 1 Reading")
  await expect(await openLog(page)).toContainText("B2")
})

test("the browser is asked once, after the first save, to keep the Log", async ({ page }) => {
  await page.addInitScript(() => {
    const spy = window as unknown as { persistCalls: number }
    spy.persistCalls = 0
    const original = navigator.storage.persist.bind(navigator.storage)
    navigator.storage.persist = () => (spy.persistCalls++, original())
  })
  const calls = () => page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)

  await readSpots(page, SIM_SPOT)
  await (await openLog(page)).getByRole("button", { name: "Close Log", exact: true }).click()
  expect(await calls()).toBe(0)

  await saveToNewSample(page, { name: "A1", condition: "moist" })
  await expect.poll(calls).toBe(1)
  await tapPhoto(page, GROUND)
  await saveToExistingSample(page, "A1, moist")
  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 2 Readings")
  expect(await calls()).toBe(1)
})
