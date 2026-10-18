import { defineConfig, devices } from "@playwright/test"

// E2E_PORT lets parallel worktrees run the browser tests at the same time.
const PORT = Number(process.env.E2E_PORT ?? 4173)

// Seam 2: the built page. The tests run against the production build (vite build, then
// vite preview), in Chromium at a phone-sized viewport with touch.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // No service worker, so its notices (and its caching) never get into another spec. The one
    // that is about the service worker, e2e/offline.spec.ts, turns it back on.
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
