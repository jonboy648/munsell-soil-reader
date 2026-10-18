// Seam 2, the frame as the Card: the built page finds the frame in a simulated Photo, the user
// confirms the outline, and a Spot in the window reads. The finder is a chunk of its own that
// loads only when the frame is chosen. The page is driven the way a user drives it.
import { expect, test, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { EXAMPLES, SIM_FRAME_SPOT, SIM_HEIGHT, SIM_WIDTH, simulatePhoto } from "../src/engine/simulate"

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
  await page.getByRole("button", { name: new RegExp(name) }).click()
  // The examples sit below the Photo; picking one must bring the Photo back into view.
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

const frameStatus = (page: Page) => page.getByTestId("frame-status")
const frameExample = (name: string) => EXAMPLES.find((e) => e.name === name)!
/** Where the markers' outer corners really are in the example Photo. */
const outlineOf = (name: string) => simulatePhoto(frameExample(name).scene).frame!.outline

/** Pick a frame example and wait for the app to find its outline. */
async function foundFrame(page: Page, name = "Frame as the Card") {
  await page.goto("/")
  await pickExample(page, name)
  await expect(frameStatus(page)).toHaveAttribute("data-state", "found")
}

/** Pick a frame example, wait for its outline and confirm it. */
async function confirmedFrame(page: Page, name = "Frame as the Card") {
  await foundFrame(page, name)
  await page.getByTestId("confirm-outline").click()
  await expect(frameStatus(page)).toHaveAttribute("data-state", "confirmed")
  // The button is below the Photo, and the next step is a tap on the Photo: it has to be back in view.
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

test("finds the frame with no taps, and the Spot dropped in the window reads the corrected Chip", async ({ page }) => {
  await page.goto("/")
  await pickExample(page, "Frame as the Card")

  // No corner prompt: the app looks for the frame itself, and its batch comes with the example.
  await expect(page.getByTestId("corner-prompt")).toHaveCount(0)
  await expect(frameStatus(page)).toHaveAttribute("data-state", "found")
  await expect(frameStatus(page)).toContainText("Found the frame")
  await expect(page.getByTestId("batch-status")).toHaveAttribute("data-state", "ready")
  await expect(page.getByTestId("batch-code")).toHaveValue("SIM-1")
  await expect(page.getByTestId("spot-prompt")).toHaveCount(0) // not until the outline is confirmed
  await expect(page.getByTestId("reading-notation")).toHaveCount(0)

  // Confirming drops a Spot in the middle of the window, where the soil is: no tap needed.
  await page.getByTestId("confirm-outline").click()
  await expect(frameStatus(page)).toHaveAttribute("data-state", "confirmed")
  await expect(page.getByTestId("spot-prompt")).toContainText("1 Spot read. The first went in the middle of the frame's window")
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
  await expect(page.getByTestId("quality-flag")).toHaveCount(0)

  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByTestId("drawer-notation")).toHaveText("10YR 4/3")
  await expect(sheet.getByRole("row", { name: /^Corrected/ })).toContainText("10YR 4/3")
  await expect(sheet.getByRole("row", { name: /^Raw/ })).not.toContainText("10YR 4/3")
  await expect(sheet).toContainText("Each of the 18 frame patches")
  await expect(sheet.getByTestId("outside-window")).toHaveCount(0)
})

test("finds a frame at an angle too", async ({ page }) => {
  await confirmedFrame(page, "Frame at an angle")
  // The Spot is in the middle of the tilted window, which is not the middle of the Photo's outline.
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
})

test("a Spot outside the window is allowed, with a note", async ({ page }) => {
  await confirmedFrame(page) // Spot 1 is in the window
  await tapPhoto(page, { x: 40, y: 560 }) // the bare ground below the frame

  await expect(page.getByTestId("spot-prompt")).toContainText("2 Spots")
  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByRole("region", { name: "Spot 1" }).getByTestId("outside-window")).toHaveCount(0)
  await expect(sheet.getByRole("region", { name: "Spot 2" }).getByTestId("outside-window")).toContainText("Outside the window")
})

test("says why when a marker is hidden, and offers no outline to confirm", async ({ page }) => {
  await page.goto("/")
  await pickExample(page, "Frame with a marker hidden")
  await expect(frameStatus(page)).toHaveAttribute("data-state", "missing")
  await expect(frameStatus(page)).toContainText("No frame found")
  await expect(frameStatus(page)).toContainText("All four corner markers need to be in view")
  await expect(page.getByTestId("confirm-outline")).toHaveCount(0)
  await expect(page.getByTestId("spot-prompt")).toHaveCount(0)
})

test("a corner of the outline can be moved with a tap, and Undo puts it back", async ({ page }) => {
  await foundFrame(page)

  // The top left corner dragged well off the frame: every patch is then read in the wrong place.
  const [tl] = outlineOf("Frame as the Card")
  await tapPhoto(page, { x: tl.x + 110, y: tl.y + 80 })
  await page.getByTestId("confirm-outline").click()
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "failed")
  await page.getByRole("button", { name: "Open Readings" }).click()
  await expect(page.getByRole("dialog")).toContainText("The outline was probably not on the frame")
  await page.keyboard.press("Escape")

  // Undo takes back the Spot, then the confirmation, then the move.
  const undo = page.getByRole("button", { name: "Undo" })
  await undo.click()
  await undo.click()
  await expect(frameStatus(page)).toHaveAttribute("data-state", "found")
  await undo.click()
  await page.getByTestId("confirm-outline").click()
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
})

test("a tap far from every corner does not move the outline", async ({ page }) => {
  await foundFrame(page)
  // The middle of the window is nowhere near a corner, so the outline stays where it was found
  // and, confirmed as it is, the Reading is good.
  await tapPhoto(page, SIM_FRAME_SPOT)
  await page.getByTestId("confirm-outline").click()
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
})

test("a Reading of the frame saves to the Log, which names the Card", async ({ page }) => {
  await confirmedFrame(page)
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")

  await page.getByRole("button", { name: "Save to Log" }).click()
  const sheet = page.getByRole("dialog", { name: "Save to Log", exact: true })
  await sheet.getByLabel("Sample name or number").fill("F1")
  await sheet.getByRole("radio", { name: "moist" }).click()
  await sheet.getByRole("button", { name: /^Save \d+ Readings?$/ }).click()
  await expect(sheet).toHaveCount(0)

  await page.getByRole("button", { name: "Open Log" }).click()
  const log = page.getByRole("dialog", { name: "Log", exact: true })
  await expect(log).toContainText("F1")
  await expect(log).toContainText("10YR 4/3")
  await expect(log).toContainText("Frame")
})

test("Undo takes the Spot in the window back, and a tap reads where the user taps", async ({ page }) => {
  await confirmedFrame(page)
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")

  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page.getByTestId("reading-notation")).toHaveCount(0)
  await expect(page.getByTestId("spot-prompt")).toContainText("Tap the middle of the soil in the frame's window")
  // It does not come back by itself.
  await expect(frameStatus(page)).toHaveAttribute("data-state", "confirmed")
  await page.waitForTimeout(300)
  await expect(page.getByTestId("reading-notation")).toHaveCount(0)

  await tapPhoto(page, SIM_FRAME_SPOT)
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("spot-prompt")).toContainText("1 Spot read")
})

test("a batch that has not been measured is refused, with the reason", async ({ page }) => {
  await page.goto("/")
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  )
  await page.getByTestId("choose-input").setInputFiles({ name: "soil.png", mimeType: "image/png", buffer: onePixelPng })
  await page.getByRole("button", { name: "Frame", exact: true }).click()
  await expect(page.getByTestId("batch-status")).toHaveAttribute("data-state", "none")

  await page.getByTestId("batch-code").fill("lot-a1")
  await expect(page.getByTestId("batch-status")).toHaveAttribute("data-state", "refused")
  await expect(page.getByTestId("batch-status")).toContainText(
    "This frame's batch (LOT-A1) has not been measured yet, so the colors of its patches are not known and it can't be used as a Card.",
  )
  await expect(page.getByTestId("spot-prompt")).toHaveCount(0)
})

test("the frame finder is loaded only once the frame is chosen", async ({ page }) => {
  const scripts: string[] = []
  page.on("request", (request) => {
    if (request.url().endsWith(".js")) scripts.push(request.url())
  })
  const finderLoaded = () => scripts.some((url) => /\/assets\/frame-[^/]*\.js$/.test(url))

  await page.goto("/")
  await pickExample(page, "Warm shop light")
  const corners = page.getByTestId("corner-prompt")
  await expect(corners).toContainText("brown patch (top left)")
  expect(scripts.length).toBeGreaterThan(0) // the app's own script was seen, so the listener works
  expect(finderLoaded()).toBe(false)

  // Choosing the frame for this Photo loads the finder, which finds no frame in a ColorChecker Photo.
  await page.getByRole("button", { name: "Frame", exact: true }).click()
  await expect(frameStatus(page)).toHaveAttribute("data-state", "missing")
  expect(finderLoaded()).toBe(true)
})
