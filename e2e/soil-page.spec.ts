// Seam 2: the wetland form's first page from the Log. A project, a sampling point and its layers
// are typed in, the Soil page is previewed and downloaded as a PDF, and the PDF is read back.
import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"
import type { XY } from "../src/engine"
import { JF1_ROWS } from "../src/delineation/fixtures/jf1"
import { widthOf } from "../src/delineation/text"
import { pdfText } from "../src/delineation/testing/pdfText"
import { SIM_CORNERS, SIM_HEIGHT, SIM_SPOT, SIM_WIDTH } from "../src/engine/simulate"

// The Sampling Point box at the top of the page is drawn first, then the profile rows.
const JF1_VALUES = ["JF-1", ...JF1_ROWS.flatMap((row) => row.filter((text) => text !== ""))]

const projects = (page: Page) => page.getByRole("dialog", { name: "Projects", exact: true })

async function openProjects(page: Page) {
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  return projects(page)
}

interface LayerFields {
  top: string
  bottom: string
  matrix?: string
  matrixPercent?: string
  redox?: [string, string][]
  remarks?: string
}

async function addLayer(sheet: Locator, layer: LayerFields) {
  await sheet.getByRole("button", { name: "Add layer" }).click()
  await sheet.getByLabel("Top (in)").fill(layer.top)
  await sheet.getByLabel("Bottom (in)").fill(layer.bottom)
  if (layer.matrix) await sheet.getByLabel("Matrix color").fill(layer.matrix)
  if (layer.matrixPercent) await sheet.getByLabel("Matrix %").fill(layer.matrixPercent)
  for (const [i, [color, percent]] of (layer.redox ?? []).entries()) {
    await sheet.getByRole("button", { name: "Add a redox color" }).click()
    await sheet.getByLabel(`Redox color ${i + 1}`).fill(color)
    await sheet.getByLabel(`Redox % ${i + 1}`).fill(percent)
  }
  if (layer.remarks) await sheet.getByLabel("Remarks").fill(layer.remarks)
  await sheet.getByRole("button", { name: "Save layer" }).click()
}

/** A project and a sampling point, with the point open. */
async function createPoint(page: Page, projectName: string, pointName: string) {
  const sheet = await openProjects(page)
  await sheet.getByLabel("Project name").fill(projectName)
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
  await sheet.getByLabel("Sampling point name").fill(pointName)
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  await sheet.getByRole("button", { name: "Open point" }).click()
  return sheet
}

test("JF-1 is typed in, previewed and exported as a PDF whose text reads back as transcribed", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "JF fixture", "JF-1")
  await addLayer(sheet, { top: "0", bottom: "20", matrix: "10YR 2/1", matrixPercent: "100" })
  await addLayer(sheet, { top: "20", bottom: "25", matrix: "10YR 3/1", matrixPercent: "100" })
  await addLayer(sheet, { top: "25", bottom: "29", matrix: "10YR 4/2", matrixPercent: "97", redox: [["7.5YR 4/6", "3"]] })
  await addLayer(sheet, { top: "29", bottom: "34", matrix: "10YR 5/2", matrixPercent: "75", redox: [["7.5YR 4/6", "25"]] })

  // The layers list from the surface down, and nothing is wrong with them.
  await expect(sheet.getByTestId("layer")).toHaveCount(4)
  await expect(sheet.getByTestId("layer").nth(2)).toContainText("25-29 in")
  await expect(sheet.getByTestId("layer").nth(2)).toContainText("Redox 7.5YR 4/6, 3%")
  await expect(sheet.getByTestId("form-warnings")).toHaveCount(0)

  // The preview draws the values in row order.
  const preview = sheet.getByTestId("soil-preview-text")
  await expect(preview).toHaveText(JF1_VALUES)

  // The PDF holds the same values, in the same order and at the same places.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    sheet.getByRole("button", { name: "Download Soil page PDF" }).click(),
  ])
  expect(download.suggestedFilename()).toBe("soil-page-JF-fixture-JF-1.pdf")
  const drawn = (await pdfText(new Uint8Array(readFileSync(await download.path())))).slice(-JF1_VALUES.length)
  expect(drawn.map((d) => d.text)).toEqual(JF1_VALUES)
  const shown = await preview.evaluateAll((nodes) =>
    nodes.map((n) => ({ x: Number(n.getAttribute("x")), baseline: Number(n.getAttribute("y")) })),
  )
  drawn.forEach((d, i) => {
    expect(d.x).toBeCloseTo(shown[i].x, 1)
    expect(d.baseline).toBeCloseTo(shown[i].baseline, 1)
  })
})

test("a layer with no matrix color is warned about, and the page still comes out", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "SP-1")
  await addLayer(sheet, { top: "0", bottom: "6" })
  await expect(sheet.getByTestId("form-warnings")).toContainText("Layer 1 (0-6 in) has no matrix color")
  await expect(sheet.getByTestId("soil-preview-text")).toHaveText(["SP-1", "0-6"])
})

test("layer problems are said in plain words, and a typed color is read as the book prints it", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "SP-1")
  await sheet.getByRole("button", { name: "Add layer" }).click()
  await sheet.getByLabel("Top (in)").fill("6")
  await sheet.getByLabel("Bottom (in)").fill("6")
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByRole("alert")).toContainText("The bottom must be deeper than the top.")
  await sheet.getByLabel("Bottom (in)").fill("12")
  await sheet.getByLabel("Matrix color").fill("brown")
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByRole("alert")).toContainText("Matrix: type a soil-book color such as 10YR 4/2.")
  await sheet.getByLabel("Matrix color").fill("10yr 4/2")
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByTestId("layer")).toContainText("Matrix 10YR 4/2, 100%")
})

test("projects, sampling points and layers can be renamed, edited and deleted behind an in-page confirm, and stay after a reload", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "SP-1")
  await addLayer(sheet, { top: "0", bottom: "6", matrix: "10YR 3/2" })
  await addLayer(sheet, { top: "6", bottom: "14", matrix: "10YR 4/2" })

  // Edit a layer, then delete the other one.
  await sheet.getByTestId("layer").nth(1).getByRole("button", { name: "Edit layer" }).click()
  await sheet.getByLabel("Matrix color").fill("10YR 5/2")
  await sheet.getByRole("button", { name: "Save layer" }).click()
  await expect(sheet.getByTestId("layer").nth(1)).toContainText("Matrix 10YR 5/2")
  await sheet.getByTestId("layer").first().getByRole("button", { name: "Delete layer" }).click()
  await sheet.getByRole("button", { name: "Keep" }).click()
  await expect(sheet.getByTestId("layer")).toHaveCount(2)
  await sheet.getByTestId("layer").first().getByRole("button", { name: "Delete layer" }).click()
  await sheet.getByRole("button", { name: "Yes, delete" }).click()
  await expect(sheet.getByTestId("layer")).toHaveCount(1)

  // Back to the project: rename the point, then the project.
  await sheet.getByRole("button", { name: "Pond" }).click()
  await sheet.getByTestId("point").getByRole("button", { name: "Rename" }).click()
  await sheet.getByLabel("Rename sampling point").fill("SP-2")
  await sheet.getByRole("button", { name: "Save name" }).click()
  await expect(sheet.getByTestId("point")).toContainText("SP-2")
  await sheet.getByRole("button", { name: "Rename" }).first().click()
  await sheet.getByLabel("Rename project").fill("Pond north")
  await sheet.getByRole("button", { name: "Save name" }).click()
  await expect(sheet.getByRole("heading", { name: "Pond north" })).toBeVisible()

  await page.reload()
  const again = await openProjects(page)
  await expect(again.getByTestId("project")).toContainText("Pond north")
  await again.getByRole("button", { name: "Open project" }).click()
  await expect(again.getByTestId("point")).toContainText("SP-2")
  await expect(again.getByTestId("point")).toContainText("1 layer")

  // Delete the point, then the project.
  await again.getByRole("button", { name: "Delete point" }).click()
  await expect(again.getByRole("group", { name: /Confirm: delete sampling point SP-2/ })).toBeVisible()
  await again.getByRole("button", { name: "Yes, delete" }).click()
  await expect(again.getByTestId("point")).toHaveCount(0)
  await again.getByRole("button", { name: "All projects" }).click()
  await again.getByRole("button", { name: "Delete project" }).click()
  await again.getByRole("button", { name: "Yes, delete" }).click()
  await expect(again.getByTestId("project")).toHaveCount(0)
})

test("a Reading is assigned to a layer as its matrix color from the readings panel", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "SP-1")
  await addLayer(sheet, { top: "0", bottom: "6" })
  await sheet.getByRole("button", { name: "Close Projects" }).click()

  await page.getByRole("button", { name: /Warm shop light/ }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
  const tap = async (point: XY) => {
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = await page.getByTestId("photo").boundingBox()
    if (!box) throw new Error("The Photo is not on screen")
    await page.touchscreen.tap(box.x + (point.x * box.width) / SIM_WIDTH, box.y + (point.y * box.height) / SIM_HEIGHT)
  }
  for (const corner of SIM_CORNERS) await tap(corner)
  await tap(SIM_SPOT)
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")

  await page.getByRole("button", { name: "Open Readings" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Assign to a layer" }).click()
  const assign = page.getByRole("dialog", { name: "Assign to a layer", exact: true })
  await expect(assign.getByTestId("assign-notation")).toHaveText("10YR 4/3")
  await assign.getByLabel("Percent of the layer").fill("90")
  await assign.getByRole("button", { name: "Assign to layer" }).click()
  await expect(assign.getByRole("status")).toContainText("10YR 4/3 is now the matrix color of SP-1, 0-6 in, at 90%.")
  await assign.getByRole("button", { name: "Done" }).click()

  const again = await openProjects(page)
  await again.getByRole("button", { name: "Open project" }).click()
  await again.getByRole("button", { name: "Open point" }).click()
  await expect(again.getByTestId("layer")).toContainText("Matrix 10YR 4/3, 90%")
  await expect(again.getByTestId("soil-preview-text")).toHaveText(["SP-1", "0-6", "10YR 4/3", "90"])
  await expect(again.getByTestId("form-warnings")).toHaveCount(0)
  void SIM_HEIGHT
})

/** The first version of the database, with one Sample in centimeters, made by hand on the app's own origin before the app runs. */
async function seedCmLog(page: Page) {
  await page.goto("/icon-192.png")
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("munsell-soil-reader", 1)
        request.onupgradeneeded = () => request.result.createObjectStore("samples", { keyPath: "id" })
        request.onsuccess = () => {
          const tx = request.result.transaction("samples", "readwrite")
          tx.objectStore("samples").put({
            id: "cm-era",
            name: "Old pit",
            depthTop: 0,
            depthBottom: 15,
            condition: "moist",
            notes: "",
            location: null,
            createdAt: 0,
            readings: [],
          })
          tx.oncomplete = () => {
            request.result.close()
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      }),
  )
}

const databaseState = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ version: number; stores: string[]; depthBottom: number }>((resolve) => {
        const request = indexedDB.open("munsell-soil-reader")
        request.onsuccess = () => {
          const { version, objectStoreNames } = request.result
          const get = request.result.transaction("samples").objectStore("samples").get("cm-era")
          get.onsuccess = () => {
            request.result.close()
            resolve({ version, stores: [...objectStoreNames].sort(), depthBottom: get.result.depthBottom })
          }
        }
      }),
  )

test("a Log from before inches, with its depths in centimeters, opens with inches and is converted once", async ({ page }) => {
  await seedCmLog(page)
  await page.goto("/")
  await page.getByRole("button", { name: "Open Log" }).click()
  const log = page.getByRole("dialog", { name: "Log", exact: true })
  await expect(log.getByRole("region", { name: "Sample Old pit" })).toContainText("0-5.9 in")

  // It was converted in the upgrade, not on the way to the screen: a reload does not convert again.
  await page.reload()
  await page.getByRole("button", { name: "Open Log" }).click()
  await expect(page.getByRole("dialog", { name: "Log", exact: true }).getByRole("region", { name: "Sample Old pit" })).toContainText("0-5.9 in")
  expect(await databaseState(page)).toEqual({ version: 2, stores: ["projects", "samples"], depthBottom: 5.9 })
})

test("when the update to inches cannot finish, the old Log is still shown and can be exported, but not changed", async ({ page }) => {
  await seedCmLog(page)
  // The disk is full: the upgrade's first write fails, which aborts it.
  await page.addInitScript(() => {
    IDBCursor.prototype.update = function () {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    }
  })
  await page.goto("/")

  // The Log opens as it was, with a note, and its depths are shown in inches (converted for reading).
  await expect(page.getByTestId("log-read-only")).toContainText("The update of the Log could not finish")
  await page.getByRole("button", { name: "Open Log" }).click()
  const log = page.getByRole("dialog", { name: "Log", exact: true })
  await expect(log.getByRole("region", { name: "Sample Old pit" })).toContainText("0-5.9 in")

  // Nothing was written: the database is still version 1, with the centimeters in it.
  expect(await databaseState(page)).toEqual({ version: 1, stores: ["samples"], depthBottom: 15 })

  // It cannot be changed, and says so, without looping or breaking.
  await log.getByRole("button", { name: "Delete Sample" }).click()
  await log.getByRole("button", { name: "Yes, delete" }).click()
  await expect(log.getByRole("alert")).toContainText("The Log could not be written")
  await expect(log.getByRole("region", { name: "Sample Old pit" })).toBeVisible()
  await log.getByRole("button", { name: "Close Log", exact: true }).click()
  await expect(page.getByRole("button", { name: "Save to Log" })).toBeDisabled()
  const projectsSheet = await openProjects(page)
  await expect(projectsSheet.getByRole("alert")).toContainText("could not finish")
  await projectsSheet.getByRole("button", { name: "Close Projects" }).click()

  // The next start, with the disk free again, gets the upgrade through.
  await page.reload()
  expect(await databaseState(page)).toEqual({ version: 1, stores: ["samples"], depthBottom: 15 })
})

test("remarks too wide for their column wrap onto the rows below, and symbols the PDF's font lacks are spelled out", async ({ page }) => {
  await page.goto("/")
  const sheet = await createPoint(page, "Pond", "SP-1")
  const remarks = "pH \u2264 5 \u2192 dark organic surface with many fine roots, small stones and some clay"
  await addLayer(sheet, { top: "0", bottom: "6", matrix: "10YR 3/2", remarks })
  await expect(sheet.getByTestId("form-warnings")).toContainText("Layer 1: the remarks have characters the form cannot print")

  const spelled = "pH <= 5 -> dark organic surface with many fine roots, small stones and some clay"
  const lines = await sheet.locator('[data-testid="soil-preview-text"][data-field$=".remarks"]').allTextContents()
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.join(" ")).toBe(spelled)

  // The PDF is made (the font has no such symbols) and no line of it crosses the table's right rule.
  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download Soil page PDF" }).click()])
  const drawn = await pdfText(new Uint8Array(readFileSync(await download.path())))
  // The remarks are the last text drawn: the name and the row's depth, color and percent come before them.
  const remarkLines = drawn.slice(-lines.length)
  expect(remarkLines.map((d) => d.text)).toEqual(lines)
  for (const d of remarkLines) expect(d.x + widthOf(d.text, 8)).toBeLessThanOrEqual(571.2)
})
