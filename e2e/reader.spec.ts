// Seam 2: the built page, driven the way a user drives it. Tests pick a Photo, tap by
// coordinates and read the text on screen. They never look inside the components.
import { expect, test, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

/** Tap a place on the Photo, given in Photo pixels (the example Photo is SIM_WIDTH x SIM_HEIGHT). */
async function tapPhoto(page: Page, point: XY) {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  await page.touchscreen.tap(
    box.x + (point.x * box.width) / SIM_WIDTH,
    box.y + (point.y * box.height) / SIM_HEIGHT,
  )
}

async function pickExample(page: Page, name: string) {
  await page.goto("/")
  await page.getByRole("button", { name: new RegExp(name) }).click()
  // The examples sit below the Photo; picking one must bring the Photo back into view.
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

const [TL, TR, BR, BL] = SIM_CORNERS
// Bare ground below the Card, a different soil from the one in the middle of the Photo.
const GROUND: XY = { x: 300, y: 560 }

test("reads a Photo end to end: corners, then a Spot, shows the corrected Reading", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")

  for (const corner of [TL, TR, BR, BL]) await tapPhoto(page, corner)
  await expect(page.getByTestId("spot-prompt")).toContainText("Tap the middle of the soil")

  await tapPhoto(page, SIM_SPOT)
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
  await expect(page.getByTestId("card-check")).toContainText("Card check good")

  // The sheet shows raw and corrected side by side.
  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByTestId("drawer-notation")).toHaveText("10YR 4/3")
  await expect(sheet.getByRole("row", { name: /^Corrected/ })).toContainText("10YR 4/3")
  await expect(sheet.getByRole("row", { name: /^Raw/ })).not.toContainText("10YR 4/3")
  await expect(sheet.getByText("Top 3 Chips")).toBeVisible()
})

test("corners tapped in the wrong order show a failed Card check", async ({ page }) => {
  await pickExample(page, "Corners out of order")
  for (const corner of [BL, TL, TR, BR]) await tapPhoto(page, corner) // starts on the white patch
  await tapPhoto(page, SIM_SPOT)

  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "failed")
  await expect(page.getByTestId("card-check")).toContainText("Card check failed")
  await page.getByRole("button", { name: "Open Readings" }).click()
  await expect(page.getByRole("dialog")).toContainText("Tap Start over and begin at the brown patch")
})

test("a smudged black patch is named and left out, and the Reading is shown with the raw one beside it", async ({ page }) => {
  await pickExample(page, "Smudged black patch")
  for (const corner of [TL, TR, BR, BL]) await tapPhoto(page, corner)
  await tapPhoto(page, SIM_SPOT)

  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 3/2")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "caution")
  await expect(page.getByTestId("card-check")).toContainText("Card check caution")
  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toContainText("black 2")
  await expect(sheet).toContainText("left out of the correction")
  await expect(sheet.getByRole("img", { name: "Corrected color" })).toBeVisible()
  await expect(sheet.getByRole("img", { name: "Raw color" })).toBeVisible()
  await expect(sheet).not.toContainText("Start over")
})

test("a Photo with no Card gives a Reading marked as not corrected", async ({ page }) => {
  await pickExample(page, "No Card in the shot")
  await expect(page.getByTestId("corner-prompt")).toHaveCount(0)
  await tapPhoto(page, SIM_SPOT)

  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "uncorrected")
  await expect(page.getByTestId("card-check")).toContainText("Not corrected")
  await expect(page.getByTestId("reading-notation")).not.toHaveText("10YR 4/3")
})

test("several Spots in one Photo each get a Reading", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  for (const corner of [TL, TR, BR, BL]) await tapPhoto(page, corner)
  await tapPhoto(page, SIM_SPOT)
  await tapPhoto(page, GROUND)

  await expect(page.getByTestId("spot-prompt")).toContainText("2 Spots")
  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByRole("region", { name: "Spot 1" })).toBeVisible()
  await expect(sheet.getByRole("region", { name: "Spot 2" })).toBeVisible()
  const notations = await sheet.getByTestId("drawer-notation").allTextContents()
  expect(notations).toHaveLength(2)
  expect(notations[0]).not.toBe(notations[1])
})

test("Undo takes back the last tap and Start over clears them all", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  await tapPhoto(page, TL)
  await tapPhoto(page, TR)
  await expect(page.getByTestId("corner-prompt")).toContainText("black patch (bottom right)")

  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page.getByTestId("corner-prompt")).toContainText("bluish-green patch (top right)")

  await page.getByRole("button", { name: "Start over" }).click()
  await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")
})

test("a Photo the user chooses opens and asks for the Card corners", async ({ page }) => {
  await page.goto("/")
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  )
  await page.getByTestId("choose-input").setInputFiles({ name: "soil.png", mimeType: "image/png", buffer: onePixelPng })
  await expect(page.getByTestId("photo-name")).toHaveText("Your Photo: soil.png")
  await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")
})

test("a file that is not a Photo says so", async ({ page }) => {
  await page.goto("/")
  await page
    .getByTestId("choose-input")
    .setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not an image") })
  await expect(page.getByRole("alert")).toContainText("didn't open as a Photo")
})

test("the interface switches between light and dark", async ({ page }) => {
  await page.goto("/")
  const html = page.locator("html")
  const before = await html.evaluate((el) => el.classList.contains("dark"))
  await page.getByRole("button", { name: /Switch to (dark|light) mode/ }).click()
  expect(await html.evaluate((el) => el.classList.contains("dark"))).toBe(!before)
})
