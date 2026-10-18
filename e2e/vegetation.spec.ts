// Seam 2, the Vegetation page: plants typed into a sampling point are resolved against the regional plant
// list, shown on the preview of the official page, exported as a PDF and read back from it. Offline too.
import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { JF1_PLANTS_EXPECTED, JF1_PLANTS_TYPED, JF1_REMARKS } from "../src/delineation/fixtures/jf1"
import { pdfText } from "../src/delineation/testing/pdfText"

async function createPoint(page: Page, projectName: string, pointName: string) {
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "Projects", exact: true })
  await sheet.getByLabel("Project name").fill(projectName)
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
  await sheet.getByLabel("Sampling point name").fill(pointName)
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  await sheet.getByRole("button", { name: "Open point" }).click()
  return sheet
}

/** Type a plant and its cover and add it, with the resolution the entry shows in between. */
async function addPlant(sheet: Locator, typed: string, cover: string, stratum?: string) {
  if (stratum) await sheet.getByRole("group", { name: "Stratum" }).getByRole("button", { name: stratum, exact: true }).click()
  await sheet.getByLabel("Plant name").fill(typed)
  await sheet.getByLabel("Cover %").fill(cover)
  await sheet.getByRole("button", { name: "Add plant" }).click()
}

const resolution = (sheet: Locator) => sheet.getByTestId("plant-resolution")
const herb = (sheet: Locator) => sheet.getByTestId("stratum-herb")

test("two plants are typed, shown on the page, exported as a PDF, and read back from it", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "VP-1")

  // The name resolves as it is typed: the scientific name and the regional status, before anything is added.
  await sheet.getByLabel("Plant name").fill("fall panicgrass")
  await expect(resolution(sheet)).toHaveAttribute("data-kind", "resolved")
  await expect(resolution(sheet)).toContainText("Panicum dichotomiflorum")
  await expect(resolution(sheet)).toContainText("FACW")
  await sheet.getByLabel("Cover %").fill("50")
  await sheet.getByRole("button", { name: "Add plant" }).click()
  await addPlant(sheet, "RCG", "3")

  await expect(herb(sheet).getByTestId("plant")).toHaveCount(2)
  await expect(herb(sheet).getByTestId("plant").first()).toContainText("Panicum dichotomiflorum FACW 50%")
  await expect(herb(sheet).getByTestId("plant").nth(1)).toContainText("Phalaris arundinacea FACW 3%")
  await expect(herb(sheet).getByTestId("total-herb")).toHaveText("Total 53%")
  await sheet.getByLabel("Vegetation remarks (bare ground, photo numbers)").fill("Bare ground - 10%")

  // The preview draws them on the official page, in the herb rows; the PDF holds the same, in the same places.
  const preview = sheet.getByTestId("veg-preview-text")
  await expect(preview.filter({ hasText: /^Panicum dichotomiflorum$/ })).toHaveCount(1)
  await expect(sheet.locator('[data-field="veg.herb.0.cover"]')).toHaveText("50")
  await expect(sheet.locator('[data-field="veg.herb.1.name"]')).toHaveText("Phalaris arundinacea")
  await expect(sheet.locator('[data-field="veg.herb.total"]')).toHaveText("53")
  await expect(sheet.locator('[data-field="veg.remarks.0"]')).toHaveText("Bare ground - 10%")

  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download vegetation PDF" }).click()])
  expect(download.suggestedFilename()).toBe("vegetation-page-Pond-VP-1.pdf")
  const drawn = await pdfText(new Uint8Array(readFileSync(await download.path())), 1)
  const texts = drawn.map((d) => d.text)
  for (const expected of ["Panicum dichotomiflorum", "50", "FACW", "Phalaris arundinacea", "3", "53", "5 ft radius", "Bare ground - 10%", "VP-1"]) {
    expect(texts, expected).toContain(expected)
  }
  const shown = await sheet.locator('[data-field="veg.herb.0.name"]').evaluate((n) => ({ x: Number(n.getAttribute("x")), baseline: Number(n.getAttribute("y")) }))
  const first = drawn.find((d) => d.text === "Panicum dichotomiflorum")!
  expect(first.x).toBeCloseTo(shown.x, 1)
  expect(first.baseline).toBeCloseTo(shown.baseline, 1)
})

test("an ambiguous name shows candidates, and picking one is what is added", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "VP-1")
  await sheet.getByLabel("Plant name").fill("barnyard")
  await expect(resolution(sheet)).toHaveAttribute("data-kind", "candidates")
  await sheet.getByLabel("Cover %").fill("5")
  // Nothing is added until the user says which plant.
  await sheet.getByRole("button", { name: "Add plant" }).click()
  await expect(sheet.getByRole("alert")).toContainText("Pick which plant it is")
  await expect(herb(sheet).getByTestId("plant")).toHaveCount(0)

  await resolution(sheet).getByRole("button", { name: /Echinochloa muricata/ }).click()
  await expect(resolution(sheet)).toHaveAttribute("data-kind", "resolved")
  await expect(resolution(sheet)).toContainText("OBL")
  await sheet.getByRole("button", { name: "Add plant" }).click()
  await expect(herb(sheet).getByTestId("plant")).toContainText("Echinochloa muricata OBL 5%")
})

test("a plant that is not on the list is recorded as UPL with a note, and warned about", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "VP-1")
  await sheet.getByLabel("Plant name").fill("Stiff greenthread")
  await expect(resolution(sheet)).toHaveAttribute("data-kind", "unknown")
  await expect(resolution(sheet)).toContainText("Not found on the plant list")
  await sheet.getByLabel("Cover %").fill("1")
  await sheet.getByRole("button", { name: "Add plant" }).click()
  await expect(herb(sheet).getByTestId("plant")).toContainText("Stiff greenthread UPL 1%")
  await expect(herb(sheet).getByTestId("plant")).toContainText("pp. 22-23")
  await expect(sheet.getByTestId("form-warnings")).toContainText("Stiff greenthread: not found on the plant list")
})

test("a cover that is not a percent is said so in plain words, and a plant can be removed", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "VP-1")
  await sheet.getByLabel("Plant name").fill("velvetleaf")
  await sheet.getByLabel("Cover %").fill("0")
  await sheet.getByRole("button", { name: "Add plant" }).click()
  await expect(sheet.getByRole("alert")).toContainText("Absolute percent cover is more than 0 and at most 100.")
  await sheet.getByLabel("Cover %").fill("2")
  await sheet.getByRole("button", { name: "Add plant" }).click()
  await expect(herb(sheet).getByTestId("plant")).toContainText("Abutilon theophrasti FACU 2%")
  await herb(sheet).getByRole("button", { name: "Remove Abutilon theophrasti" }).click()
  await expect(herb(sheet).getByTestId("plant")).toHaveCount(0)
})

test("JF-1's herb stratum, as Jon wrote it, comes to the scientific names and statuses, and totals 85", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "JF fixture", "JF-1")
  for (const [typed, cover] of JF1_PLANTS_TYPED) await addPlant(sheet, typed, String(cover))
  await sheet.getByLabel("Vegetation remarks (bare ground, photo numbers)").fill(JF1_REMARKS)

  const rows = herb(sheet).getByTestId("plant")
  await expect(rows).toHaveCount(9)
  for (const [i, [name, status]] of JF1_PLANTS_EXPECTED.entries()) {
    await expect(rows.nth(i), name).toContainText(`${name} ${status} ${JF1_PLANTS_TYPED[i][1]}%`)
  }
  await expect(herb(sheet).getByTestId("total-herb")).toHaveText("Total 85%")
  await expect(sheet.getByTestId("form-warnings")).toContainText("Sonchus spp.: identified to genus only")

  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download vegetation PDF" }).click()])
  const texts = (await pdfText(new Uint8Array(readFileSync(await download.path())), 1)).map((d) => d.text)
  for (const expected of ["Panicum dichotomiflorum", "Setaria pumila", "Cirsium arvense", "Sonchus spp.", "Persicaria maculosa", "Stiff greenthread", "85", "5 ft radius"]) {
    expect(texts, expected).toContain(expected)
  }
})

test("more plants than the first page holds go to the Vegetation Continued page", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "VP-1")
  for (let i = 1; i <= 13; i++) await addPlant(sheet, "Carex nonexistentus", String(i), "Herb")
  await expect(sheet.getByTestId("vegetation-continued-preview")).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download vegetation PDF" }).click()])
  const bytes = new Uint8Array(readFileSync(await download.path()))
  const second = (await pdfText(bytes, 2)).map((d) => d.text)
  expect(second).toContain("VEGETATION Continued")
  expect(second).toContain("13") // plant 13's cover, on the Continued page
  expect(second).toContain("91") // the stratum total, repeated: 1 + 2 + ... + 13
})

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" })

  test("the plant list resolves a name and the PDF is made with the network off", async ({ page, context }) => {
    const failed: string[] = []
    page.on("requestfailed", (request) => failed.push(request.url()))
    await page.goto("/")
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

    await context.setOffline(true)
    await page.reload()
    const sheet = await createPoint(page, "Field", "OFF-1")
    await sheet.getByLabel("Plant name").fill("RCG")
    await expect(resolution(sheet)).toHaveAttribute("data-kind", "resolved")
    await expect(resolution(sheet)).toContainText("Phalaris arundinacea")
    await sheet.getByLabel("Cover %").fill("40")
    await sheet.getByRole("button", { name: "Add plant" }).click()
    const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download vegetation PDF" }).click()])
    const texts = (await pdfText(new Uint8Array(readFileSync(await download.path())), 1)).map((d) => d.text)
    expect(texts).toContain("Phalaris arundinacea")
    expect(failed).toEqual([])
  })
})
