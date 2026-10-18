// Temporary probe: many fresh-context service worker installs in a row, to see how often
// WebKit stalls before a worker starts, alone and after the whole suite has run.
import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "allow" })
test.setTimeout(120_000)

for (let i = 1; i <= 120; i++) {
  test(`sw install ${i}`, async ({ page }) => {
    const t0 = Date.now()
    await page.goto("/")
    const outcome = await page.evaluate(() =>
      Promise.race([
        navigator.serviceWorker.ready.then(() => "ready"),
        new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 12_000)),
      ]),
    )
    if (outcome === "TIMEOUT") {
      const regsOf = () =>
        page.evaluate(async () =>
          (await navigator.serviceWorker.getRegistrations()).map((r) => ({
            installing: r.installing?.state,
            waiting: r.waiting?.state,
            active: r.active?.state,
          })),
        )
      const has = async () => (await regsOf()).some((r) => r.installing || r.waiting || r.active)
      const stages: string[] = [`regs ${JSON.stringify(await regsOf())}`]
      let recovered = "none"
      for (let s = 0; s < 36 && recovered === "none"; s++) {
        await page.waitForTimeout(500)
        if (await has()) recovered = `self after ${(Date.now() - t0) / 1000}s`
      }
      stages.push(`waited: ${recovered}`)
      if (recovered === "none") {
        await page
          .evaluate(async () => {
            await Promise.race([(await navigator.serviceWorker.getRegistration())?.update(), new Promise((r) => setTimeout(r, 3000))])
          })
          .catch((e) => stages.push(`update threw ${String(e).slice(0, 80)}`))
        for (let s = 0; s < 16 && recovered === "none"; s++) {
          await page.waitForTimeout(500)
          if (await has()) recovered = "update"
        }
        stages.push(`after update(): ${recovered}`)
      }
      console.log(`SWLOOP STALL #${i} recovered=${recovered} ${JSON.stringify(stages)}`)
      expect(outcome, `service worker never started (recovered: ${recovered})`).toBe("ready")
    }
    const took = (Date.now() - t0) / 1000
    if (took > 2) console.log(`SWLOOP SLOW #${i} ${took}s`)
  })
}
