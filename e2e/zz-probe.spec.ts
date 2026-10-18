// @ts-nocheck
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


const LOG = () => {
  const ev: string[] = ((window as any).__ev = [])
  const t0 = performance.now()
  for (const t of ["pointerdown", "pointerup", "pointercancel", "pointermove", "touchstart", "touchend", "touchcancel"])
    window.addEventListener(t, (e: any) => {
      const p = e.touches?.[0] ?? e
      ev.push(`${(performance.now() - t0).toFixed(0)} ${t} id${e.pointerId ?? ""} ${p.clientX?.toFixed?.(1)},${p.clientY?.toFixed?.(1)} ${(e.target as HTMLElement).tagName} cancelable=${e.cancelable}`)
    }, true)
}
for (const [name, from, to, least, most] of [
  ["about 1.6x", 100, 138, 1.4, 1.9],
  ["the most it goes", 16, 160, 4.5, 5.1],
] as const) {
  test(`probe zoomed in ${name}`, async ({ page }) => {
    await page.addInitScript(LOG)
    await pickExample(page, "Warm shop light")
    const touch = await fingers(page)
    await pinch(page, touch, from, to)
    await expect.poll(async () => (await glassOf(page)).scale).toBeGreaterThan(least)
    expect((await glassOf(page)).scale).toBeLessThan(most)
    try {
      await expectLensClearOfFinger(page, touch, LENS - 1)
    } catch (e) {
      const dump = await page.evaluate(() => ({ ev: (window as any).__ev.slice(-30), vv: { s: visualViewport!.scale, l: visualViewport!.offsetLeft, t: visualViewport!.offsetTop, w: visualViewport!.width, h: visualViewport!.height }, photo: document.querySelector('[data-testid="photo"]')!.getBoundingClientRect().toJSON(), lens: !!document.querySelector('[data-testid="magnifier"]') }))
      console.log("PROBE-FAIL " + name + " " + String(e).split(String.fromCharCode(10)).slice(0, 3).join(" | ") + " " + JSON.stringify(dump))
      throw e
    }
  })
}
