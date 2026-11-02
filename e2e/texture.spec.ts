// Seam 2: the rest of the Soil page's profile row from the sampling point. Texture and the redox codes are
// picked on a layer, colors are typed in by hand, the restrictive layer is recorded, the page is previewed
// and downloaded as a PDF, and the PDF is read back.
import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { regionOf } from "../src/delineation/regions"
import { pdfText } from "../src/delineation/testing/pdfText"

const { soil } = regionOf("NCNE")
const sheetOf = (page: Page) => page.getByRole("dialog", { name: "Projects", exact: true })

/** A project and a sampling point, with the point open. */
async function createPoint(page: Page, projectName: string, pointName: string) {
  await page.goto("/")
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const sheet = sheetOf(page)
  await sheet.getByLabel("Project name").fill(projectName)
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
  await sheet.getByLabel("Sampling point name").fill(pointName)
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  await sheet.getByRole("button", { name: "Open point" }).click()
  return sheet
}

async function downloadSoilPage(page: Page, sheet: ReturnType<typeof sheetOf>) {
  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download Soil page PDF" }).click()])
  return pdfText(new Uint8Array(readFileSync(await download.path())))
}

test("texture and a redox type and location are picked on a layer, exported, and read back from the PDF", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "SP-1")
  await sheet.getByRole("button", { name: "Add layer" }).click()
  await sheet.getByLabel("Top (in)").fill("0")
  await sheet.getByLabel("Bottom (in)").fill("8")
  await sheet.getByLabel("Matrix color").fill("10YR 3/2")
  await sheet.getByLabel("Texture").selectOption("clay loam")
  await sheet.getByRole("button", { name: "Add a redox color" }).click()
  await sheet.getByLabel("Redox color 1").fill("7.5YR 4/6")
  await sheet.getByLabel("Redox % 1").fill("5")
  await sheet.getByLabel("Redox type 1").selectOption("C")
  await sheet.getByLabel("Redox location 1").selectOption("PL")
  await sheet.getByRole("button", { name: "Save layer" }).click()

  await expect(sheet.getByTestId("layer")).toContainText("Texture clay loam")
  await expect(sheet.getByTestId("layer")).toContainText("Redox 7.5YR 4/6, 5%, C, PL")
  await expect(sheet.getByTestId("soil-preview-text")).toHaveText(["SP-1", "0-8", "10YR 3/2", "100", "7.5YR 4/6", "5", "C", "PL", "clay loam"])

  // The PDF has them in their columns, on the layer's row.
  const drawn = await downloadSoilPage(page, sheet)
  const at = (text: string) => drawn.filter((d) => d.text === text).at(-1)!
  expect(at("clay loam").x).toBeCloseTo(soil.columns.texture[0] + soil.inset, 1)
  expect(at("C").x).toBeCloseTo(soil.columns.redoxType[0] + soil.inset, 1)
  expect(at("PL").x).toBeCloseTo(soil.columns.redoxLoc[0] + soil.inset, 1)
  expect(at("clay loam").baseline).toBeCloseTo(at("0-8").baseline, 1)
  expect(at("PL").baseline).toBeCloseTo(at("0-8").baseline, 1)

  // They survive editing the layer.
  await sheet.getByRole("button", { name: "Edit layer" }).click()
  await expect(sheet.getByLabel("Texture")).toHaveValue("clay loam")
  await expect(sheet.getByLabel("Redox type 1")).toHaveValue("C")
  await expect(sheet.getByLabel("Redox location 1")).toHaveValue("PL")
})

test("mucky is a modifier of a mineral texture only, and a term too long for the column prints as its Field Book code", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "SP-2")
  await sheet.getByRole("button", { name: "Add layer" }).click()
  await sheet.getByLabel("Top (in)").fill("0")
  await sheet.getByLabel("Bottom (in)").fill("6")
  const mucky = sheet.getByRole("checkbox", { name: /^Mucky/ })

  await expect(mucky).toBeDisabled()
  await sheet.getByLabel("Texture").selectOption("muck")
  await expect(mucky).toBeDisabled()
  await sheet.getByLabel("Texture").selectOption("very fine sandy loam")
  await mucky.check()
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByTestId("layer")).toContainText("Texture mucky very fine sandy loam")
  await expect(sheet.getByTestId("soil-preview-text").filter({ hasText: /MK-VFSL/ })).toHaveCount(1)
  const drawn = await downloadSoilPage(page, sheet)
  expect(drawn.some((d) => d.text === "MK-VFSL")).toBe(true)
})

test("a typed color is checked against the Chip list: a Chip is named, another valid notation is accepted with a note", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "SP-3")
  await sheet.getByRole("button", { name: "Add layer" }).click()
  await sheet.getByLabel("Top (in)").fill("0")
  await sheet.getByLabel("Bottom (in)").fill("6")

  await sheet.getByLabel("Matrix color").fill("10yr 4/2")
  await expect(sheet.getByTestId("color-hint")).toContainText("10YR 4/2 is a Chip in the soil book: dark grayish brown.")
  await sheet.getByLabel("Matrix color").fill("7.5YR 4.5/3")
  await expect(sheet.getByTestId("color-hint")).toContainText("7.5YR 4.5/3 is not a Chip in the soil book. It is printed as you typed it.")
  await sheet.getByLabel("Matrix color").fill("10YR 11/2")
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByRole("alert")).toContainText("Matrix: 10YR 11/2 is outside the Munsell system")

  await sheet.getByLabel("Matrix color").fill("7.5YR 4.5/3")
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByTestId("layer")).toContainText("Matrix 7.5YR 4.5/3, 100% (not a book Chip)")
  await expect(sheet.getByTestId("form-warnings")).toContainText("Layer 1: the matrix color 7.5YR 4.5/3 is not a Chip in the soil book. It is printed as entered.")
  // It prints like any measured one.
  await expect(sheet.getByTestId("soil-preview-text")).toHaveText(["SP-3", "0-6", "7.5YR 4.5/3", "100"])
  const drawn = await downloadSoilPage(page, sheet)
  expect(drawn.some((d) => d.text === "7.5YR 4.5/3")).toBe(true)
})

test("the restrictive layer's type and depth print in the form's box", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "SP-4")
  const box = sheet.getByRole("region", { name: "Restrictive layer" })
  await box.getByLabel("Restrictive layer type").selectOption("fragipan")
  await box.getByLabel("Restrictive layer depth (in)").fill("18")
  await box.getByLabel("Restrictive layer depth (in)").blur()
  await expect(sheet.getByTestId("soil-preview-text")).toHaveText(["SP-4", "fragipan", "18"])

  const drawn = await downloadSoilPage(page, sheet)
  const type = drawn.filter((d) => d.text === "fragipan").at(-1)!
  const depth = drawn.filter((d) => d.text === "18").at(-1)!
  expect(type.baseline).toBeCloseTo(soil.restrictive.type.rule - soil.aboveRule, 1)
  expect(depth.baseline).toBeCloseTo(soil.restrictive.depth.rule - soil.aboveRule, 1)
  expect(type.x).toBeCloseTo(soil.restrictive.type.column[0] + soil.inset, 1)

  // It stays after a reload.
  await page.reload()
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const again = sheetOf(page)
  await again.getByRole("button", { name: "Open project" }).click()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(again.getByLabel("Restrictive layer type")).toHaveValue("fragipan")
  await expect(again.getByLabel("Restrictive layer depth (in)")).toHaveValue("18")
})

test("gaps and overlaps between layers are warned about on the sampling point", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "SP-5")
  for (const [top, bottom] of [["0", "6"], ["8", "12"], ["10", "20"]]) {
    await sheet.getByRole("button", { name: "Add layer" }).click()
    await sheet.getByLabel("Top (in)").fill(top)
    await sheet.getByLabel("Bottom (in)").fill(bottom)
    await sheet.getByLabel("Matrix color").fill("10YR 4/2")
    await sheet.getByRole("button", { name: "Save layer" }).click()
    await expect(sheet.getByTestId("layer")).toHaveCount(["0", "8", "10"].indexOf(top) + 1)
  }
  await expect(sheet.getByTestId("form-warnings")).toContainText("There is a gap between layers 1 and 2.")
  await expect(sheet.getByTestId("form-warnings")).toContainText("Layers 2 and 3 overlap.")
})
