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
