// The public guide's real review flow: saved answers, deliberate decisions and portable feedback.
import { readFileSync } from "node:fs"
import { expect, test, type Locator, type Page } from "@playwright/test"

const BUILD = "soil-guide-20261021-v2"
const ANSWERS = [
  {
    tab: "Workflow",
    title: "Does this follow the way you work?",
    answer: "Mostly, with changes",
    comment: "Keep paired sampling points easy to compare.",
  },
  {
    tab: "Missing information",
    title: "Can you record the information you need?",
    answer: "Some information is missing",
    comment: "Make the water-depth units easier to find.",
  },
  {
    tab: "Field usability",
    title: "How does it feel on your field device?",
    answer: "Not tried yet",
    comment: "I still need to try this with field gloves.",
  },
  {
    tab: "Documents",
    title: "Does the PDF match what you entered?",
    answer: "The fields match",
    comment: "The example's colors and cover reach the worksheet.",
  },
  {
    tab: "Priority",
    title: "What should we improve first?",
    answer: "Offline use and installation",
    comment: "Help me prepare the phone before leaving signal.",
  },
] as const

async function openGuide(page: Page): Promise<Locator> {
  await page.goto("/#guide")
  return page.getByRole("region", { name: "Your field review", exact: true })
}

async function reviewStep(review: Locator, name: string): Promise<void> {
  await review.getByRole("navigation", { name: "Review questions" })
    .getByRole("button", { name, exact: true }).click()
}

async function expectPhoneFit(page: Page): Promise<void> {
  expect(await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

test("answers and comments persist, but approval must be chosen again after reload", async ({ page }) => {
  const review = await openGuide(page)
  await reviewStep(review, "Review & decision")
  const decisions = review.getByRole("group", { name: "Your decision", exact: true })
  await expect(decisions.getByRole("radio")).toHaveCount(4)
  await expect(decisions.getByRole("radio", { checked: true })).toHaveCount(0)
  await expect(review.getByRole("button", { name: "Copy review to send" })).toBeDisabled()
  await expect(review.getByRole("button", { name: "Download review (.txt)", exact: true })).toBeDisabled()

  for (const item of ANSWERS.slice(0, 2)) {
    await reviewStep(review, item.tab)
    await review.getByRole("radio", { name: item.answer, exact: true }).check()
    await review.getByRole("textbox", { name: /Anything to add/ }).fill(item.comment)
  }
  await reviewStep(review, "Review & decision")
  await review.getByRole("textbox", { name: /Name or initials/ }).fill("Guide test reviewer")
  await review.getByRole("textbox", { name: /Device and browser/ }).fill("Chromium test device")
  await decisions.getByRole("radio", { name: "Ready for field trial", exact: true }).check()
  await expect(review.getByRole("button", { name: "Copy review to send" })).toBeEnabled()

  await page.reload()
  for (const item of ANSWERS.slice(0, 2)) {
    await reviewStep(review, item.tab)
    await expect(review.getByRole("radio", { name: item.answer, exact: true })).toBeChecked()
    await expect(review.getByRole("textbox", { name: /Anything to add/ })).toHaveValue(item.comment)
  }
  await reviewStep(review, "Review & decision")
  await expect(decisions.getByRole("radio", { checked: true })).toHaveCount(0)
  await expect(review.getByRole("textbox", { name: /Name or initials/ })).toHaveValue("Guide test reviewer")
  await expect(review.getByRole("textbox", { name: /Device and browser/ })).toHaveValue("Chromium test device")
  await expect(review.getByRole("button", { name: "Copy review to send" })).toBeDisabled()
  await expect(review.getByRole("button", { name: "Download review (.txt)", exact: true })).toBeDisabled()
  const response = await review.getByRole("textbox", { name: "Your complete review", exact: true }).inputValue()
  expect(response).toContain("Decision: Not selected")
  expect(response).not.toContain("Decision: Ready for field trial")
})

test("download contains the complete review and copying is explicitly not sending", async ({ page }) => {
  const review = await openGuide(page)
  for (const item of ANSWERS) {
    await review.getByRole("radio", { name: item.answer, exact: true }).check()
    await review.getByRole("textbox", { name: /Anything to add/ }).fill(item.comment)
    await review.getByRole("button", {
      name: item.tab === "Priority" ? "Review my answers" : "Continue",
      exact: true,
    }).click()
  }
  await expect(review.getByText("5 of 5 answered", { exact: true })).toBeVisible()
  await expect(review.getByRole("group", { name: "Your decision", exact: true })
    .getByRole("radio", { checked: true })).toHaveCount(0)
  await review.getByRole("textbox", { name: /Name or initials/ }).fill("Guide test reviewer")
  await review.getByRole("textbox", { name: /Device and browser/ }).fill("Chromium, phone viewport")
  await review.getByRole("radio", { name: "Changes needed", exact: true }).check()

  const response = await review.getByRole("textbox", { name: "Your complete review", exact: true }).inputValue()
  expect(response).toContain(`Build: ${BUILD}`)
  expect(response).toContain("Screen-capture source: 1eb9292 (capture provenance; guide build above identifies this review)")
  expect(response).toContain("Guide snapshot: 2026-10-21")
  expect(response).toContain(`Page: ${page.url()}`)
  expect(new URL(page.url()).hash).toBe("#guide")
  expect(response).toContain("Reviewer: Guide test reviewer")
  expect(response).toContain("Device / browser: Chromium, phone viewport")
  for (const item of ANSWERS) {
    expect(response).toContain(`${item.title}\nAnswer: ${item.answer}\nComment: ${item.comment}`)
  }
  expect(response).toContain("Decision: Changes needed")
  expect(response).toContain("This is not a regulatory determination or certification of soil accuracy.")
  await expect(review.getByText(/copying and downloading do not send anything/)).toBeVisible()

  await review.getByRole("button", { name: "Copy review to send" }).click()
  // Clipboard permission varies by engine; the documented manual-copy fallback is also valid.
  await expect(review.getByRole("status")).toContainText(/Nothing was sent by this page|Automatic copying is unavailable/)

  const downloadEvent = page.waitForEvent("download")
  await review.getByRole("button", { name: "Download review (.txt)", exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe(`${BUILD}-feedback.txt`)
  const path = await download.path()
  expect(path).not.toBeNull()
  expect(readFileSync(path!, "utf8")).toBe(response)
  await expect(review.getByRole("status")).toContainText("downloading does not send it")
})

test("all eight walkthrough steps and the review fit a 360 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  const review = await openGuide(page)
  const workflow = page.getByRole("region", { name: "One record, from the field to the form.", exact: true })
  const choices = workflow.getByRole("list", { name: "Choose a workflow step" })
  const steps = [
    ["Project", "Enter the shared details once."],
    ["Sampling point", "Give each place its own field record."],
    ["Photo & readings", "Read the color, with a reference in the photo."],
    ["Soil layers", "Put each Reading where it belongs."],
    ["Vegetation", "Record cover. Let the worksheet do the arithmetic."],
    ["Hydrology", "Record what the water evidence actually shows."],
    ["Confirm indicators", "Read the reason before ticking the box."],
    ["Preview & export", "Check the official page, then take it with you."],
  ] as const
  await expect(choices.getByRole("button")).toHaveCount(8)
  await expect(workflow.getByRole("button", { name: "Previous step", exact: true })).toBeDisabled()
  for (const [i, [title, heading]] of steps.entries()) {
    await expect(choices.getByRole("button", { name: title, exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(workflow.getByRole("heading", { name: heading, exact: true })).toBeVisible()
    await expect(workflow.getByText(`Step ${i + 1} of 8`, { exact: true })).toBeVisible()
    const capture = workflow.getByRole("img")
    await capture.scrollIntoViewIfNeeded()
    await expect.poll(() => capture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expectPhoneFit(page)
    if (i < steps.length - 1) await workflow.getByRole("button", { name: "Next step", exact: true }).click()
  }
  await expect(workflow.getByRole("button", { name: "Next step", exact: true })).toBeDisabled()
  await workflow.getByRole("button", { name: "Previous step", exact: true }).click()
  await expect(choices.getByRole("button", { name: "Confirm indicators", exact: true })).toHaveAttribute("aria-pressed", "true")
  await choices.getByRole("button", { name: "Project", exact: true }).click()
  await expect(workflow.getByRole("button", { name: "Previous step", exact: true })).toBeDisabled()

  await reviewStep(review, "Review & decision")
  await expect(review.getByRole("group", { name: "Your decision", exact: true })).toBeVisible()
  await expectPhoneFit(page)
})
