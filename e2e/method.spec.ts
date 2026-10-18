// Seam 2, the accuracy and method page: it opens from the main screen, says how a Reading is made
// with the engine's own thresholds, lists every credit with its license and opens the full text,
// says the 20-soil test has not run, marks what is not in this version, and works with no network.
import { expect, test, type Page } from "@playwright/test"

async function openMethodPage(page: Page) {
  await page.goto("/")
  await page.getByTestId("method-link").click()
  await expect(page.getByTestId("method-page")).toBeVisible()
}

test("opens from the main screen and goes back to the Photo", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Warm shop light/ }).click()
  await expect(page.getByTestId("photo-name")).toBeVisible()

  await page.getByTestId("method-link").click()
  await expect(page.getByRole("heading", { level: 1, name: "Accuracy and method" })).toBeVisible()
  await expect(page.getByTestId("photo")).toHaveCount(0)

  // The Photo being worked on is still there when the reader comes back.
  await page.getByTestId("back-to-reader").first().click()
  await expect(page.getByTestId("photo-name")).toContainText("warm shop light")
})

test("explains the steps, the Card check line and each warning with its number", async ({ page }) => {
  await openMethodPage(page)
  const steps = page.locator("#steps")
  for (const step of ["Sampling", "Correction", "Card check", "Munsell conversion", "Nearest Chip"]) {
    await expect(steps.getByRole("heading", { name: step })).toBeVisible()
  }
  await expect(steps).toContainText("Below 2 the check is good")

  const warnings = page.locator("#warnings")
  for (const warning of ["Glare", "Clipped", "Uneven light", "Card too small"]) {
    await expect(warnings.getByRole("heading", { name: warning })).toBeVisible()
  }
  await expect(warnings.getByTestId("warning-kind")).toHaveCount(4)
  await expect(warnings).toContainText("closer than 24 pixels")
  await expect(warnings).toContainText("more than 0.3 stops")

  const correction = page.locator("#correction")
  await expect(correction).toContainText("Straighten the tone curve, then 3x3 (used)")
  await expect(correction).toContainText("Root-polynomial")
})

test("explains the Page against ColorChecker trade and the faded-book limit", async ({ page }) => {
  await openMethodPage(page)
  const cards = page.locator("#cards")
  await expect(cards).toContainText("a Page corrects against the same book the answer is read from")
  await expect(cards).toContainText("cannot see a Page that has faded evenly")
  await expect(page.locator("#limits")).toContainText("Faded or dirty book pages")
  await expect(page.locator("#limits")).toContainText("Phone camera processing")
  await expect(page.locator("#limits")).toContainText("One hue per Page")
  await expect(page.locator("#limits")).toContainText("Light")
})

test("lists every credit with its license", async ({ page }) => {
  await openMethodPage(page)
  const credits = page.getByTestId("credit")
  await expect(credits).toHaveCount(7)
  const expected: [string, string][] = [
    ["Munsell Soil Reader", "MIT"],
    ["munsell.js", "MPL-2.0"],
    ["Soil-book Chip list", "CC0 1.0"],
    ["X-Rite ColorChecker Classic reference values", "BSD-3-Clause"],
    ["colour-science root-polynomial correction", "BSD-3-Clause"],
    ["Archivo, Public Sans and IBM Plex Mono", "SIL OFL 1.1"],
    ["js-aruco2", "MIT"],
  ]
  for (const [name, license] of expected) {
    const credit = credits.filter({ hasText: name })
    await expect(credit).toHaveCount(1)
    await expect(credit.getByTestId("credit-license")).toContainText(license)
  }
  await expect(page.getByTestId("other-dependencies")).toContainText("React, React DOM")
})

test("opens the full license text of each credit that has one", async ({ page }) => {
  await openMethodPage(page)
  const texts: [string, string][] = [
    ["Munsell Soil Reader", "Copyright (c) 2026 Jon Cackler"],
    ["munsell.js", "Mozilla Public License Version 2.0"],
    ["X-Rite ColorChecker Classic reference values", "Redistribution and use in source and binary forms"],
    ["colour-science root-polynomial correction", "Copyright 2013 Colour Developers"],
    ["js-aruco2", "Copyright (c) 2020 Damiano Falcioni"],
  ]
  for (const [name, snippet] of texts) {
    const credit = page.getByTestId("credit").filter({ hasText: name })
    await credit.getByText("Read the full license text").click()
    await expect(credit.getByTestId("license-text")).toContainText(snippet)
  }
  // The fonts ship with the app, so the OFL text travels with them, with each font's copyright line.
  const fonts = page.getByTestId("credit").filter({ hasText: "Archivo, Public Sans and IBM Plex Mono" })
  await fonts.getByText("Read the full license text").click()
  const ofl = fonts.getByTestId("license-text")
  await expect(ofl).toContainText("Copyright 2020 The Archivo Project Authors")
  await expect(ofl).toContainText("Copyright 2015 The Public Sans Project Authors")
  await expect(ofl).toContainText("Copyright 2017 IBM Corp. All rights reserved.")
  await expect(ofl).toContainText("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007")
  await expect(ofl).toContainText("PERMISSION & CONDITIONS")
  // The Chip list is CC0: a link, not a text to read.
  const chips = page.getByTestId("credit").filter({ hasText: "Soil-book Chip list" })
  await expect(chips.getByTestId("license-text")).toHaveCount(0)
  await expect(chips.getByRole("link", { name: "CC0 1.0 legal code" })).toBeVisible()
})

test("says the 20-soil test has not been run, and marks what is not in this version", async ({ page }) => {
  await openMethodPage(page)
  await expect(page.getByTestId("soil-test-results")).toHaveText("The 20-soil test has not been run yet.")

  for (const stub of ["page-card-stub", "frame-stub", "forms-stub", "leaves-stub"]) {
    await expect(page.getByTestId(stub)).toContainText("Not yet in this version")
  }
  await expect(page.getByTestId("leaves-stub")).toContainText("Plant photo identification")
  await expect(page.getByTestId("leaves-stub")).toContainText("Your location")
  await expect(page.getByTestId("leaves-stub")).toContainText("Look-ups by location")
  await expect(page.locator("#privacy")).toContainText("Nothing does.")
})

test("uses only gray: no text, border or background on the page has any color", async ({ page }) => {
  await openMethodPage(page)
  const colored = await page.evaluate(() => {
    // Let the browser turn any CSS color (oklch, color-mix, rgb) into red, green, blue.
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
    const rgb = (css: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = "#000"
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      return ctx.getImageData(0, 0, 1, 1).data
    }
    const bad: string[] = []
    for (const el of document.querySelectorAll("[data-testid=method-page], [data-testid=method-page] *")) {
      const style = getComputedStyle(el)
      for (const prop of ["color", "backgroundColor", "borderTopColor", "borderBottomColor"] as const) {
        const [r, g, b] = rgb(style[prop])
        if (Math.max(r, g, b) - Math.min(r, g, b) > 2) bad.push(`${el.tagName} ${prop} ${style[prop]}`)
      }
    }
    return bad
  })
  expect(colored).toEqual([])
})

test.describe("with no network", () => {
  test.use({ serviceWorkers: "allow" })

  test("the page opens after the first visit, from the link and by reload", async ({ page, context }) => {
    await page.goto("/")
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

    await context.setOffline(true)
    await page.getByTestId("method-link").click()
    await expect(page.getByRole("heading", { level: 1, name: "Accuracy and method" })).toBeVisible()
    const munsell = page.getByTestId("credit").filter({ hasText: "munsell.js" })
    await munsell.getByText("Read the full license text").click()
    await expect(munsell.getByTestId("license-text")).toContainText("Mozilla Public License Version 2.0")

    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: "Accuracy and method" })).toBeVisible()
    await expect(page.getByTestId("soil-test-results")).toBeVisible()
  })
})
