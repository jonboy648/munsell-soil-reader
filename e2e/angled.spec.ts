// Seam 2: a Card photographed at an angle, through the built page. Tests pick the angled
// example, tap by coordinates and read what is on screen.
import { expect, test, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { EXAMPLES, SIM_HEIGHT, SIM_WIDTH, simulatePhoto } from "../src/engine/simulate"

// Where the Card's patches and the soil really are in the angled example.
const angled = simulatePhoto(EXAMPLES.find((e) => e.id === "angled")!.scene)

/**
 * Tap a place on the Photo, given in Photo pixels (the example Photo is SIM_WIDTH x SIM_HEIGHT).
 * A click lands on a whole CSS pixel, and engines differ on how they get there (Chromium rounds,
 * WebKit and Firefox cut off the fraction), so the tap is rounded here and every engine taps the
 * same place, at most half a CSS pixel from the one asked for.
 */
async function tapPhoto(page: Page, point: XY) {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  await page.touchscreen.tap(
    Math.round(box.x + (point.x * box.width) / SIM_WIDTH),
    Math.round(box.y + (point.y * box.height) / SIM_HEIGHT),
  )
}

async function pickAngledExample(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: /Card at an angle/ }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

test("an angled Card gives a good Card check and the right Reading", async ({ page }) => {
  await pickAngledExample(page)
  for (const corner of angled.corners) await tapPhoto(page, corner)
  await tapPhoto(page, angled.spot)

  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
  await expect(page.getByTestId("card-check")).toContainText("Card check good")
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
})

test("after the fourth corner the overlay rings every patch in place, smaller on the far side", async ({ page }) => {
  await pickAngledExample(page)
  for (const corner of angled.corners) await tapPhoto(page, corner)
  await expect(page.getByTestId("spot-prompt")).toBeVisible()

  // How far from each patch's true center, going left, right, up and down, the first pure
  // white pixel is: the white ring the overlay draws. Everything else on the Card is darker.
  const rings = await page.getByTestId("photo").evaluate((canvas: HTMLCanvasElement, centers: XY[]) => {
    const ctx = canvas.getContext("2d")!
    const reach = (c: XY, dx: number, dy: number) => {
      for (let d = 0; d < 100; d++) {
        const [r, g, b] = ctx.getImageData(Math.round(c.x + dx * d), Math.round(c.y + dy * d), 1, 1).data
        if (r >= 235 && g >= 235 && b >= 235) return d
      }
      return null
    }
    return centers.map((c) => ({ left: reach(c, -1, 0), right: reach(c, 1, 0), up: reach(c, 0, -1), down: reach(c, 0, 1) }))
  }, angled.patches)

  // Taps land on whole CSS pixels, so a ring can sit up to half of one off its patch, which
  // makes the two sides differ by up to one (here cssPx Photo pixels). Two more cover the
  // white pixel being found a pixel early or late.
  const cssPx = SIM_WIDTH / (await page.getByTestId("photo").boundingBox())!.width
  const offCenter = cssPx + 2

  // The four corner patches carry the user's own tap marks too, so look at the other twenty.
  const corners = [0, 5, 18, 23]
  rings.forEach((ring, i) => {
    if (corners.includes(i)) return
    const { left, right, up, down } = ring
    expect(left, `patch ${i + 1} ring found`).not.toBeNull()
    expect(Math.abs(left! - right!), `patch ${i + 1} is centered left to right`).toBeLessThanOrEqual(offCenter)
    expect(Math.abs(up! - down!), `patch ${i + 1} is centered top to bottom`).toBeLessThanOrEqual(offCenter)
  })
  // The Card turns away to the right, so the rightmost patches are farther and their rings smaller.
  expect(rings[11].left!).toBeLessThan(0.7 * rings[6].left!)
})
