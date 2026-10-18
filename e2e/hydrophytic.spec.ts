// Seam 3, the dominance test and the prevalence index: JF-1's plants are typed in, the dominant is marked and
// the worksheets are filled on the preview of the Vegetation page, the indicators are suggested in the
// supplement's order, and what the user confirms is ticked on the PDF. What is not confirmed goes on a cover note.
import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { PDFDocument } from "pdf-lib"
import { JF1_PLANTS_TYPED } from "../src/delineation/fixtures/jf1"
import { pdfText } from "../src/delineation/testing/pdfText"
import { createPoint } from "./projects"

/** Type a plant and its cover and add it. */
async function addPlant(sheet: Locator, typed: string, cover: string, stratum?: string) {
  if (stratum) await sheet.getByRole("group", { name: "Stratum" }).getByRole("button", { name: stratum, exact: true }).click()
  await sheet.getByLabel("Plant name").fill(typed)
  await sheet.getByLabel("Cover %").fill(cover)
  await sheet.getByRole("button", { name: "Add plant" }).click()
}

/** Download the Vegetation PDF: its bytes and how many pages it has. */
async function download(page: Page, sheet: Locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download vegetation PDF" }).click()])
  const bytes = new Uint8Array(readFileSync(await file.path()))
  return { bytes, pages: (await PDFDocument.load(bytes)).getPageCount() }
}

const field = (sheet: Locator, id: string) => sheet.locator(`[data-field="${id}"]`)
const indicator = (sheet: Locator, id: string) => sheet.getByTestId("veg-indicators").locator(`[data-testid="veg-indicator"][data-indicator="${id}"]`)

test("JF-1: the dominant is marked, the worksheets are filled, and what is confirmed is ticked on the page", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "JF fixture", "JF-1")
  for (const [typed, cover] of JF1_PLANTS_TYPED) await addPlant(sheet, typed, String(cover))

  // Fall panicgrass is the only dominant: 50 of 85, over the 42.5 line, and nothing else reaches 17.
  await expect(sheet.getByTestId("veg-dominants").locator('[data-stratum="herb"]')).toContainText("Herb: total cover 85, 50% is 42.5, 20% is 17. Panicum dichotomiflorum (50)")
  await expect(field(sheet, "veg.herb.0.dominant")).toHaveText("Yes")
  await expect(field(sheet, "veg.herb.1.dominant")).toHaveText("No")
  await expect(field(sheet, "veg.herb.8.dominant")).toHaveText("No")

  // The worksheets on the preview.
  for (const [id, text] of [
    ["veg.dominance.a", "1"],
    ["veg.dominance.b", "1"],
    ["veg.dominance.percent", "100%"],
    ["veg.prevalence.OBL.cover", "0"],
    ["veg.prevalence.FACW.cover", "53"],
    ["veg.prevalence.FACW.product", "106"],
    ["veg.prevalence.FAC.cover", "18"],
    ["veg.prevalence.FACU.cover", "13"],
    ["veg.prevalence.total.a", "84"],
    ["veg.prevalence.total.b", "212"],
    ["veg.prevalence.index", "2.52"],
  ] as const) {
    await expect(field(sheet, id), id).toHaveText(text)
  }

  // The indicators in the supplement's order: the first two satisfied, the prevalence index not needed, the last two the user's.
  await expect(sheet.getByTestId("veg-indicators").getByTestId("veg-indicator")).toHaveCount(5)
  const states = await sheet.getByTestId("veg-indicators").getByTestId("veg-indicator").evaluateAll((nodes) => nodes.map((n) => [n.getAttribute("data-indicator"), n.getAttribute("data-state")]))
  expect(states).toEqual([["rapid", "satisfied"], ["dominance", "satisfied"], ["prevalence", "not applied"], ["morphological", "yours"], ["problematic", "yours"]])
  await expect(indicator(sheet, "dominance").getByTestId("veg-indicator-reason")).toHaveText("1 of 1 dominant species is OBL, FACW or FAC: 100 percent. It must be more than 50.")
  await expect(indicator(sheet, "dominance").getByTestId("veg-indicator-rule")).toContainText("More than 50 percent of the dominant plant species across all strata are rated OBL, FACW, or FAC.")
  await expect(indicator(sheet, "prevalence").getByTestId("veg-indicator-reason")).toContainText("Not needed: the dominance test is satisfied. The prevalence index is 2.52 (212 / 84), 3.0 or less.")

  // Nothing is ticked until it is confirmed; the unconfirmed suggestions go on a cover note.
  const preview = sheet.getByTestId("veg-preview-text")
  await expect(preview.filter({ hasText: /^X$/ })).toHaveCount(0)
  await expect(sheet.getByTestId("veg-present")).toContainText("Suggested: Yes. Yes: Rapid Test for Hydrophytic Vegetation and Dominance Test is >50% are satisfied.")
  const unconfirmed = await download(page, sheet)
  expect(unconfirmed.pages).toBe(2)
  expect((await pdfText(unconfirmed.bytes, 2)).map((d) => d.text).join(" ")).toContain("Suggested by the app, not confirmed")

  // Confirm both and answer Yes.
  await sheet.getByRole("button", { name: "Confirm Rapid Test" }).click()
  await sheet.getByRole("button", { name: "Confirm Dominance Test" }).click()
  await expect(indicator(sheet, "rapid")).toHaveAttribute("data-decision", "confirmed")
  await expect(preview.filter({ hasText: /^X$/ })).toHaveCount(2)
  const yes = sheet.getByTestId("veg-present").getByRole("button", { name: "Yes", exact: true })
  await yes.click()
  await expect(yes).toHaveAttribute("aria-pressed", "true")
  await expect(preview.filter({ hasText: /^X$/ })).toHaveCount(3)

  // The PDF: one page, no cover note, the worksheet values and each X on the blank beside its label.
  const made = await download(page, sheet)
  expect(made.pages).toBe(1)
  const drawn = await pdfText(made.bytes, 1)
  const texts = drawn.map((d) => d.text)
  for (const value of ["100%", "2.52", "212", "84", "53"]) expect(texts, value).toContain(value)
  const ticks = drawn.filter((d) => d.text === "X")
  expect(ticks).toHaveLength(3)
  const label = (text: string) => drawn.find((d) => d.text === text)!
  for (const [tick, words] of [[ticks[0], "Rapid Test"], [ticks[1], "Dominance Test is"]] as const) {
    const beside = drawn.find((d) => d.text.includes(words) && d.x > 380 && Math.abs(d.baseline - tick.baseline) < 3)
    expect(beside, words).toBeDefined()
    expect(tick.x).toBeLessThan(beside!.x)
  }
  expect(ticks[2].x).toBeGreaterThan(label("Yes").x)
  expect(ticks[2].x).toBeLessThan(label("No").x)
  const shown = await preview.filter({ hasText: /^X$/ }).evaluateAll((nodes) => nodes.map((n) => ({ x: Number(n.getAttribute("x")), baseline: Number(n.getAttribute("y")) })))
  ticks.forEach((t, i) => {
    expect(t.x).toBeCloseTo(shown[i].x, 1)
    expect(t.baseline).toBeCloseTo(shown[i].baseline, 1)
  })

  // The choices stay.
  await page.reload()
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  const again = page.getByRole("dialog", { name: "Projects", exact: true })
  await again.getByRole("button", { name: "Open project" }).click()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(indicator(again, "rapid")).toHaveAttribute("data-decision", "confirmed")
  await expect(again.getByTestId("veg-present")).toHaveAttribute("data-answer", "yes")
})

test("a failing dominance test waits for hydric soil and hydrology, unless the user applies the prevalence index and says why", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Upland edge", "UE-1")
  for (const [typed, stratum] of [["Quercus alba", "Tree"], ["Acer saccharum", "Tree"], ["Pinus strobus", "Tree"]] as const) await addPlant(sheet, typed, "10", stratum)
  await addPlant(sheet, "Carex stricta", "70", "Herb")

  // 1 of 4 dominants is OBL, FACW or FAC: the dominance test fails, and the index is not applied yet.
  await expect(indicator(sheet, "dominance")).toHaveAttribute("data-state", "not met")
  await expect(indicator(sheet, "prevalence")).toHaveAttribute("data-state", "not applied")
  await expect(indicator(sheet, "prevalence").getByTestId("veg-indicator-reason")).toContainText("Missing: a hydric soil indicator and wetland hydrology indicators.")
  await expect(sheet.getByTestId("veg-present")).toContainText("No indicator is satisfied.")
  await expect(field(sheet, "veg.prevalence.index")).toHaveText("1.90")

  // Applying it anyway needs a reason.
  const apply = sheet.getByRole("form", { name: "Apply the prevalence index anyway" })
  await apply.getByRole("button", { name: "Apply it" }).click()
  await expect(apply.getByRole("alert")).toContainText("Say why.")
  await apply.getByLabel("Apply the prevalence index anyway, because").fill("Soil and hydrology are on the next point")
  await apply.getByRole("button", { name: "Apply it" }).click()
  await expect(indicator(sheet, "prevalence")).toHaveAttribute("data-state", "satisfied")
  await expect(indicator(sheet, "prevalence").getByTestId("veg-indicator-reason")).toContainText("Applied at your request: Soil and hydrology are on the next point. The prevalence index is 1.90 (190 / 100), 3.0 or less.")
  await expect(sheet.getByTestId("veg-present")).toContainText("Suggested: Yes. Yes: Prevalence Index is 3.0 or less is satisfied.")

  // An indicator that rests on what the user saw needs the user's words.
  const morph = sheet.getByRole("form", { name: "Tick Morphological Adaptations" })
  await morph.getByRole("button", { name: "Tick it" }).click()
  await expect(morph.getByRole("alert")).toContainText("Say what you saw.")
  await morph.getByLabel("What you saw").fill("Adventitious roots on most of the white oak")
  await morph.getByRole("button", { name: "Tick it" }).click()
  await expect(indicator(sheet, "morphological").getByTestId("veg-indicator-state")).toContainText("Ticked: Adventitious roots on most of the white oak")

  // On the PDF: the user's tick on the page, and the cover note has the suggestion, the tick's reason and why the index was applied.
  const made = await download(page, sheet)
  expect(made.pages).toBe(2)
  expect((await pdfText(made.bytes, 1)).filter((d) => d.text === "X")).toHaveLength(1)
  const note = (await pdfText(made.bytes, 2)).map((d) => d.text).join(" ")
  expect(note).toContain("3 - Prevalence Index is 3.0 or less")
  expect(note).toContain("The user's reason: Adventitious roots on most of the white oak")
  expect(note).toContain("Prevalence index applied by the user")
  expect(note).toContain("Soil and hydrology are on the next point")

  // Stop applying it: back to waiting.
  await sheet.getByRole("button", { name: "Stop applying" }).click()
  await expect(indicator(sheet, "prevalence")).toHaveAttribute("data-state", "not applied")
})

test("on a 360 px phone the vegetation indicators are not wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/")
  const sheet = await createPoint(page, "JF fixture", "JF-1")
  for (const [typed, cover] of JF1_PLANTS_TYPED) await addPlant(sheet, typed, String(cover))
  await sheet.getByTestId("veg-indicators").scrollIntoViewIfNeeded()
  const morph = sheet.getByRole("form", { name: "Tick Morphological Adaptations" })
  await morph.getByLabel("What you saw").fill("A remark with a-very-long-unbroken-word-that-must-not-widen-anything-at-all and more words after it")
  await morph.getByRole("button", { name: "Tick it" }).click()
  await expect(indicator(sheet, "morphological").getByTestId("veg-indicator-state")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  expect(await sheet.getByTestId("veg-indicators").evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
})
