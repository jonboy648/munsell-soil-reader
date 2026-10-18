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
npx playwright install webkit firefox   # once, to run the other engines too
npm run test:e2e -- --project=webkit    # one engine: chromium, webkit or firefox
```

CI runs typecheck and `npm test` once, and the browser tests on Chromium, Firefox and WebKit, on
every pull request. See Tests below.

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

The Card's patches are found from the four corner taps with a homography (a perspective
transform, `src/engine/grid.ts`), so a Card photographed at an angle still lands on every patch,
and the read circle shrinks on the far side. Any four known grid positions fix it, so other
Card kinds can reuse it.

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
- **Browser** (`e2e/*.spec.ts`): the production build at a phone viewport. It picks an example,
  taps corners and Spots by coordinates and reads the text on screen.

The browser tests run on three engines, one Playwright project each (`playwright.config.ts`):

| Project | Engine | Screen | CI runner |
| --- | --- | --- | --- |
| `chromium` | Chromium | Pixel 7 (emulated phone) | ubuntu-latest |
| `firefox` | Firefox | 412 x 839 with touch; Firefox cannot emulate a phone | ubuntu-latest |
| `webkit` | WebKit, the engine of Safari | iPhone 15 (emulated phone) | macos-latest |

`npm run test:e2e` runs Chromium only, so one `npx playwright install chromium` is enough and
`deploy.yml` is unchanged. Naming a project runs just that engine, and naming several runs
those: `npm run test:e2e -- --project=webkit --project=firefox`. CI (`ci.yml`) runs every spec in
`e2e/` on each engine as its own job, so a new spec joins all three by being added. All three
jobs run to the end and the workflow fails if any one fails. A test that passes only on its
retry counts as a failure in CI: it is fixed or ticketed, not retried away. Each job's summary
page lists passed, skipped, flaky and failed (`scripts/e2e-summary.mjs`).

A test that only one engine can run is skipped on the others, with the reason, so it shows as
skipped and is counted rather than passing without running. A test that drives touch through the
Chrome DevTools Protocol (CDP), or asks Chromium whether the app is installable, is Chromium only:

```ts
test("...", async ({ browserName }) => {
  test.skip(browserName !== "chromium", "needs the Chrome DevTools Protocol, which only Chromium has")
  ...
})
```

`fingers()` in `e2e/magnifier.spec.ts` does this for every test that sends raw touch events.

Taps: a click lands on a whole CSS pixel, and engines get there differently (Chromium rounds,
WebKit and Firefox cut off the fraction). A test that measures where a tap landed must round the
tap itself (see `tapPhoto` in `e2e/angled.spec.ts`) and allow for half a CSS pixel.

## Limits

The examples use a simulated camera, so real Photos will do worse: phones add tone curves, HDR
and local processing that no per-channel curve and 3x3 correction can undo. A Card in the shot, in the same light as
the soil, is needed for a corrected Reading.

The first version of this page lives on the `prototype/logic` branch.

## Licenses

The app is MIT. It builds on other code and data; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which includes the munsell.js license.
