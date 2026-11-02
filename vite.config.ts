import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vitest/config"
import { bundledLicenses } from "./vite-plugins/bundledLicenses.ts"

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
  // The site is served at the root of soil.joncackler.com, so assets, the manifest scope and the
  // service worker scope are all "/".
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    // The code the app ships, and its licenses, for the method page. The stylesheet comes from
    // these packages, the fonts are files the module graph does not list, and the service worker is
    // built in a second pass from the Workbox ones.
    bundledLicenses([
      "@fontsource-variable/archivo",
      "@fontsource-variable/public-sans",
      "@fontsource/ibm-plex-mono",
      "tailwindcss",
      "tw-animate-css",
      "shadcn",
      "workbox-core",
      "workbox-precaching",
      "workbox-routing",
    ]),
    VitePWA({
      // A new service worker waits until the user taps Reload (see src/components/UpdateNotice.tsx), so a Reading in
      // progress is never swapped out from under them.
      registerType: "prompt",
      // The app registers the worker itself (src/lib/serviceWorker.ts).
      injectRegister: false,
      manifest: {
        id: "/",
        name: "Munsell Soil Reader",
        short_name: "Munsell Soil Reader",
        description: "Read the Munsell soil color of a Sample in a Photo, corrected against a Card.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // The light theme's background gray (--background). Gray only, like the interface.
        theme_color: "#ebebeb",
        background_color: "#ebebeb",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Everything the app needs, matched by type so data files and example Photos added
        // later are cached without touching this list. Fonts are the bundled woff2 files.
        globPatterns: ["**/*.{html,js,css,woff2,png,svg,jpg,jpeg,webp,json,csv,webmanifest,pdf}"],
      },
    }),
  ],
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
