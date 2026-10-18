// The magnifier and the gestures on the Photo, through the built page. Fingers are driven with
// raw touch events (Playwright's own touchscreen can only tap) and the mouse with the mouse
// API. What is asserted is what the user sees: the magnifier, the next prompt and the Reading.
import { expect, test, type Locator, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

/** Where a place on the Photo, given in Photo pixels, is on screen. */
async function onScreen(page: Page, point: XY): Promise<XY> {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  return { x: box.x + (point.x * box.width) / SIM_WIDTH, y: box.y + (point.y * box.height) / SIM_HEIGHT }
}

type TouchType = "touchStart" | "touchMove" | "touchEnd" | "touchCancel"

/**
 * Raw fingers. Every call lists all the fingers that are down at that moment, on screen, the
 * first as finger 0 and so on; a finger that stays down while another lifts names its `id`.
 */
async function fingers(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const send = (type: TouchType, ...down: (XY & { id?: number })[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: down.map((p, i) => ({ id: i, ...p })) })
  const lens = page.getByTestId("magnifier")
  return {
    send,
    lens,
    /** Press at `from`, hold until the magnifier shows, drag to `to`, lift. */
    async holdDrag(from: XY, to: XY) {
      await send("touchStart", from)
      await expect(lens).toBeVisible()
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
const FIRST_CORNER = "brown patch (top left)"
const SECOND_CORNER = "bluish-green patch (top right)"

async function expectReading(page: Page) {
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
}

async function expectNothingPlaced(page: Page, lens: Locator) {
  await expect(lens).toHaveCount(0)
  await expect(page.getByTestId("corner-prompt")).toContainText(FIRST_CORNER)
}

test("holding then dragging places each corner and the Spot where the finger lifts", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  const drag = async (from: XY, to: XY) => touch.holdDrag(await onScreen(page, from), await onScreen(page, to))

  await drag(before(TL), TL)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
  for (const corner of [TR, BR, BL]) await drag(before(corner), corner)
  await expect(page.getByTestId("spot-prompt")).toContainText("Tap the middle of the soil")

  await drag(GROUND, SIM_SPOT)
  // Wrong corners would fail the Card check, and a Spot on the ground would not read 10YR 4/3.
  await expectReading(page)
})

test("the magnifier shows under a held finger, magnified, and goes when it lifts", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await expect(touch.lens).toHaveCount(0)

  // 20 Photo pixels right of the left edge of the white patch.
  const press: XY = { x: 80, y: 360 }
  await touch.send("touchStart", await onScreen(page, press))
  await expect(touch.lens).toBeVisible()
  const box = (await touch.lens.boundingBox())!
  expect(box.y + box.height).toBeLessThan((await onScreen(page, press)).y) // above the finger

  // Where the white patch's left edge falls in the lens says how much it is magnified.
  const photoBox = (await page.getByTestId("photo").boundingBox())!
  const edge = await touch.lens.evaluate((canvas: HTMLCanvasElement) => {
    const row = canvas.getContext("2d")!.getImageData(0, canvas.height / 2 + canvas.height / 5, canvas.width, 1).data
    let x = Math.floor(canvas.width / 2) // in the white patch; walk left to the first dark pixel
    while (x > 0 && row[x * 4] >= 128) x--
    return { fromCenter: x - canvas.width / 2, perCssPixel: canvas.width / canvas.clientWidth }
  })
  const photoPixelsOnScreen = photoBox.width / SIM_WIDTH
  const zoom = -edge.fromCenter / edge.perCssPixel / (20 * photoPixelsOnScreen)
  expect(zoom).toBeGreaterThanOrEqual(3)

  // It follows the finger, centered on it once clear of the screen's edge.
  const moved = await onScreen(page, { x: 230, y: press.y })
  await touch.send("touchMove", moved)
  await expect
    .poll(async () => {
      const b = (await touch.lens.boundingBox())!
      return b.x + b.width / 2
    })
    .toBeCloseTo(moved.x, 0)

  await touch.send("touchEnd")
  await expect(touch.lens).toHaveCount(0)
})

test("the crosshair is on the exact point that will be placed", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  // The top left corner of the white patch: dark frame to its left and above, white inside.
  await touch.send("touchStart", await onScreen(page, { x: 60, y: 342 }))
  await expect(touch.lens).toBeVisible()

  const seen = await touch.lens.evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!
    const css = canvas.width / canvas.clientWidth // lens pixels per CSS pixel
    const mid = Math.floor(canvas.width / 2)
    const at = (x: number, y: number) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3))
    const bright = (c: number[]) => c[0] >= 128
    // Walk a line 27 CSS pixels clear of the crosshair to where dark turns to white.
    const edge = (along: "row" | "column") => {
      for (let d = -30 * css; d <= 30 * css; d++) {
        const [x, y] = along === "row" ? [mid + d, mid + 27 * css] : [mid + 27 * css, mid + d]
        if (bright(at(x, y))) return d / css // CSS pixels from the crosshair
      }
      return null
    }
    return {
      vertical: edge("row"), // where the patch's left edge is, across
      horizontal: edge("column"), // where its top edge is, down
      onTheLine: at(mid - 12 * css, mid), // the white core of the crosshair, over the dark frame
      besideTheLine: at(mid + 12 * css, mid + 3), // its black edge, over the white patch
    }
  })
  expect(seen.vertical).not.toBeNull()
  expect(seen.horizontal).not.toBeNull()
  expect(Math.abs(seen.vertical!)).toBeLessThanOrEqual(1)
  expect(Math.abs(seen.horizontal!)).toBeLessThanOrEqual(1)
  expect(Math.min(...seen.onTheLine)).toBeGreaterThanOrEqual(240)
  expect(Math.max(...seen.besideTheLine)).toBeLessThanOrEqual(40)
  await touch.send("touchCancel")
})

test("the magnifier stays on screen and clear of the finger wherever the Photo is pressed", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  const view = page.viewportSize()!
  const photo = (await page.getByTestId("photo").boundingBox())!
  const xs = [4, view.width / 2, view.width - 4]
  const ys = [photo.y + 4, photo.y + photo.height / 2, photo.y + photo.height - 4]

  for (const y of ys) {
    for (const x of xs) {
      await touch.send("touchStart", { x, y })
      await expect(touch.lens).toBeVisible()
      const b = (await touch.lens.boundingBox())!
      const where = `press at ${x},${y}, lens at ${b.x},${b.y}`
      expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= view.width && b.y + b.height <= view.height, where).toBe(true)
      // A fingertip and thumb: about 50 wide, reaching 90 below the touch point.
      const underThumb = b.x < x + 25 && b.x + b.width > x - 25 && b.y < y + 90 && b.y + b.height > y
      expect(underThumb, where).toBe(false)
      await touch.send("touchCancel")
      await expect(touch.lens).toHaveCount(0)
    }
  }
})

test("a swipe on the Photo scrolls the page and places nothing", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 100)).toBe(true)
  const touch = await fingers(page)
  const start = await onScreen(page, { x: 480, y: 500 })
  await touch.send("touchStart", start)
  for (const dy of [-40, -80, -120, -160]) await touch.send("touchMove", { x: start.x, y: start.y + dy })
  await touch.send("touchEnd")

  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100)
  await expect(touch.lens).toHaveCount(0)
  await expect(page.getByTestId("corner-prompt")).toContainText(FIRST_CORNER)
})

test("dragging after a hold does not scroll the page", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  const start = await onScreen(page, { x: 480, y: 500 })
  await touch.send("touchStart", start)
  await expect(touch.lens).toBeVisible()
  for (const dy of [-100, -200, -300]) await touch.send("touchMove", { x: start.x, y: start.y + dy })
  await touch.send("touchEnd")
  expect(await page.evaluate(() => scrollY)).toBe(0)
})

test("a pinch places nothing, whether the second finger comes down early or after a hold", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  const a = await onScreen(page, { x: 300, y: 300 })
  const b = await onScreen(page, { x: 340, y: 300 })
  const apart = { x: b.x + 40, y: b.y }

  // At once: the second finger lands before the hold, then the first finger lifts.
  await touch.send("touchStart", a)
  await touch.send("touchStart", a, b)
  await touch.send("touchMove", a, apart)
  await touch.send("touchEnd", { ...apart, id: 1 })
  await touch.send("touchEnd")
  await expectNothingPlaced(page, touch.lens)

  // After a hold: the magnifier is up, then the second finger lands and it goes.
  await touch.send("touchStart", a)
  await expect(touch.lens).toBeVisible()
  await touch.send("touchStart", a, b)
  await expect(touch.lens).toHaveCount(0)
  await touch.send("touchEnd", { ...b, id: 1 })
  await touch.send("touchEnd")
  await expectNothingPlaced(page, touch.lens)

  // And the next tap still works.
  await page.touchscreen.tap((await onScreen(page, TL)).x, (await onScreen(page, TL)).y)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
})

test("the page can still be pinch-zoomed and zoomed back out with two fingers on the Photo", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  const photo = (await page.getByTestId("photo").boundingBox())!
  const x = page.viewportSize()!.width / 2
  const y = photo.y + photo.height / 2
  const zoom = () => page.evaluate(() => visualViewport!.scale)

  // Two fingers, `from` then `to` CSS pixels either side of the middle of the Photo.
  const pinch = async (from: number, to: number) => {
    const apart = (half: number): [XY, XY] => [{ x: x - half, y }, { x: x + half, y }]
    await touch.send("touchStart", apart(from)[0])
    await touch.send("touchStart", ...apart(from))
    for (let i = 1; i <= 12; i++) await touch.send("touchMove", ...apart(from + ((to - from) * i) / 12))
    await touch.send("touchEnd", { ...apart(to)[1], id: 1 })
    await touch.send("touchEnd")
  }

  await pinch(16, 160)
  await expect.poll(zoom).toBeGreaterThan(1.5)
  await pinch(160, 16)
  await expect.poll(zoom).toBeLessThan(1.1)
  await expectNothingPlaced(page, touch.lens)
})

test("a press the browser cancels places nothing", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await touch.send("touchStart", await onScreen(page, TL))
  await expect(touch.lens).toBeVisible()
  await touch.send("touchCancel")
  await expectNothingPlaced(page, touch.lens)
})

test("the mouse works: a click places a point, and press-drag-release places it at the release", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const mouse = page.mouse
  const lens = page.getByTestId("magnifier")

  const from = await onScreen(page, before(TL))
  const to = await onScreen(page, TL)
  await mouse.move(from.x, from.y)
  await mouse.down()
  await expect(lens).toBeVisible() // a mouse has no scroll or pinch to tell apart, so no hold
  await mouse.move(to.x, to.y, { steps: 4 })
  await mouse.up()
  await expect(lens).toHaveCount(0)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)

  for (const point of [TR, BR, BL, SIM_SPOT]) {
    const at = await onScreen(page, point)
    await mouse.click(at.x, at.y)
  }
  await expectReading(page)
})

test("releasing the mouse well off the Photo places nothing", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const mouse = page.mouse
  const lens = page.getByTestId("magnifier")
  const photo = (await page.getByTestId("photo").boundingBox())!
  const middle = { x: photo.x + photo.width / 2, y: photo.y + photo.height / 2 }

  await mouse.move(middle.x, middle.y)
  await mouse.down()
  await expect(lens).toBeVisible()
  await mouse.move(middle.x, photo.y + photo.height + 80, { steps: 6 })
  await expect(lens).toHaveCount(0) // off the Photo, so lifting here would cancel
  await mouse.up()
  await mouse.move(middle.x, middle.y) // back over the Photo, nothing pressed
  await expectNothingPlaced(page, lens)

  // The press was ended by the release (the Photo kept the drag), so the next click places.
  const at = await onScreen(page, TL)
  await mouse.click(at.x, at.y)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
})

test("a press stops the context menu, a mouse right-click does not", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const photo = page.getByTestId("photo")
  const contextMenuAllowed = () =>
    photo.evaluate((el) => el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })))

  expect(await contextMenuAllowed()).toBe(true)
  const at = await onScreen(page, TL)
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  expect(await contextMenuAllowed()).toBe(false)
  await page.mouse.up()
  expect(await contextMenuAllowed()).toBe(true)
})
