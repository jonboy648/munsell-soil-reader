// Install and offline: the manifest, the service worker, a Reading with no network, and the
// reload notice for a new deploy. Like reader.spec.ts, these drive the built page only.
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { expect, test, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

/**
 * Open the app, wait for its service worker to install and cache everything, then reload so
 * the page is one the service worker controls (a first visit is not controlled).
 */
async function openControlled(page: Page, url = "/") {
  await page.goto(url)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

/** Tap a place on the Photo, given in Photo pixels (the example Photo is SIM_WIDTH x SIM_HEIGHT). */
async function tapPhoto(page: Page, point: XY) {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  await page.touchscreen.tap(
    box.x + (point.x * box.width) / SIM_WIDTH,
    box.y + (point.y * box.height) / SIM_HEIGHT,
  )
}

test("the manifest is linked and has what installing needs", async ({ page }) => {
  await page.goto("/")
  const href = await page.locator('link[rel="manifest"]').getAttribute("href")
  expect(href).toBeTruthy()
  const response = await page.request.get(new URL(href!, page.url()).href)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()

  expect(manifest).toMatchObject({
    name: "Munsell Soil Reader",
    short_name: "Munsell Soil Reader",
    display: "standalone",
    start_url: "/",
    scope: "/",
  })
  // Gray only: red, green and blue the same.
  expect(manifest.theme_color).toMatch(/^#([0-9a-f]{2})\1\1$/i)
  expect(manifest.background_color).toMatch(/^#([0-9a-f]{2})\1\1$/i)

  const icons: { src: string; sizes: string; type: string; purpose: string }[] = manifest.icons
  expect(icons.filter((i) => i.purpose === "any").map((i) => i.sizes).sort()).toEqual([
    "192x192",
    "512x512",
  ])
  expect(icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true)
  for (const icon of icons) {
    const file = await page.request.get(new URL(icon.src, new URL(href!, page.url())).href)
    expect(file.ok(), icon.src).toBe(true)
    expect(file.headers()["content-type"], icon.src).toBe(icon.type)
  }
})

test("Chromium finds nothing in the way of installing the app", async ({ page }) => {
  await openControlled(page)
  // The browser's own installability check, run on the built page.
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors")
  expect(installabilityErrors).toEqual([])
})

test("a service worker is registered at the site root and controls the page", async ({ page }) => {
  await openControlled(page)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  expect(scope).toBe(new URL("/", page.url()).href)
})

test("works offline after the first visit: reload with no network and complete a Reading", async ({
  page,
  context,
}) => {
  const failed: string[] = []
  page.on("requestfailed", (request) => failed.push(request.url()))
  const origins = new Set<string>()
  page.on("request", (request) => {
    if (request.url().startsWith("http")) origins.add(new URL(request.url()).origin)
  })

  await openControlled(page)

  await context.setOffline(true)
  await page.reload()
  await page.getByRole("button", { name: /Warm shop light/ }).click()
  await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")
  for (const corner of SIM_CORNERS) await tapPhoto(page, corner)
  await tapPhoto(page, SIM_SPOT)
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")

  // Nothing the page asked for failed, and everything came from this site: the fonts are
  // bundled, not fetched from Google Fonts, and they loaded with no network.
  expect(failed).toEqual([])
  expect([...origins]).toEqual([new URL(page.url()).origin])
  const loadedFonts = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family)
  })
  expect(loadedFonts.some((family) => family.includes("Public Sans"))).toBe(true)
  expect(loadedFonts.some((family) => family.includes("Archivo"))).toBe(true)
})

test("a new deploy shows a Reload notice, and Reload switches to it", async ({ page, baseURL }) => {
  // Playwright cannot swap the service worker file mid-test, so the page is served through a
  // small proxy to the preview server. Once `deployed` is set, sw.js comes back a byte longer,
  // which is all the browser needs to see a new version.
  let deployed = false
  const proxy = createServer(async (req, res) => {
    const upstream = await fetch(new URL(req.url ?? "/", baseURL))
    let body = Buffer.from(await upstream.arrayBuffer())
    if (deployed && req.url === "/sw.js") body = Buffer.concat([body, Buffer.from("\n// the next deploy")])
    res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "" })
    res.end(body)
  })
  await new Promise<void>((done) => proxy.listen(0, "127.0.0.1", done))
  try {
    await openControlled(page, `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/`)
    await expect(page.getByTestId("update-notice")).toHaveCount(0)

    deployed = true
    // The app looks for a new version when it comes back to the front.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    const notice = page.getByTestId("update-notice")
    await expect(notice).toContainText("A new version is ready")
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)

    await Promise.all([page.waitForEvent("load"), notice.getByRole("button", { name: "Reload" }).click()])
    await expect(page.getByTestId("update-notice")).toHaveCount(0)
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false)
  } finally {
    proxy.close()
  }
})
