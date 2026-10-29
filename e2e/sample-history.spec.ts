// Synthetic readings exercise the saved-data boundary, not field accuracy.
import { expect, test, type Page } from "@playwright/test"
import { newPoint, newProject } from "../src/delineation/model"
import type { Project } from "../src/delineation/model"
import { readPhoto } from "../src/engine"
import { LIGHTS, SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH, simulatePhoto } from "../src/engine/simulate"
import { savedReadings } from "../src/lib/log"

async function seed(page: Page) {
  const photo = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: "5PB 5/1", noise: 0 })
  const card = { kind: "colorchecker" as const, corners: photo.corners }
  const [reading] = savedReadings(readPhoto({ pixels: photo.pixels, card, spots: [photo.spot] }), card, [0])
  reading.savedAt = Date.UTC(2026, 9, 18, 17)
  const project = newProject("Field trial", "NCNE")
  const point = newPoint("JF-1")
  point.layers = [{ id: "layer-1", top: 0, bottom: 6, matrix: { notation: reading.reading.corrected!.chip.notation, percent: 100, reading }, redox: [], remarks: "" }]
  project.points = [point, newPoint("JF-2")]
  await page.goto("/icon-192.png")
  await page.evaluate((project) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("munsell-soil-reader", 2)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("samples", { keyPath: "id" })
      request.result.createObjectStore("projects", { keyPath: "id" })
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction("projects", "readwrite")
      tx.objectStore("projects").put(project)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => reject(tx.error)
    }
  }), project)
  return project
}

async function originals(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("munsell-soil-reader")
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction("projects", "readonly")
      const get = tx.objectStore("projects").getAll()
      tx.oncomplete = () => { db.close(); resolve(get.result) }
    }
  }))
}

async function replaceProject(page: Page, project: Project) {
  await page.evaluate((project) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("munsell-soil-reader")
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction("projects", "readwrite")
      tx.objectStore("projects").put(project)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => reject(tx.error)
    }
  }), project)
}

test("a previous point shows its dated reading and book page; feedback survives reload without changing the project", async ({ page }, testInfo) => {
  const project = await seed(page)
  await page.goto("/#history")
  await expect(page.getByRole("heading", { name: "Sample History", exact: true })).toBeVisible()
  await page.getByLabel("Sample point or Log sample").selectOption({ label: "Field trial / JF-1" })
  const reading = page.getByRole("article", { name: /Reading/ })
  await expect(reading).toContainText("5PB 5/1")
  await expect(reading).toContainText("Soil book page: Gley 2")
  await expect(reading.locator("time").first()).toHaveAttribute("datetime", "2026-10-18T17:00:00.000Z")
  await expect(reading).toContainText("Calculated estimate")
  await expect(reading).toContainText("not a printed chip")
  await reading.getByLabel("Optional note").fill("Page does not look like my book; retest in daylight.")
  await reading.getByRole("button", { name: "Off", exact: true }).click()
  await expect(reading).toContainText("Feedback saved on this device")
  await expect.poll(() => originals(page)).toEqual([project])
  await page.reload()
  await expect(page.getByText("Page does not look like my book; retest in daylight.", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Not sure", exact: true }).click()
  await expect(page.getByRole("list", { name: "Previous feedback" }).getByRole("listitem")).toHaveCount(2)
  await expect.poll(() => originals(page)).toEqual([project])
  await page.setViewportSize({ width: 360, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("history-mobile.png"), fullPage: true })
  await page.setViewportSize({ width: 1365, height: 950 })
  await page.screenshot({ path: testInfo.outputPath("history-desktop.png"), fullPage: true })
  await page.getByLabel("Sample point or Log sample").selectOption({ label: "Field trial / JF-2" })
  await expect(page.getByText("No photo readings saved for this point yet.")).toBeVisible()
  await expect(page.getByText("Page does not look like my book; retest in daylight.", { exact: true })).toHaveCount(0)
})

test("feedback errors never claim a save or modify the reading", async ({ page }) => {
  const project = await seed(page)
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (...args: Parameters<typeof original>) {
      if (this.name === "munsell-reading-feedback" && args[1] === "readwrite") throw new DOMException("Full", "QuotaExceededError")
      return original.apply(this, args)
    }
  })
  await page.goto("/#history")
  await page.getByRole("button", { name: "Good", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Feedback was not saved")
  await expect(page.getByText("Feedback saved on this device", { exact: true })).toHaveCount(0)
  expect(await originals(page)).toEqual([project])
})

test("a quick response follows a new reading into the Log and Sample History", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Warm shop light/ }).click()
  for (const point of [...SIM_CORNERS, SIM_SPOT]) {
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = await page.getByTestId("photo").boundingBox()
    if (!box) throw new Error("Missing photo")
    await page.touchscreen.tap(box.x + point.x * box.width / SIM_WIDTH, box.y + point.y * box.height / SIM_HEIGHT)
  }
  await page.getByRole("region", { name: "Quick reading feedback" }).getByRole("button", { name: "Good", exact: true }).click()
  await expect(page.getByText("Feedback saved on this device", { exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Sample History", exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole("article")).toContainText("Good")
  await expect(page.getByRole("heading", { name: "Readings with feedback / Not linked to a saved point" })).toBeVisible()
  await page.getByRole("link", { name: "Soil reader", exact: true }).click()
  // Adding another Spot recomputes the engine result; feedback must stay on the first reading.
  await page.evaluate(() => window.scrollTo(0, 0))
  const photo = await page.getByTestId("photo").boundingBox()
  if (!photo) throw new Error("Missing photo")
  await page.touchscreen.tap(photo.x + 300 * photo.width / SIM_WIDTH, photo.y + 560 * photo.height / SIM_HEIGHT)
  await page.getByRole("button", { name: "Save to Log", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Save to Log", exact: true })
  await sheet.getByLabel("Sample name or number").fill("Lunch trial")
  await sheet.getByRole("radio", { name: "moist" }).click()
  await sheet.getByRole("button", { name: "Save 2 Readings", exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await page.getByRole("link", { name: "Sample History", exact: true }).filter({ visible: true }).click()
  await page.getByLabel("Sample point or Log sample").selectOption({ label: "Log / Lunch trial" })
  await expect(page.getByRole("article")).toHaveCount(2)
  const rated = page.getByRole("article").filter({ has: page.getByRole("list", { name: "Previous feedback" }) })
  await expect(rated).toContainText("Good")
  await expect(rated).toContainText("10YR 4/3")
  await page.reload()
  await expect(page.getByRole("list", { name: "Previous feedback" }).getByRole("listitem")).toHaveCount(1)
})

test("two tabs append feedback to the same reading without losing either response", async ({ page, context }) => {
  const project = await seed(page)
  await page.goto("/#history")
  const second = await context.newPage()
  await second.goto("/#history")
  await page.getByLabel("Optional note").fill("First field check")
  await second.getByLabel("Optional note").fill("Second field check")
  await Promise.all([
    page.getByRole("button", { name: "Good", exact: true }).click(),
    second.getByRole("button", { name: "Off", exact: true }).click(),
  ])
  for (const tab of [page, second]) {
    await expect(tab.getByRole("list", { name: "Previous feedback" }).getByRole("listitem")).toHaveCount(2)
    await expect(tab.getByText("First field check", { exact: true })).toBeVisible()
    await expect(tab.getByText("Second field check", { exact: true })).toBeVisible()
  }
  expect(await originals(page)).toEqual([project])
})

test("an empty history explains how to save readings and needs no network", async ({ page, context }) => {
  await page.goto("/")
  await context.setOffline(true)
  await page.getByRole("link", { name: "Sample History", exact: true }).filter({ visible: true }).click()
  await expect(page.getByRole("heading", { name: "No saved samples yet" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Take a reading" })).toBeVisible()
})

test("feedback storage can fail while the original saved history remains readable", async ({ page }) => {
  await seed(page)
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open
    IDBFactory.prototype.open = function (...args: Parameters<typeof original>) {
      if (args[0] === "munsell-reading-feedback") throw new DOMException("Unavailable", "UnknownError")
      return original.apply(this, args)
    }
  })
  await page.goto("/#history")
  await expect(page.getByLabel("Sample point or Log sample")).toBeVisible()
  await expect(page.getByRole("article")).toContainText("5PB 5/1")
  await expect(page.getByText("Feedback history is unavailable. Your original readings are still shown.")).toBeVisible()
})

test("a newer reading arriving during a refresh preserves an unfinished feedback note", async ({ page }) => {
  const project = await seed(page)
  await page.goto("/#history")
  await page.getByLabel("Optional note").fill("Still comparing with the book")
  const originalLayer = project.points[0].layers[0]
  const copy = structuredClone(originalLayer)
  copy.id = "layer-2"
  copy.top = 6
  copy.bottom = 12
  copy.matrix!.reading!.id = "new-reading"
  copy.matrix!.reading!.savedAt = Date.UTC(2026, 9, 19, 17)
  project.points[0].layers.push(copy)
  await replaceProject(page, project)
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByRole("article")).toHaveCount(2)
  await expect(page.getByRole("article").filter({ hasText: "0–6 in · Matrix" }).getByLabel("Optional note")).toHaveValue("Still comparing with the book")
})

test("newest first follows the displayed measurement time even when saved out of order", async ({ page }) => {
  const project = await seed(page)
  const first = project.points[0].layers[0]
  first.matrix!.reading!.measuredAt = Date.UTC(2026, 9, 17, 17)
  first.matrix!.reading!.savedAt = Date.UTC(2026, 9, 20, 17)
  const second = structuredClone(first)
  second.id = "layer-2"
  second.matrix!.reading!.id = "newer-measurement"
  second.matrix!.reading!.measuredAt = Date.UTC(2026, 9, 18, 17)
  second.matrix!.reading!.savedAt = Date.UTC(2026, 9, 19, 17)
  project.points[0].layers.push(second)
  await replaceProject(page, project)
  await page.goto("/#history")
  await expect(page.getByRole("article").first().locator("time").first()).toHaveAttribute("datetime", "2026-10-18T17:00:00.000Z")
})

test("removing a different redox entry preserves the surviving reading's draft", async ({ page }) => {
  const project = await seed(page)
  const layer = project.points[0].layers[0]
  const first = structuredClone(layer.matrix!)
  first.reading!.id = "redox-first"
  first.percent = 10
  const second = structuredClone(first)
  second.reading!.id = "redox-second"
  second.percent = 20
  layer.redox = [first, second]
  await replaceProject(page, project)
  await page.goto("/#history")
  const surviving = page.getByRole("article").filter({ hasText: "Redox · 20%" })
  await surviving.getByLabel("Optional note").fill("Keep this mottle observation")
  layer.redox.shift()
  await replaceProject(page, project)
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
  await expect(page.getByRole("article")).toHaveCount(2)
  await expect(surviving.getByLabel("Optional note")).toHaveValue("Keep this mottle observation")
})

test("one reading assigned in multiple places has one feedback panel and retains every context", async ({ page }) => {
  const project = await seed(page)
  const layer = project.points[0].layers[0]
  const repeated = structuredClone(layer.matrix!)
  repeated.percent = 15
  layer.redox = [repeated]
  await replaceProject(page, project)
  await page.goto("/#history")
  await expect(page.getByRole("article")).toHaveCount(1)
  await expect(page.getByRole("article")).toContainText("Matrix · 100%")
  await expect(page.getByRole("article")).toContainText("Redox · 15%")
  await page.getByRole("button", { name: "Off", exact: true }).click()
  await expect(page.getByRole("list", { name: "Previous feedback" }).getByRole("listitem")).toHaveCount(1)
})
