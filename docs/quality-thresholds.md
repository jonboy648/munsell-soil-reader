# Photo quality thresholds

How the engine decides a Photo has glare, clipping, uneven light, or a Card that is too small, and
why each limit is where it is. For the method page (#13). The code is `src/engine/quality.ts`; the
limits are exported constants there (the ColorChecker's own two are in `src/engine/readPhoto.ts`),
and `src/engine/quality.test.ts` pins them with simulated Photos on each side of each limit.

These limits come from simulated Photos only: 960 x 600, a ColorChecker, soil of `10YR 4/3`, a
tone curve (0 to 0.7), sensor noise (up to 3 times the usual) and JPEG compression (quality 50 to
90, with 4:2:0 color). Real Photos have more blur and HDR, so Jon's real Photos should confirm or
move them. The least certain are marked **least certain**.

## What each check measures

| Problem | Measure | Limit |
|---|---|---|
| Blown pixel | Channels at 253 or more (8-bit) | 2 of 3 channels |
| Crushed pixel | Channels at 5 or less | all 3 |
| Glare on the Card | Blown pixels in a reference, against the Card's white | 5 points more than the white |
| Clipped, highlights | Blown share of the Card's white | 50% or more |
| Clipped, shadows | Crushed share of the Card's black | 50% or more |
| Glare or clipped, on a Spot | Blown share of the Spot, and the Spot's own level | 5% blown; own level 245 or more is clipped |
| Uneven light | Spread, in stops, of the Card's black frame at 15 places | over 0.2 stops, up to 2 |
| Card too small | Spacing between patches the tapped corners give | under 24 px |
| Corners off the Card | Pairs of readable grays measured in the wrong order | 3 or more |

A Photo is at most 1600 px on its longest side (`MAX_SIDE` in `src/lib/photo.ts`), so pixels
here are of that.

## Two comparison sets, each with its own limit

The checks read the Card through two lists the caller supplies, so a Page of the soil book (#8)
can reuse them without ColorChecker code in the engine.

- **`references`**: where the Card's patches are, each with a read radius and the luminance it has
  in even light. They carry glare, clipping and the placement test. References marked `neutral`
  are the tonal ladder: the brightest is the white and the darkest the black.
- **`evenness`**: places on the Card that should come out equally bright in even light, with the
  limit that suits them. The ColorChecker supplies its black frame, limit 0.2 stops. A Page will
  supply its white paper, whose limit should be much tighter, since a flat white is easy to
  measure and a shadow on it is easy to see. A limit belongs to its comparison set and is not a
  property of the check: do not reuse 0.2 for paper.

## Reasoning

**What is blown.** A white that touches the top in one channel is normal: warm light puts the
ColorChecker's white at 254/236/188, and the camera color shift puts it at 244/248/255 (247/250/255
through the stronger tone curve of 0.5). Counting one channel at 250 or more flags both, though
the Card check is good (0.68 and 0.76, through the example tone curve of 0.5) and the Reading is right. So a pixel is blown when two
channels are at 253 or more: both examples pass. The shift example flags at 5% more light, and
the warm one at 30% more, when a second channel reaches the top. Crushed uses every channel: dark
soil has almost no blue, so one channel at 0 is not a lost Spot. The one-channel rule (even at 253)
makes 29 of the 46 quality tests fail.

**Glare against exposure.** Both are blown pixels, so the Card says which. White is the brightest
thing on the Card in every channel, so under any exposure it is blown at least as much as any
other patch. A reference with 5 points more blown pixels than the white is a reflection. If the
white itself is 50% blown, the exposure is the cause. A crushed black works the same way. Five
points keeps a stray speck from counting: a speck too small to blow 5% of a patch or a Spot is
not flagged. Glare is flagged with the Card check failing, at every size tried: two adjacent patches, a
row, the gray patches, six patches, and a broad sheen over the whole Card.

**Glare against exposure on a Spot.** The Spot's own level says which: the strongest channel
of the darker quarter of its unblown pixels. Soil at normal exposure reads 220 to 234 for the
lightest chips (`10YR 8/1` and `5Y 8/3`, under any of the three lights) and 56 to 194 for the
others. Blown
pixels on a Spot below 245 are glare, since the soil itself is well short of the top. At 245 or more
the Spot is at the top of the range, so they are exposure. This does not look at the Card, so a
`10YR 4/3` Spot with a reflection is glare even when the exposure has clipped the Card's white,
and a `10YR 8/1` Spot at 1.64 times the light, part blown, is clipped whether or not a Card is
there. A Spot blown right through has no level of its own, and the Card's white decides: with no
Card, exposure. **Least certain:** a very light soil under warm light with a reflection on it
can read above 245 without any clipping, and is then called clipped.

**Uneven light.** The first design measured the six grays on the Card's bottom row, in stops off
from what they should be. It measured the tone curve: the grays run from white to black along the
row, and a tone curve darkens the dark end, just as a shadow would.

| Photo | Gray spread, stops |
|---|---|
| Clean, tone curve 0.3 | 0.51 to 0.64 |
| Clean, tone curve 0.5 | 0.90 to 1.09 |
| Clean, tone curve 0.7 | 1.30 to 1.57 |
| Shadow along the gray row | as clean: the grays darken alike, so it cannot be seen |

So it flagged clean Photos at curve 0.5 and above and missed any shadow along the row. The
black frame has none of that: it is one black surface, equally bright everywhere in even light
whatever the curve does. The engine reads it where four patches meet (15 places, the midpoints of
diagonal neighbors), in a circle a quarter of the way across that diagonal, as the brightness of
the darkest 15% of pixels in it, so a tap that is a few pixels off, which puts bright patch in the
circle, does not move the reading. The spread is the gap between the second darkest and second
brightest place, in stops.

| Simulated Photo | Spread, stops |
|---|---|
| Clean, 4 lights x tone curve 0, 0.3, 0.5, 0.7 (worst of 16) | 0.01 |
| Warm, noise x2, JPEG 75 | 0.10 |
| Warm, noise x3, JPEG 50 | 0.15 |
| Dim, curve 0.5, noise x3, JPEG 75 | 0.08 |

| Shadow, light left in the shade | 0.9 | 0.8 | 0.7 | 0.5 | 0.3 |
|---|---|---|---|---|---|
| Ramp across the Card, left to right | 0.11 | 0.24 | 0.33 | 0.67 | 1.08 |
| Edge down the middle | 0.16 | 0.33 | 0.55 | 1.03 | 1.77 |
| Ramp top to bottom | 0.10 | 0.15 | 0.28 | 0.51 | 0.86 |
| Over the top two rows | 0.16 | 0.33 | 0.55 | 1.03 | 1.77 |
| Over the gray row | 0.11 | 0.21 | 0.40 | 0.85 | 1.59 |
| Over the white end (left column) | 0.07 | 0.15 | 0.28 | 0.56 | 0.89 |

The limit of 0.2 sits above everything clean, with the harshest compression and noise at 0.15,
and below a shadow of about a third of a stop in most layouts and half a stop in all. Corners
tapped up to 12 px off (a pitch of 74) left every clean Photo clear and missed no shadow, in 30
trials each. Above 2 stops the spread is not the light. Of the 23 wrong corner orders, 12 read 2.5 to 5.9 stops
because the sampling places land on patches, so those are left alone and the failed Card check
explains them. The other 11 (flips and half turns of the grid) put the places on the frame again
and read near 0, so they raise nothing. A real shadow deeper than 2 stops is lost the same way as
the first 12.
**Least certain:** the simulated frame is 16% of the patch pitch wide, and the real card's is
narrower. The darkest-15% reading needs the frame to be a good share of the circle (about half at
16%, a third at 10%), and a shadow only on the outer ring of patches (the white end alone) does not
reach the 15 places inside the Card, so it shows only as a failed Card check.

Glare on the Card also lights the frame near it. Places within one patch spacing of a glared
reference, or that are themselves blown or crushed, are left out, and the check needs 6 of the 15
to be left. Without that rule glare would raise uneven light as well. With it, glare and a shadow
are each flagged: tested with reflections on three patches and a shadow over the top rows.

**Card too small.** Patches are read in a circle of 20% of their pitch, from corners the user
tapped, so a tap that is off puts the circle on a gap or a neighbor. In the simulated camera (no
blur, flat patches, tone curve 0.5) the Card check stayed good in 40 of 40 trials with tap errors
of up to 8 px at a pitch of 24.4 px, in 38 of 40 at 20.7 px, and in 23 of 40 at 17.8 px. With
errors up to 6 px it held in 40 of 40 down to 17.8 px and fell to 36 of 40 at 14.8 px. So a pitch of about three times the tap
error is safe, and 24 px allows 8 px of error (about 2 screen pixels on a phone, where a 1600 px
Photo is shown 4 times smaller). The spacing comes from the tapped corners (the smallest of
the four sides over its patch count), not from the patch positions they imply: with the corners in
the wrong order those bunch together and would call a good Card small. **Least certain:** real
blur and JPEG blocks eat into this, so 24 px may need to rise.

**Corners off the Card.** With the corners tapped in the wrong order the references are not on
the Card and nothing they show says much. The test: sort the readable grays (not blown or crushed)
white to black and count pairs measured in the wrong order. Light, shadows and tone curves squeeze
the order but keep it. Over 51 right-order Photos (every light, tone curve, exposure, shadow
direction and depth, and glare) it counted 0, except 1 to 3 for shadows of a stop or more that
darken the white end or fall from right to left. The 23 wrong orders counted 4 or more, except
three that count 0, 1 and 1 and so pass as the Card (one is the two top corners swapped, which
leaves the gray row alone). Uneven light stays quiet for those three anyway (the frame spread is
over 2 stops or near 0), Card too small does not depend on this test, and the Card check fails.
Off the Card, uneven light and Card too small are skipped. With fewer than 3 readable grays the
references are taken as placed. Glare and clipping
are not: with no white to compare to, a reference that is partly blown is glare and one that
is mostly blown is exposure. So a white blown by 30% extra light is still `clipped` in the three wrong orders
tried. With the exposure much further off and the corners also wrong, glare may be reported in
its place.

## Known limits

Every one of these still leaves a signal: with the corners in any of the 23 wrong orders the Card
check fails (24.8 or worse, against a limit of 2), so the Reading is shown uncorrected.

- Three of the 23 wrong orders (`1023`, `3021` and `0321`, with 0, 1 and 1 inverted pairs) are not
  told apart from the Card by the gray ladder, so the white and black it supplies are the wrong
  patches. Their Card check reads 27.6, 34.0 and 31.2, and uneven light stays quiet for them (the
  frame spread is 0.0, 5.9 and 5.8 stops).
- With the corners in the wrong order and the exposure also far off, glare can be reported where
  clipped is true. For a warm light at 1.3 times, all 23 orders report clipped; at 2 times, 19 do
  and 4 report glare; at 4 times, 17 do and 6 report glare.
- A shadow of about 2.3 stops that darkens the white end, or falls from right to left, inverts up
  to 3 pairs of grays, so the ladder takes the Card for off the Card: uneven light and Card too
  small are then skipped, and the Card check, which fails at that depth, is the signal.

- Glare that covers the whole white patch is reported as clipped: a reflection on the white is the
  same to the engine as a white that is too bright.
- A single clipped channel (a red-heavy light blowing only red) is not flagged.
- A very light soil under warm light can read near the top without clipping; glare on it is called
  clipped.
- A shadow confined to the outer ring of patches does not reach the black frame inside.
- One warning per kind per place. When the light is both blown and crushed the Card gets one
  clipped warning that says both.
