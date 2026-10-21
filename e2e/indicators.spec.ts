// Seam 3: hydric soil indicators. JF-1 is recorded, the app suggests Thick Dark Surface (A12) with the rule
// quoted and the layers named, the user confirms it and the answer, and the PDF has the Xs on the official
// page's own blanks. What is not confirmed prints blank and goes on a cover note.
import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { PDFDocument } from "pdf-lib"
import { JF1_ROWS } from "../src/delineation/fixtures/jf1"
import { pdfRules } from "../src/delineation/testing/pdfRules"
import { pdfText } from "../src/delineation/testing/pdfText"
import { addLayer, createPoint, openProjects, recordJf1 } from "./projects"

// The Sampling Point box at the top of the page is drawn first, then the profile rows.
const JF1_VALUES = ["JF-1", ...JF1_ROWS.flatMap((row) => row.filter((text) => text !== ""))]

/** Download the Soil page and read it back: its bytes, and how many pages it has. */
async function download(page: Page, sheet: Locator) {
  const [file] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download Soil page PDF" }).click()])
  const bytes = new Uint8Array(readFileSync(await file.path()))
  return { bytes, pages: (await PDFDocument.load(bytes)).getPageCount() }
}

const coverText = async (bytes: Uint8Array) => (await pdfText(bytes, 2)).map((d) => d.text).join(" ")

test("JF-1 suggests A12 with its rule and layers; confirmed, it and Yes are Xs on the official page's blanks", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "JF fixture", "JF-1")
  await recordJf1(sheet)
  const panel = sheet.getByTestId("indicators")
  const preview = sheet.getByTestId("soil-preview-text")

  // One suggestion, the rule in the document's words, and the layers that satisfy it.
  const suggestion = panel.getByTestId("suggestion")
  await expect(suggestion).toHaveCount(1)
  await expect(suggestion).toHaveAttribute("data-indicator", "A12")
  await expect(suggestion).toHaveAttribute("data-decision", "pending")
  await expect(suggestion).toContainText("A12 Thick Dark Surface")
  await expect(suggestion).toContainText("Suggested from Layers 1 to 4 (0-34 in)")
  await expect(suggestion.getByTestId("suggestion-rule")).toContainText("A layer 15 cm (6 inches) or more thick with a depleted or gleyed matrix that has 60 percent or more chroma of 2 or less")
  await expect(suggestion.getByTestId("suggestion-rule")).toContainText("Field Indicators of Hydric Soils")
  await expect(suggestion.getByTestId("suggestion-evidence")).toContainText("Layers 3 and 4 (25-34 in)")
  // The ones it cannot decide are listed with what they need, not suggested.
  await panel.getByTestId("needs").locator("summary").click()
  await expect(panel.getByTestId("needs").locator('[data-indicator="A1"]')).toContainText("Histosol")
  await expect(panel.getByTestId("needs").locator('[data-indicator="A4"]')).toContainText("hydrogen sulfide")

  // Nothing is ticked until it is confirmed, and Hydric Soil Present has nothing to suggest yet.
  await expect(preview).toHaveText(JF1_VALUES)
  await expect(panel.getByTestId("hydric-present")).toContainText("No indicator is confirmed yet.")
  const unconfirmed = await download(page, sheet)
  expect(await pdfText(unconfirmed.bytes)).not.toContainEqual(expect.objectContaining({ text: "X" }))
  expect(unconfirmed.pages).toBe(2)
  const note = await coverText(unconfirmed.bytes)
  expect(note).toContain("Suggested by the app, not confirmed")
  expect(note).toContain("A12 Thick Dark Surface")
  expect(note).toContain("Layers 3 and 4 (25-34 in)")

  // Confirm it: an X in the preview, and Yes is suggested but not yet answered.
  await panel.getByRole("button", { name: "Confirm A12" }).click()
  await expect(suggestion).toHaveAttribute("data-decision", "confirmed")
  await expect(preview).toHaveText([...JF1_VALUES, "X"])
  await expect(panel.getByTestId("hydric-present")).toContainText("Suggested: Yes. Yes: A12 Thick Dark Surface is confirmed.")
  await expect(panel.getByTestId("hydric-present")).toContainText("Your answer prints on the Soil page only once you confirm it.")
  const yes = panel.getByTestId("hydric-present").getByRole("button", { name: "Yes", exact: true })
  await expect(yes).toHaveAttribute("aria-pressed", "false")
  await expect(preview).toHaveText([...JF1_VALUES, "X"])
  await yes.click()
  await expect(yes).toHaveAttribute("aria-pressed", "true")
  await expect(preview).toHaveText([...JF1_VALUES, "X", "X"])

  // The PDF: one page, no cover note, and each X on the blank beside its own label.
  const made = await download(page, sheet)
  expect(made.pages).toBe(1)
  const drawn = await pdfText(made.bytes)
  const ticks = drawn.filter((d) => d.text === "X")
  expect(ticks).toHaveLength(2)
  const label = (text: string) => drawn.find((d) => d.text === text)!
  const a12 = label("Thick Dark Surface (A12)")
  expect(ticks[0].x).toBeLessThan(a12.x)
  expect(Math.abs(ticks[0].baseline - a12.baseline)).toBeLessThan(3)
  expect(ticks[1].x).toBeGreaterThan(label("Yes").x)
  expect(ticks[1].x).toBeLessThan(label("No").x)
  expect(Math.abs(ticks[1].baseline - label("Yes").baseline)).toBeLessThan(3)
  // Each X is inside a blank the page draws: the rules are read from the file.
  const blanks = await pdfRules(made.bytes)
  for (const t of ticks) {
    const centre = t.x + 3
    expect(blanks.some((b) => centre > b.left && centre < b.right && b.top > t.baseline - 0.1 && b.top - t.baseline < 3), `an X at ${t.x}, ${t.baseline}`).toBe(true)
  }
  // The preview and the PDF put them in the same place.
  const shown = await preview.evaluateAll((nodes) => nodes.slice(-2).map((n) => ({ x: Number(n.getAttribute("x")), baseline: Number(n.getAttribute("y")) })))
  ticks.forEach((t, i) => {
    expect(t.x).toBeCloseTo(shown[i].x, 1)
    expect(t.baseline).toBeCloseTo(shown[i].baseline, 1)
  })

  // The choices stay.
  await page.reload()
  const again = await openProjects(page)
  await again.getByRole("button", { name: "Open project" }).click()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(again.getByTestId("suggestion")).toHaveAttribute("data-decision", "confirmed")
  await expect(again.getByTestId("hydric-present")).toHaveAttribute("data-answer", "yes")
  await expect(again.getByTestId("soil-preview-text")).toHaveText([...JF1_VALUES, "X", "X"])
})

test("a rejected suggestion leaves no tick and no cover note; one the user ticks needs a remark and goes on the cover note", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "JF-1")
  await recordJf1(sheet)
  const panel = sheet.getByTestId("indicators")
  const suggestion = panel.getByTestId("suggestion")

  await panel.getByRole("button", { name: "Reject A12" }).click()
  await expect(suggestion).toHaveAttribute("data-decision", "rejected")
  await expect(suggestion.getByTestId("suggestion-state")).toContainText("Rejected: not ticked.")
  const rejected = await download(page, sheet)
  expect(rejected.pages).toBe(1)
  expect(await pdfText(rejected.bytes)).not.toContainEqual(expect.objectContaining({ text: "X" }))
  await suggestion.getByRole("button", { name: "Undo A12" }).click()
  await expect(suggestion).toHaveAttribute("data-decision", "pending")

  // An indicator the app did not suggest: pick it, and say why.
  const tick = panel.getByRole("form", { name: "Tick another indicator" })
  await tick.getByRole("button", { name: "Tick it" }).click()
  await expect(tick.getByRole("alert")).toContainText("Pick the indicator to tick.")
  await tick.getByLabel("Indicator").selectOption({ label: "Hydrogen Sulfide (A4)" })
  await tick.getByRole("button", { name: "Tick it" }).click()
  await expect(tick.getByRole("alert")).toContainText("Say why in the remark.")
  await tick.getByLabel("Remark").fill("Rotten egg smell at 8 in")
  await tick.getByRole("button", { name: "Tick it" }).click()
  await expect(panel.getByTestId("ticked")).toContainText("A4 Hydrogen Sulfide: Rotten egg smell at 8 in")
  await expect(sheet.getByTestId("soil-preview-text")).toHaveText([...JF1_VALUES, "X"])
  await expect(panel.getByTestId("hydric-present")).toContainText("Yes: A4 Hydrogen Sulfide is confirmed.")

  // On the PDF: the tick, and a cover note with both the unconfirmed suggestion and the user's own tick.
  const made = await download(page, sheet)
  expect(made.pages).toBe(2)
  expect((await pdfText(made.bytes)).filter((d) => d.text === "X")).toHaveLength(1)
  const note = await coverText(made.bytes)
  expect(note).toContain("Suggested by the app, not confirmed")
  expect(note).toContain("A12 Thick Dark Surface")
  expect(note).toContain("Ticked by the user, not suggested by the app")
  expect(note).toContain("A4 Hydrogen Sulfide: Rotten egg smell at 8 in")
})

test("the subregion picked on the project decides which indicators are offered", async ({ page }) => {
  await page.goto("/")
  const sheet = await openProjects(page)
  await sheet.getByLabel("Project name").fill("Pond")
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
  await sheet.getByLabel("Sampling point name").fill("SP-1")
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  const picker = sheet.getByTestId("subregion")
  const needs = (id: string) => sheet.getByTestId("indicators").getByTestId("needs").locator(`[data-indicator="${id}"]`)

  await picker.getByLabel("Subregion (LRR)").selectOption({ label: "LRR M" })
  await sheet.getByRole("button", { name: "Open point" }).click()
  await addLayer(sheet, { top: "0", bottom: "13", matrix: "10YR 2/1" })
  await addLayer(sheet, { top: "13", bottom: "19", matrix: "10YR 5/1" })
  await expect(sheet.getByTestId("suggestion")).toHaveAttribute("data-indicator", "A12")
  await expect(sheet.getByTestId("indicators")).toContainText("Subregion: LRR M.")
  await sheet.getByTestId("needs").locator("summary").click()
  // Marl and High Chroma Sands are for LRR K and L: not offered in LRR M. Hydrogen Sulfide is for all.
  await expect(needs("F10")).toHaveCount(0)
  await expect(needs("S11")).toHaveCount(0)
  await expect(needs("A4")).toHaveCount(1)

  await sheet.getByRole("button", { name: "Pond" }).click()
  await picker.getByLabel("Subregion (LRR)").selectOption({ label: "LRR K (Northcentral Forests)" })
  await sheet.getByRole("button", { name: "Open point" }).click()
  await sheet.getByTestId("needs").locator("summary").click()
  await expect(sheet.getByTestId("indicators")).toContainText("Subregion: LRR K.")
  await expect(needs("F10")).toContainText("marl")
  await expect(needs("S11")).toContainText("dune-and-swale")

  // Not picked: the scoped ones ask for it, and A12 is still suggested.
  await sheet.getByRole("button", { name: "Pond" }).click()
  await picker.getByLabel("Subregion (LRR)").selectOption({ label: "Not picked" })
  await sheet.getByRole("button", { name: "Open point" }).click()
  await sheet.getByTestId("needs").locator("summary").click()
  await expect(sheet.getByTestId("indicators")).toContainText("The project's subregion is not picked")
  await expect(needs("F10")).toContainText("Pick it on the project")
  await expect(sheet.getByTestId("suggestion")).toHaveAttribute("data-indicator", "A12")
})

test("on a 360 px phone the indicators panel, with a suggestion and a cover-note tick, is not wider than the screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto("/")
  const sheet = await createPoint(page, "JF fixture", "JF-1")
  await recordJf1(sheet)
  const panel = sheet.getByTestId("indicators")
  await panel.getByTestId("needs").locator("summary").click()
  const tick = panel.getByRole("form", { name: "Tick another indicator" })
  await tick.getByLabel("Indicator").selectOption({ label: "Other (Explain in Remarks)" })
  await tick.getByLabel("Remark").fill("A remark long enough to wrap onto several lines at this width, with a-very-long-unbroken-word-that-must-not-widen-anything-at-all")
  await tick.getByRole("button", { name: "Tick it" }).click()
  await expect(panel.getByTestId("ticked")).toContainText("Other (Explain in Remarks)")
  await expect(panel.getByTestId("suggestion")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
})
