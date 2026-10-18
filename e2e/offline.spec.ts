// Install and offline: the manifest, the service worker, a Reading with no network, and the
// notices for the first install and for a new deploy. Like reader.spec.ts, these drive the
// built page only.
import { mkdtempSync, rmSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, devices, expect, test as base, type BrowserContext, type Locator, type Page } from "@playwright/test"
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
  /** Make a precached file answer 503 (or stop), as on a weak signal. */
  failPrecache: (on: boolean) => void
  /** How many times a precached file has answered 503. */
  precacheFailures: () => number
  /** Make a precached file slow, so the first install finishes this many ms late. */
  delayPrecache: (ms: number) => void
}

// Playwright cannot swap files mid-test, so the app is served through a small proxy to the
// preview server (on a dynamic port, so parallel runs never collide).
const test = base.extend<{ site: Site; fullChromium: BrowserContext }>({
  // A persistent profile in full Chromium, for the installability check (see below). Its folder is
  // short and in the OS temp folder: under the long test output path, Chromium's cache folders
  // pass Windows' path limit and the service worker never installs. Fixture teardown also runs
  // after a timeout, so neither the browser nor the folder is left behind.
  fullChromium: async ({ baseURL, browserName }, use) => {
    // Chromium's installability check is read over the Chrome DevTools Protocol, and only Chromium
    // has it. Skipped here, before the launch, because the other engines' jobs have no Chromium.
    base.skip(browserName !== "chromium", "the installability check is Chromium's, read over CDP")
    const profile = mkdtempSync(join(tmpdir(), "munsell-"))
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      ...devices["Pixel 7"],
      baseURL,
    })
    try {
      await use(context)
    } finally {
      await context.close()
      rmSync(profile, { recursive: true, force: true })
    }
  },
  site: async ({ baseURL }, use) => {
    let version = 1
    let failInstall = false
    let failPrecache = false
    let failures = 0
    let delay = 0
    const proxy = createServer(async (req, res) => {
      const target = new URL(req.url ?? "/", baseURL)
      if (delay && target.pathname === "/icon-512.png") await new Promise((r) => setTimeout(r, delay))
      if (failPrecache && target.pathname === "/icon-512.png") {
        failures++
        res.writeHead(503).end()
        return
      }
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
      failPrecache: (on) => {
        failPrecache = on
      },
      precacheFailures: () => failures,
      delayPrecache: (ms) => {
        delay = ms
      },
    })
    proxy.close()
  },
})

// playwright.config.ts blocks service workers, so the other specs never see their notices; this
// spec is the one about them.
test.use({ serviceWorkers: "allow" })

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

// Chromium's own installability check, which is about the manifest and the icons; that the app
// has a service worker and works offline is what the tests after these two cover. The check only
// does its work in a real (non-incognito) profile, and Playwright's default contexts are
// incognito, where it answers "in-incognito" and nothing else; hence the fullChromium fixture.
// The second test is the guard: a page with no manifest must be reported, or the first test
// could never fail.
async function installabilityErrors(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors")
  return installabilityErrors.map((error) => error.errorId)
}

test("Chromium finds nothing in the way of installing the app", async ({ fullChromium }) => {
  const page = await fullChromium.newPage()
  await openControlled(page)
  expect(await installabilityErrors(page)).toEqual([])
})

test("the installability check does report a page with no manifest", async ({ fullChromium }) => {
  // Its own origin, so the app's service worker does not answer for it.
  await fullChromium.route("http://127.0.0.1:1/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Bare</title>" }),
  )
  const page = await fullChromium.newPage()
  await page.goto("http://127.0.0.1:1/")
  expect(await installabilityErrors(page)).toContain("no-manifest")
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
  // Counted on the prototype: WebKit drops a property set on the storage object itself once
  // nothing in the page holds that object, and the app asks for `navigator.storage` afresh.
  await page.addInitScript(() => {
    const prototype = Object.getPrototypeOf(navigator.storage)
    const persist = prototype.persist
    Object.assign(window, { persistCalls: 0 })
    prototype.persist = function (this: StorageManager) {
      Object.assign(window, { persistCalls: (window as unknown as { persistCalls: number }).persistCalls + 1 })
      return persist.call(this)
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
    await expect(page.getByTestId("install-hint")).toContainText("open this page in Safari")
  })

  test("the ready-offline notice carries the Home Screen caveat", async ({ page, site }) => {
    await openFirstVisit(page, site.url)
    await expect(page.getByTestId("offline-notice")).toContainText("open it once online")
  })

  test("the installed app does not show the hint", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }))
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Munsell Soil Reader" })).toBeVisible()
    await expect(page.getByTestId("install-hint")).toHaveCount(0)
  })
})

test.describe("other phones", () => {
  test.use({ userAgent: devices["Pixel 7"].userAgent })

  test("are not shown the iPhone hint", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Munsell Soil Reader" })).toBeVisible()
    await expect(page.getByTestId("install-hint")).toHaveCount(0)
  })
})

test("a new deploy shows a Reload notice, and Reload switches to the new version", async ({ page, site }) => {
  await openControlled(page, site.url)
  await expect(page.getByTestId("update-notice")).toHaveCount(0)
  await expect(page.locator("html")).not.toHaveAttribute("data-deploy", /.*/)

  site.deploy(2)
  await lookForUpdate(page)
  await expect(page.getByTestId("update-notice")).toContainText("Update ready")
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

test("with a Photo open, resuming the app offers Reload and says it clears the Photo, and Later hides it until the next resume", async ({
  page,
  site,
}) => {
  await openControlled(page, site.url)
  await pickExample(page)
  await expect(page.getByTestId("photo-name")).toBeVisible()
  await page.evaluate(() => Object.assign(window, { stayed: true })) // survives a resume, not a reload

  // Coming back to the front is a resume, not a navigation.
  site.deploy(2)
  await lookForUpdate(page)
  const notice = page.getByTestId("update-notice")
  await expect(notice).toContainText("Reload clears this Photo")
  await expect(notice.getByRole("button", { name: "Reload" })).toBeVisible()
  await expect(page.getByTestId("photo-name")).toBeVisible()

  await notice.getByRole("button", { name: "Later" }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.getByTestId("photo-name")).toBeVisible()
  await lookForUpdate(page) // the next resume
  await expect(page.getByTestId("update-notice")).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true)

  await tapReload(page)
  await expect(page.locator("html")).toHaveAttribute("data-deploy", "2")
  await expect(page.getByTestId("photo-name")).toHaveCount(0)
  await expect(page.getByTestId("update-notice")).toHaveCount(0)
})

test("with a Photo open, closing the app and opening it again has the new version", async ({
  page,
  context,
  site,
}) => {
  await openControlled(page, site.url)
  await pickExample(page)
  site.deploy(2)
  await lookForUpdate(page)
  await expect(page.getByTestId("update-notice")).toBeVisible()

  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(site.url)
  await expect(reopened.locator("html")).toHaveAttribute("data-deploy", "2")
  await expect(reopened.getByTestId("update-notice")).toHaveCount(0)
})

/** Where the header, the step indicator and the Photo are: none of them may move or be covered. */
async function layout(page: Page) {
  const boxes = await Promise.all(
    [page.getByRole("banner"), page.getByRole("list", { name: "Steps" }), page.getByTestId("photo")].map((l) =>
      l.boundingBox(),
    ),
  )
  return boxes
}

/** The notice replaces the title, so it must be no bigger than the header and hold its content. */
async function expectNoticeFits(notice: Locator, page: Page) {
  const [noticeBox, headerBox] = await Promise.all([notice.boundingBox(), page.getByRole("banner").boundingBox()])
  expect(noticeBox).toEqual(headerBox)
  const size = await notice.evaluate((el) => ({
    over: el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth,
  }))
  expect(size.over).toBe(false)
}

test.describe("on a 320 x 568 phone", () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test("an update notice with a Photo open moves and covers nothing, and the Photo stays tappable", async ({
    page,
    site,
  }) => {
    await openControlled(page, site.url)
    await pickExample(page)
    await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")
    const before = await layout(page)

    site.deploy(2)
    await lookForUpdate(page)
    const notice = page.getByTestId("update-notice")
    await expect(notice).toContainText("Reload clears this Photo")
    expect(await layout(page)).toEqual(before)
    await expectNoticeFits(notice, page)

    await tapPhoto(page, SIM_CORNERS[0])
    await expect(page.getByTestId("corner-prompt")).toContainText("bluish-green patch (top right)")
  })

  test("the ready-offline notice arriving with a Photo open moves and covers nothing", async ({ page, site }) => {
    site.delayPrecache(2000) // the install finishes after the Photo is up
    await page.goto(site.url)
    await pickExample(page)
    await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")
    const before = await layout(page)
    await expect(page.getByTestId("offline-notice")).toBeVisible()
    expect(await layout(page)).toEqual(before)
    await expectNoticeFits(page.getByTestId("offline-notice"), page)
  })

  test.describe("on an iPhone", () => {
    test.use({ userAgent: devices["iPhone 14"].userAgent })

    test("the ready-offline notice with the Home Screen caveat still fits the header", async ({ page, site }) => {
      await openFirstVisit(page, site.url)
      await expect(page.getByTestId("offline-notice")).toContainText("open it once online")
      await expectNoticeFits(page.getByTestId("offline-notice"), page)
    })
  })
})

test("a first install that fails is tried again when the app comes back to the front", async ({ page, site }) => {
  // The first visit on a weak signal: one precached file answers 503, so the install fails and
  // the browser drops the registration.
  site.failPrecache(true)
  await page.goto(site.url)
  // Wait for the install to really have failed, not just for there to be no registration yet.
  await expect.poll(() => site.precacheFailures()).toBeGreaterThan(0)
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()) === undefined))
    .toBe(true)
  await expect(page.getByTestId("offline-notice")).toHaveCount(0)

  // Signal comes back; no reload.
  site.failPrecache(false)
  await lookForUpdate(page)
  await expect(page.getByTestId("offline-notice")).toContainText("Ready to work offline")
})

test("an update reaches a window no worker controls while another window holds it waiting", async ({
  page,
  context,
  site,
}) => {
  await openFirstVisit(page, site.url) // never controlled
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
  const controlled = await context.newPage()
  await openControlled(controlled, site.url)

  site.deploy(2)
  await lookForUpdate(controlled) // installs, and waits: the second window is still on the old one
  await lookForUpdate(page)
  await expect(page.getByTestId("update-notice")).toBeVisible()

  await tapReload(page)
  await expect(page.locator("html")).toHaveAttribute("data-deploy", "2")
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
