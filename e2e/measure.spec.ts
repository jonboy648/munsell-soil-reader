// Seam 2: measurement mode, at /?measure. Walks shots of a simulated swatch card beside a
// ColorChecker, the way a maker does, and reads the batch CSV it exports.
import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { SWATCH_IDS, deltaE2000, parseBatchCsv, swatchSlot, type XY } from "../src/engine"
import { SIM_HEIGHT, SIM_WIDTH, measureExamples, simSwatchLabs, simulatePhoto } from "../src/engine/simulate"

const [WARM, ANGLED] = measureExamples()
const warm = simulatePhoto(WARM.scene)
const angled = simulatePhoto(ANGLED.scene)

/**
 * Taps places on the Photo, given in Photo pixels, once the Photo is on screen and still. Rounded
 * to a whole CSS pixel so every engine taps the same place (a click lands on whole pixels, which
 * Chromium rounds and WebKit and Firefox cut off).
 */
async function tapper(page: Page) {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  return (point: XY) =>
    page.touchscreen.tap(
      Math.round(box.x + (point.x * box.width) / SIM_WIDTH),
      Math.round(box.y + (point.y * box.height) / SIM_HEIGHT),
    )
}

/** The Card check of the shot being taken (the finished shots have their own). */
const liveCheck = (page: Page) => page.getByTestId("shot-readings").getByTestId("card-check")

/** Picks an example Photo and taps the ColorChecker's corners on it; returns how to tap the rest. */
async function openShot(page: Page, name: RegExp, corners: XY[]) {
  await page.getByRole("button", { name }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
  const tap = await tapper(page)
  for (const corner of corners) await tap(corner)
  await expect(page.getByTestId("swatch-prompt")).toBeVisible()
  return tap
}

test("two shots of a swatch card average into a batch CSV", async ({ page }) => {
  test.slow() // 80 taps, and Firefox takes most of the default 30 s
  await page.goto("/?measure")
  await expect(page.getByRole("heading", { name: "Measurement mode" })).toBeVisible()

  // Shot 1: the ColorChecker's corners, then the swatches in order. The label advances by itself.
  const tapWarm = await openShot(page, /Swatch card, warm light/, warm.corners)
  for (const [i, at] of warm.swatches.entries()) {
    if (i % 6 === 0) {
      await expect(page.getByTestId("swatch-prompt")).toContainText(`${SWATCH_IDS[i]} (frame slot ${swatchSlot(SWATCH_IDS[i])})`)
    }
    await tapWarm(at)
  }
  await expect(liveCheck(page)).toHaveAttribute("data-verdict", "good")
  await page.getByTestId("add-shot").click()
  await expect(page.getByTestId("shot-list").getByRole("listitem")).toHaveCount(1)

  // Shot 2, from another place and in another light, with each label picked from the list, last first.
  const tapAngled = await openShot(page, /Swatch card, tilted/, angled.corners)
  for (const i of [...angled.swatches.keys()].reverse()) {
    await page.getByTestId("swatch-label").selectOption(SWATCH_IDS[i])
    await tapAngled(angled.swatches[i])
  }
  await expect(liveCheck(page)).toHaveAttribute("data-verdict", "good")
  await page.getByTestId("add-shot").click()
  await expect(page.getByTestId("shot-list").getByRole("listitem")).toHaveCount(2)

  // Every swatch has two shots in its mean, and nothing was left out.
  const rows = page.getByTestId("summary").locator("tbody tr")
  await expect(rows).toHaveCount(18)
  for (const row of await rows.all()) await expect(row.locator("td").last()).toHaveText("2")
  await expect(page.getByTestId("excluded")).toHaveCount(0)

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()])
  expect(download.suggestedFilename()).toMatch(/^batch-\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = parseBatchCsv(readFileSync((await download.path())!, "utf8"))

  expect(csv.map((r) => r.patch)).toEqual([...Array(6).keys()].map((i) => `G${i + 1}`).concat([...Array(12).keys()].map((i) => `S${String(i + 1).padStart(2, "0")}`)))
  const truth = simSwatchLabs()
  csv.forEach((r, i) => {
    expect(r.n, r.patch).toBe(2)
    expect(r.sd, r.patch).toHaveLength(3)
    expect(r.method).toBe("camera vs ColorChecker")
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // A mean of two shots, one in a light that clips the lightest swatch: the engine test states
    // the single-shot errors (up to 5.1 for swatch_01, 2.9 for the rest under that light).
    expect(deltaE2000(r.lab, truth[i]), r.patch).toBeLessThan(3.5)
  })
})

test("a shot whose Card check fails is listed and left out of the means", async ({ page }) => {
  await page.goto("/?measure")
  const first = await openShot(page, /Swatch card, warm light/, warm.corners)
  for (const at of warm.swatches.slice(0, 3)) await first(at)
  await page.getByTestId("add-shot").click()

  // The same Photo again, with the corners tapped starting on the white patch.
  const [tl, tr, br, bl] = warm.corners
  const second = await openShot(page, /Swatch card, warm light/, [bl, tl, tr, br])
  for (const at of warm.swatches.slice(0, 3)) await second(at)
  await expect(liveCheck(page)).toHaveAttribute("data-verdict", "failed")
  await page.getByTestId("add-shot").click()

  await expect(page.getByTestId("excluded")).toContainText("shot 2 (Card check failed")
  const rows = page.getByTestId("summary").locator("tbody tr")
  await expect(rows).toHaveCount(3)
  for (const row of await rows.all()) await expect(row.locator("td").last()).toHaveText("1")
})

test("tapping a swatch again moves it, and Undo takes back the last tap", async ({ page }) => {
  await page.goto("/?measure")
  const tap = await openShot(page, /Swatch card, warm light/, warm.corners)
  await tap(warm.swatches[0])
  await tap(warm.swatches[1])
  await expect(page.getByTestId("swatch-prompt")).toContainText("swatch_03")

  // Pick swatch_01 again and tap another tile: no third swatch appears, the first one moves.
  await page.getByTestId("swatch-label").selectOption("swatch_01")
  await tap(warm.swatches[5])
  await expect(page.getByTestId("swatch-prompt")).toContainText("2/18")
  await expect(page.getByTestId("swatch-prompt")).toContainText("swatch_03")

  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page.getByTestId("swatch-prompt")).toContainText("1/18")
  await expect(page.getByTestId("swatch-prompt")).toContainText("swatch_02")
})

test("the reader never loads measurement mode", async ({ page }) => {
  const loaded: string[] = []
  page.on("request", (request) => loaded.push(request.url()))
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Munsell Soil Reader" })).toBeVisible()
  expect(loaded.filter((url) => /MeasureApp/.test(url))).toEqual([])
  await expect(page.getByText("Measurement mode")).toHaveCount(0)

  await page.goto("/?measure")
  await expect(page.getByRole("heading", { name: "Measurement mode" })).toBeVisible()
  expect(loaded.some((url) => /MeasureApp/.test(url))).toBe(true)
})

test("the method says what the camera cannot see and who checks the first lot", async ({ page }) => {
  await page.goto("/?measure")
  await page.getByTestId("method").locator("summary").click()
  await expect(page.getByTestId("method")).toContainText("1 to 2 dE00")
  await expect(page.getByTestId("method")).toContainText("metamerism")
  await expect(page.getByTestId("method")).toContainText("first lot")
  await expect(page.getByTestId("method")).toContainText("#50")
})
