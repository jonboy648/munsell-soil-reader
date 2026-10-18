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
  the Photo and from the Soil and Chip color blocks.
- `src/engine/`: the reading engine. Pure TypeScript with no DOM and no React; the one main
  call is `readPhoto({ pixels, card, spots })`.
- `src/components/`: one component per feature area (`PhotoView`, `CardPanel`, `SpotsPanel`,
  `ReadingsPanel`), plus the step indicator, example picker, bottom bar and theme toggle.
  `src/components/ui/` is shadcn/ui.
- `src/lib/`: the session reducer (taps and undo), loading a Photo, and which Reading to show.
- `e2e/`: the browser tests.

How a Reading is made: the median of the tapped pixels, a white balance and then a 3x3
correction fitted to the 24 Card patches (ColorChecker "after November 2014" reference values),
a conversion to Munsell with [munsell.js](https://github.com/privet-kitty/munsell.js) (MPL-2.0),
then the nearest Chip by CIEDE2000. The Card check is the mean CIEDE2000 of the corrected
patches; below 3 is good. The Chip grid (10R to 5Y, values 2.5 to 8, chromas 1 to 8) still
approximates the soil book; it is not the official Chip list and has no color names yet.

## Tests

Two seams, and nothing else:

- **Engine** (`src/engine/engine.test.ts`): a simulated camera (`src/engine/simulate.ts`) renders
  a Card and soil of a known Chip under a chosen light, exposure, color shift and tone curve,
  then calls `readPhoto`. The same simulated camera makes the example Photos in the app.
- **Browser** (`e2e/reader.spec.ts`): the production build in Chromium at a phone viewport. It
  picks an example, taps corners and Spots by coordinates and reads the text on screen.

## Limits

The examples use a simulated camera, so real Photos will do worse: phones add tone curves, HDR
and local processing that no 3x3 correction can undo. A Card in the shot, in the same light as
the soil, is needed for a corrected Reading.

The first version of this page lives on the `prototype/logic` branch.

## Licenses

The app is MIT. It builds on other code and data; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which includes the munsell.js license.
