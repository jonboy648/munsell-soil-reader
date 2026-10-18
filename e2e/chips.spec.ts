// Seam 2, the soil-book Chips: what the Readings sheet shows for the nearest Chip and for the
// candidates. Driven the way a user drives it; nothing looks inside the components.
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
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

test("a Reading shows the Chip's color name, three candidates and the two swatches", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  for (const corner of SIM_CORNERS) await tapPhoto(page, corner)
  await tapPhoto(page, SIM_SPOT)
  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")

  // The nearest Chip: its notation and its name in the soil book.
  await expect(sheet.getByTestId("drawer-notation")).toHaveText("10YR 4/3")
  await expect(sheet.getByTestId("drawer-name")).toHaveText("brown")
  await expect(sheet.getByText(/^exact \d/)).toBeVisible()

  // Three candidates, nearest first, each with its name and distance.
  const candidates = sheet.getByRole("list", { name: "Top 3 Chips" }).getByRole("listitem")
  await expect(candidates).toHaveCount(3)
  await expect(candidates.first()).toHaveText(/^10YR 4\/3 brown \d+\.\d$/)
  for (const text of await candidates.allTextContents()) expect(text).toMatch(/^\S+ [\d.]+\/[\d.]* [a-z ]+ \d+\.\d$/)

  // The corrected color sits beside the Chip's color: same row, corrected on the left. Both
  // boxes are read in one go, and polled, because the sheet is still sliding up at first.
  await expect(sheet.getByRole("img", { name: "Corrected color" })).toBeVisible()
  await expect(sheet.getByRole("img", { name: "Chip color" })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const box = (name: string) =>
          document.querySelector(`[role="img"][aria-label="${name}"]`)!.getBoundingClientRect()
        const [corrected, chip] = [box("Corrected color"), box("Chip color")]
        return Math.abs(corrected.y - chip.y) < 2 && corrected.right <= chip.left + 1
      }),
    )
    .toBe(true)
})

test("a Photo with no Card still names the Chip and its candidates, and the swatch says Raw", async ({ page }) => {
  await pickExample(page, "No Card in the shot")
  await tapPhoto(page, SIM_SPOT)
  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")

  await expect(sheet.getByTestId("drawer-name")).not.toHaveText("")
  await expect(sheet.getByRole("list", { name: "Top 3 Chips" }).getByRole("listitem")).toHaveCount(3)
  await expect(sheet.getByRole("img", { name: "Raw color" })).toBeVisible()
  await expect(sheet.getByRole("img", { name: "Corrected color" })).toHaveCount(0)
})
