# Which correction the engine uses, and what the Card check says

Tickets #4 and #28. The engine corrects a Photo against the Card with a fit made on the Card's
references, and the Card check says whether to believe it. This note compares the candidates,
says which ships and why, and records how the Card check's two limits were set. The cases are in
`src/engine/correction.test.ts`; `readPhoto` takes an optional `correction` so a test can swap the
fit. Everything here is from simulated Photos, except where it says Jon's real Pages. **Every limit
is provisional until a real ColorChecker Photo (#15) has been run.**

**Result.** A curve for each channel through the Card's gray patches (PCHIP, a monotone cubic),
inverted before a 3x3 matrix is fitted. A gray step that looks dirty is named, left out, and the
fit redone. The Card check is **good** below 2, **caution** from 2 to 3.5 (the corrected Reading
stays the answer, with the raw one beside it), and **failed** above 3.5 or when a Page row has to
lose two Chips. Root-polynomial correction is a wash against the plain 3x3 and is not shipped. A
curve shared by all three channels is better in simulation and worse on Jon's real Pages, so it
is not shipped either; both stay as test code (`src/engine/correctionCandidates.testkit.ts`).

## The candidates

- **3x3.** A matrix fitted by least squares on the Card's references. The prototype's method.
- **Root-polynomial 2.** Finlayson, MacKiewicz and Hurlbert (2015), degree 2, ported from
  colour-science (pinned to colour-science's own numbers by `golden/`). Degrees 3 and 4 overfit
  the Card (held-out Card check 8.5 and 94.6 against 3.3 for degree 2, in the first round).
- **A curve per channel, then 3x3.** For each channel, draw a curve through the Card's gray
  ladder (what the camera measured against what the gray really is, in sRGB-encoded values) and
  invert it before the matrix. The curve is PCHIP (exactly through every gray, ships), straight
  lines between the grays, or a least-squares cubic.
- **One tone curve for all channels, then 3x3.** A camera applies one tone curve, and its white
  balance only scales each channel before it, so in log space the three channels' curves are one
  shape, one vertical shift apart. Fit that shape (a cubic in log measured against log true) and
  the three offsets to all six grays' three channels at once, with a Huber weight so a gray far
  from it counts less. That is 3 times the data per parameter, so one dirty gray cannot bend the
  curve alone.
- **Either curve, then root-polynomial 2.** To see whether the extra terms help once the curve is
  gone.

## How it was measured

- **Clean simulated camera, 160 cases.** 8 soils (10YR 4/3, 7.5YR 5/6, 10YR 6/3, 2.5Y 7/2,
  5YR 3/4, 10R 4/6, 10YR 3/1, 2.5Y 8/2) by 5 lights (camera color shift, warm, dim, shade, dim
  with a color shift) by 4 tone curve strengths (0, 0.3, 0.5, 0.7).
- **A real sensor, spectrally.** The Nikon D5100's sensitivities (measured at NPL, from
  colour-science), the ColorChecker's *measured* reflectances (Ohta; not the X-Rite reference
  values the engine corrects towards, so the Card check has real reference error to cope with),
  soils whose smooth reflectances are recovered from their color (Mallett 2019), an ideal white
  balance, no noise, in CIE D65 daylight, FL2 cool white fluorescent and A tungsten. 11 soils by
  4 tone curves by 3 lights. `src/engine/golden/make_real_sensor_fixture.py` makes the fixture. It
  reproduces the review that raised #28: a clean Card scores 2.0 to 2.1 in daylight, 2.4 to 2.7
  in fluorescent and 2.8 to 3.1 in tungsten.
- **Damage.** A smudge on one gray step (a 10YR soil film at 10 to 25%, a yellowed white, a
  hazy black), on each of the six grays, in 6 soils (dark and light), 2 lights and 2 tone
  curves: 624 Photos. The same on the real sensor: 480. Other damage to the Card: a dirty
  patch, two, glare, a shadow over half the Card at three strengths, corners out of order in all
  7 ways, corners 36 px off or the Card drawn 25% small: 324. A light gradient of 10% and 20%
  across the Card, on the simulated camera (80) and the real sensor (60).
- **Jon's real Pages.** Four Pages and a second 10YR Photo, in `src/engine/fixtures/real-pages`
  and `realPages.test.ts`. The only real Photos so far.
- **Card check.** Leave-one-out over the references: each is left out, the correction is fitted
  on the rest, and the left-out reference is corrected and compared with its true color
  (CIEDE2000). The mean is the Card check. The tone curve is refitted inside each fold.
- **Reading error.** CIEDE2000 between the corrected soil and its true color. The soil is
  never part of the fit, so it is a held-out reference too.
- **Chips off.** Steps from the true Chip on the soil book's grid (0 = right, 1 = a
  Neighbouring chip).

## Results

### The clean simulated camera (160 cases)

| Correction | Card check, held out (mean) | Reading error ΔE (mean) | Within one Chip | Exact Chip |
|---|---|---|---|---|
| 3x3 | 2.69 | 3.00 | 125 of 160 | 84 |
| root-polynomial 2 | 2.59 | 3.26 | 124 of 160 | 83 |
| curve per channel, straight lines | 0.68 | 0.65 | 159 of 160 | 149 |
| curve per channel, cubic | 0.69 | 0.62 | 160 of 160 | 154 |
| **curve per channel, PCHIP (ships)** | 0.64 | 0.55 | 159 of 160 | 151 |
| PCHIP, then root-polynomial 2 | 0.76 | 0.63 | 158 of 160 | 150 |
| one tone curve for all channels | 0.73 | 0.63 | 160 of 160 | 157 |

By tone curve strength, each cell is mean Reading error ΔE / cases within one Chip (of 40):

| Tone curve | 3x3 | root-polynomial 2 | PCHIP (ships) | one tone curve |
|---|---|---|---|---|
| 0 | 0.50 / 40 | 0.46 / 40 | 0.57 / 40 | 0.48 / 40 |
| 0.3 | 2.40 / 33 | 2.62 / 33 | 0.59 / 40 | 0.55 / 40 |
| 0.5 | 3.88 / 28 | 4.23 / 27 | 0.59 / 39 | 0.67 / 40 |
| 0.7 | 5.20 / 24 | 5.74 / 24 | 0.45 / 40 | 0.81 / 40 |

### The real sensor (132 Photos), and Jon's real Pages

| Correction | Card check range | Good | Caution | Failed | Reading error ΔE | Readings > 1 Chip off |
|---|---|---|---|---|---|---|
| **curve per channel, PCHIP (ships)** | 2.00 to 3.06 | 0 | 132 | 0 | 3.12 | 25 |
| one tone curve for all channels | 1.58 to 2.90 | 44 | 88 | 0 | 2.32 | 7 |

In simulation the shared curve is clearly better on a real sensor: the sensor's channels disagree
a little, and a shared shape averages that out. **On Jon's real Pages it is mixed, and fails where
it matters.** The gray ladder (the /1 column) fits a shared cubic with a root-mean-square residual of
0.06 to 0.17 in log units, against 0.04 to 0.10 for a cubic per channel, so the real phone's
channels do not share one curve. And it does not find the smudges the Page's leave-out exists for.
With the Page fit as it is on main (the ladder's curves, then a ridged 3x3):

| Real Page | PCHIP per channel (ships) | one tone curve for all channels |
|---|---|---|
| 10YR on wood (smudged 8/1 and 7/1) | 2.79, caution, leaves out 8/1, 7/1, 3/6 | 4.66, failed, leaves out nothing |
| 10YR on fabric | 3.98, failed, leaves out 8/1, 7/1 | 5.05, failed, leaves out nothing |
| 7.5YR on wood | 2.98, failed (row guard) | 2.41, failed (row guard) |
| 2.5Y on wood | 2.84, caution | 2.29, caution |
| 5Y on wood | 1.83, good | 2.01, caution |

The shared curve scores two Pages lower and cannot see a smudged ladder step, which is the case
that decides whether a worn Page gives a corrected Reading at all. The real Pages are the only real
Photos, so they decide: the shared curve waits for a real ColorChecker Photo.

### Damaged gray steps

Photos with one dirty gray (simulated camera, 624), through the shipped engine and through the
same engine with the shared curve:

| | Good | Caution | Failed | Left a gray out | Readings > 1 Chip off, shown as the answer |
|---|---|---|---|---|---|
| **curve per channel, PCHIP (ships)** | 318 | 306 | 0 | 174 | 46 (14 good, 32 caution) |
| one tone curve for all channels | 510 | 114 | 0 | 48 | 15 (2 good, 13 caution) |

On a bigger sweep (1716 Photos, 11 soils, no leave-out) the number of Photos whose Reading is
more than a Chip off and whose Card check is under 3.5 falls with the curve: PCHIP 128,
least-squares cubic 108, Huber cubic 99, shared curve 77, shared with Huber 71. Dark soils (10YR
2.5/2, 3/2, 5YR 3/4) with a hazy black or N3.5, or a filmed white, are where they read wrong:
those three grays are 193 of the 221 PCHIP failures.

With PCHIP the leave-out leaves a gray out in 174 of the 624; in 156 it is exactly the damaged one,
and in 18 it is another step. 16 of the 174 still read wrong (11 with the black left out, the dark
end then guessed from N3.5, and 5 with a filmed white). Of the 450 it left alone, 30 read wrong,
25 of them a hazy N3.5. On the real sensor with a dirty gray (480) it leaves one out in 95, always
the damaged one, and 182 Readings are more than a Chip off, 112 of them shown as the answer. A clean
Card leaves a gray out in none of the 220 simulated Photos and none of the 132 real-sensor Photos.
This is the weak spot: a dirty gray step can still pass. The caution band shows the raw Reading
beside the corrected one in 306 of those 624 Photos.

### Light gradient and other damage

| Photos | Good | Caution | Failed | Card check range |
|---|---|---|---|---|
| Clean Card, simulated camera (220) | 220 | 0 | 0 | 0.52 to 0.83 |
| 10% and 20% gradient across the Card (80) | 76 | 4 | 0 | 0.86 to 2.10 |
| Clean Card, real sensor (132) | 0 | 132 | 0 | 2.00 to 3.06 |
| 10% and 20% gradient, real sensor (60) | 10 | 50 | 0 | 1.97 to 3.48 |
| Damaged ladder, simulated (624) | 318 | 306 | 0 | 0.60 to 3.47 |
| Damaged ladder, real sensor (480) | 10 | 320 | 150 | 1.79 to 5.86 |
| Other damage to the Card (324) | 36 | 21 | 267 | 0.58 to 48.7 |

"Other damage" splits into what spoils the Reading and what does not. 214 of the 324 Photos read
more than a Chip off; **none of those is good or caution**, all are failed. The 110 that read right
include the small corner errors (24 px off) and the Card drawn 10% large, which pass.

## What it says

- **Undoing the tone curve is the big win.** The 3x3's Reading error grows with the tone curve
  (0.5, 2.4, 3.9, 5.2 ΔE); with the curve inverted it stays under 0.6. On a camera with no tone
  curve it costs 0.07 (0.57 against 0.50).
- **Root-polynomial 2 against the 3x3 is a wash on the Card check.** It has the lower mean
  (2.59 against 2.69) and wins the dim lights (dim: lower in 24 of 32 cases; dim with a color
  shift: 24 of 32), but loses color shift and warm light in all 32 each, and a Wilcoxon test over
  the 160 cases finds no difference (p = 0.97). On the Reading it is worse, not a wash: 3.26
  against 3.00 ΔE, lower in only 36 of 160 cases (p = 7e-10).
- **Root-polynomial adds nothing once the curve is gone.** PCHIP then root-polynomial 2 is worse
  than PCHIP then 3x3 on both measures (0.76 and 0.63 against 0.64 and 0.55).
- **Overfitting shows only held out.** In the first round (15 cases, one soil), root-polynomial 3
  scored 1.85 on the patches it was fitted on (3x3: 3.08) and 8.5 held out; degree 4 scored 0.38
  on its own Card and 94.6 held out. That is why the Card check is leave-one-out.
- **Chroma-1 soils are the exception to "within a Chip".** Neighbouring hue pages are about 1 ΔE
  apart at chroma 1 and 2, so a Reading 2 to 3 ΔE off can sit two pages away without anything
  being wrong with the Card.

## The Card check

Three states. `CARD_CHECK_GOOD` (2) and `CARD_CHECK_CAUTION` (3.5), both in
`src/engine/cardCheck.ts`:

- **Good**, mean held-out error below 2, no ladder step left out. The corrected Reading is the
  answer.
- **Caution**, 2 up to 3.5, or any ladder step left out. The corrected Reading is still the
  answer, the raw one is shown beside it, and the words name uneven light or the dirty step, never
  the corner order. If the Photo warnings flag a problem on the Card, they are the cause given.
- **Failed**, 3.5 or more, or a Page row that had to lose two Chips off the ladder. The raw Reading
  is shown. The words blame the corner order only when nothing else is flagged on the Card.

Why these two limits, and why the first round's "every Reading more than a Chip off scored 3.7 or
more" and "every Card that passed at 2 read within 2.4" go. Neither held: that sweep had no damage
to the ladder ends (a hazy black, a yellowed white), no dark soils below 3/1 and no real sensor.
With those added, dark soils read two to five Chips off at a check of 1.6, and clean Cards from a
real sensor scored 2.0 to 3.1 and were failed at 2. What the data supports now:

- Clean Photos score 0.5 to 0.8 on the simulated camera, up to 2.1 with a 20% gradient, 2.0 to 3.1
  on the real sensor, and up to 3.48 on the real sensor under a 20% gradient. None may fail.
- Damaged Cards whose Reading is more than a Chip off score 3.56 at the lowest (a dirty patch),
  then 3.76 (a light shadow), and nearly all over 4.
- 3.5 sits in the gap, which is narrow (3.48 to 3.56). Nothing clean fails and none of the
  damaged-and-wrong Cards is good or caution. That is a property of one simulated camera, and the
  first real ColorChecker Photo may move it.
- 2 is the good limit: below it no simulated real-sensor Reading was more than a Chip off, and
  Jon's real Pages score 1.6 to 2.3 after leave-out. A clean Card from a real camera is mostly
  caution, by design, and not failed.

## Leaving a dirty gray out

The grays are the tone ladder, and one dirty gray bends the curve of every channel, but a gray is
one reference of 24 and the mean hides it. The Page Card's leave-out (#8, `src/engine/leftOut.ts`)
judges a ladder step by the references beside it, in its value row and the rows above and below:
a step is dirty when leaving it out makes the curve agree with those row-mates, and it must also
be a miss to the curve drawn without it. One rule, `dirtyLadderSteps`, serves both Cards. The
ColorChecker's grays are the ladder, and each other patch sits in the value row of the gray
nearest it in lightness (`PATCH_VALUE_ROWS`); a Page's /1 column is the ladder and its rows are
the printed values.

The ColorChecker uses the ladder rule and nothing else: its patches do not wear, and leaving
colored patches out as well dropped one from 110 of the 132 real-sensor Photos in a trial, and
made two Readings worse. A Page
leaves out Chips off the ladder too (up to four), and a row that has to lose two of them is a
suspect row, which fails the check. A Photo with a ladder step left out names it, and is capped at
caution; a worn Chip off the ladder is named and not capped.

The ladder's own held-out errors do not find a dirty gray. A gray at either end is predicted by
extrapolation and misses whether it is dirty or not (a clean Card reaches 4 to 6 at its ends),
and the worst of the six was the damaged one in only 638 of 1716 Photos. Judging the ladder by
the references beside it does.

## The Page's correction

Ticket #59. The first real Photos (#15, `src/engine/realPages.test.ts`) showed that the full 3x3
after the curves distorts colors that are not on a Page. A hue Page's Chips lie along one line of
color space (value and chroma vary, hue does not), so they cannot say how the camera mixes the
channels in the hue direction, and the matrix is free there: it extrapolates toward the Page's own
hue. The same wood behind the holes of four Pages (10YR, 7.5YR, 2.5Y, 5Y; same light, same phone)
is within 2.4 CIEDE2000 across them raw and 11.8 apart corrected; the raw 10YR wood read as 2.5Y on
the 2.5Y Page and 5Y on the 5Y Page, so the hue suggestion never fired there. The ColorChecker's
patches span color space, so it keeps its full correction.

**Result: the Page uses the ladder's curves, then a 3x3 pulled toward one gain per channel (ridge
on the off-diagonal terms, strength 1).** `fitPageCorrection` in `src/engine/correction.ts`.

How the candidates were measured (all with the curves first; Chips left out as the engine does):
- **Wood.** The mean corrected color of the wood through every hole (25 to 30) of each of the four
  wood Pages, and the largest and mean pairwise CIEDE2000 between the four.
- **Card check.** The Page's held-out mean on each real Photo (the 10YR fabric Photo is warm
  indoor light, and the Page's worst).
- **Simulated soils.** Pages of 10YR, 7.5YR and 5Y (8, 6 and 6 soils: on the Page's hue, one hue step
  off, two or more steps off) in warm, dim and camera-shift light at tone 0.5: 60 Photos. The mean
  CIEDE2000 between the corrected soil and its true color. The shift camera mixes the channels
  strongly (a simulation choice), which is where a matrix helps.

| Correction | Wood, largest / mean | Card check: 10YR, 7.5YR, 2.5Y, 5Y (fabric) | Sim. on hue | 1 step off | 2+ steps off | Sim. Card check |
|---|---|---|---|---|---|---|
| curves + full 3x3 (was) | 11.8 / 8.3 | 2.12, 2.30, 2.21, 1.80 (5.22) | 0.40 | 1.28 | 2.58 | 0.51 |
| curves only | 4.2 / 3.2 | 3.43, 2.81, 2.50, 1.62 (4.53) | 1.19 | 1.24 | 1.29 | 1.22 |
| curves + gain per channel | 4.0 / 3.1 | 2.73, 2.98, 2.85, 1.82 (4.02) | 0.79 | 0.91 | 1.22 | 1.02 |
| ridge 0.001 | 8.3 / 5.5 | 2.21, 2.26, 2.18, 1.85 (2.83) | 0.46 | 0.86 | 2.10 | 0.53 |
| ridge 0.01 | 5.8 / 4.2 | 2.58, 2.72, 2.48, 1.87 (5.69) | 0.48 | 0.88 | 1.83 | 0.59 |
| ridge 0.1 | 4.9 / 3.5 | 2.64, 2.98, 2.80, 1.85 (6.52) | 0.46 | 0.84 | 1.65 | 0.68 |
| ridge 0.3 | 4.7 / 3.2 | 2.76, 2.99, 2.83, 1.84 (6.65) | 0.56 | 0.77 | 1.48 | 0.82 |
| ridge 0.5 | 4.5 / 3.2 | 2.77, 2.99, 2.84, 1.83 (6.71) | 0.62 | 0.80 | 1.37 | 0.89 |
| **ridge 1 (ships)** | **4.3 / 3.1** | **2.79, 2.98, 2.84, 1.83 (3.98)** | **0.69** | **0.81** | **1.28** | **0.96** |
| ridge 3 | 4.1 / 3.1 | 2.71, 2.98, 2.85, 1.82 (4.00) | 0.77 | 0.88 | 1.24 | 0.99 |

(The ridge is on the off-diagonal terms, scaled by the references' mean squared channel value, so
1 puts each term's penalty as high as the data's own scale; as it grows the fit tends to the gain
per channel. The fabric column moves with which Chips are left out, which changes between rows.)

What it says:
- **Choosing the strength by held-out error alone picks the wrong one.** The Card check is made on
  the Page's own Chips, which all have one hue, so it is lowest for the weakest ridge (2.21 at 0.001)
  and cannot see the pull. That strength is the one that spreads the wood 8.3 apart. The strength is
  the weakest that brings the wood to the noise floor: within one Photo the holes differ from their
  own mean by a median of 2.6 to 6.9 (wood grain), so 3 to 4 between Pages is the floor, and the
  ticket's line is 4.5. 1 gives 4.3; 0.5 gives 4.5 with no margin.
- **Curves only and a gain per channel reach the floor** (4.2 and 4.0) and are simpler. They lose the
  simulated shift camera, where the matrix is needed (on hue, shift light: 2.90 and 1.55 against 1.25
  for the ridge and 0.59 for the full 3x3), and the curves only are worse on the Page's own Card
  check (3.43 on 10YR).
- **Off-hue soils are the point.** The full 3x3 reads a soil two or more hue steps off the Page 2.58
  from its true color; the ridge, 1.28. On the Page's own hue it is 0.69 against 0.40, the price.
- **The Page's own Card check goes up** (10YR 2.12 to 2.79, 7.5YR 2.30 to 2.98, 2.5Y 2.21 to 2.84,
  5Y 1.80 to 1.83) because the matrix has less freedom to fit the Page's own Chips. A better Card
  check was never a better Reading here: the 3x3's came from the pull.
- **Hue suggestion.** The wood on the 2.5Y Page reads as 10YR again (13 of 25 holes 10YR 5/6, 9 of
  4/6) and `betterPage` names 10YR for 23 of 25; on the 7.5YR Page for 29 of 29; on the 5Y Page
  for 20 of 25 (12 say 10YR, 8 say 2.5Y, a neighbour).
- Judging the strength on real Photos with a book Reading of the wood, if Jon gives one, would
  replace "the wood agrees with itself across the Pages" with the right answer.

## Limits

- **Provisional.** `CARD_CHECK_GOOD`, `CARD_CHECK_CAUTION` and the leave-out's limits come from
  simulated Photos and four real Pages. A real phone adds local tone mapping, HDR, sharpening, JPEG
  and lens shading, none of which a global curve can invert. Expect real numbers to be worse.
  **Issue #15 is the real test**, and the 20-soil test after it.
- **The ColorChecker has no real Photo yet.** The choice of curve rests on the real Pages (a curve
  per channel) against the real-sensor simulation (a shared curve). When a real ColorChecker Photo
  arrives, run both, `readPhoto(..., { correction })` with the candidates in the test kit, and
  decide the ColorChecker again; the Page can keep its own.
- **The real-sensor simulation is one camera, one white balance, no noise.** Other sensors and an
  imperfect white balance will score higher.
- **A dirty gray step can still pass.** 14 of 624 simulated Photos with one dirty gray read more
  than a Chip off with the check good, mostly a hazy N3.5 on a dark soil.
- **Root-polynomial was not shown at its best either.** The simulated camera has no spectral
  non-linearity for its cross-terms to fix; the real-sensor simulation does, and still the
  cross-terms add nothing after the curve.
- **Not tried:** a curve fitted jointly with the matrix, a curve that is a shared shape plus a
  curve per channel through the residuals, a different space for the curve, and regularising the
  matrix.
