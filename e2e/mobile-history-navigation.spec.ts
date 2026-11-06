import { expect, test } from "@playwright/test"

test("History stays above the photo on a phone and returning keeps the photo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("button", { name: /Warm shop light/ }).click()
  await expect(page.getByTestId("photo")).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))

  const history = page.getByRole("link", { name: "Sample History", exact: true }).filter({ visible: true })
  await expect(history).toHaveCount(1)
  const link = await history.boundingBox()
  const photo = await page.getByTestId("photo").boundingBox()
  expect(link).not.toBeNull()
  expect(photo).not.toBeNull()
  expect(link!.y + link!.height).toBeLessThanOrEqual(photo!.y)
  await expect(history).toBeInViewport()

  const name = await page.getByTestId("photo-name").textContent()
  await history.click()
  await expect(page.getByRole("heading", { name: "Sample History", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Soil reader", exact: true }).click()
  await expect(page.getByTestId("photo-name")).toHaveText(name!)
  await expect(page.getByTestId("photo")).toBeVisible()
})
