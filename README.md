# Munsell Soil Reader

Photograph soil next to an X-Rite ColorChecker Classic (24 patches) or a Page of your own soil
book, tap the Card's four corners (a Page: four named Chips) and then the soil, and read its
Munsell soil color, corrected for the light and the camera. Runs entirely in the browser; Photos
are never uploaded.

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

The Card's patches are found from the four corner taps with a homography (a perspective
transform, `src/engine/grid.ts`), so a Card photographed at an angle still lands on every patch,
and the read circle shrinks on the far side. Any four known grid positions fix it, so other
Card kinds can reuse it.

A Page is the other Card (ADR 0001, `src/engine/page.ts`). The hue Pages 2.5YR, 5YR, 7.5YR, 10YR,
2.5Y and 5Y work; the grid (value rows, six evenly spaced chroma columns, gaps where nothing is
printed) is derived from the Chip list, so each Page has its own bottom row and /8 column. The user
taps four Chips that exist on that Page (10YR: 8/1, 8/8, 5/8, 2/1; the grid's bottom right is
usually empty) and the homography finds the rest. Each Chip is read in its solid middle, clear of
the round holes, and corrected against the color computed from its notation, with the /1 column as
the ladder. A Spot tapped inside a hole reads the soil behind the Page. The Gley, 10Y-5GY and WHITE
Pages (which mix hues), and 10R (not checked against the book), are not Cards yet; their Chips are
still matchable. If the soil's nearest Chip is on another Page, the Reading suggests retaking with
that Page.

Worn Chips are left out of the fit (`src/engine/leftOut.ts`): a few smudged or blotchy Chips must
not drag the correction. A Chip off the ladder is left out when its held-out error stands out from
the rest. The ladder cannot be judged that way (its curves pass exactly through its own steps, and
two dirty steps side by side vouch for each other), so dirty steps are the ones whose removal makes
the curves agree with the Chips off the ladder. At most four Chips are left out, and the Card check
names them. The limits are provisional: derived from the simulated camera and sanity-checked on
four of Jon's real Pages, not yet fitted to real Photos (issue 15).

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

## Limits

A Page is the book's own colors, so it can only be as good as the book. Books fade and get dirty
over the years. A Chip worn by itself is left out and named, but a Page faded evenly shifts every
Chip the same way: the Card check cannot see that, and the Reading it corrects is off by the same
shift (ADR 0001). The ColorChecker stays supported as the independent reference. The method page
(issue 13) should say this in plain words. The correction is also strongest near the Page's own
hue, which is why the Reading suggests the Page the soil belongs on.

The examples use a simulated camera, so real Photos will do worse: phones add tone curves, HDR
and local processing that no per-channel curve and 3x3 correction can undo. A Card in the shot, in the same light as
the soil, is needed for a corrected Reading.

The first version of this page lives on the `prototype/logic` branch.

## Licenses

The app is MIT. It builds on other code and data; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which includes the munsell.js license.
