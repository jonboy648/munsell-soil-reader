import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"

// js-aruco2 (the frame finder's marker reader) is a plain script with no import or export that
// sets `AR` on `this`. The build takes such a file for an ES module, where `this` is undefined,
// and the finder fails the moment it loads. Run both its files with `this` as CommonJS `exports`,
// which is what Node does with them.
const jsAruco2AsCommonJs: Plugin = {
  name: "js-aruco2-as-commonjs",
  transform(code, id) {
    if (/[\\/]js-aruco2[\\/]src[\\/](aruco|cv)\.js$/.test(id)) {
      return { code: `(function () {\n${code}\n}).call(exports)`, map: null }
    }
  },
}

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
    rolldownOptions: { plugins: [jsAruco2AsCommonJs] },
  },
  test: {
    // The engine seam only; the browser seam lives in e2e/ and runs under Playwright.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
