import { defineConfig, devices } from "@playwright/test"

// E2E_PORT lets parallel worktrees run the browser tests at the same time.
const PORT = Number(process.env.E2E_PORT ?? 4173)

// The engines the browser tests run on, each on a phone-sized screen with touch. Firefox has no
// mobile emulation (isMobile throws there), so it gets the desktop browser at the Pixel 7's size.
const ENGINES = {
  chromium: devices["Pixel 7"],
  webkit: devices["iPhone 15"],
  firefox: { ...devices["Desktop Firefox"], viewport: { width: 412, height: 839 }, hasTouch: true },
}

// Plain `npm run test:e2e` runs Chromium only, as does the deploy workflow, which installs only
// Chromium. Naming an engine, `npm run test:e2e -- --project=webkit`, makes all three available.
// Workers read this file again but not the command line, so the choice goes on in the environment.
process.env.E2E_ALL_ENGINES ??= process.argv.some((arg) => arg.startsWith("--project")) ? "1" : ""
const engines = Object.entries(ENGINES).filter(([name]) => name === "chromium" || process.env.E2E_ALL_ENGINES)

// Seam 2: the built page. The tests run against the production build (vite build, then
// vite preview). CI runs each engine as its own job (.github/workflows/ci.yml).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A test that passes only on its retry is flaky. It keeps its trace, and the run still fails.
  failOnFlakyTests: !!process.env.CI,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["json", { outputFile: "e2e-results.json" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: engines.map(([name, use]) => ({ name, use })),
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
