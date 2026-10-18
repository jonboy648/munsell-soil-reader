# 3x3 against root-polynomial correction

Ticket #4. The engine fits a correction on the Card (white balance, then a fit to the Card's
references). This compares the plain 3x3 matrix with the root-polynomial correction of
Finlayson, MacKiewicz and Hurlbert (2015), at degrees 2 and 3, on simulated Photos. The cases
are in `src/engine/correction.test.ts`; `readPhoto` takes a `correctionDegree` to pick one
(1 is the 3x3).

**Result: the 3x3 stays.** Root-polynomial is ported and kept (`src/engine/rootPolynomial.ts`,
BSD-3 notice in the file and in `THIRD_PARTY_NOTICES.md`), but it does not beat the 3x3 here.

## How it was measured

- **Cases.** Five lights (camera color shift, warm light, dim light, shade, dim light with a
  color shift) through a camera with a tone curve at strength 0.3, 0.5 and 0.7: 15 Photos. The
  true soil is 10YR 4/3 in all of them.
- **Card check.** Leave-one-out over the 24 ColorChecker patches: each patch is left out, the
  correction is fitted on the other 23, and the left-out patch is corrected and compared with
  its true color (CIEDE2000). The mean over the 24 is the Card check. Good is below 3.
- **Reading error.** CIEDE2000 between the corrected soil and its true color. The soil is
  never part of the fit, so it is a held-out reference too, and the only one whose true
  color the simulator knows independently of the Card.
- **Chips off.** Steps from 10YR 4/3 on the grid used in `engine.test.ts` (0 = right, 1 = a
  Neighbouring chip).

## Results

Each cell reads 3x3 / root-polynomial 2 / root-polynomial 3.

| Tone curve | Light | Card check (held out) | Reading error (ΔE) | Chips off |
|---|---|---|---|---|
| 0.3 | color shift | 1.51 / 1.54 / 4.79 | 2.7 / 2.8 / 1.9 | 0 / 0 / 0 |
| 0.3 | warm | 2.04 / 2.18 / 7.09 | 3.2 / 3.3 / 3.0 | 0 / 1 / 1 |
| 0.3 | dim | 2.61 / 2.49 / 8.64 | 3.7 / 4.0 / 3.7 | 0 / 0 / 0 |
| 0.3 | shade | 1.99 / 2.08 / 6.43 | 2.9 / 3.3 / 3.0 | 0 / 0 / 0 |
| 0.3 | dim + shift | 2.65 / 2.30 / 4.91 | 3.4 / 3.9 / 2.6 | 0 / 0 / 0 |
| 0.5 | color shift | 2.32 / 2.39 / 7.87 | 4.1 / 4.1 / 3.1 | 1 / 1 / 0 |
| 0.5 | warm | 3.25 / 3.41 / 9.34 | 4.7 / 5.2 / 4.8 | 2 / 1 / 1 |
| 0.5 | dim | 4.13 / 3.91 / 9.38 | 6.1 / 6.8 / 5.7 | 1 / 2 / 1 |
| 0.5 | shade | 3.12 / 3.12 / 8.39 | 5.4 / 5.7 / 5.7 | 1 / 1 / 1 |
| 0.5 | dim + shift | 4.49 / 3.59 / 5.98 | 5.8 / 6.7 / 4.7 | 1 / 1 / 1 |
| 0.7 | color shift | 3.20 / 3.33 / 9.88 | 5.6 / 6.1 / 5.3 | 2 / 2 / 1 |
| 0.7 | warm | 4.35 / 4.47 / 10.77 | 6.6 / 7.1 / 7.7 | 3 / 3 / 3 |
| 0.7 | dim | 5.85 / 5.28 / 16.45 | 8.5 / 9.4 / 8.3 | 1 / 2 / 1 |
| 0.7 | shade | 4.17 / 4.12 / 10.00 | 7.1 / 7.7 / 7.4 | 1 / 1 / 2 |
| 0.7 | dim + shift | 6.15 / 5.04 / 7.28 | 8.2 / 9.1 / 7.2 | 1 / 1 / 1 |
| | **Mean** | **3.45 / 3.28 / 8.48** | **5.20 / 5.68 / 4.94** | |
| | Within one Chip | | | 12 / 11 / 13 of 15 |
| | Card check good | | | 6 / 6 / 0 of 15 |

## What it says

- **Root-polynomial 2 is a wash on the Card check.** Its mean is lower by 0.17 (3.28 against
  3.45), but it is lower in 7 of the 15 cases and not lower in 8. The gain is mostly in the
  dim cases. The ticket's rule is to use it only if it is lower across the cases; it is not.
- **It is worse on the Reading itself.** The corrected soil is no closer to the truth in any
  case (one tie) and 0.48 ΔE further on average. Why is not tested. A likely cause is that
  the extra terms help the saturated patches, which dominate the Card check, but do nothing
  for a dark, dull soil.
- **Root-polynomial 3 overfits.** Fitted on all 24 patches it looks best on them (mean 1.85
  when scored on the patches it was fitted on, against 3.08 for the 3x3). Held out it is 8.48,
  and its Card check fails in all 15 cases. Degree 4 (22 terms for 24 patches) scores 0.38 on
  its own Card and 94.6 held out. This is the overfit the ticket warned about, and the held-out
  check is what shows it. Root-polynomial 3 reads the soil 0.26 ΔE closer than the 3x3 on
  average, but with every Card check failed it could not be shown as an answer.
- **Degree 2 is the root-polynomial degree to compare.** It has the lowest held-out error of
  the root-polynomial degrees (3.28, against 8.48 for degree 3 and 94.6 for degree 4).
- **Tone curve 0.5 and 0.7 are not fixed.** At 0.5, the 3x3 reads one case two Chips away
  (warm light) and root-polynomial 2 reads one case two away (dim light). Neither holds every
  case within one Chip, so the tests' standard phone curve stays 0.3.
- **The Card check does its job.** With the 3x3, it is good in all five cases at 0.3 (all
  read exactly 10YR 4/3), and it never passes a Photo whose Reading is more than one Chip off.
  It is conservative at 0.5 and 0.7: it fails 9 cases, 6 of which read within one Chip.
  The threshold stays 3.

## Why root-polynomial does not win here, and when to look again

Root-polynomial correction adds cross-terms to the 3x3 for cameras whose response is not a
linear mix of the eye's, and unlike an ordinary polynomial it stays correct when the exposure
changes. The simulated camera here is a 3x3 mix of the scene plus a per-channel tone curve. A
3x3 already handles the mix and the exposure exactly, and neither correction can undo a tone
curve, so the extra terms have little to fix. Real phones have
spectral responses that break the linear-mix assumption, so root-polynomial may do better on
real Photos. The comparison is one constant (`CORRECTION_DEGREE` in `readPhoto.ts`) and the
tests above, so it can be repeated on Jon's 10YR Page Photo and the 20-soil test.

The error that is left is the tone curve. Untested here: linearising each channel from the six
gray patches before the matrix.
