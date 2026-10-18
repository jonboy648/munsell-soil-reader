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
  await expect(correction).toContainText("Six corrections were compared")
  await expect(correction.getByRole("row")).toHaveCount(7) // the header and six corrections
  await expect(correction).toContainText("a smooth curve per channel, then 3x3 (used for a Page)")
  await expect(correction).toContainText("one curve shared by the channels, then 3x3 (used for a ColorChecker)")
  await expect(correction).toContainText("Root-polynomial")
})

test("explains how a Page is used, how dirty Chips are handled, and what has not been checked", async ({ page }) => {
  await openMethodPage(page)
  const pageCard = page.getByTestId("page-card")
  await expect(pageCard).toContainText("2.5YR, 5YR, 7.5YR, 10YR, 2.5Y, 5Y")
  await expect(pageCard).toContainText("on the 10YR Page 8/1, 8/8, 5/8, 2/1")
  await expect(pageCard).toContainText("on the 7.5YR Page 8/1, 8/6, 5/8, 2.5/1")
  await expect(pageCard).toContainText("The soil is in a hole.")
  await expect(pageCard).toContainText("The /1 column")

  const cards = page.locator("#cards")
  await expect(cards).toContainText("Dirty Chips are left out")
  await expect(cards).toContainText("At most 4 Chips are left out, and at most 2 of them gray steps.")
  await expect(cards).toContainText("The row guard.")
  await expect(cards).toContainText("The Page Card has no accuracy figure yet.")
  // The real Pages, as found.
  await expect(cards).toContainText("8/1, 7/1 and 3/6")
  await expect(cards).toContainText("7.56")
  await expect(cards).toContainText("2.79")
  // The correction a Page uses, and why.
  const pageCorrection = page.getByTestId("page-correction")
  await expect(pageCorrection).toContainText("not its full 3x3 matrix")
  await expect(pageCorrection).toContainText("11.8 apart")
  await expect(pageCorrection).toContainText("4.3 apart")
  await expect(pageCorrection).toContainText("better-Page hint never fired")
  await expect(cards).toContainText("7.5YR fails the Card check,")
  await expect(cards).toContainText("What is not caught.")
  // And it is no longer a stub.
  await expect(page.getByTestId("page-card-stub")).toHaveCount(0)
})

test("says the Card check line is provisional and that a pass is not a promise", async ({ page }) => {
  await openMethodPage(page)
  const correction = page.locator("#correction")
  await expect(correction).toContainText("The lines are 2 and 3.5, and they are provisional.")
  await expect(correction).toContainText("scored 3.56 or more")
  await expect(correction).toContainText("A pass is not a promise that the Reading is within one Chip.")
  await expect(correction).toContainText("A real camera's clean Card is mostly caution.")
  await expect(correction).toContainText("Caution,")
  // Claims that were not true, and are gone.
  await expect(correction).not.toContainText("3.7 or more")
  await expect(correction).not.toContainText("half the lowest")
})

test("explains the Page against ColorChecker trade and the faded-book limit", async ({ page }) => {
  await openMethodPage(page)
  const cards = page.locator("#cards")
  await expect(cards).toContainText("a Page corrects against the same book the answer is read from")
  await expect(cards).toContainText("A Page that has faded evenly shifts every Reading, and the Card check cannot see it")
  await expect(page.locator("#limits")).toContainText("Faded or dirty book pages")
  await expect(page.locator("#limits")).toContainText("Phone camera processing")
  await expect(page.locator("#limits")).toContainText("One hue per Page")
  await expect(page.locator("#limits")).toContainText("Light")
})

test("lists every credit with its license", async ({ page }) => {
  await openMethodPage(page)
  const credits = page.getByTestId("credit")
  await expect(credits).toHaveCount(11)
  const expected: [string, string][] = [
    ["Munsell Soil Reader", "MIT"],
    ["munsell.js", "MPL-2.0"],
    ["Soil-book Chip list", "CC0 1.0"],
    ["X-Rite ColorChecker Classic reference values", "BSD-3-Clause"],
    ["colour-science root-polynomial correction", "BSD-3-Clause"],
    ["Archivo, Public Sans and IBM Plex Mono", "SIL OFL 1.1"],
    ["ReUI components, from 21st.dev", "MIT"],
    ["js-aruco2", "MIT"],
    ["ENG Form 6116-8", "public domain"],
    ["2022 National Wetland Plant List", "public domain"],
    ["Regional Supplement", "public domain"],
  ]
  for (const [name, license] of expected) {
    const credit = credits.filter({ hasText: name })
    await expect(credit).toHaveCount(1)
    await expect(credit.getByTestId("credit-license")).toContainText(license)
  }
})

test("lists every package the app ships, with its license text, generated from the build", async ({ page }) => {
  await openMethodPage(page)
  const packages = page.getByTestId("bundled-package")
  await expect(packages.first()).toBeVisible()
  expect(await packages.count()).toBeGreaterThan(30)

  // The ones that need a notice, by license: Apache-2.0, MIT, ISC, and the stylesheet and service worker's.
  const expected: [string, string, string][] = [
    ["class-variance-authority", "Apache-2.0", "Apache License"],
    ["clsx", "MIT", "Permission is hereby granted"],
    ["@radix-ui/react-dialog", "MIT", "Permission is hereby granted"],
    ["vaul", "MIT", "Permission is hereby granted"],
    ["react", "MIT", "Permission is hereby granted"],
    ["lucide-react", "ISC", "Permission to use, copy, modify"],
    ["tailwindcss", "MIT", "Permission is hereby granted"],
    ["workbox-core", "MIT", "Permission is hereby granted"],
  ]
  for (const [name, license, snippet] of expected) {
    const pkg = page.locator(`[data-package="${name}"]`)
    await expect(pkg, name).toHaveCount(1)
    await expect(pkg.locator("summary")).toContainText(license)
    await pkg.locator("summary").click()
    await expect(pkg.getByTestId("package-license-text")).toContainText(snippet)
  }
  // Packages that have a credit of their own are not repeated, and nothing sends the reader to node_modules.
  await expect(page.locator('[data-package="munsell"]')).toHaveCount(0)
  await expect(page.getByTestId("method-page")).not.toContainText("node_modules")

  // Every package has a text.
  const empty = await page.getByTestId("package-license-text").evaluateAll((els) =>
    els.filter((el) => !(el.textContent ?? "").trim()).length,
  )
  expect(empty).toBe(0)
})

test("opens the full license text of each credit that has one", async ({ page }) => {
  await openMethodPage(page)
  const texts: [string, string][] = [
    ["Munsell Soil Reader", "Copyright (c) 2026 Jon Cackler"],
    ["munsell.js", "Mozilla Public License Version 2.0"],
    ["X-Rite ColorChecker Classic reference values", "Redistribution and use in source and binary forms"],
    ["colour-science root-polynomial correction", "Copyright 2013 Colour Developers"],
    ["js-aruco2", "Copyright (c) 2020 Damiano Falcioni"],
    ["ReUI components, from 21st.dev", "Copyright (c) 2025 Keenthemes Inc"],
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

test("says how a plant's status is found, and that the order of the neighbouring regions is an assumption", async ({ page }) => {
  await openMethodPage(page)
  const notes = page.getByTestId("vegetation-notes")
  await expect(notes).toContainText("2022 National Wetland Plant List")
  await expect(notes).toContainText("The 2022 list has no NI or NO ratings.")
  await expect(notes).toContainText("Midwest, then the Eastern Mountains and Piedmont, then the Atlantic and Gulf Coastal Plain, then the Great Plains")
  await expect(notes).toContainText("the order is an assumption")
})

test("says how the dominant species are chosen, when the prevalence index is applied, and that a plant identified only to its genus counts", async ({ page }) => {
  await openMethodPage(page)
  const notes = page.getByTestId("vegetation-notes")
  await expect(notes).toContainText("50/20 rule")
  await expect(notes).toContainText("A stratum under 5 percent cover is recorded and not used, unless it is the only one.")
  await expect(notes).toContainText("applied only when the dominance test fails and hydric soil and wetland hydrology indicators are present")
  await expect(notes).toContainText("nothing is ticked on the form until you confirm it")
  await expect(notes).toContainText("Decided on 2026-10-18: a plant identified only to its genus")
  await expect(notes).toContainText("the 80 percent of cover that must be identified and rated")
})

test("says the 20-soil test has not been run, and marks what is not in this version", async ({ page }) => {
  await openMethodPage(page)
  await expect(page.getByTestId("soil-test-results")).toHaveText("The 20-soil test has not been run yet.")

  for (const stub of ["frame-stub", "forms-stub", "leaves-stub"]) {
    await expect(page.getByTestId(stub)).toContainText("Not yet in this version")
  }
  await expect(page.getByTestId("leaves-stub")).toContainText("Plant photo identification")
  await expect(page.getByTestId("leaves-stub")).toContainText("Your location")
  await expect(page.getByTestId("leaves-stub")).toContainText("Look-ups by location")
  await expect(page.locator("#privacy")).toContainText("Your Photos and Readings never leave it.")
  await expect(page.locator("#privacy")).toContainText("soil.joncackler.com")
  await expect(page.locator("#privacy")).toContainText("carries no Photo and no Reading")
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

    // The list of everything else the app ships is cached too.
    const cva = page.locator('[data-package="class-variance-authority"]')
    await cva.locator("summary").click()
    await expect(cva.getByTestId("package-license-text")).toContainText("Apache License")

    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: "Accuracy and method" })).toBeVisible()
    await expect(page.getByTestId("soil-test-results")).toBeVisible()
  })

  test("a first visit straight to the method page still installs, and works offline", async ({ page, context }) => {
    await page.goto("/#method")
    await expect(page.getByTestId("method-page")).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: "Accuracy and method" })).toBeVisible()
    await page.getByTestId("back-to-reader").first().click()
    await expect(page.getByTestId("method-link")).toBeVisible()
  })

  test("the ready-offline notice is still there after a visit to the method page", async ({ page }) => {
    await page.goto("/#method")
    await expect(page.getByTestId("method-page")).toBeVisible()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.getByTestId("back-to-reader").first().click()
    await expect(page.getByTestId("offline-notice")).toContainText("Ready to work offline")
  })
})

test("Back to the Photo takes one step back, so the system Back does not reopen the page", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("method-link").click()
  await expect(page).toHaveURL(/#method$/)
  await page.getByTestId("back-to-reader").first().click()
  await expect(page.getByTestId("method-link")).toBeVisible()
  await expect(page).not.toHaveURL(/#method/)
  await page.goBack()
  await expect(page.getByTestId("method-page")).toHaveCount(0)
})

test("opened straight on the method page, Back to the Photo replaces it", async ({ page }) => {
  await page.goto("/#method")
  await expect(page.getByTestId("method-page")).toBeVisible()
  await page.getByTestId("back-to-reader").first().click()
  await expect(page.getByTestId("method-link")).toBeVisible()
  await page.goBack()
  // There was nothing in the app to go back to, so the system Back leaves it instead of reopening the page.
  await expect(page.getByTestId("method-page")).toHaveCount(0)
})

test("opening each license text never makes the page wider than a 360 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await openMethodPage(page)
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await wide()).toBeLessThanOrEqual(0)

  const credits = page.getByTestId("credit")
  for (let i = 0; i < (await credits.count()); i++) {
    const open = credits.nth(i).getByText("Read the full license text")
    if (await open.count()) await open.click()
  }
  const packages = page.getByTestId("bundled-package")
  for (let i = 0; i < (await packages.count()); i++) await packages.nth(i).locator("summary").click()
  expect(await wide()).toBeLessThanOrEqual(0)
})
