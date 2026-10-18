// Seam 2, Photo quality: the built page shows each warning with its advice, tied to the Card
// or to its Spot, and stays quiet on a Photo with nothing wrong.
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

async function readExample(page: Page, name: string, corners: XY[], spot: XY = SIM_SPOT) {
  await page.goto("/")
  await page.getByRole("button", { name: new RegExp(name) }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
  for (const corner of corners) await tapPhoto(page, corner)
  await tapPhoto(page, spot)
  await expect(page.getByTestId("reading-notation")).toBeVisible()
}

const [TL, TR, BR, BL] = SIM_CORNERS

test("glare on the Card and on the soil is flagged where it is, with advice", async ({ page }) => {
  await readExample(page, "Glare on the Card and the soil", [TL, TR, BR, BL])
  await expect(page.getByTestId("quality-flag")).toHaveText("2 warnings")

  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  const onCard = sheet.getByTestId("quality-warning").and(sheet.locator('[data-where="card"]'))
  await expect(onCard).toHaveAttribute("data-kind", "glare")
  await expect(onCard).toContainText("Card")
  await expect(onCard).toContainText("Tilt the Card or move into shade to lose the reflection")

  const onSpot = sheet.getByTestId("quality-warning").and(sheet.locator('[data-where="0"]'))
  await expect(onSpot).toHaveAttribute("data-kind", "glare")
  await expect(onSpot).toContainText("Spot 1")
  await expect(onSpot).toContainText("lose the reflection")
})

test("a Photo with nothing wrong shows no warning", async ({ page }) => {
  await readExample(page, "Warm shop light", [TL, TR, BR, BL])
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
  await expect(page.getByTestId("quality-flag")).toHaveCount(0)

  await page.getByRole("button", { name: "Open Readings" }).click()
  await expect(page.getByRole("dialog").getByTestId("quality-warning")).toHaveCount(0)
})

test("corners tapped in the wrong order fail the Card check without blaming the light", async ({ page }) => {
  await readExample(page, "Corners out of order", [BL, TL, TR, BR])
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "failed")
  await expect(page.getByTestId("quality-flag")).toHaveCount(0)
})
