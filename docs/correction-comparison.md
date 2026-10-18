# Which correction the engine uses, and what the Card check says

Tickets #4 and #28. The engine corrects a Photo against the Card with a fit made on the Card's
references, and the Card check says whether to believe it. This note compares the candidates,
says which ships and why, and records how the Card check's two limits were set. The cases are in
`src/engine/correction.test.ts`; `readPhoto` takes an optional `correction` so a test can swap the
fit. Everything here is from simulated Photos, so every limit is **provisional until Jon's real
Photo (#15) has been run**. That is said in the code and again at the end.

**Result.** Undo the camera's tone curve along the Card's gray patches, with one curve shared by
the three channels, then fit a 3x3. A gray that looks dirty is named, left out, and the fit
redone. The Card check is **good** below 2, **caution** from 2 to 3.5 (the corrected Reading
stays the answer, with the raw one beside it), and **failed** above 3.5. Root-polynomial
correction is a wash against the plain 3x3 and is not shipped; it stays as test code for this
comparison (`src/engine/correctionCandidates.testkit.ts`).

## The candidates

- **3x3.** A matrix fitted by least squares on the Card's references. The prototype's method.
- **Root-polynomial 2.** Finlayson, MacKiewicz and Hurlbert (2015), degree 2, ported from
  colour-science. Degrees 3 and 4 overfit the Card (held-out Card check 8.5 and 94.6 against
  3.3 for degree 2, in the first round), so degree 2 is the one compared.
- **A curve per channel, then 3x3.** For each channel, draw a curve through the Card's gray
  ladder (what the camera measured against what the gray really is, in sRGB-encoded values) and
  invert it before the matrix. The curve is PCHIP (a monotone cubic, exactly through every gray),
  or a least-squares cubic, or that cubic with a Huber weight so a gray far from it counts less.
  This is what shipped in the first round of #4 (PCHIP).
- **One tone curve for all channels, then 3x3 (ships).** A camera applies one tone curve, and
  its white balance only scales each channel before it, so in log space the three channels'
  curves are one shape, one vertical shift apart. Fit that shape (a cubic in log measured
  against log true) and the three offsets to all six grays' three channels at once, with a Huber
  weight, and invert it before the matrix. That is 3 times the data per parameter, so a gray
  that no tone curve explains (a tint, a smudge, a hazy black) cannot bend the curve alone.
- **One tone curve, then root-polynomial 2.** To see whether the extra terms help once the
  curve is gone.

## How it was measured

- **Clean simulated camera, 160 cases.** 8 soils (10YR 4/3, 7.5YR 5/6, 10YR 6/3, 2.5Y 7/2,
  5YR 3/4, 10R 4/6, 10YR 3/1, 2.5Y 8/2) by 5 lights (camera color shift, warm, dim, shade, dim
  with a color shift) by 4 tone curve strengths (0, 0.3, 0.5, 0.7).
- **A real sensor, spectrally.** The Nikon D5100's sensitivities (measured at NPL, from
  colour-science), the ColorChecker's *measured* reflectances (Ohta; not the X-Rite reference
  values the engine corrects towards, so the Card check has real reference error to cope with),
  soils whose smooth reflectances are recovered from their color (Mallett 2019), an ideal white
  balance, no noise, in CIE D65 daylight, FL2 cool white fluorescent and A tungsten. 11 soils by
  4 tone curves by 3 lights. `src/engine/golden/make_real_sensor_fixture.py` makes the fixture.
  It reproduces the review that raised #28: the first round's correction (a curve per channel)
  scores a clean Card 2.0 to 2.1 in daylight, 2.4 to 2.7 in fluorescent and 2.8 to 3.1 in tungsten.
- **Damage.** A smudge on one gray step (a 10YR soil film at 10 to 25%, a yellowed white, a
  hazy black), on each of the six grays, in 6 soils (dark and light), 2 lights and 2 tone
  curves: 624 Photos. The same on the real sensor: 480. Other damage to the Card: a dirty
  patch, two, glare, a shadow over half the Card at three strengths, corners out of order in all
  7 ways, corners 36 px off or the Card drawn 25% small: 324. A light gradient of 10% and 20%
  across the Card, on the simulated camera (80) and the real sensor (60).
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
| curve per channel (PCHIP) + 3x3 | 0.64 | 0.55 | 159 of 160 | 151 |
| curve per channel (cubic) + 3x3 | 0.69 | 0.62 | 160 of 160 | 154 |
| **one tone curve + 3x3 (ships)** | 0.73 | 0.63 | 160 of 160 | 157 |
| one tone curve + root-polynomial 2 | 0.80 | 0.68 | 158 of 160 | 156 |

By tone curve strength, each cell is mean Reading error ΔE / cases within one Chip (of 40):

| Tone curve | 3x3 | root-polynomial 2 | curve per channel (PCHIP) | one tone curve (ships) |
|---|---|---|---|---|
| 0 | 0.50 / 40 | 0.46 / 40 | 0.57 / 40 | 0.48 / 40 |
| 0.3 | 2.40 / 33 | 2.62 / 33 | 0.59 / 40 | 0.55 / 40 |
| 0.5 | 3.88 / 28 | 4.23 / 27 | 0.59 / 39 | 0.67 / 40 |
| 0.7 | 5.20 / 24 | 5.74 / 24 | 0.45 / 40 | 0.81 / 40 |

On a clean simulated camera a curve through every gray is as exact as it gets, and the shared
curve gives up 0.08 ΔE against it. It buys the robustness below.

### The real sensor (132 Photos)

| Correction | Card check range | Good | Caution | Failed | Reading error ΔE | Readings > 1 Chip off |
|---|---|---|---|---|---|---|
| curve per channel (PCHIP) + 3x3 | 2.00 to 3.06 | 0 | 132 | 0 | 3.12 | 25 |
| **one tone curve + 3x3 (ships)** | 1.58 to 2.90 | 44 | 88 | 0 | 2.32 | 7 |

The sensor's channels disagree a little, and the shared shape averages the disagreement out. The
Card check falls about 0.4 and the Readings improve a lot. Daylight scores 1.58 to 1.63 and is
good, fluorescent 2.05 to 2.16 and is caution, tungsten 2.72 to 2.90 and is caution. Every one of
the seven Readings more than a Chip off is in caution; none is in good.

### Damaged gray steps

Photos with one dirty gray (simulated camera, 624), through the shipped engine and through the
same engine with a curve per channel (PCHIP) instead of the shared curve:

| | Good | Caution | Failed | Left a gray out | Readings > 1 Chip off, shown as the answer |
|---|---|---|---|---|---|
| curve per channel (PCHIP) | 300 | 324 | 0 | 216 | 45 |
| **one tone curve (ships)** | 444 | 180 | 0 | 120 | 15 (2 good, 13 caution) |

On a bigger sweep (1716 Photos, 11 soils, no leave-out) the number of Photos whose Reading is
more than a Chip off and whose Card check is under 3.5 falls with the curve: PCHIP 128,
least-squares cubic 108, Huber cubic 99, shared curve 77, **shared with Huber 71**. Dark soils
(10YR 2.5/2, 3/2, 5YR 3/4) with a hazy black or N3.5, or a filmed white, are where they read
wrong: those three grays are 193 of the 221 PCHIP failures.

The leave-out (below) leaves a gray out in 120 of the 624, and every time it is exactly the
damaged one; none of those 120 reads wrong. The 15 that read wrong are Photos it did not
catch: 8 are a filmed white, 4 a hazy N3.5, 3 a hazy black, and 13 of the 15 are caution anyway.
On the real sensor with a dirty gray (480) it leaves one out in 95, always the damaged one;
Readings more than a Chip off and shown as the answer are 43, against 113 for the curve per
channel. A clean Card leaves a gray out in none of the 220 simulated Photos and none of the 132
real-sensor Photos.

### Light gradient and other damage

| Photos | Good | Caution | Failed | Card check range |
|---|---|---|---|---|
| Clean Card, simulated camera (220) | 220 | 0 | 0 | 0.35 to 1.78 |
| 10% and 20% gradient across the Card (80) | 72 | 8 | 0 | 0.84 to 2.22 |
| Clean Card, real sensor (132) | 44 | 88 | 0 | 1.58 to 2.90 |
| 10% and 20% gradient, real sensor (60) | 20 | 40 | 0 | 1.50 to 3.36 |
| Damaged ladder, simulated (624) | 444 | 180 | 0 | 0.50 to 2.93 |
| Damaged ladder, real sensor (480) | 65 | 355 | 60 | 1.52 to 4.12 |
| Other damage to the Card (324) | 36 | 27 | 261 | 0.49 to 56.1 |

"Other damage" splits into what spoils the Reading and what does not. 208 of the 324 Photos
read more than a Chip off; **none of those is good, and one is caution** (a light shadow over a
dark soil, check 3.32). The 116 that read right include the small corner errors (24 px off) and
the Card drawn 10% large, which pass.

## What it says

- **Undoing the tone curve is the big win.** The 3x3's Reading error grows with the tone curve
  (0.5, 2.4, 3.9, 5.2 ΔE); with the curve inverted it stays under 0.85. On a camera with no tone
  curve it costs nothing (0.48 against 0.50).
- **One shared curve over a curve per channel.** It reads a clean simulated camera as well, and a
  real sensor and a dirty Card much better, because no single gray can own a stretch of a curve.
  A curve that goes through every gray looks fine to its own smudge; a shared one does not.
- **Root-polynomial 2 against the 3x3 is a wash on the Card check.** It has the lower mean
  (2.59 against 2.69) and wins the dim lights (dim: lower in 24 of 32 cases; dim with a color
  shift: 24 of 32), but loses color shift and warm light in all 32 each, and a Wilcoxon test over
  the 160 cases finds no difference (p = 0.97). On the Reading it is worse, not a wash: 3.26
  against 3.00 ΔE, lower in only 36 of 160 cases (p = 7e-10).
- **Root-polynomial adds nothing once the curve is gone.** One tone curve then root-polynomial 2
  is worse than one tone curve then 3x3 on both measures (0.80 and 0.68 against 0.73 and 0.63).
- **Overfitting shows only held out.** In the first round (15 cases, one soil), root-polynomial 3
  scored 1.85 on the patches it was fitted on (3x3: 3.08) and 8.5 held out; degree 4 scored 0.38
  on its own Card and 94.6 held out. That is why the Card check is leave-one-out.
- **Chroma-1 soils are the exception to "within a Chip".** The shipped correction reads none of
  the 160 cases more than a Chip off. In the first round the curve per channel read 10YR 3/1 two
  hue pages away (ΔE 2.4) in one, and in the 80 gradient Photos the shipped one reads 10YR 2.5/2
  as 5Y 2.5/2 (ΔE 2.7) once, with the Card check good. Neighbouring hue pages are about 1 ΔE apart
  at chroma 1 and 2, so a Reading 2 to 3 ΔE off can sit two pages away without anything being
  wrong with the Card.

## The Card check

Three states. `CARD_CHECK_GOOD` (2) and `CARD_CHECK_CAUTION` (3.5), both in
`src/engine/cardCheck.ts`:

- **Good**, mean held-out error below 2, no gray left out. The corrected Reading is the answer.
- **Caution**, 2 up to 3.5, or any gray left out. The corrected Reading is still the answer, the
  raw one is shown beside it, and the words name uneven light or the dirty gray, never the
  corner order. If the Photo warnings flag a problem on the Card, they are the cause given.
- **Failed**, 3.5 or more. The raw Reading is shown. The words blame the corner order only
  when nothing else is flagged on the Card.

Why 3.5, and why the old "3.7 or more" and "within 2.4" claims go. The first round said every
Reading more than a Chip off scored 3.7 or more, and that every Card that passed at 2 read within
2.4. Neither held. The sweep behind them had no damage to the ladder ends (a hazy black, a
yellowed white), no dark soils below 3/1 and no real sensor. With those added, dark soils read two
to five Chips off at a check of 1.6, and clean Cards from a real sensor scored 2.0 to 3.1 and
were failed at 2. What the data supports now:

- Clean Photos score up to 1.78 on the simulated camera, 2.22 with a 20% gradient, 2.9 on the
  real sensor, and 3.36 on the real sensor under a 20% gradient. All of these must not fail:
  the failed limit is above 3.36.
- Damaged Cards whose Reading is more than a Chip off score 3.32 at the lowest (a light shadow
  over a dark soil), then 3.66, 3.69 and 3.89 (a dirty patch, a light shadow); 98% score 4 or more.
- 3.5 sits between them: nothing clean fails, one damaged Photo in 208 is caution instead of
  failed, and none is good. The caution band is where the answer and the raw Reading disagree
  and the user should look at both.
- 2 is the good limit: on the real sensor not one Reading is more than a Chip off below 2, and
  all seven that are off are in caution. A clean Card from a real camera is mostly caution,
  by design, not failed.

Both are guesses at what a phone's JPEG does. They are marked provisional in the code, and
should be re-derived from the sweep when #15 has a real Photo.

## Leaving a dirty gray out

The grays are the tone ladder, and one dirty gray bends the curve of every channel, but a gray is
one reference of 24 and the mean hides it. The Page Card's leave-out (#8, `src/engine/leftOut.ts`)
judges a ladder step by the references beside it, in its value row and the rows above and below:
a step is dirty when leaving it out makes the curve agree with those row-mates, and it must also
be a miss to the curve drawn without it. One rule, `dirtyLadderSteps`, serves both Cards. The
ColorChecker's grays are the ladder, and each other patch sits in the value row of the gray
nearest it in lightness (`PATCH_VALUE_ROWS`); a Page's /1 column is the ladder and its rows are
the printed values.

That rule alone misses a dirty step under the shared curve, and this ticket adds one clause. A
curve that passes through every step is bent by a dirty one, which shows in the row-mates; the
shared curve gives a far-off step little weight and is not, so removing the step changes nothing
for its row-mates, and the step shows only in how badly it misses. So a step is also left out when
the curve drawn without it misses it by 6 or more and fits its row-mates to 1.5 or less. On Jon's
worn 10YR Page (8/1 and 7/1 smudged) the first test finds nothing to improve; the clause finds
both.

The ColorChecker uses the ladder rule and nothing else: its patches do not wear, and leaving
colored patches out as well dropped one from 110 of the 132 real-sensor Photos and made two
Readings worse. A Page leaves out Chips off the ladder too (up to four), and a row that has to
lose two of them is a suspect row, which fails the check. A Photo with a gray (or any ladder step)
left out names it, and is capped at caution; a worn Chip off the ladder is named and not capped.

The ladder's own held-out errors do not find a dirty gray. A gray at either end is predicted by
extrapolation and misses whether it is dirty or not (a clean Card reaches 4 to 6 at its ends),
and the worst of the six was the damaged one in only 638 of 1716 Photos. Judging the ladder by
the references beside it did: 120 of 120.

## Limits

- **Provisional.** `CARD_CHECK_GOOD`, `CARD_CHECK_CAUTION` and the leave-out's limits come from
  simulated Photos. A real phone adds local tone mapping, HDR, sharpening, JPEG and lens shading,
  none of which a global curve can invert. Expect real numbers to be worse. **Issue #15 is the
  real test**, and the 20-soil test after it. Jon's Pages after leave-out score 1.6 to 2.3, which
  the caution band is for.
- **The shared curve is its best case here.** The simulator's non-linearity is exactly one curve
  applied to all channels after a linear mix, and the real-sensor simulation adds only the
  sensor's spectral response and an ideal white balance. A phone that tone-maps each channel
  differently would break the shared shape; the per-channel PCHIP would then be the better fit,
  and swapping them is `linearizePerChannel` in the test kit.
- **The real-sensor simulation is one camera, one white balance, no noise.** Other sensors and
  an imperfect white balance will score higher.
- **Root-polynomial was not shown at its best either.** The simulated camera has no spectral
  non-linearity for its cross-terms to fix; the real-sensor simulation does, and still the
  cross-terms add nothing after the curve.
- **The Page Card (#8) has a ladder too:** the /1 chroma column, values 2 to 8
  (`ladder: true` on a `Reference`). The truth is known per channel, so the ladder need not be
  exactly neutral.
- **Not tried:** a curve fitted jointly with the matrix, a different space for the curve, and
  regularising the matrix.
