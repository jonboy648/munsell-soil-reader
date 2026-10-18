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
  "Saved,Spot x,Spot y,Chip,Chip name,Exact,Top 3,Card,Page hue,Card check,Card check mean DE,Warnings"
const COLUMNS = CSV_HEADER.split(",")

/** Tap a place on the Photo, given in Photo pixels. */
async function tapPhoto(page: Page, point: XY) {
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

/** Save to Log into a new Sample, the way a user fills the form. */
async function saveToNewSample(page: Page, sample: SampleFields) {
  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = page.getByRole("dialog", { name: "Save to Log", exact: true })
  await sheet.getByLabel("Sample name or number").fill(sample.name)
  if (sample.top) await sheet.getByLabel("Depth top (cm)").fill(sample.top)
  if (sample.bottom) await sheet.getByLabel("Depth bottom (cm)").fill(sample.bottom)
  await sheet.getByRole("radio", { name: sample.condition }).click()
  if (sample.notes) await sheet.getByLabel("Notes").fill(sample.notes)
  await sheet.getByRole("button", { name: /^Save \d+ Readings?$/ }).click()
  await expect(sheet).toHaveCount(0)
}

const openLog = async (page: Page) => {
  await page.getByRole("button", { name: "Open Log" }).click()
  return page.getByRole("dialog", { name: "Log", exact: true })
}

/** Presses Export CSV and returns the downloaded file's name and text. */
async function exportCsv(page: Page) {
  const log = page.getByRole("dialog", { name: "Log", exact: true })
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    log.getByRole("button", { name: "Export CSV" }).click(),
  ])
  return { filename: download.suggestedFilename(), text: readFileSync(await download.path(), "utf8") }
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
  const sample = log.getByRole("region", { name: "Sample A1" })
  await expect(sample).toContainText("0-15 cm · moist")
  await expect(sample).toContainText("dark topsoil")
  await expect(sample.getByTestId("log-notation")).toHaveText("10YR 4/3")
  await expect(sample).toContainText("Card check good")
})

test("the CSV has the header and one row per Reading, with the Sample repeated and fields quoted", async ({ page }) => {
  const notes = 'Dark, "mottled" topsoil\nsecond line'
  await readSpots(page, SIM_SPOT, GROUND)
  await saveToNewSample(page, { name: "Pit 3, north", top: "0", bottom: "15", condition: "moist", notes })
  await openLog(page)
  const { filename, text } = await exportCsv(page)

  expect(filename).toMatch(/^soil-log-\d{4}-\d{2}-\d{2}\.csv$/)
  expect(text.startsWith(`${CSV_HEADER}\r\n`)).toBe(true)
  expect(text).toContain('\r\n"Pit 3, north",0,15,moist,"Dark, ""mottled"" topsoil\nsecond line",')

  // Despite the commas, quotes and line break, the file is a header and two rows.
  const rows = parseCsv(text)
  expect(rows).toHaveLength(3)
  expect(rows[0]).toEqual(COLUMNS)
  const [first, second] = rows.slice(1).map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])))

  for (const r of [first, second]) {
    expect(r["Sample"]).toBe("Pit 3, north")
    expect(r["Depth top (cm)"]).toBe("0")
    expect(r["Depth bottom (cm)"]).toBe("15")
    expect(r["Condition"]).toBe("moist")
    expect(r["Notes"]).toBe(notes)
    expect(r["Latitude"]).toBe("")
    expect(r["Longitude"]).toBe("")
    expect(Date.parse(r["Saved"])).not.toBeNaN()
    expect(r["Card"]).toBe("colorchecker")
    expect(r["Card check"]).toBe("good")
    expect(Number(r["Card check mean DE"])).toBeLessThan(3)
    expect(r["Top 3"]).toContain(r["Chip"])
  }
  expect(first["Chip"]).toBe("10YR 4/3")
  expect(second["Chip"]).not.toBe(first["Chip"])
  expect(Math.abs(Number(first["Spot x"]) - SIM_SPOT.x)).toBeLessThan(5)
  expect(Math.abs(Number(first["Spot y"]) - SIM_SPOT.y)).toBeLessThan(5)
  expect(Math.abs(Number(second["Spot x"]) - GROUND.x)).toBeLessThan(5)
  expect(Math.abs(Number(second["Spot y"]) - GROUND.y)).toBeLessThan(5)
})

test("no location is asked for unless the user switches it on", async ({ page }) => {
  await page.addInitScript(() => {
    const spy = window as unknown as { geoCalls: number }
    spy.geoCalls = 0
    const geo = navigator.geolocation as unknown as Record<string, (...args: unknown[]) => unknown>
    for (const method of ["getCurrentPosition", "watchPosition"]) {
      const original = geo[method].bind(geo)
      geo[method] = (...args) => (spy.geoCalls++, original(...args))
    }
  })
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "dry" })
  const log = await openLog(page)
  await expect(log.getByRole("region", { name: "Sample A1" })).toBeVisible()

  expect(await page.evaluate(() => (window as unknown as { geoCalls: number }).geoCalls)).toBe(0)
  // A request would have turned the browser's permission from "prompt" to "denied" by now.
  expect(await page.evaluate(async () => (await navigator.permissions.query({ name: "geolocation" })).state)).toBe("prompt")
})

test.describe("with location switched on", () => {
  test.use({ permissions: ["geolocation"], geolocation: { latitude: 41.5, longitude: -93.6, accuracy: 12 } })

  test("the Sample keeps one location, and the setting stays on", async ({ page }) => {
    await readSpots(page, SIM_SPOT)
    await page.getByRole("button", { name: "Save to Log" }).click()
    const sheet = page.getByRole("dialog", { name: "Save to Log", exact: true })
    const location = sheet.getByRole("switch", { name: "Save my location with this Sample" })
    await expect(location).not.toBeChecked()
    await location.click()
    await sheet.getByLabel("Sample name or number").fill("B2")
    await sheet.getByRole("radio", { name: "dry" }).click()
    await sheet.getByRole("button", { name: /^Save \d+ Readings?$/ }).click()
    await expect(page.getByRole("status")).toHaveText("Saved 1 Reading to B2.")

    const log = await openLog(page)
    await expect(log.getByRole("region", { name: "Sample B2" })).toContainText("41.50000, -93.60000 (within 12 m)")
    const [row] = parseCsv((await exportCsv(page)).text).slice(1)
    expect(row[COLUMNS.indexOf("Latitude")]).toBe("41.500000")
    expect(row[COLUMNS.indexOf("Longitude")]).toBe("-93.600000")
    expect(row[COLUMNS.indexOf("Location accuracy (m)")]).toBe("12")

    await page.reload()
    await readSpots(page, SIM_SPOT)
    await page.getByRole("button", { name: "Save to Log" }).click()
    await expect(page.getByRole("switch", { name: "Save my location with this Sample" })).toBeChecked()
  })
})

test("a Reading can be added to an existing Sample", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await saveToNewSample(page, { name: "A1", condition: "moist" })

  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = page.getByRole("dialog", { name: "Save to Log", exact: true })
  await sheet.getByLabel("Add to").selectOption({ label: "A1, moist" })
  await expect(sheet.getByLabel("Sample name or number")).toHaveCount(0)
  await sheet.getByRole("button", { name: "Save 1 Reading" }).click()
  await expect(page.getByRole("status")).toHaveText("Saved 1 Reading to A1.")

  await expect(page.getByTestId("log-summary")).toContainText("1 Sample, 2 Readings")
  const log = await openLog(page)
  await expect(log.getByTestId("log-sample")).toHaveCount(1)
  await expect(log.getByTestId("log-reading")).toHaveCount(2)
})

test("a Sample needs a name and a Condition before it is saved", async ({ page }) => {
  await readSpots(page, SIM_SPOT)
  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = page.getByRole("dialog", { name: "Save to Log", exact: true })
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
