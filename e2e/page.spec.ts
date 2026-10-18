// Seam 2: a Page of the soil book as the Card, through the built page. Tests pick the Page
// example, choose the hue, tap the four Chips and a Spot inside a hole, and read what is on screen.
import { expect, test, type Page } from "@playwright/test"
import { pageSites, type XY } from "../src/engine"
import { EXAMPLES, LIGHTS, PHONE_TONE_CURVE, SIM_HEIGHT, SIM_WIDTH, simulatePhoto } from "../src/engine/simulate"

// Where the Page's Chips and holes really are in the example.
const example = simulatePhoto(EXAMPLES.find((e) => e.id === "page")!.scene)

/** Tap a place on the Photo, given in Photo pixels (the example Photo is SIM_WIDTH x SIM_HEIGHT). */
async function tapPhoto(page: Page, point: XY) {
  const box = await page.getByTestId("photo").boundingBox()
  if (!box) throw new Error("The Photo is not on screen")
  await page.touchscreen.tap(
    box.x + (point.x * box.width) / SIM_WIDTH,
    box.y + (point.y * box.height) / SIM_HEIGHT,
  )
}

async function pickPageExample(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: /Soil-book Page, worn/ }).click()
  await expect(page.getByTestId("photo")).toBeInViewport({ ratio: 1 })
}

const chooseHue = (page: Page, hue: string) =>
  page.getByRole("radiogroup", { name: "Page hue" }).getByRole("radio", { name: hue, exact: true }).click()

test("the Card picker offers ColorChecker, a Page or the frame, and a Page asks for one of six hues", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: /Warm shop light/ }).click()
  const kinds = page.getByRole("radiogroup", { name: "Card" })
  await expect(kinds.getByRole("radio")).toHaveText(["ColorChecker", "Soil-book Page", "Frame"])
  await expect(kinds.getByRole("radio", { name: "ColorChecker" })).toBeChecked()
  await expect(page.getByTestId("corner-prompt")).toContainText("brown patch (top left)")

  await kinds.getByRole("radio", { name: "Soil-book Page" }).click()
  await expect(page.getByTestId("hue-prompt")).toBeVisible()
  await expect(page.getByRole("radiogroup", { name: "Page hue" }).getByRole("radio")).toHaveText([
    "2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y",
  ])
  // Nothing can be tapped until the Chips are known: the Photo ignores the tap.
  await tapPhoto(page, example.corners[0])
  await expect(page.getByTestId("hue-prompt")).toBeVisible()
  await expect(page.getByTestId("corner-prompt")).toHaveCount(0)
})

test("a worn Page reads a Spot in a hole to a corrected Reading, and names the Chips left out", async ({ page }) => {
  await pickPageExample(page)
  await expect(page.getByRole("radiogroup", { name: "Card" }).getByRole("radio", { name: "Soil-book Page" })).toBeChecked()
  await expect(page.getByTestId("hue-prompt")).toContainText("Choose the hue")
  await chooseHue(page, "10YR")

  // The four Chips to tap, with a diagram, in the order the screen shows them.
  await expect(page.getByTestId("page-diagram")).toBeVisible()
  const prompts = ["8/1", "8/8", "5/8", "2/1"]
  for (const [i, corner] of example.corners.entries()) {
    await expect(page.getByTestId("corner-prompt")).toContainText(prompts[i])
    await tapPhoto(page, corner)
  }
  await expect(page.getByTestId("spot-prompt")).toContainText("Tap the middle of the soil")

  // A Spot inside a hole: the soil sits behind the Page.
  await tapPhoto(page, example.holes[10])
  await expect(page.getByTestId("reading-notation")).toHaveText("10YR 4/3")
  // Two steps of the ladder are smudged and left out, so the Card check is caution, not good.
  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "caution")

  await page.getByRole("button", { name: "Open Readings" }).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet.getByTestId("drawer-notation")).toHaveText("10YR 4/3")
  await expect(sheet.getByRole("row", { name: /^Corrected/ })).toContainText("10YR 4/3")
  await expect(sheet.getByRole("row", { name: /^Raw/ })).not.toContainText("10YR 4/3")
  // The two smudged Chips are left out, and named next to the Card check.
  await expect(sheet.getByTestId("left-out")).toContainText("10YR 7/1, 10YR 6/1")
  await expect(sheet.getByTestId("better-page")).toHaveCount(0)
})

test("the overlay rings every Chip of the Page and crosses the two left out", async ({ page }) => {
  await pickPageExample(page)
  await chooseHue(page, "10YR")
  for (const corner of example.corners) await tapPhoto(page, corner)
  await tapPhoto(page, example.holes[10])
  await expect(page.getByTestId("reading-notation")).toBeVisible()

  // The overlay is drawn in white with a black edge. A Chip's ring is white left of its center at
  // its read radius. A Chip left out also carries a cross, so both diagonals through its center are
  // white too. The Chips' own colors, here, are darker than that.
  const sites = pageSites("10YR", example.corners)
  const marks = () =>
    page.getByTestId("photo").evaluate(
      (canvas: HTMLCanvasElement, chips: { center: XY; radius: number }[]) => {
        const ctx = canvas.getContext("2d")!
        // Any white pixel within two pixels: the taps land a pixel or two off the exact centers.
        const white = (x: number, y: number) => {
          const { data } = ctx.getImageData(Math.round(x) - 2, Math.round(y) - 2, 5, 5)
          return Array.from({ length: 25 }, (_, i) => Math.min(data[4 * i], data[4 * i + 1], data[4 * i + 2])).some(
            (v) => v >= 200, // the overlay's white, a little softened at a line's edge
          )
        }
        return chips.map(({ center: c, radius }) => ({
          ring: [-2, -1, 0, 1, 2].some((d) => white(c.x - radius + d, c.y)),
          cross: white(c.x - 0.35 * radius, c.y - 0.35 * radius) && white(c.x + 0.35 * radius, c.y - 0.35 * radius),
        }))
      },
      sites,
    )
  // The overlay is drawn after the Reading appears, so poll. Chip 14 is 10YR 6/3, which nobody
  // tapped and the fit kept: ringed, not crossed. Chips 6 and 12 are 10YR 7/1 and 6/1, the smudged
  // ones: crossed.
  await expect.poll(async () => (await marks()).length).toBe(36)
  await expect.poll(async () => (await marks())[14]).toEqual({ ring: true, cross: false })
  await expect.poll(async () => (await marks())[12].cross).toBe(true)
  await expect.poll(async () => (await marks())[6]).toEqual({ ring: true, cross: true })
})

test("Chips tapped out of order show a failed Card check, and say where to start over", async ({ page }) => {
  await pickPageExample(page)
  await chooseHue(page, "10YR")
  const [tl, tr, br, bl] = example.corners
  for (const corner of [bl, tl, tr, br]) await tapPhoto(page, corner) // starts on the lowest /1
  await tapPhoto(page, example.holes[10])

  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "failed")
  await page.getByRole("button", { name: "Open Readings" }).click()
  await expect(page.getByRole("dialog")).toContainText("Tap Start over and begin at the 8/1 Chip")
})

test("a soil of another hue suggests the Page to retake with", async ({ page, context }) => {
  // A 10YR Page on a 5Y soil, made with the same simulated camera and sent in as a file.
  const sim = simulatePhoto({ camera: { light: LIGHTS.warm, toneCurve: PHONE_TONE_CURVE }, page: "10YR", soil: "5Y 6/4" })
  const maker = await context.newPage()
  const png = await maker.evaluate(
    async ({ base64, width, height }) => {
      const data = Uint8ClampedArray.from(atob(base64), (c) => c.charCodeAt(0))
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d")!.putImageData(new ImageData(data, width, height), 0, 0)
      return canvas.toDataURL("image/png").split(",")[1]
    },
    { base64: Buffer.from(sim.pixels.data).toString("base64"), width: SIM_WIDTH, height: SIM_HEIGHT },
  )
  await maker.close()

  await page.goto("/")
  await page.getByRole("button", { name: /Soil-book Page, worn/ }).click()
  await chooseHue(page, "10YR")
  await page.getByTestId("choose-input").setInputFiles({ name: "5y-soil.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") })
  await expect(page.getByTestId("photo-name")).toHaveText("Your Photo: 5y-soil.png")
  for (const corner of sim.corners) await tapPhoto(page, corner)
  await tapPhoto(page, sim.holes[10])

  await expect(page.getByTestId("card-check")).toHaveAttribute("data-verdict", "good")
  await page.getByRole("button", { name: "Open Readings" }).click()
  const better = page.getByRole("dialog").getByTestId("better-page")
  await expect(better).toContainText("than to the 10YR Page you used")
  await expect(better).toContainText(/Retake the Photo with the (2\.5Y|5Y) Page/)
})

test("the prompt names the second Chip by where it really is: top right only when the top row is full", async ({ page }) => {
  await pickPageExample(page)
  await chooseHue(page, "10YR")
  await tapPhoto(page, example.corners[0])
  await expect(page.getByTestId("corner-prompt")).toContainText("8/8 (top right)")

  // 7.5YR's top row stops at /6, so its second Chip is the last Chip of the top row, not the top right.
  await chooseHue(page, "7.5YR")
  await tapPhoto(page, example.corners[0])
  await expect(page.getByTestId("corner-prompt")).toContainText("8/6 (last Chip of the top row)")
})
