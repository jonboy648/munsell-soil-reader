// Install and offline: the manifest, the service worker, a Reading with no network, and the
// notices for the first install and for a new deploy. Like reader.spec.ts, these drive the
// built page only.
import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, devices, expect, test as base, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

/** A stand-in for soil.joncackler.com that can publish new versions of the app. */
type Site = {
  url: string
  /**
   * Publish version 2, 3, ...: index.html changes (its <html> gets data-deploy) and so does its
   * revision in the service worker, as in a real deploy. With failInstall the new service worker
   * installs badly and is thrown away.
   */
  deploy: (version: number, options?: { failInstall?: boolean }) => void
}

// Playwright cannot swap files mid-test, so the app is served through a small proxy to the
// preview server (on a dynamic port, so parallel runs never collide).
const test = base.extend<{ site: Site }>({
  site: async ({ baseURL }, use) => {
    let version = 1
    let failInstall = false
    const proxy = createServer(async (req, res) => {
      const target = new URL(req.url ?? "/", baseURL)
      const upstream = await fetch(target)
      let body = Buffer.from(await upstream.arrayBuffer())
      if (version > 1 && (target.pathname === "/" || target.pathname === "/index.html")) {
        body = Buffer.from(
          body.toString().replace('<html lang="en">', `<html lang="en" data-deploy="${version}">`),
        )
      }
      if (version > 1 && target.pathname === "/sw.js") {
        let script = body
          .toString()
          .replace(/(url:"index\.html",revision:)"[^"]*"/, `$1"deploy-${version}"`)
        if (failInstall) {
          script += '\nself.addEventListener("install",e=>e.waitUntil(Promise.reject(new Error("no"))))'
        }
        body = Buffer.from(script)
      }
      res.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "" })
      res.end(body)
    })
    await new Promise<void>((done) => proxy.listen(0, "127.0.0.1", done))
    await use({
      url: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}/`,
      deploy: (next, options) => {
        version = next
        failInstall = options?.failInstall ?? false
      },
    })
    proxy.close()
  },
})

/** Open the app and wait for the first install to finish; the page is not controlled yet. */
async function openFirstVisit(page: Page, url = "/") {
  await page.goto(url)
  await expect(page.getByTestId("offline-notice")).toBeVisible()
}

/** Open the app, let its service worker install, then reload so the page is one it controls. */
async function openControlled(page: Page, url = "/") {
  await page.goto(url)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

/** The app looks for a new version when it comes back to the front; do that. */
const lookForUpdate = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

const hasWaitingWorker = (page: Page) =>
  page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)

async function tapReload(page: Page) {
  await Promise.all([
    page.waitForEvent("load"),
    page.getByTestId("update-notice").getByRole("button", { name: "Reload" }).click(),
  ])
}

const pickExample = (page: Page) => page.getByRole("button", { name: /Warm shop light/ }).click()

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

// Chromium's own installability check. It only does its work in a real (non-incognito) profile,
// and Playwright's default contexts are incognito, where it answers "in-incognito" and nothing
// else. So these two tests run a persistent profile in full Chromium. The second one is the
// guard: a page with no manifest must be reported, or the first test could never fail.
async function installabilityErrors(baseURL: string, open: (page: Page) => Promise<void>) {
  const profile = mkdtempSync(join(tmpdir(), "munsell-install-"))
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    ...devices["Pixel 7"],
    baseURL,
  })
  try {
    const page = await context.newPage()
    await open(page)
    const cdp = await context.newCDPSession(page)
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors")
    return installabilityErrors.map((error) => error.errorId)
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
}

test("Chromium finds nothing in the way of installing the app", async ({ baseURL }) => {
  const errors = await installabilityErrors(baseURL!, (page) => openControlled(page))
  expect(errors).toEqual([])
})

test("the installability check does report a page with no manifest", async ({ baseURL }) => {
  const errors = await installabilityErrors(baseURL!, async (page) => {
    // Its own origin, so the app's service worker does not answer for it.
    await page.context().route("http://127.0.0.1:1/", (route) =>
      route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Bare</title>" }),
    )
    await page.goto("http://127.0.0.1:1/")
  })
  expect(errors).toContain("no-manifest")
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
  await pickExample(page)
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

test("the first visit says it is ready to work offline, once, and asks the browser to keep the copy", async ({
  page,
  site,
}) => {
  await page.addInitScript(() => {
    const storage = navigator.storage
    const persist = storage.persist.bind(storage)
    Object.assign(window, { persistCalls: 0 })
    storage.persist = () => {
      Object.assign(window, { persistCalls: (window as unknown as { persistCalls: number }).persistCalls + 1 })
      return persist()
    }
  })
  await openFirstVisit(page, site.url)
  await expect(page.getByTestId("offline-notice")).toContainText("Ready to work offline")
  expect(await page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls)).toBe(1)

  await page.getByTestId("offline-notice").getByRole("button", { name: "OK" }).click()
  await expect(page.getByTestId("offline-notice")).toHaveCount(0)

  // Opening it again does not announce it again.
  await page.reload()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect(page.getByTestId("offline-notice")).toHaveCount(0)
})

test("the browser bar color follows the in-app light and dark switch, not just the OS", async ({ page }) => {
  const barColors = () =>
    page.locator('meta[name="theme-color"]').evaluateAll((metas) => metas.map((m) => m.getAttribute("content")))
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await expect.poll(barColors).toEqual(["#1f1f1f", "#1f1f1f"])

  // The OS says dark; the user picks light.
  await page.getByRole("button", { name: "Switch to light mode" }).click()
  await expect.poll(barColors).toEqual(["#ebebeb", "#ebebeb"])
  await page.getByRole("button", { name: "Switch to dark mode" }).click()
  await expect.poll(barColors).toEqual(["#1f1f1f", "#1f1f1f"])
})

test.describe("iPhone and iPad", () => {
  test.use({ userAgent: devices["iPhone 14"].userAgent })

  test("a browser tab is told to Add to Home Screen and open it once with signal", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("install-hint")).toContainText("Add to Home Screen")
    await expect(page.getByTestId("install-hint")).toContainText("once with signal")
  })

  test("the installed app does not show the hint", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }))
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Munsell Soil Reader" })).toBeVisible()
    await expect(page.getByTestId("install-hint")).toHaveCount(0)
  })
})

test("other phones are not shown the iPhone hint", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Munsell Soil Reader" })).toBeVisible()
  await expect(page.getByTestId("install-hint")).toHaveCount(0)
})

test("a new deploy shows a Reload notice, and Reload switches to the new version", async ({ page, site }) => {
  await openControlled(page, site.url)
  await expect(page.getByTestId("update-notice")).toHaveCount(0)
  await expect(page.locator("html")).not.toHaveAttribute("data-deploy", /.*/)

  site.deploy(2)
  await lookForUpdate(page)
  await expect(page.getByTestId("update-notice")).toContainText("A new version is ready")
  // Until the user taps Reload the page stays as it was.
  expect(await hasWaitingWorker(page)).toBe(true)
  await expect(page.locator("html")).not.toHaveAttribute("data-deploy", /.*/)

  await tapReload(page)
  await expect(page.locator("html")).toHaveAttribute("data-deploy", "2")
  await expect(page.getByTestId("update-notice")).toHaveCount(0)
  expect(await hasWaitingWorker(page)).toBe(false)
})

test("a page open since before the first install gets the update too", async ({ page, site }) => {
  await openFirstVisit(page, site.url)
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull()

  site.deploy(2)
  await lookForUpdate(page)
  await expect(page.getByTestId("update-notice")).toBeVisible()
  await tapReload(page)
  await expect(page.locator("html")).toHaveAttribute("data-deploy", "2")
  await expect(page.getByTestId("update-notice")).toHaveCount(0)
})

test.describe("a page that has been open for more than a minute", () => {
  // workbox-window stops watching for updates 60 seconds after registering, so the page
  // thinks it has been open for two minutes.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const now = performance.now.bind(performance)
      performance.now = () => now() + 120_000
    })
  })

  test("still gets the update notice", async ({ page, site }) => {
    await openControlled(page, site.url)
    site.deploy(2)
    await lookForUpdate(page)
    await expect(page.getByTestId("update-notice")).toBeVisible()
    await tapReload(page)
    await expect(page.locator("html")).toHaveAttribute("data-deploy", "2")
  })

  test("still gets the next deploy after one that failed to install", async ({ page, site }) => {
    await openControlled(page, site.url)
    site.deploy(2, { failInstall: true })
    await lookForUpdate(page)
    // The bad worker is thrown away and nothing is offered.
    await expect.poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return !registration?.installing && !registration?.waiting
      }),
    ).toBe(true)
    await expect(page.getByTestId("update-notice")).toHaveCount(0)

    site.deploy(3)
    await lookForUpdate(page)
    await expect(page.getByTestId("update-notice")).toBeVisible()
    await tapReload(page)
    await expect(page.locator("html")).toHaveAttribute("data-deploy", "3")
  })
})

test("with a Photo open the notice asks to finish first, and a cold reopen has the new version", async ({
  page,
  context,
  site,
}) => {
  await openControlled(page, site.url)
  await pickExample(page)
  await expect(page.getByTestId("photo-name")).toBeVisible()

  site.deploy(2)
  await lookForUpdate(page)
  const notice = page.getByTestId("update-notice")
  await expect(notice).toContainText("Reload clears the current Photo")
  await expect(notice.getByRole("button", { name: "Reload" })).toHaveCount(0)
  await expect(page.getByTestId("photo-name")).toBeVisible()

  // The user finishes, closes the app and opens it again.
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(site.url)
  await expect(reopened.locator("html")).toHaveAttribute("data-deploy", "2")
  await expect(reopened.getByTestId("update-notice")).toHaveCount(0)
})

test("Reload switches only the window where it was tapped", async ({ page, context, site }) => {
  await openControlled(page, site.url)
  const other = await context.newPage()
  await other.goto(site.url)
  await expect.poll(() => other.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await other.evaluate(() => Object.assign(window, { stillHere: true }))

  site.deploy(2)
  await lookForUpdate(page)
  await lookForUpdate(other)
  await expect(page.getByTestId("update-notice")).toBeVisible()
  await expect(other.getByTestId("update-notice")).toBeVisible()

  await tapReload(page)
  await expect(page.locator("html")).toHaveAttribute("data-deploy", "2")
  // The other window was not reloaded under its user.
  await expect(other.getByTestId("update-notice")).toBeVisible()
  expect(await other.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true)
})
