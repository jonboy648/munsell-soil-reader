# Photo quality thresholds

How the engine decides a Photo has glare, clipping, uneven light, or a Card that is too small, and
why each limit is where it is. For the method page (#13). The code is `src/engine/quality.ts`; the
limits are exported constants there, and `src/engine/quality.test.ts` pins them with one simulated
Photo per problem.

These limits come from simulated Photos only (960 x 600, a ColorChecker, soil of `10YR 4/3`, the
phone-like tone curve of strength 0.3, noise of a few levels). Real Photos have blur, JPEG blocks
and HDR, so Jon's real Photos should confirm or move them. The two least certain are marked.

## What each check measures

All checks read the Card's references: each one a position, a read radius and the luminance it
has in even light. The grays are the Card's tonal ladder. A Page of the soil book will supply its
own list, so nothing here is ColorChecker-specific.

| Problem | Measure | Limit |
|---|---|---|
| Glare | Share of an area's pixels that are blown (every channel at least 250) | A reference or Spot with 5 percentage points more blown pixels than the Card's white has |
| Clipped, highlights | Share of the Card's white (brightest gray) that is blown | 50% or more. On a Spot: blown pixels that the Card's white explains |
| Clipped, shadows | Share of the Card's black (darkest gray) that is crushed (every channel at most 5) | 50% or more. On a Spot: 50% or more of it crushed |
| Uneven light | Spread, in stops, of measured / expected luminance across the readable grays | More than 0.8 stops, with at least 3 readable grays |
| Card too small | Closest pair of reference centers, in Photo pixels | Under 24 px |
| Card not found | Card check, mean CIEDE2000 | 20 or more: the Card checks are skipped |

A Photo is at most 1600 px on its longest side (`MAX_SIDE` in `src/lib/photo.ts`), so pixels
here are of that.

## Reasoning

**Glare versus clipping.** Both are blown pixels, so the Card says which one it is. White is the
brightest thing on the Card in every channel, so under any exposure it is blown at least as much
as any other patch. A reference with more blown pixels than the white is a reflection, not the
exposure. If the white itself is blown, the exposure is the cause and the Card is flagged
clipped. With no Card there is nothing to compare, so a Spot that is mostly blown (50% or more)
is clipped and a partly blown one is glare. Five percent keeps a stray bright speck from
counting. The simulated glare is a soft blob whose core is pure white; a Photo with it over part of a
Spot, or over one Card patch, raises glare and nothing else.

**Clipped.** A white that is blown, or a black that is crushed, is outside what the camera can
record, and no correction recovers it. Exposure scenes: the light scaled by 1.3 already blows the
white; 0.1 (3.5 stops under) does not crush the black, 0.05 does. Blown and crushed
grays are left out of the uneven-light check, since they say nothing about the light.

**Uneven light.** In even light every gray is off by the same factor, so the spread is small. A
shadow pulls some down more than others. Spread of the six grays, in stops:

| Simulated Photo | Spread |
|---|---|
| Clean, phone curve 0.3, four lights (neutral, shift, warm, dim) | 0.51 to 0.64 |
| Shadow ramp across the Card, light at 0.8 / 0.7 / 0.5 / 0.35 | 0.75 / 0.92 / 1.27 / 1.68 |
| Shadow edge across the middle of the Card, 0.7 / 0.5 / 0.35 | 1.09 / 1.55 / 2.09 |
| Clean, stronger tone curve 0.5 / 0.7 | 0.90 to 1.09 / 1.30 to 1.57 |

The limit of 0.8 sits above the clean phone Photos and below a shadow of about half a stop
(light at 0.7). **Least certain:** the grays run white to black along the Card's bottom row, so a
tone curve and a left-to-right shadow both darken the dark end more, and the two cannot be told
apart from the grays alone. A very contrasty real phone (curve 0.5 or more) would be flagged
without a shadow. Its Card check would be near failing anyway (2.1 to 3.7), but a check on real
Photos may call for a higher limit.

**Card too small.** Patches are read in a circle of 20% of their pitch, from corners the user
tapped, so a tap that is off puts the circle over a gap or a neighbor. In the simulated camera
(no blur, flat patches) the Card check stayed good in 100 of 100 trials with tap errors of up to
8 px at a pitch of 24.4 px, in 97 of 100 at 20.7 px, and in 66 of 100 at 17.8 px. With errors up to
6 px it held to 17.8 px and fell to 87 of 100 at 14.8 px. So a pitch of about three times the tap
error is safe, and 24 px allows 8 px of error (about 2 screen pixels on a phone, where a 1600 px
Photo is shown 4 times smaller). **Least certain:** real blur and JPEG blocks eat into this, so
24 px may need to rise.

**Card not found.** With corners tapped in the wrong order every one of the 23 other orders gave
a Card check of 23 to 37, because the references are not on the Card. The worst Card problem
simulated (glare over a patch) gave 14.7. At 20 or more the references say nothing about the
Photo, so the Card checks are skipped and the Card check failure alone explains it.

## Known limits

- Glare that covers the whole white patch is reported as clipped: a reflection on the white is
  the same to the engine as a white that is too bright.
- Blown means every channel at least 250. A single clipped channel (a red-heavy light blowing red
  only) is not flagged.
- One warning per kind per place. When the light is both blown and crushed the Card gets one
  clipped warning that says both.
