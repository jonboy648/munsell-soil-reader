# Munsell Soil Reader

Photograph soil next to an X-Rite ColorChecker Classic (24 patches), tap the Card's four
corners and then the soil, and read its Munsell soil color, corrected for the light and the
camera. Runs entirely in the browser; Photos are never uploaded.

The plan, in order of tickets, is in [issue #1](https://github.com/jonboy648/munsell-soil-reader/issues/1).
The words used in the code and the interface are defined in [CONTEXT.md](CONTEXT.md).

## Commands

Needs Node 24 and npm.

```sh
npm install              # dependencies
npm run dev              # dev server with hot reload
npm run build            # typecheck, then the production build into dist/
npm run preview          # serve dist/ locally
npm run typecheck        # tsc -b over the app, the config files and the browser tests
npm test                 # engine tests (Vitest)
npx playwright install chromium   # once, for the browser tests
npm run test:e2e         # browser tests (Playwright): builds, serves, drives Chromium on a phone viewport
```

CI runs typecheck, `npm test` and `npm run test:e2e` on every pull request.

## Deploys

Every push to `main` deploys to <https://soil.joncackler.com/> through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): typecheck, `npm test`,
`npm run test:e2e`, `npm run build`, then GitHub Pages publishes `dist/`. If a test fails,
nothing is deployed and the live site stays on the last good build. To redeploy without a
commit, run the Deploy workflow from the Actions tab.

The repository's Pages source is "GitHub Actions". The custom domain and enforced HTTPS are
Pages settings, not part of the build; `public/CNAME` is copied into `dist/` and holds the
same domain. The old `gh-pages` branch is no longer deployed from and is kept only as a backup.

## How it is built

- Vite, React, TypeScript (strict), Tailwind CSS and shadcn/ui. The interface is neutral gray
  in light and dark, so it does not tint how you judge a color; color on screen comes only from
  the Photo and from the Reading and Chip color blocks.
- `src/engine/`: the reading engine. Pure TypeScript with no DOM and no React; the one main
  call is `readPhoto({ pixels, card, spots })`.
- `src/components/`: one component per feature area (`PhotoView`, `CardPanel`, `SpotsPanel`,
  `ReadingsPanel`), plus the step indicator, example picker, bottom bar and theme toggle.
  `src/components/ui/` is shadcn/ui.
- `src/lib/`: the session reducer (taps and undo), loading a Photo, and which Reading to show.
- `e2e/`: the browser tests.
- Install and offline: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (MIT, Workbox)
  writes the web app manifest and a service worker that precaches every built file (code,
  styles, the bundled fonts, icons and any data files by type), so the app opens with no
  network after the first visit. The app registers the worker itself
  (`src/lib/serviceWorker.ts`) and says "Ready to work offline" once the first install is done.
  A new deploy downloads in the background and an "Update ready" notice follows; the app looks
  for one whenever it returns to the front or the network returns, and registers again if a
  first install failed. The notices ("Ready to work offline", "Update ready") sit in the header
  and replace the title while they show, so they are as big as the title and nothing below them,
  the Photo included, moves or is covered; a layout test holds that. Reload clears the Photo and
  the taps, so with a Photo loaded the notice says "Reload clears this Photo", and "Later" hides
  it until the app next returns to the front. Reload switches only the window where it was
  tapped. The site is served at the root of
  soil.joncackler.com, so the base is `/`. The icons in `public/` are drawn by
  `node scripts/make-icons.mjs` and committed.

The Card's patches are found from the four corner taps with a homography (a perspective
transform, `src/engine/grid.ts`), so a Card photographed at an angle still lands on every patch,
and the read circle shrinks on the far side. Any four known grid positions fix it, so other
Card kinds can reuse it.

The frame finder (`src/engine/frame.ts`, `findCard(pixels)`) finds a printed frame by its four
ArUco markers, IDs 0 to 3 at the frame's top left, top right, bottom right and bottom left, and
returns the Card's corner patches, or null when any marker is missing. It uses
[js-aruco2](https://github.com/damianofalcioni/js-aruco2) and is built and tested on simulated
Photos only. It is hidden: nothing in the app imports it, and `src/engine/frame.test.ts` checks
that its code is not in the app bundle. No frame exists yet; switching it on later means wiring
it in (a dynamic import, so js-aruco2 stays out of the main chunk).

How a Reading is made: the median of the tapped pixels, then a correction fitted to the 24 Card
patches (ColorChecker "after November 2014" reference values): each channel is linearized along
the six gray patches, undoing the camera's tone curve, and a 3x3 matrix is fitted to all 24. Then
a conversion to Munsell with [munsell.js](https://github.com/privet-kitty/munsell.js) (MPL-2.0),
then the nearest Chip by CIEDE2000. The Card check is the mean CIEDE2000 over the Card's
patches, each corrected by a fit made without it (leave one out); below 2 is good. Why this
correction and this threshold, and how it compares with a plain 3x3 and root-polynomial
correction: [docs/correction-comparison.md](docs/correction-comparison.md). The engine knows 359 Chips with their color names, gley, neutral and
the WHITE Page included: the CC0 list by tomax31 (`src/engine/chipList.ts`, 315 Chips) plus
what a physical soil book showed it lacks or has stale (`src/engine/bookCorrections.ts`). That
list is only as complete as the checking, which is against one copy (Soil-Color Charts, 2009
Revision, 2015 Production). Checked, Chips and names: 2.5YR, 5YR, 7.5YR, 10YR, 10Y-5GY, Gley 1,
Gley 2 and WHITE. Chips checked, names pending: 2.5Y and 5Y. Not checked: 10R, whose Page the
binder's tabs do not show (they start at 2.5YR). Not known: whether the book has 5R or 7.5R Pages.
Each Chip's color is computed from its notation, matching happens in Lab, and only the
on-screen swatch is clamped to sRGB.

## Tests

Two seams, and nothing else:

- **Engine** (`src/engine/*.test.ts`): a simulated camera (`src/engine/simulate.ts`) renders
  a Card and soil of a known Chip under a chosen light, exposure, color shift, tone curve and
  tilt, then calls `readPhoto`. The same simulated camera makes the example Photos in the app.
- **Browser** (`e2e/*.spec.ts`): the production build in Chromium at a phone viewport. It
  picks an example, taps corners and Spots by coordinates and reads the text on screen.
  `e2e/offline.spec.ts` covers install and offline: the manifest, Chromium's installability
  check, a Reading with the network off, and the notices for the first install and for each kind
  of new deploy (served through a small proxy that publishes new versions of the app). The
  browser tests run with service workers blocked (`playwright.config.ts`), so other specs never
  see these notices; the offline spec turns them back on.

## Limits

The examples use a simulated camera, so real Photos will do worse: phones add tone curves, HDR
and local processing that no per-channel curve and 3x3 correction can undo. A Card in the shot, in the same light as
the soil, is needed for a corrected Reading.

Offline on iPhone and iPad: an app added to the Home Screen has its own storage, separate from
Safari's, so it does not get the offline copy Safari already downloaded. After Add to Home
Screen, open the icon once with signal; after that it works with no signal. In a Safari tab (not
the Home Screen app), Safari can delete the offline copy after seven days of Safari use without
opening this site; opening it with signal brings it back. The Home Screen app is not affected.
The app shows a hint about the first limit on iOS, outside the installed app.

The first version of this page lives on the `prototype/logic` branch.

## Licenses

The app is MIT. It builds on other code and data; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which includes the munsell.js license.
