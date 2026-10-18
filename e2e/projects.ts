// Typing a project, a sampling point and its layers into the Projects sheet, for the browser specs
// that start from a recorded point.
import type { Locator, Page } from "@playwright/test"

export const projects = (page: Page) => page.getByRole("dialog", { name: "Projects", exact: true })

export async function openProjects(page: Page) {
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  return projects(page)
}

export interface LayerFields {
  top: string
  bottom: string
  matrix?: string
  matrixPercent?: string
  redox?: [string, string][]
  remarks?: string
}

export async function addLayer(sheet: Locator, layer: LayerFields) {
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
  if (layer.remarks) await sheet.getByLabel("Remarks", { exact: true }).fill(layer.remarks)
  await sheet.getByRole("button", { name: "Save layer" }).click()
}

/** A project and a sampling point, with the point open. */
export async function createPoint(page: Page, projectName: string, pointName: string) {
  const sheet = await openProjects(page)
  await sheet.getByLabel("Project name").fill(projectName)
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
  await sheet.getByLabel("Sampling point name").fill(pointName)
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  await sheet.getByRole("button", { name: "Open point" }).click()
  return sheet
}

/** The four layers of JF-1, typed in as on the paper form. */
export async function recordJf1(sheet: Locator) {
  await addLayer(sheet, { top: "0", bottom: "20", matrix: "10YR 2/1", matrixPercent: "100" })
  await addLayer(sheet, { top: "20", bottom: "25", matrix: "10YR 3/1", matrixPercent: "100" })
  await addLayer(sheet, { top: "25", bottom: "29", matrix: "10YR 4/2", matrixPercent: "97", redox: [["7.5YR 4/6", "3"]] })
  await addLayer(sheet, { top: "29", bottom: "34", matrix: "10YR 5/2", matrixPercent: "75", redox: [["7.5YR 4/6", "25"]] })
}
