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

// The specs that turn service workers on run as a project of their own, `<engine>-sw`, so they
// get a browser of their own. WebKit, once it has run the other specs in the same browser, now
// and then never starts a service worker (the registration exists, no worker ever appears, and
// nothing recovers it: not waiting, update(), registering again or reloading). In 600 installs in
// fresh browsers that never happened; after other specs had run in the browser it happened 13
// times in about 2,800 (once in a hundred after the whole suite). See the README, Tests.
// `--project='webkit*'` runs both projects of an engine.
const SERVICE_WORKER_SPECS = /[\\/](offline|method)\.spec\.ts$/

// Seam 2: the built page. The tests run against the production build (vite build, then
// vite preview). CI runs each engine as its own job (.github/workflows/ci.yml).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Two workers in CI whatever the runner: the macOS runner has 3 cores, which Playwright rounds
  // down to one worker, and WebKit's job then takes the longest of the three.
  workers: process.env.CI ? 2 : undefined,
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
    // No service worker, so its notices (and its caching) never get into another spec. The one
    // that is about the service worker, e2e/offline.spec.ts, turns it back on.
    serviceWorkers: "block",
  },
  projects: engines.flatMap(([name, use]) => [
    { name, use, testIgnore: SERVICE_WORKER_SPECS },
    { name: `${name}-sw`, use, testMatch: SERVICE_WORKER_SPECS },
  ]),
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
