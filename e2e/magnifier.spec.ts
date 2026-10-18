// The magnifier and drag-to-place, through the built page. A finger is driven with raw touch
// events (Playwright's own touchscreen can only tap), a mouse with the mouse API. What is
// asserted is what the user sees: the magnifier, the next prompt and the Reading.
import { expect, test, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

/** Where a place on the Photo, given in Photo pixels, is on screen. */
async function onScreen(page: Page, point: XY): Promise<XY> {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  return { x: box.x + (point.x * box.width) / SIM_WIDTH, y: box.y + (point.y * box.height) / SIM_HEIGHT }
}

/** One finger, pressing and moving at places on the Photo given in Photo pixels. */
async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const send = async (type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel", at?: XY) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: at ? [await onScreen(page, at)] : [] })
  return {
    down: (at: XY) => send("touchStart", at),
    move: (at: XY) => send("touchMove", at),
    up: () => send("touchEnd"),
    cancel: () => send("touchCancel"),
    /** Press at `from`, drag to `to`, lift. */
    async drag(from: XY, to: XY) {
      await send("touchStart", from)
      await send("touchMove", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 })
      await send("touchMove", to)
      await send("touchEnd")
    },
  }
}

async function pickExample(page: Page, name: string) {
  await page.goto("/")
  await page.getByRole("button", { name: new RegExp(name) }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

const [TL, TR, BR, BL] = SIM_CORNERS
const before = (p: XY): XY => ({ x: p.x + 100, y: p.y + 80 }) // far enough to land on another patch
const GROUND: XY = { x: 300, y: 560 } // a different soil from the one at SIM_SPOT

async function expectReading(page: Page) {
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
}

test("a touch drag places each corner and the Spot where the finger lifts", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await finger(page)

  await touch.drag(before(TL), TL)
  await expect(page.getByTestId("corner-prompt")).toContainText("bluish-green patch (top right)")
  for (const corner of [TR, BR, BL]) await touch.drag(before(corner), corner)
  await expect(page.getByTestId("spot-prompt")).toContainText("Tap the middle of the soil")

  await touch.drag(GROUND, SIM_SPOT)
  // Wrong corners would fail the Card check, and a Spot on the ground would not read 10YR 4/3.
  await expectReading(page)
})

test("the magnifier shows under a pressed finger, magnified, and goes when it lifts", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await finger(page)
  const lens = page.getByTestId("magnifier")
  await expect(lens).toHaveCount(0)

  // 20 Photo pixels right of the left edge of the white patch.
  const press: XY = { x: 80, y: 360 }
  await touch.down(press)
  await expect(lens).toBeVisible()
  const box = (await lens.boundingBox())!
  expect(box.y + box.height).toBeLessThan((await onScreen(page, press)).y) // above the finger

  // Where the white patch's left edge falls in the lens says how much it is magnified.
  const photoBox = (await page.getByTestId("photo").boundingBox())!
  const edge = await lens.evaluate((canvas: HTMLCanvasElement) => {
    const row = canvas.getContext("2d")!.getImageData(0, canvas.height / 2 + canvas.height / 5, canvas.width, 1).data
    let x = Math.floor(canvas.width / 2) // in the white patch; walk left to the first dark pixel
    while (x > 0 && row[x * 4] >= 128) x--
    return { fromCenter: x - canvas.width / 2, perCssPixel: canvas.width / canvas.clientWidth }
  })
  const photoPixelsOnScreen = photoBox.width / SIM_WIDTH
  const zoom = -edge.fromCenter / edge.perCssPixel / (20 * photoPixelsOnScreen)
  expect(zoom).toBeGreaterThanOrEqual(3)

  // It follows the finger, centered on it once clear of the screen's edge.
  const moved: XY = { x: 230, y: press.y }
  await touch.move(moved)
  await expect
    .poll(async () => {
      const b = (await lens.boundingBox())!
      return b.x + b.width / 2
    })
    .toBeCloseTo((await onScreen(page, moved)).x, 0)

  await touch.up()
  await expect(lens).toHaveCount(0)
})

test("the magnifier drops below the finger when there is no room above it", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await finger(page)
  const top: XY = { x: 480, y: 4 }
  await touch.down(top)
  const lens = page.getByTestId("magnifier")
  await expect(lens).toBeVisible()
  expect((await lens.boundingBox())!.y).toBeGreaterThan((await onScreen(page, top)).y)
  await touch.up()
})

test("a press that is cancelled places nothing", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await finger(page)
  await touch.down(TL)
  await expect(page.getByTestId("magnifier")).toBeVisible()
  await touch.cancel()
  await expect(page.getByTestId("magnifier")).toHaveCount(0)
  await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")
})

test("dragging on the Photo does not scroll the page", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 100)).toBe(true)
  const touch = await finger(page)
  await touch.down({ x: 480, y: 500 })
  for (const y of [400, 300, 200, 100]) await touch.move({ x: 480, y })
  await touch.up()
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test("the mouse works: a click places a point, and press-drag-release places it at the release", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const mouse = page.mouse

  const from = await onScreen(page, before(TL))
  const to = await onScreen(page, TL)
  await mouse.move(from.x, from.y)
  await mouse.down()
  await expect(page.getByTestId("magnifier")).toBeVisible()
  await mouse.move(to.x, to.y, { steps: 4 })
  await mouse.up()
  await expect(page.getByTestId("magnifier")).toHaveCount(0)
  await expect(page.getByTestId("corner-prompt")).toContainText("bluish-green patch (top right)")

  for (const point of [TR, BR, BL, SIM_SPOT]) {
    const at = await onScreen(page, point)
    await mouse.click(at.x, at.y)
  }
  await expectReading(page)
})
