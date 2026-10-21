// Seam 2: the Hydrology section of page 1 from the sampling point. Indicators are ticked, the rule's
// suggestion is shown and confirmed, depths and notes are entered, the page is previewed and
// downloaded as a PDF, and the PDF is read back against the preview.
import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { regionOf } from "../src/delineation/regions"
import { pdfText } from "../src/delineation/testing/pdfText"

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

const tick = (sheet: ReturnType<typeof sheetOf>, label: string) => sheet.getByRole("checkbox", { name: label })

test("two secondary indicators are ticked, the rule suggests yes, the user confirms, and page 1 is exported and read back", async ({ page }) => {
  const sheet = await createPoint(page, "Pond survey", "HP-1")
  const suggestion = sheet.getByTestId("hydrology-suggestion")
  const hydrology = sheet.getByRole("region", { name: "Hydrology" })

  // One secondary indicator alone is not enough.
  await tick(sheet, "Surface Soil Cracks (B6)").check()
  await expect(suggestion).toContainText("No: only 1 secondary indicator ticked (B6)")
  await expect(suggestion).toContainText("One primary or two secondary indicators are needed.")
  await expect(suggestion).toContainText("ERDC/EL TR-12-1 (2012), p. 81")

  // The second one makes it yes, as a suggestion: nothing is on the form until it is confirmed.
  await tick(sheet, "Geomorphic Position (D2)").check()
  await expect(suggestion).toContainText("Yes: 2 secondary indicators ticked (B6, D2)")
  // The header at the top of page 1 is drawn too; these are the values of the Hydrology section, which come last.
  const printed = sheet.locator('[data-testid="page1-preview-text"][data-field^="page1.hydrology."]')
  await expect(printed).toHaveText(["X", "X"])
  await expect(sheet.locator('[data-testid="page1-preview-text"][data-field="page1.hydrology.present.yes"]')).toHaveCount(0)

  // An indicator shows what the supplement says it is.
  await sheet.getByRole("group").filter({ hasText: "Geomorphic Position (D2)" }).first().locator("details").first().locator("summary").click()
  await expect(hydrology).toContainText("depression, drainageway, concave position within a floodplain")
  await expect(hydrology).toContainText("ERDC/EL TR-12-1 (2012), Indicator D2, p. 110")

  // Depths and the notes.
  await hydrology.getByRole("radiogroup", { name: "Water Table Present?" }).getByRole("radio", { name: "Yes" }).click()
  await hydrology.getByLabel("Water Table depth (in)").fill("14")
  await hydrology.getByLabel("Describe Recorded Data").fill("Monitoring well MW-3 read 14 in. on 12 Oct.")
  await hydrology.getByLabel("Hydrology remarks").fill("Seasonally flooded depression.")
  await hydrology.getByLabel("Hydrology remarks").blur()

  // Confirm the suggestion: now Yes is printed.
  await sheet.getByRole("button", { name: "Confirm Yes" }).click()
  await expect(hydrology.getByRole("status")).toContainText("Confirmed: Yes, printed on the form.")
  await expect(printed).toHaveText(["X", "X", "X", "14", "X", "Monitoring well MW-3 read 14 in. on 12 Oct.", "Seasonally flooded depression."])

  // The PDF holds the same values at the same places as the preview.
  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download Page 1 PDF" }).click()])
  expect(download.suggestedFilename()).toBe("page-1-Pond-survey-HP-1.pdf")
  const shown = await printed.evaluateAll((nodes) =>
    nodes.map((n) => ({ text: n.textContent, id: n.getAttribute("data-field"), x: Number(n.getAttribute("x")), baseline: Number(n.getAttribute("y")) })),
  )
  const drawn = (await pdfText(new Uint8Array(readFileSync(await download.path())))).slice(-shown.length)
  expect(drawn.map((d) => d.text)).toEqual(shown.map((s) => s.text))
  drawn.forEach((d, i) => {
    expect(d.x).toBeCloseTo(shown[i].x, 1)
    expect(d.baseline).toBeCloseTo(shown[i].baseline, 1)
  })

  // The X for B6 is on B6's blank, and the Yes X is on the Wetland Hydrology Present? Yes blank.
  const { ticks, present } = regionOf("NCNE").page1.hydrology
  const at = (id: string) => shown.find((s) => s.id === `page1.hydrology.${id}`)!
  expect(at("tick.B6").baseline).toBeCloseTo(ticks.B6.rule - 1.5, 1)
  expect(at("tick.B6").x).toBeGreaterThan(ticks.B6.column[0])
  expect(at("tick.B6").x).toBeLessThan(ticks.B6.column[1])
  expect(at("present.yes").baseline).toBeCloseTo(present.rule - 1.5, 1)
  expect(at("present.yes").x).toBeGreaterThan(present.yes[0])
  expect(at("present.yes").x).toBeLessThan(present.yes[1])
})

test("a primary indicator alone is a yes, and an answer that differs from the rule is printed and warned about", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "HP-2")
  const suggestion = sheet.getByTestId("hydrology-suggestion")
  await tick(sheet, "Water Marks (B1)").check()
  await expect(suggestion).toContainText("Yes: 1 primary indicator ticked (B1). One is enough.")

  // The delineator answers No against the suggestion: that is printed, with a warning, and nothing else is.
  await tick(sheet, "Water Marks (B1)").uncheck()
  await tick(sheet, "Surface Soil Cracks (B6)").check()
  await sheet.getByRole("radiogroup", { name: "Wetland Hydrology Present?" }).getByRole("radio", { name: "Yes" }).click()
  await expect(sheet.getByRole("region", { name: "Hydrology", exact: true }).getByRole("alert")).toContainText("Add a remark")
  const summary = sheet.getByTestId("summary-hydrology")
  await summary.getByRole("button", { name: "Override or decide" }).click()
  await summary.getByLabel("Your answer", { exact: true }).selectOption("yes")
  await summary.getByLabel("Remark explaining your decision").fill("Synthetic hydrology override for this browser test")
  await summary.getByRole("button", { name: "Confirm answer with remark" }).click()
  await expect(sheet.getByTestId("form-warnings")).toContainText("Wetland Hydrology Present? is Yes, but the ticked indicators give a different answer")
  await expect(sheet.locator('[data-testid="page1-preview-text"][data-field="page1.hydrology.present.yes"]')).toHaveText("X")
})

test("a tick that needs a depth it does not have is warned about, and the ticks stay after a reload", async ({ page }) => {
  const sheet = await createPoint(page, "Pond", "HP-3")
  await tick(sheet, "High Water Table (A2)").check()
  await expect(sheet.getByTestId("form-warnings")).toContainText("High Water Table (A2) is ticked, but Water Table Present? is not Yes")
  await sheet.getByRole("radiogroup", { name: "Water Table Present?" }).getByRole("radio", { name: "Yes" }).click()
  await sheet.getByLabel("Water Table depth (in)").fill("18")
  await sheet.getByLabel("Water Table depth (in)").blur()
  await expect(sheet.getByTestId("form-warnings")).toContainText("the water table must be 12 in. or less below the surface")
  await sheet.getByLabel("Water Table depth (in)").fill("8")
  await sheet.getByLabel("Water Table depth (in)").blur()
  await expect(sheet.getByTestId("form-warnings")).toHaveCount(0)
  await expect(sheet.locator('[data-testid="page1-preview-text"][data-field^="page1.hydrology."]')).toHaveText(["X", "X", "8"])

  await page.reload()
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const again = sheetOf(page)
  await again.getByRole("button", { name: "Open project" }).click()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(tick(again, "High Water Table (A2)")).toBeChecked()
  await expect(again.getByLabel("Water Table depth (in)")).toHaveValue("8")
})
