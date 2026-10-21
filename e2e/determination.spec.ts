// Public JF-1 transcription and generated camera readings only. Hydrology and header choices here
// are simulated acceptance inputs, not observations or a field validation of JF-1.
import { readFileSync, writeFileSync } from "node:fs"
import { PDFDocument } from "pdf-lib"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { JF1_PLANTS_TYPED, JF1_POINT, JF1_ROWS } from "../src/delineation/fixtures/jf1"
import { JF1_DETERMINATION_POINT, JF1_DETERMINATION_PROJECT } from "../src/delineation/fixtures/jf1Determination"
import type { LayerColor, Project } from "../src/delineation/model"
import { pdfText, type DrawnText } from "../src/delineation/testing/pdfText"
import { readPhoto, type Card } from "../src/engine"
import { LIGHTS, simulatePhoto } from "../src/engine/simulate"
import { savedReadings, type Sample } from "../src/lib/log"
import { createPoint, openProjects } from "./projects"

const SYNTHETIC = "Synthetic acceptance inputs: public JF-1 layer/plant transcription; simulated saved readings and hydrology. Not field validation."
const summary = (sheet: Locator, id: string) => sheet.getByTestId(`summary-${id}`)
const field = (sheet: Locator, id: string) => sheet.locator(`[data-field="${id}"]`)

/** Seed the documented Log shape before the app opens, as other migration specs do. */
async function openFixture(page: Page, project: Project, samples: Sample[] = []) {
  await page.goto("/icon-192.png")
  await page.evaluate(({ project, samples }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("munsell-soil-reader", 2)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("samples", { keyPath: "id" })
      request.result.createObjectStore("projects", { keyPath: "id" })
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(["samples", "projects"], "readwrite")
      tx.objectStore("projects").put(project)
      samples.forEach((sample) => tx.objectStore("samples").put(sample))
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  }), { project, samples })
  await page.goto("/")
  const sheet = await openProjects(page)
  await sheet.getByRole("button", { name: "Open project" }).click()
  await sheet.getByRole("button", { name: "Open point" }).click()
  return sheet
}

/** Generate actual engine readings of synthetic photos for the public fixture's colors. */
async function savedJf1() {
  const samples: Sample[] = []
  const layers = []
  for (const layer of JF1_POINT.layers) {
    const sample: Sample = {
      id: `synthetic-${layer.id}`, name: `Synthetic JF-1 ${layer.top}-${layer.bottom}`, depthTop: layer.top,
      depthBottom: layer.bottom, condition: "moist", notes: SYNTHETIC, location: null, createdAt: 0, readings: [],
    }
    const readColor = async (color: LayerColor): Promise<LayerColor> => {
      const photo = simulatePhoto({ camera: { light: LIGHTS.neutral }, soil: color.notation, noise: 0 })
      const card: Card = { kind: "colorchecker", corners: photo.corners }
      const result = await readPhoto({ pixels: photo.pixels, card, spots: [photo.spot] })
      const [reading] = savedReadings(result, card, [0])
      expect(reading.reading.corrected?.chip.notation).toBe(color.notation)
      sample.readings.push(reading)
      return { ...color, notation: reading.reading.corrected!.chip.notation, reading }
    }
    const matrix = await readColor(layer.matrix!)
    const redox: LayerColor[] = []
    for (const color of layer.redox) redox.push(await readColor(color))
    layers.push({ ...layer, matrix, redox })
    samples.push(sample)
  }
  return { samples, project: { ...JF1_DETERMINATION_PROJECT, points: [{ ...JF1_POINT, layers }] } }
}

async function downloadForm(page: Page, sheet: Locator) {
  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download form PDF", exact: true }).click()])
  const bytes = new Uint8Array(readFileSync(await download.path()))
  const count = (await PDFDocument.load(bytes)).getPageCount()
  const pages = await Promise.all(Array.from({ length: count }, (_, i) => pdfText(bytes, i + 1)))
  return { bytes, pages, text: pages.flat().map((t) => t.text).join(" ") }
}

/** Check against the PDF's labels and independently measured blank coordinates, not the preview. */
function expectSummaryTicks(drawn: DrawnText[], answers: ("yes" | "no")[]) {
  const ticks = drawn.filter((t) => t.text === "X" && t.baseline > 250 && t.baseline < 290)
  expect(ticks).toHaveLength(4)
  const baselines = [260.22, 272.58, 284.94, 272.58]
  const lefts = answers.map((answer, i) => i === 3 ? (answer === "yes" ? 443.52 : 489.36) : (answer === "yes" ? 216.72 : 257.76))
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i]
    expect(tick.x).toBeCloseTo(lefts[i] + 7.765, 2)
    expect(tick.baseline).toBeCloseTo(baselines[i], 2)
    const label = drawn.find((t) => t.text === (answers[i] === "yes" ? "Yes" : "No") && t.x < lefts[i] && lefts[i] - t.x < 20 && Math.abs(t.baseline - tick.baseline) < 2)
    expect(label).toBeDefined()
  }
}

async function decide(card: Locator, answer: "yes" | "no", remark: string) {
  await card.getByRole("button", { name: "Override or decide" }).click()
  await card.getByLabel("Your answer", { exact: true }).selectOption(answer)
  await card.getByLabel("Remark explaining your decision").fill(remark)
  await card.getByRole("button", { name: "Confirm answer with remark" }).click()
}

test("JF-1 saved readings to plants, confirmed parameters and a complete, read-back summary PDF", async ({ page }, testInfo) => {
  test.slow()
  const seeded = await savedJf1()
  const sheet = await openFixture(page, seeded.project, seeded.samples)
  await expect(sheet.getByTestId("layer")).toHaveCount(4)
  for (const [i, row] of JF1_ROWS.entries()) {
    await expect(field(sheet, `soil.profile.${i}.depth`)).toHaveText(row[0])
    await expect(field(sheet, `soil.profile.${i}.matrixColor`)).toHaveText(row[1])
  }
  for (const [name, cover] of JF1_PLANTS_TYPED) {
    await sheet.getByLabel("Plant name", { exact: true }).fill(name)
    await sheet.getByLabel("Cover %", { exact: true }).fill(String(cover))
    await sheet.getByRole("button", { name: "Add plant", exact: true }).click()
  }
  await sheet.getByRole("checkbox", { name: "Surface Soil Cracks (B6)", exact: true }).check()
  await sheet.getByRole("checkbox", { name: "Geomorphic Position (D2)", exact: true }).check()
  await sheet.getByLabel("Hydrology remarks", { exact: true }).fill("Simulated test hydrology only; not a JF-1 field observation.")
  await sheet.getByLabel("Hydrology remarks", { exact: true }).blur()
  await expect(summary(sheet, "vegetation")).toContainText("No applicable vegetation indicator is confirmed")
  await expect(summary(sheet, "soil")).toContainText("No indicator is confirmed yet")
  const pending = await downloadForm(page, sheet)
  expect(pending.pages[0].filter((t) => t.text === "X" && t.baseline > 250 && t.baseline < 290)).toHaveLength(0)
  for (const label of ["Page 2 - Vegetation", "Page 3 - Soil", "Page 1 - Hydrology", "Page 1 - Summary of findings"]) expect(pending.text).toContain(label)

  await sheet.getByRole("button", { name: "Confirm A12", exact: true }).click()
  await sheet.getByRole("button", { name: "Confirm Rapid Test", exact: true }).click()
  await sheet.getByRole("button", { name: "Confirm Dominance Test", exact: true }).click()
  for (const id of ["vegetation", "soil", "hydrology"]) {
    const card = summary(sheet, id)
    await expect(card).toHaveAttribute("data-answer", "")
    await card.getByRole("button", { name: "Confirm suggested Yes", exact: true }).click()
    await expect(card).toHaveAttribute("data-answer", "yes")
  }
  await expect(sheet.getByTestId("veg-present")).toHaveAttribute("data-answer", "yes")
  await expect(sheet.getByTestId("hydric-present")).toHaveAttribute("data-answer", "yes")
  await expect(field(sheet, "page1.hydrology.present.yes")).toHaveText("X")
  await expect(summary(sheet, "wetland")).toContainText("All three parameters are confirmed Yes")
  await expect(field(sheet, "page1.summary.wetland.yes")).toHaveCount(0)
  // The explicit human confirmation also labels the retained acceptance artifact.
  await decide(summary(sheet, "wetland"), "yes", SYNTHETIC)
  await expect(field(sheet, "page1.summary.wetland.yes")).toHaveText("X")
  const completed = await downloadForm(page, sheet)
  expectSummaryTicks(completed.pages[0], ["yes", "yes", "yes", "yes"])
  expect(completed.pages).toHaveLength(5) // three form pages, explanatory cover, privacy
  expect(completed.text).toContain(SYNTHETIC)
  expect(completed.text).not.toContain("Unconfirmed conclusions")
  expect(completed.text).not.toContain("Suggested by the app, not confirmed")
  expect(completed.pages[1].map((t) => t.text)).toContain("Panicum dichotomiflorum")
  expect(completed.pages[2].map((t) => t.text)).toContain("29-34")
  expect(completed.pages[2].find((t) => t.text === "X" && t.x > 490.7 && t.x < 512.9 && Math.abs(t.baseline - 550) < 0.1)).toBeDefined()
  // No field observation was inferred from the hydrology indicator ticks.
  expect(completed.pages[0].filter((t) => t.text === "X" && t.x < 340 && t.baseline > 560 && t.baseline < 600)).toHaveLength(0)

  await page.reload()
  const again = await openProjects(page)
  await again.getByRole("button", { name: "Open project" }).click()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(summary(again, "wetland")).toHaveAttribute("data-answer", "yes")
  await expect(summary(again, "wetland")).not.toContainText("changed after confirmation")
  await again.getByRole("checkbox", { name: "Geomorphic Position (D2)", exact: true }).uncheck()
  await expect(summary(again, "wetland")).toContainText("changed after confirmation")
  await expect(field(again, "page1.summary.wetland.yes")).toHaveText("X")
  expect((await downloadForm(page, again)).text).toContain("Retained human confirmations to review")
  const artifact = process.env.JF1_ACCEPTANCE_PDF ?? testInfo.outputPath("JF1-confirmed-acceptance.pdf")
  writeFileSync(artifact, completed.bytes)
  await testInfo.attach("Confirmed JF-1, synthetic acceptance inputs", { path: artifact, contentType: "application/pdf" })
})

test("each override requires a remark, remains shared with its detail page, prints, and can be undone", async ({ page }) => {
  test.slow()
  const point = { ...JF1_DETERMINATION_POINT, hydricSoilPresent: "yes" as const,
    vegetation: { ...JF1_DETERMINATION_POINT.vegetation!, present: "yes" as const },
    hydrology: { ...JF1_DETERMINATION_POINT.hydrology!, present: true } }
  const sheet = await openFixture(page, { ...JF1_DETERMINATION_PROJECT, points: [point] })
  await summary(sheet, "wetland").getByRole("button", { name: "Confirm suggested Yes" }).click()
  for (const id of ["vegetation", "soil", "hydrology", "wetland"]) {
    const card = summary(sheet, id)
    await card.getByRole("button", { name: "Override or decide" }).click()
    await card.getByLabel("Your answer", { exact: true }).selectOption(id === "wetland" ? "yes" : "no")
    await card.getByRole("button", { name: "Confirm answer with remark" }).click()
    await expect(card.getByRole("alert")).toContainText("Explain your decision")
    await card.getByLabel("Remark explaining your decision").fill(`Synthetic ${id} override for acceptance only`)
    await card.getByRole("button", { name: "Confirm answer with remark" }).click()
  }
  await expect(field(sheet, "veg.present.no")).toHaveText("X")
  await expect(field(sheet, "soil.hydric.no")).toHaveText("X")
  await expect(field(sheet, "page1.hydrology.present.no")).toHaveText("X")
  const exported = await downloadForm(page, sheet)
  expectSummaryTicks(exported.pages[0], ["no", "no", "no", "yes"])
  for (const id of ["vegetation", "soil", "hydrology", "wetland"]) expect(exported.text).toContain(`Synthetic ${id} override for acceptance only`)
  await summary(sheet, "soil").getByRole("button", { name: "Undo confirmation" }).click()
  await expect(field(sheet, "soil.hydric.no")).toHaveCount(0)
  await expect(field(sheet, "page1.summary.soil.no")).toHaveCount(0)
  expect((await downloadForm(page, sheet)).text).toContain("Page 3 - Soil; page 1 summary: Hydric Soil Present?")
})

test("unknown is not No and the existing page controls cannot bypass an override remark", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  const sheet = await createPoint(page, "Synthetic unknown", "U-1")
  await expect(summary(sheet, "wetland")).toContainText("Unknown is not No")
  const hydrology = sheet.getByRole("region", { name: "Hydrology", exact: true })
  await expect(hydrology.getByRole("button", { name: "Confirm No", exact: true })).toHaveCount(0)
  await sheet.getByTestId("hydric-present").getByRole("button", { name: "No", exact: true }).click()
  await expect(sheet.getByTestId("hydric-present").getByRole("alert")).toContainText("Add a remark")
  await expect(summary(sheet, "soil")).toHaveAttribute("data-answer", "")
  await hydrology.getByRole("radiogroup", { name: "Wetland Hydrology Present?", exact: true }).getByRole("radio", { name: "No", exact: true }).click()
  await expect(hydrology.getByRole("alert")).toContainText("Add a remark")
  await expect(summary(sheet, "hydrology")).toHaveAttribute("data-answer", "")
  await decide(summary(sheet, "wetland"), "no", "Synthetic manual decision with missing observations")
  await expect(summary(sheet, "wetland")).toHaveAttribute("data-answer", "no")
  expect(errors).toEqual([])
})

test("disturbed conditions require an explicit human decision even with three confirmed Yes answers", async ({ page }) => {
  const point = { ...JF1_DETERMINATION_POINT, hydricSoilPresent: "yes" as const,
    vegetation: { ...JF1_DETERMINATION_POINT.vegetation!, present: "yes" as const },
    hydrology: { ...JF1_DETERMINATION_POINT.hydrology!, present: true } }
  const project = { ...JF1_DETERMINATION_PROJECT, points: [point], header: { ...JF1_DETERMINATION_PROJECT.header,
    disturbed: { ...JF1_DETERMINATION_PROJECT.header.disturbed, soil: "yes" as const } } }
  const sheet = await openFixture(page, project)
  const wetland = summary(sheet, "wetland")
  await expect(wetland).toContainText("Human judgment required")
  await expect(wetland.getByRole("button", { name: "Confirm suggested Yes" })).toHaveCount(0)
  await decide(wetland, "yes", "Synthetic disturbed-soil exception; acceptance test only")
  const exported = await downloadForm(page, sheet)
  expectSummaryTicks(exported.pages[0], ["yes", "yes", "yes", "yes"])
  expect(exported.text).toContain("Synthetic disturbed-soil exception; acceptance test only")
})

for (const parameter of ["soil", "vegetation", "hydrology"] as const) {
  test(`${parameter} summary shortcut focuses the summary without closing Projects or changing history`, async ({ page }) => {
    const sheet = await openFixture(page, { ...JF1_DETERMINATION_PROJECT, points: [JF1_DETERMINATION_POINT] })
    const source = parameter === "hydrology"
      ? sheet.getByRole("region", { name: "Hydrology", exact: true })
      : sheet.getByTestId(parameter === "soil" ? "hydric-present" : "veg-present")
    const url = page.url()
    const historyLength = await page.evaluate(() => history.length)
    await source.getByText("Explain or override in Summary of findings", { exact: true }).click()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole("heading", { name: "Sampling point JF-1", exact: true })).toBeVisible()
    await expect(page).toHaveURL(url)
    expect(await page.evaluate(() => history.length)).toBe(historyLength)
    await expect(sheet.getByRole("region", { name: "Summary of findings", exact: true })).toBeFocused()
  })
}
