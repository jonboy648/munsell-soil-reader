# Which correction the engine uses

Ticket #4. The engine corrects a Photo against the Card with a fit made on the Card's
references. This note compares candidates, says which ships and why, and records how the Card
check threshold was set. The cases are in `src/engine/correction.test.ts`; `readPhoto` takes an
optional `correction` so a test can swap the fit.

**Result: linearize each channel along the Card's gray patches, then a 3x3.** It is the lowest
on the held-out Card check and on the Reading error, and it is exact or one Chip off in 159 of
160 cases at tone curves up to 0.7. Root-polynomial correction is a wash against the plain
3x3 and is not shipped. It stays in the repo as test code for this comparison
(`src/engine/correctionCandidates.testkit.ts`).

## The candidates

- **3x3.** A matrix fitted by least squares on the Card's references. The prototype's method.
- **Root-polynomial 2.** Finlayson, MacKiewicz and Hurlbert (2015), degree 2, ported from
  colour-science. Degrees 3 and 4 overfit the Card (held-out Card check 8.5 and 94.6 against
  3.3 for degree 2, on the 15 cases of the first round), so degree 2 is the one compared.
- **Linearize, then 3x3.** For each channel, draw a curve through the Card's gray ladder
  (what the camera measured against what the gray really is, in sRGB-encoded values),
  and invert it before the matrix. The curve is either straight lines between the gray steps
  or a monotone cubic (PCHIP, Fritsch and Carlson 1980), and runs straight past the first
  and last step. The curves are fitted inside the fit, so the Card check refits them without
  the reference it holds out.
- **Linearize (PCHIP), then root-polynomial 2.** To see whether the extra terms still help
  once the curve is gone.

The idea of linearizing first came from a review of this ticket's first round, which found
that the 3x3 and root-polynomial both leave the tone curve alone.

## How it was measured

- **Cases.** 160 Photos: 8 soils (10YR 4/3, 7.5YR 5/6, 10YR 6/3, 2.5Y 7/2, 5YR 3/4, 10R 4/6,
  10YR 3/1, 2.5Y 8/2) by 5 lights (camera color shift, warm light, dim light, shade, dim light
  with a color shift) by 4 tone curve strengths (0, 0.3, 0.5, 0.7).
- **Card check.** Leave-one-out over the 24 ColorChecker patches: each patch is left out, the
  correction is fitted on the other 23, and the left-out patch is corrected and compared with
  its true color (CIEDE2000). The mean of the 24 is the Card check.
- **Reading error.** CIEDE2000 between the corrected soil and its true color. The soil is
  never part of the fit, so it is a held-out reference too, and the one whose true color the
  simulator knows independently of the Card.
- **Chips off.** Steps from the true Chip on the grid used in `engine.test.ts` (0 = right,
  1 = a Neighbouring chip).

## Results

| Correction | Card check, held out (mean) | Reading error ΔE (mean) | Within one Chip | Exact Chip | Card check good (below 2) |
|---|---|---|---|---|---|
| 3x3 | 2.69 | 3.00 | 144 of 160 | 82 | 56 of 160 |
| root-polynomial 2 | 2.59 | 3.26 | 145 of 160 | 80 | 48 of 160 |
| linearize (straight lines) + 3x3 | 0.68 | 0.65 | 159 of 160 | 149 | 160 of 160 |
| **linearize (PCHIP) + 3x3 (ships)** | **0.64** | **0.55** | 159 of 160 | 151 | 160 of 160 |
| linearize (PCHIP) + root-polynomial 2 | 0.76 | 0.63 | 158 of 160 | 150 | 160 of 160 |

By tone curve strength. Each cell reads: mean Reading error ΔE / cases within one Chip (of 40)
/ mean Card check.

| Tone curve | 3x3 | root-polynomial 2 | linearize (PCHIP) + 3x3 |
|---|---|---|---|
| 0 | 0.50 / 40 / 0.41 | 0.46 / 40 / 0.51 | 0.57 / 40 / 0.58 |
| 0.3 | 2.40 / 40 / 2.16 | 2.62 / 40 / 2.12 | 0.59 / 40 / 0.65 |
| 0.5 | 3.88 / 35 / 3.46 | 4.23 / 34 / 3.29 | 0.59 / 39 / 0.68 |
| 0.7 | 5.20 / 29 / 4.75 | 5.74 / 31 / 4.44 | 0.45 / 40 / 0.66 |

## What it says

- **Linearizing first is the win.** The 3x3's Reading error grows with the tone curve (0.5, 2.4,
  3.9, 5.2 ΔE); with the curve inverted it stays near 0.6. On a camera with no tone curve it
  costs 0.07 ΔE. The simulated phone curve can now be 0.5 (`PHONE_TONE_CURVE`), where the 3x3
  reads 5 of 40 cases more than one Chip off and this reads 1.
- **PCHIP over straight lines.** PCHIP's held-out Card check is lower (0.64 against 0.68; lower
  in 104 of 160 cases; Wilcoxon p = 2e-7) and so is its Reading error (0.55 against 0.65; p =
  4e-4). That is the rule the ticket sets, and PCHIP ships.
- **Root-polynomial 2 against the 3x3 is a wash on the Card check.** It has the lower mean
  (2.59 against 2.69) and wins the dim lights (dim light: lower in 24 of 32 cases; dim light
  with a color shift: 24 of 32), but loses color shift and warm light in all 32 each, and a
  Wilcoxon test over the 160 cases finds no difference (p = 0.97). On the Reading it is
  worse, not a wash: 3.26 against 3.00 ΔE, lower in only 36 of 160 cases (p = 7e-10).
- **Root-polynomial adds nothing once the curve is gone.** Linearize then root-polynomial 2
  is worse than linearize then 3x3 on both measures (0.76 and 0.63 against 0.64 and 0.55).
- **Overfitting is visible only held out.** In the first round (15 cases, one soil),
  root-polynomial 3 scored 1.85 on the patches it was fitted on (3x3: 3.08) and 8.5 held out;
  degree 4 scored 0.38 on its own Card and 94.6 held out. That is why the Card check is
  leave-one-out.
- **The one case beyond a Chip.** 10YR 3/1 under dim light with a color shift at tone curve 0.5
  reads 5YR 3/1, two hue pages away, 2.4 ΔE from the truth. At chroma 1 neighbouring hue
  pages are about 1 ΔE apart, so this is not a Card problem: its Card check is 0.77, like
  its neighbours'. No threshold can flag it without failing everything.

## The Card check threshold

`CARD_CHECK_GOOD` is 2 (it was 3, the prototype's). The rule: no simulated Reading more than
one Chip off passes the Card check. Data, from a throwaway sweep of 840 Photos (4 soils, 5
lights, tone curves 0.3 and 0.7, and 21 conditions of the Card from "fine" to "broken"):

- Photos with a well-formed Card score **1.04 or less**: the whole 160-case grid scores 0.83 or
  less, and corners tapped 8, 16 and 24 px off, or the Card drawn 10% large or small, score up
  to 1.04.
- Photos that break the fit score **much higher**: corners in the wrong order, 24 to 56;
  corners 36 px off or the Card drawn 25% small, 23 to 35; a shadow over half the Card, 3.8
  to 15; glare on a patch, 6 to 22; one or two dirty patches, 0.9 to 16.
- Of those, every Reading **more than one Chip off scored 3.7 or more** (lowest: a dirty patch
  in dim light, 3.75, and a light shadow, 3.76). The converse does not hold: a Card can fail
  the check and still give a good Reading, so a failed check is a warning, not a verdict.

Anything from 1.1 to 3.7 meets the rule. 2 is the middle of that gap on a log scale (the
square root of 1.04 times 3.74 is 1.97): about twice the worst well-formed Photo, so a real
phone's extra noise has room, and about half the lowest Card that spoiled a Reading. Every
case in the sweep that passes at 2 reads within 2.4 ΔE of the truth. The old threshold of 3
also meets the rule on this data, but only 20% under the lowest bad score, and not with the
3x3: 10YR 3/2 at tone curve 0.3 passed the Card check while reading 7.5YR 2.5/2, two Chips
off. The shipped correction reads it within one Chip, and passes the check, in all ten
cases tested (five lights, tone curves 0.3 and 0.5).

`src/engine/correction.test.ts` holds a smaller version of this sweep: wrong-order corners,
a dirty patch, glare and shadows, and checks that none of the damaged Cards that spoil a
Reading passes.

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

- **This is the method's best case.** The simulated camera's non-linearity is exactly a
  per-channel curve applied after a linear mix, which is the thing linearizing undoes. A real
  phone adds local tone mapping, HDR, sharpening, JPEG and lens shading, none of which a
  per-channel curve can invert. Expect the real numbers to be worse than 0.6 ΔE.
  **Issue #15 (Jon's real 10YR Page Photo) is the real test**, and the 20-soil test after it.
  Both the comparison and the threshold should be re-run on real Photos.
- **Root-polynomial was not shown at its best either.** The simulated camera has no spectral
  non-linearity for its cross-terms to fix. If real Photos show one, the comparison is
  `readPhoto(..., { correction })` with the candidates in `correctionCandidates.testkit.ts`.
- **The Page Card has a ladder too.** The Page Card (#8) marks the /1 chroma column, values 2
  to 8, as its ladder (`ladder: true` on a `Reference`). The truth is known per channel, so the
  ladder need not be exactly neutral.
- **Not tried:** a curve fitted jointly with the matrix, curves in a different space, and
  regularising the matrix. The error left is small in the simulation.
