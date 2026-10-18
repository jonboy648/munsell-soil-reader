// The magnifier and the gestures on the Photo, through the built page. Fingers are driven with
// raw touch events (Playwright's own touchscreen can only tap) and the mouse with the mouse
// API. What is asserted is what the user sees: the magnifier, the next prompt and the Reading.
import { expect, test, type Locator, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

/**
 * Where a place on the Photo, given in Photo pixels, is in the coordinates fingers and the mouse
 * use: CSS pixels from the top left of what is on screen. That is the page's own coordinates
 * unless the page is pinch-zoomed in.
 */
async function onScreen(page: Page, point: XY): Promise<XY> {
  const at = await page.getByTestId("photo").evaluate((photo) => {
    const r = photo.getBoundingClientRect()
    return { x: r.left - visualViewport!.offsetLeft, y: r.top - visualViewport!.offsetTop, w: r.width, h: r.height }
  })
  return { x: at.x + (point.x * at.w) / SIM_WIDTH, y: at.y + (point.y * at.h) / SIM_HEIGHT }
}

/** Where an element is on the glass, in screen pixels (CSS pixels times the pinch-zoom scale). */
const onGlass = (element: Locator) =>
  element.evaluate((node) => {
    const vv = visualViewport!
    const r = node.getBoundingClientRect()
    return {
      left: (r.left - vv.offsetLeft) * vv.scale,
      top: (r.top - vv.offsetTop) * vv.scale,
      width: r.width * vv.scale,
      height: r.height * vv.scale,
    }
  })

/** How big the screen is, in screen pixels, and how far the page is pinch-zoomed in. */
const glassOf = (page: Page) =>
  page.evaluate(() => ({
    width: visualViewport!.width * visualViewport!.scale,
    height: visualViewport!.height * visualViewport!.scale,
    scale: visualViewport!.scale,
  }))

type TouchType = "touchStart" | "touchMove" | "touchEnd" | "touchCancel"

/**
 * Raw fingers. Every call lists all the fingers that are down at that moment, on screen, the
 * first as finger 0 and so on; a finger that stays down while another lifts names its `id`.
 */
async function fingers(page: Page) {
  // Raw touch events are sent over the Chrome DevTools Protocol, which only Chromium has. On the
  // other engines these tests are skipped, and show up as skipped with this reason.
  test.skip(
    page.context().browser()?.browserType().name() !== "chromium",
    "raw touch events need the Chrome DevTools Protocol, which only Chromium has",
  )
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

type Fingers = Awaited<ReturnType<typeof fingers>>

/**
 * Waits until the page has stopped moving. A pinch ends with the browser animating the zoom and
 * the pan into place, which takes longer on a slow machine, and a position measured before it
 * finishes is where the Photo was, not where it is.
 */
const settled = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => {
        const view = () => `${visualViewport!.scale} ${visualViewport!.offsetLeft} ${visualViewport!.offsetTop}`
        let last = view()
        let since = performance.now()
        const check = () => {
          if (view() !== last) [last, since] = [view(), performance.now()]
          if (performance.now() - since > 300) done()
          else requestAnimationFrame(check)
        }
        check()
      }),
  )

/** Two fingers on the middle of the Photo, `from` then `to` CSS pixels either side of the middle. */
async function pinch(page: Page, touch: Fingers, from: number, to: number) {
  const x = page.viewportSize()!.width / 2
  const { y } = await onScreen(page, { x: SIM_WIDTH / 2, y: SIM_HEIGHT / 2 })
  const apart = (half: number): [XY, XY] => [{ x: x - half, y }, { x: x + half, y }]
  await touch.send("touchStart", apart(from)[0])
  await touch.send("touchStart", ...apart(from))
  for (let i = 1; i <= 12; i++) await touch.send("touchMove", ...apart(from + ((to - from) * i) / 12))
  await touch.send("touchEnd", { ...apart(to)[1], id: 1 })
  await touch.send("touchEnd")
  await settled(page)
}

const LENS = 136 // the magnifier's size on screen, in pixels, when there is room

/** Presses the part of the Photo that is on screen, from its corners to its middle, and checks the lens. */
async function expectLensClearOfFinger(page: Page, touch: Fingers, smallest: number) {
  const glass = await glassOf(page)
  const photo = await onGlass(page.getByTestId("photo"))
  const left = Math.max(photo.left, 0) + 4
  const right = Math.min(photo.left + photo.width, glass.width) - 4
  const top = Math.max(photo.top, 0) + 4
  const bottom = Math.min(photo.top + photo.height, glass.height) - 4

  for (const y of [top, (top + bottom) / 2, bottom]) {
    for (const x of [left, (left + right) / 2, right]) {
      await touch.send("touchStart", { x: x / glass.scale, y: y / glass.scale })
      await expect(touch.lens).toBeVisible()
      const l = await onGlass(touch.lens)
      const where = `finger at ${x},${y}, lens at ${l.left},${l.top}, ${l.width} wide, on a ${glass.width}x${glass.height} screen`
      expect(l.left >= -0.5 && l.top >= -0.5, where).toBe(true)
      expect(l.left + l.width <= glass.width + 0.5 && l.top + l.height <= glass.height + 0.5, where).toBe(true)
      // Its size on the glass does not depend on the zoom: full size unless the screen is too narrow.
      expect(l.width, where).toBeGreaterThanOrEqual(smallest)
      expect(l.width, where).toBeLessThanOrEqual(LENS + 0.5)
      // A fingertip and thumb: about 50 wide, reaching 90 below the touch point.
      const underThumb = l.left < x + 25 && l.left + l.width > x - 25 && l.top < y + 90 && l.top + l.height > y
      expect(underThumb, where).toBe(false)
      await touch.send("touchCancel")
      await expect(touch.lens).toHaveCount(0)
    }
  }
}

// The right edge of the magenta patch, with the dark frame past it, and the row through its middle.
const MAGENTA_EDGE: XY = { x: 418, y: 299 }

/**
 * Presses just left of that edge, near enough that a 4x lens has it 30 screen pixels from its
 * middle at any pinch-zoom (the lens only shows a few Photo pixels when the page is zoomed in).
 * Returns how many Photo pixels left of the edge that is.
 */
async function pressNearEdge(page: Page, touch: Fingers) {
  const photo = await onGlass(page.getByTestId("photo"))
  const away = 30 / (4 * (photo.width / SIM_WIDTH))
  await touch.send("touchStart", await onScreen(page, { x: MAGENTA_EDGE.x - away, y: MAGENTA_EDGE.y }))
  return away
}

/** How many times bigger than it looks on screen the lens shows the Photo, from where that edge falls. */
async function lensMagnification(page: Page, lens: Locator, away: number) {
  const photo = await onGlass(page.getByTestId("photo"))
  const edge = await lens.evaluate((canvas: HTMLCanvasElement) => {
    // A row clear of the crosshair, walking right from the middle to the first dark pixel.
    const row = canvas.getContext("2d")!.getImageData(0, canvas.height / 2 + canvas.height / 5, canvas.width, 1).data
    let x = Math.floor(canvas.width / 2)
    while (x < canvas.width && row[x * 4] >= 128) x++
    const glassPerPixel = (canvas.clientWidth * visualViewport!.scale) / canvas.width
    return (x - canvas.width / 2) * glassPerPixel
  })
  return edge / (away * (photo.width / SIM_WIDTH))
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

  const away = await pressNearEdge(page, touch)
  await expect(touch.lens).toBeVisible()
  const box = (await touch.lens.boundingBox())!
  expect(box.y + box.height).toBeLessThan((await onScreen(page, MAGENTA_EDGE)).y) // above the finger
  expect(await lensMagnification(page, touch.lens, away)).toBeGreaterThanOrEqual(3)

  // It follows the finger, centered on it once clear of the screen's edge.
  const moved = await onScreen(page, { x: 230, y: MAGENTA_EDGE.y })
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
  await expectLensClearOfFinger(page, await fingers(page), LENS - 1)
})

// Pinch-zoomed in, the magnifier keeps its size on the glass, still shows 4x what is on screen,
// and still stays clear of the finger. 1.6x is where an unscaled lens used to cover the finger;
// the most the browser zooms is 5x.
for (const [name, from, to, least, most] of [
  ["about 1.6x", 100, 138, 1.4, 1.9],
  ["the most it goes", 16, 160, 4.5, 5.1],
] as const) {
  test(`the magnifier keeps its size and place when the page is zoomed in ${name}`, async ({ page }) => {
    await pickExample(page, "Warm shop light")
    const touch = await fingers(page)
    await pinch(page, touch, from, to)
    await expect.poll(async () => (await glassOf(page)).scale).toBeGreaterThan(least)
    expect((await glassOf(page)).scale).toBeLessThan(most)
    await expectLensClearOfFinger(page, touch, LENS - 1)

    const away = await pressNearEdge(page, touch)
    await expect(touch.lens).toBeVisible()
    const zoom = await lensMagnification(page, touch.lens, away)
    expect(zoom).toBeGreaterThan(3.5)
    expect(zoom).toBeLessThan(4.5)
    await touch.send("touchCancel")
  })
}

test("the magnifier moves back on screen if the screen gets shorter while it is held", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  const photo = (await page.getByTestId("photo").boundingBox())!
  // Near the top of the screen, so the lens is beside the finger, part way down.
  await touch.send("touchStart", { x: 206, y: photo.y + 4 })
  await expect(touch.lens).toBeVisible()

  await page.setViewportSize({ width: 412, height: 150 })
  await expect
    .poll(async () => {
      const l = await onGlass(touch.lens)
      return l.top + l.height <= 150
    })
    .toBe(true)
  await touch.send("touchCancel")
})

test.describe("on a narrow phone", () => {
  test.use({ viewport: { width: 320, height: 658 } })

  test("the magnifier shrinks beside the finger rather than cover it", async ({ page }) => {
    await pickExample(page, "Warm shop light")
    await expectLensClearOfFinger(page, await fingers(page), 80)
  })
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

// Pinch-zoomed to about 2x, where the page has more to show than the screen does. The view is
// "panned" when the visual viewport moves over the page, which scrollY alone does not show.
async function zoomedTwice(page: Page, touch: Fingers) {
  await pinch(page, touch, 60, 100)
  await expect.poll(async () => (await glassOf(page)).scale).toBeGreaterThan(1.7)
  expect((await glassOf(page)).scale).toBeLessThan(2.4)
}
const viewOf = (page: Page) => page.evaluate(() => ({ x: visualViewport!.pageLeft, y: visualViewport!.pageTop }))

test("a swipe on the Photo pans a pinch-zoomed page and places nothing", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await zoomedTwice(page, touch)
  const swipe = async (dx: number, dy: number) => {
    const start = await onScreen(page, { x: SIM_WIDTH / 2, y: SIM_HEIGHT / 2 })
    await touch.send("touchStart", start)
    for (const f of [0.25, 0.5, 0.75, 1]) await touch.send("touchMove", { x: start.x + dx * f, y: start.y + dy * f })
    await touch.send("touchEnd")
  }

  // The finger going left moves the view right over the page, and going up moves it down. The
  // browser pans along one axis at a time, so these are two swipes.
  const before = await viewOf(page)
  await swipe(-80, 0)
  await expect.poll(async () => (await viewOf(page)).x - before.x).toBeGreaterThan(20)
  await swipe(0, -80)
  await expect.poll(async () => (await viewOf(page)).y - before.y).toBeGreaterThan(20)
  await expectNothingPlaced(page, touch.lens)
})

test("after a hold, dragging on a pinch-zoomed page places a point and does not pan", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await zoomedTwice(page, touch)
  const before = await viewOf(page)

  const from = await onScreen(page, { x: SIM_WIDTH / 2, y: SIM_HEIGHT / 2 })
  await touch.holdDrag(from, { x: from.x - 30, y: from.y - 15 })

  const after = await viewOf(page)
  expect(Math.abs(after.x - before.x)).toBeLessThan(1)
  expect(Math.abs(after.y - before.y)).toBeLessThan(1)
  await expect(touch.lens).toHaveCount(0)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
})

// A swipe coasts on after the finger lifts, and the natural way to stop it is a tap on the page.
// That tap is not a point to place.
const tap = async (touch: Fingers, at: XY) => {
  await touch.send("touchStart", at)
  await touch.send("touchEnd")
}

test("a tap that stops a coasting page places nothing, and a tap a moment later places", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  // Part way down the page, so a swipe down has page to scroll back over; y = 150 is on the Photo
  // all the way from here to the top.
  await page.evaluate(() => scrollTo(0, 150))
  const on = { x: 206, y: 150 }

  await touch.send("touchStart", on)
  for (const dy of [30, 60, 90, 120]) await touch.send("touchMove", { x: on.x, y: on.y + dy })
  await touch.send("touchEnd")
  await tap(touch, on) // the page is still moving, or has only just stopped
  await expectNothingPlaced(page, touch.lens)

  await page.waitForTimeout(1000)
  await tap(touch, on)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
})

test("a hold right after a swipe still places, since it is not a tap", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await page.evaluate(() => scrollTo(0, 150))
  const on = { x: 206, y: 150 }

  await touch.send("touchStart", on)
  for (const dy of [30, 60, 90, 120]) await touch.send("touchMove", { x: on.x, y: on.y + dy })
  await touch.send("touchEnd")
  await touch.holdDrag(on, on)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
})

test("a tap that stops a pinch-zoomed page from panning places nothing, and a tap a moment later places", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await zoomedTwice(page, touch)
  const middle = await onScreen(page, { x: SIM_WIDTH / 2, y: SIM_HEIGHT / 2 })

  await touch.send("touchStart", middle)
  for (const f of [0.25, 0.5, 0.75, 1]) await touch.send("touchMove", { x: middle.x - 80 * f, y: middle.y })
  await touch.send("touchEnd")
  await tap(touch, middle)
  await expectNothingPlaced(page, touch.lens)

  await page.waitForTimeout(1000)
  await tap(touch, middle)
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
})

test("a tap right after the app scrolls the page itself still places", async ({ page }) => {
  await pickExample(page, "Warm shop light")
  const touch = await fingers(page)
  await page.evaluate(() => scrollTo(0, 50))
  await tap(touch, await onScreen(page, TL))
  await expect(page.getByTestId("corner-prompt")).toContainText(SECOND_CORNER)
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
  const zoom = async () => (await glassOf(page)).scale

  await pinch(page, touch, 16, 160)
  await expect.poll(zoom).toBeGreaterThan(1.5)
  await pinch(page, touch, 160, 16)
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
