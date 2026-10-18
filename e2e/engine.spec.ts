// The engine matrix is only worth having if each project runs the engine it is named for: a
// Pixel 7 descriptor on the firefox project would quietly run Chromium a second time.
import { expect, test } from "@playwright/test"

test("the project runs the engine it is named for", async ({ page, browserName }, testInfo) => {
  await page.goto("/")
  const engine = await page.evaluate(() =>
    "userAgentData" in navigator ? "chromium" : CSS.supports("-moz-appearance", "none") ? "firefox" : "webkit",
  )
  expect(testInfo.project.name).toBe(browserName)
  expect(engine).toBe(browserName)
})
