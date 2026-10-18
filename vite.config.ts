import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    // munsell.js ships the Munsell renotation tables (about 370 kB) so the app works offline.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    // The engine seam only; the browser seam lives in e2e/ and runs under Playwright.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
