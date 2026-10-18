// Seam 2: page 1's header and the project PDF, through the built page. The header is entered once for a
// project, two sampling points are added, a pair is recorded, and the project's PDF is read back.
import { readFileSync } from "node:fs"
import { expect, test, type Download, type Locator, type Page } from "@playwright/test"
import { pdfText } from "../src/delineation/testing/pdfText"

const projectsSheet = (page: Page) => page.getByRole("dialog", { name: "Projects", exact: true })

async function openProjects(page: Page) {
  await page.getByRole("button", { name: "Projects", exact: true }).click()
  return projectsSheet(page)
}

async function createProject(sheet: Locator, name: string) {
  await sheet.getByLabel("Project name").fill(name)
  await sheet.getByRole("button", { name: "Create project" }).click()
  await sheet.getByRole("button", { name: "Open project" }).click()
}

const HEADER: [label: string, value: string][] = [
  ["Project/Site", "Cedar Creek crossing"],
  ["Applicant/Owner", "County Roads Dept"],
  ["City/County", "Story"],
  ["State", "IA"],
  ["Investigator(s)", "J. Fixture"],
  ["Sampling Date", "2026-10-18"],
  ["Section, Township, Range", "S14 T83N R24W"],
  ["Landform", "terrace"],
  ["Local relief", "concave"],
  ["Slope %", "2"],
  ["Subregion", "MLRA 103"],
  ["Soil Map Unit Name", "Clarion loam"],
  ["NWI classification", "PEM1C"],
]

async function fillHeader(sheet: Locator, values = HEADER) {
  await sheet.getByRole("button", { name: "Edit header" }).click()
  for (const [label, value] of values) await sheet.getByLabel(label).fill(value)
  await sheet.getByRole("radiogroup", { name: 'Are "Normal Circumstances" present?' }).getByRole("radio", { name: "Yes" }).click()
  const answer = (group: string, answer: string) => sheet.getByRole("radiogroup", { name: group }).getByRole("radio", { name: answer }).click()
  await answer("Vegetation significantly disturbed", "No")
  await answer("Soil significantly disturbed", "No")
  await answer("Hydrology significantly disturbed", "Yes")
  await answer("Soil naturally problematic", "No")
  await sheet.getByRole("button", { name: "Save header" }).click()
  await expect(sheet.getByTestId("header-summary")).toBeVisible() // the form closes once it is saved
}

async function addPoint(sheet: Locator, name: string) {
  await sheet.getByLabel("Sampling point name").fill(name)
  await sheet.getByRole("button", { name: "Add sampling point" }).click()
  // The field clears when the point is saved; the next one is typed after that.
  await expect(sheet.getByTestId("point").filter({ hasText: name })).toBeVisible()
  await expect(sheet.getByLabel("Sampling point name")).toHaveValue("")
}

async function openPoint(sheet: Locator, name: string) {
  await sheet.getByTestId("point").filter({ hasText: name }).getByRole("button", { name: "Open point" }).click()
}

async function setDetails(sheet: Locator, details: { lat: string; long: string; datum: string; pairWith?: string; role?: "Wetland point" | "Upland point" }) {
  await sheet.getByRole("button", { name: "Edit location and pair" }).click()
  await sheet.getByLabel("Lat", { exact: true }).fill(details.lat)
  await sheet.getByLabel("Long", { exact: true }).fill(details.long)
  await sheet.getByLabel("Datum").fill(details.datum)
  if (details.pairWith) {
    await sheet.getByLabel("Paired with").selectOption({ label: details.pairWith })
    await sheet.getByRole("radiogroup", { name: "This point is the" }).getByRole("radio", { name: details.role ?? "Wetland point" }).click()
  }
  await sheet.getByRole("button", { name: "Save details" }).click()
  await expect(sheet.getByTestId("point-details")).toBeVisible() // the form closes once it is saved
}

const textOf = async (download: Download, pageNumber: number) =>
  (await pdfText(new Uint8Array(readFileSync(await download.path())), pageNumber)).map((d) => d.text)

const page1Text = (sheet: Locator) => sheet.getByTestId("page1-preview").getByTestId("preview-text")

test("the header is filled once, two points are added, and the project's PDF reads back both forms", async ({ page }) => {
  await page.goto("/")
  const sheet = await openProjects(page)
  await createProject(sheet, "Cedar Creek")

  // The site starts as the project's name; the header fills every line once.
  await expect(sheet.getByTestId("header-summary")).toContainText("1 of 13 lines filled")
  await fillHeader(sheet)
  await expect(sheet.getByTestId("header-summary")).toContainText("13 of 13 lines filled")

  await addPoint(sheet, "JF-1")
  await addPoint(sheet, "JF-2")
  await openPoint(sheet, "JF-1")
  await setDetails(sheet, { lat: "42.5009", long: "-93.2204", datum: "WGS84", pairWith: "JF-2", role: "Wetland point" })
  await expect(sheet.getByTestId("point-details")).toContainText("Wetland point, paired with the upland point JF-2.")

  // Page 1's preview shows the project's lines and this point's own, as the PDF will draw them.
  await expect(page1Text(sheet)).toHaveText([
    "Cedar Creek crossing", "Story", "10/18/2026", "County Roads Dept", "IA", "JF-1", "J. Fixture", "S14 T83N R24W",
    "terrace", "concave", "2", "MLRA 103", "42.5009", "-93.2204", "WGS84", "Clarion loam", "PEM1C",
    "X", "N", "N", "Y", "N", "Wetland point, paired with the upland point JF-2.",
  ])

  // The other half of the pair says so too, with its own lines and the same header.
  await sheet.getByRole("button", { name: "Cedar Creek" }).click()
  await openPoint(sheet, "JF-2")
  await expect(sheet.getByTestId("point-details")).toContainText("Upland point, paired with the wetland point JF-1.")
  await setDetails(sheet, { lat: "42.5012", long: "-93.2210", datum: "WGS84" })
  await expect(sheet.getByTestId("point-details")).toContainText("Upland point, paired with the wetland point JF-1.") // kept by the save
  await expect(page1Text(sheet).filter({ hasText: "Cedar Creek crossing" })).toHaveCount(1)
  await expect(page1Text(sheet).filter({ hasText: /^JF-2$/ })).toHaveCount(1)

  // The project's PDF: for each point, page 1, the Soil page and the Privacy Act page, in the order listed.
  await sheet.getByRole("button", { name: "Cedar Creek" }).click()
  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download project PDF" }).click()])
  expect(download.suggestedFilename()).toBe("wetland-forms-Cedar-Creek.pdf")
  const first = await textOf(download, 1)
  const second = await textOf(download, 4)
  expect(first).toContain("JF-1")
  expect(first).not.toContain("JF-2")
  expect(second).toContain("JF-2")
  expect(second).not.toContain("JF-1")
  for (const text of ["Cedar Creek crossing", "County Roads Dept", "Story", "IA", "J. Fixture", "10/18/2026", "PEM1C", "WGS84"]) {
    expect(first, text).toContain(text)
    expect(second, text).toContain(text)
  }
  expect(first).toContain("42.5009")
  expect(second).toContain("42.5012")
  expect(first).toContain("Wetland point, paired with the upland point JF-2.")
  expect(second).toContain("Upland point, paired with the wetland point JF-1.")
  expect((await textOf(download, 3)).join(" ")).toContain("AGENCY DISCLOSURE NOTIFICATION")
  expect((await textOf(download, 6)).join(" ")).toContain("PRIVACY ACT STATEMENT")
})

test("the header and the pair are still there after a reload, and a point's own PDF holds only its pages", async ({ page }) => {
  await page.goto("/")
  let sheet = await openProjects(page)
  await createProject(sheet, "Pond")
  await fillHeader(sheet, [["Project/Site", "North pond"], ["City/County", "Boone"]])
  await addPoint(sheet, "SP-1")
  await addPoint(sheet, "SP-2")
  await openPoint(sheet, "SP-1")
  await setDetails(sheet, { lat: "41.9", long: "-93.6", datum: "WGS84", pairWith: "SP-2", role: "Upland point" })

  await page.reload()
  sheet = await openProjects(page)
  await sheet.getByRole("button", { name: "Open project" }).click()
  await expect(sheet.getByTestId("header-summary")).toContainText("2 of 13 lines filled")
  await openPoint(sheet, "SP-2")
  await expect(sheet.getByTestId("point-details")).toContainText("Wetland point, paired with the upland point SP-1.")

  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download PDF" }).click()])
  expect(download.suggestedFilename()).toBe("wetland-form-Pond-SP-2.pdf")
  const pages = await Promise.all([1, 2, 3].map((n) => textOf(download, n)))
  expect(pages[0]).toContain("SP-2")
  expect(pages[0]).toContain("North pond")
  expect(pages.flat()).not.toContain("SP-1")
  await expect(textOf(download, 4)).rejects.toThrow() // three pages, not four
})

test("a line too long for its place on the form says so, and a character the form cannot print is replaced", async ({ page }) => {
  await page.goto("/")
  const sheet = await openProjects(page)
  await createProject(sheet, "Long")
  await fillHeader(sheet, [["City/County", "Story County, Iowa, and the neighbouring counties besides"], ["Investigator(s)", "José 中"]])
  await addPoint(sheet, "P-1")
  await openPoint(sheet, "P-1")
  const warnings = sheet.getByTestId("form-warnings")
  await expect(warnings).toContainText("City/County is too long for its line on the form")
  await expect(warnings).toContainText("Investigator(s): the text has characters the form cannot print")
  await expect(page1Text(sheet).filter({ hasText: "José ?" })).toHaveCount(1)
})

test("a project saved before the header existed opens with a blank header and still exports", async ({ page }) => {
  await page.goto("/")
  // Opening Projects is what creates the database; the old project is put into it after that.
  await expect(await openProjects(page)).toContainText("No projects yet")
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("munsell-soil-reader")
        request.onsuccess = () => {
          const tx = request.result.transaction("projects", "readwrite")
          tx.objectStore("projects").put({
            id: "old-project",
            name: "Older project",
            region: "NCNE",
            createdAt: 1,
            points: [{ id: "old-point", name: "OP-1", layers: [] }],
          })
          tx.oncomplete = () => {
            request.result.close()
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      }),
  )
  await page.reload()
  const sheet = await openProjects(page)
  await sheet.getByRole("button", { name: "Open project" }).click()
  await expect(sheet.getByTestId("header-summary")).toContainText("0 of 13 lines filled")
  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download project PDF" }).click()])
  expect(await textOf(download, 1)).toContain("OP-1")
})
