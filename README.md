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
  `src/components/ui/` is shadcn/ui and four components from 21st.dev (see below).
- `src/components/method/`: the accuracy and method page (how a Reading is made, the warnings and
  their numbers, the correction, limits, what leaves the phone, credits and license texts). It
  reads its numbers from the engine's constants and its license texts from `LICENSE` and
  `THIRD_PARTY_NOTICES.md`, so it cannot drift from them. The licenses of everything else the
  app ships are written at build time by `vite-plugins/bundledLicenses.ts` (every package in the
  build, with its own license text) to `licenses.json`, which the service worker caches too. It is a page of the same single HTML
  file (`#method`), so it works offline with the rest.
- `src/lib/`: the session reducer (taps and undo), loading a Photo, and which Reading to show.
- The Log: Samples and their Readings are saved on the device in IndexedDB (`src/lib/log.ts`,
  `logStore.ts`) and exported as CSV (`logCsv.ts`); the screens are `LogPanel`, `SaveToLogSheet` and
  `LogScreen`. Photos are never stored. Location is off unless the user switches it on in the Save
  form. The CSV starts with a UTF-8 byte-order mark so Excel reads it as UTF-8. In Excel, a Sample
  name or note that it could mistake for a formula, number, time, date or TRUE/FALSE (`=1+1`, `001`,
  `1 A`, `Mar 5`) is shown with a leading apostrophe: the export adds it on purpose, so that
  Excel keeps the text as typed. It is not corruption.
- `src/delineation/`: the wetland form. A Project holds a header (the lines at the top of page 1, entered
  once and printed on every point's form) and Sampling points, which hold their own lines (name, lat,
  long, datum, the wetland or upland pair), Layers (inches) and Hydrology. `formFor(project, point)` is
  the pure form engine: every printed field of page 1's header and Hydrology section and the Soil page's
  profile table, suggestions, conclusions and warnings. The region package (`regions/ncne/`) is data:
  the official ENG Form 6116-8 pages, as PDFs and images, and where each field sits on them, measured
  from the PDF. A point's PDF is its page 1, Soil page and Privacy Act page, each the official page
  with the values drawn on it (pdf-lib, on the device); the project PDF is those for every point in
  order, with each official page embedded once. The on-screen previews draw the same lists of placed
  values. Text is made printable and fitted to its line in `text.ts`, with a warning when it is cut.
  Page 1's Hydrology section (the 29 indicators with the supplement's definitions and pages,
  `regions/ncne/hydrology-rules.md`, the one-primary-or-two-secondary rule, depths and notes) is drawn
  on the same page the same way.
- `e2e/`: the browser tests.
- Measurement mode, at `/?measure`: a maker tool that measures a filament lot's swatches
  against a ColorChecker and exports the batch file the frame card reads. It is a separate
  chunk the reader never loads. How it measures, the file format and how accurate it is:
  [docs/measurement-mode.md](docs/measurement-mode.md).
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

A Page is the other Card (ADR 0001, `src/engine/page.ts`). The hue Pages 2.5YR, 5YR, 7.5YR, 10YR,
2.5Y and 5Y work; the grid (value rows, six evenly spaced chroma columns, gaps where nothing is
printed) is derived from the Chip list, so each Page has its own bottom row and /8 column. The user
taps four Chips that exist on that Page (10YR: 8/1, 8/8, 5/8, 2/1; the grid's bottom right is
usually empty) and the homography finds the rest. Each Chip is read in its solid middle, clear of
the round holes, and corrected against the color computed from its notation, with the /1 column as
the ladder. The correction is the ladder's curves and then a 3x3 pulled toward one gain per channel,
not the ColorChecker's full 3x3: a Page's Chips have one hue, so they cannot say how the camera
mixes the channels in the hue direction, and a free matrix there pulled every other color toward the
Page's hue (the same wood behind the holes of four Pages came out 11.8 apart, against 2.4 raw; now
4.3). The comparison is in [docs/correction-comparison.md](docs/correction-comparison.md). A Spot tapped inside a hole reads the soil behind the Page. The Gley, 10Y-5GY and WHITE
Pages (which mix hues), and 10R (not checked against the book), are not Cards yet; their Chips are
still matchable. If the soil's nearest Chip is on another Page, the Reading suggests retaking with
the hue Page that holds it (a Gley 1 or 10Y-5GY Chip goes to 5Y, a 10R Chip to 2.5YR; nothing is
suggested that cannot be a Card).

Worn Chips are left out of the fit (`src/engine/leftOut.ts`): a few smudged, hazed or blotchy Chips
must not drag the correction. A Chip off the ladder is left out when its held-out error stands out
from the rest. A ladder step cannot be judged that way (the curves pass exactly through the steps, a
dark step bends a curve a lot for a small miss, and two dirty steps side by side vouch for each
other), so a step is judged by its row-mates, the Chips off the ladder in its value row and the rows
above and below: it is dirty when leaving it out makes the curves agree with them. At most four Chips
are left out, two of them ladder steps, and the Card check names them. When two or more Chips off
the ladder in one value row had to go, the Card check fails whatever the mean of the rest says: that
row's ladder step is probably dirty, or its Chips lie beyond what the gray ladder can describe (on
Jon's real 7.5YR Page the dark Chips 3/3, 2.5/2 and 2.5/3 measure far darker and more saturated than
the gray steps reach, so that Page fails for this reason, not for dirt). The limits are provisional:
derived from the simulated camera and sanity-checked on four of Jon's real Pages, not yet fitted to
real Photos (issue 15). Held-out errors are made in one place, `heldOutErrors`.

A Spot read on a Page is cut to fit the hole it is in: the hole is a circle two fifths of a column
pitch in radius, which the Page's tilt turns into an ellipse, so its narrowest half-width in the
Photo is found from the local map of the grid and the Spot's circle is that, less a tap's error (a
tenth of a pitch). Away from the Page the usual circle stands.

The frame (ADR 0003) is a Card of its own: a printed card with a soil window, 18 measured
reference patches (six grays, twelve soil colors) and an ArUco marker in each corner. Choose
"Frame" on the Card step and the app finds the frame itself, so no corners are tapped:
`findCard(pixels)` in `src/engine/frame.ts` reads the four markers (IDs 0 to 3, top left to
bottom left, with [js-aruco2](https://github.com/damianofalcioni/js-aruco2)) and returns the
frame's outline, the markers' outer corners, or null when any marker is missing or one shows
twice. The user confirms the outline, and can press-drag a corner onto its marker with the
magnifier. The outline fixes a homography from the frame's layout in millimetres
(`src/engine/frameLayout.json`, agent-fab's prototype 1) to the Photo, which places every patch,
the window and the black base used for the evenness check. The grays are the tone ladder. The
first Spot goes in the middle of the window when the frame is ready (outline confirmed, batch measured), since that is where the soil is; Undo takes it back, and more Spots are tapped as usual. A Spot outside the window is read, with a note.

The patches' true colors come from the frame's batch: a CSV per print batch, found by the batch
code printed on the frame ([docs/frame-batches.md](docs/frame-batches.md)). No batch has been
measured yet, so a frame is refused as a Card, with a plain message, until one is. The practice
Photos of the frame carry a made-up batch of their own. The finder and js-aruco2 are a chunk that
loads only when the frame is chosen; `src/engine/frame.test.ts` checks the main bundle stays
without it.

How a Reading is made: the median of the tapped pixels, then a correction fitted to the 24 Card
patches (ColorChecker "after November 2014" reference values): one tone curve, shared by the three
channels, is drawn through the six gray patches and undone, which removes the camera's tone curve,
and a 3x3 matrix is fitted to all 24. (A Page draws a curve for each channel, through its /1 column.) A gray that looks dirty is named and left out. Then a conversion to Munsell with
[munsell.js](https://github.com/privet-kitty/munsell.js) (MPL-2.0), then the nearest Chip by
CIEDE2000. The Card check is the mean CIEDE2000 over the Card's patches, each corrected by a fit made
without it (leave one out): below 2 is good, up to 3.5 is caution (the corrected Reading is still the
answer, with the raw one beside it) and above that it has failed. Both limits are provisional until
a real Photo has been run. Why this correction and these limits, and how it compares with a plain
3x3, root-polynomial correction and a curve per channel:
[docs/correction-comparison.md](docs/correction-comparison.md). The engine knows 359 Chips with their color names, gley, neutral and
the WHITE Page included: the CC0 list by tomax31 (`src/engine/chipList.ts`, 315 Chips) plus
what a physical soil book showed it lacks or has stale (`src/engine/bookCorrections.ts`). That
list is only as complete as the checking, which is against one copy (Soil-Color Charts, 2009
Revision, 2015 Production). Checked, Chips and names: 2.5YR, 5YR, 7.5YR, 10YR, 10Y-5GY, Gley 1,
Gley 2 and WHITE. Chips checked, names pending: 2.5Y and 5Y. Not checked: 10R, whose Page the
binder's tabs do not show (they start at 2.5YR). Not known: whether the book has 5R or 7.5R Pages.
Each Chip's color is computed from its notation, matching happens in Lab, and only the
on-screen swatch is clamped to sRGB.

## Adding 21st.dev components

The step indicator, the Card picker and the Readings sheet are built on components from the
[21st.dev](https://21st.dev) registry, copied into `src/components/ui/` and restyled to the
interface's neutral grays. The registry wants an API key. `components.json` names it as
`${API_KEY_21ST}` and never holds its value, so building, testing and CI need no key: the
components are in the source.

To add another, put the key in your shell first. It is a Windows user environment variable, which
a new shell does not inherit; in bash:

```sh
export API_KEY_21ST="$(powershell.exe -NoProfile -Command "[Environment]::GetEnvironmentVariable('API_KEY_21ST','User')" | tr -d '\r')"
npx shadcn add @21st/<author>/<component> -p src/components/ui
```

Things to know:

- The registry's answers repeat the key in the addresses of a component's own dependencies
  (`?api_key=...`). Do not paste, save or commit raw output from the registry or the CLI, and do
  not run `shadcn view`; filter any output you share.
- A registry component can bring files you do not want (its own button, new color variables in
  `src/index.css`). Keep only what the app uses, and check `git diff` for a stray value in
  `package.json`, `components.json` or the stylesheet.
- Check the license of the component and of its upstream repository before you use it (the
  registry's "License" line is the author's word), keep the gray tokens, and give it a header
  comment (its address, its license, what you changed), a credit in `src/lib/credits.ts` and its
  license text in `THIRD_PARTY_NOTICES.md`. The generated package list does not see it: it is
  source, not a package.

## Tests

Two seams, and nothing else:

- **Engine** (`src/engine/*.test.ts`): a simulated camera (`src/engine/simulate.ts`) renders
  a Card and soil of a known Chip under a chosen light, exposure, color shift, tone curve and
  tilt, then calls `readPhoto`. The same simulated camera makes the example Photos in the app,
  and, with a swatch card in the scene, the measurement mode's (`measure.test.ts`).
- **Browser** (`e2e/*.spec.ts`): the production build at a phone viewport. It picks an example,
  taps corners and Spots by coordinates and reads the text on screen.
  `e2e/log.spec.ts` covers the Log: save, reload, edit, delete, and the downloaded CSV.
  `e2e/offline.spec.ts` covers install and offline: the manifest, Chromium's installability
  check, a Reading with the network off, and the notices for the first install and for each kind
  of new deploy (served through a small proxy that publishes new versions of the app). The
  browser tests run with service workers blocked (`playwright.config.ts`), so other specs never
  see these notices; the offline spec turns them back on.

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

A Page is the book's own colors, so it can only be as good as the book. Books fade and get dirty
over the years. A Chip worn by itself is left out and named, but a Page faded evenly shifts every
Chip the same way: the Card check cannot see that, and the Reading it corrects is off by the same
shift (ADR 0001). The ColorChecker stays supported as the independent reference. The method page
(issue 13) should say this in plain words. The correction is also strongest near the Page's own
hue, which is why the Reading suggests the Page the soil belongs on.

The examples use a simulated camera, so real Photos will do worse: phones add tone curves, HDR
and local processing that no curve per channel and 3x3 correction can undo. A Card in the shot, in the same light as
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
