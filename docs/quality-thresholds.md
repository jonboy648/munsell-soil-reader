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
| Clipped, highlights | The Card white's median color | 2 channels at 254 or more |
| Clipped, shadows | Crushed share of the Card's black patch, or of its black frame | 50% or more; frame: fewer than 3 of 15 places above the crush level |
| Glare or clipped, on a Spot | Blown share of the Spot, and the Spot's own level | 5% blown; own level 245 or more is clipped |
| Uneven light | How much a plane fitted to the Card's black frame, read at 15 places, rises across the Card, in stops | over 0.3 stops, up to 3 |
| Card too small | Spacing between patches the tapped corners give | under 24 px |
| Corners off the Card | Pairs of readable grays measured in the wrong order | 3 or more |

A Photo is at most 1600 px on its longest side (`MAX_SIDE` in `src/lib/photo.ts`), so pixels
here are of that.

## Two comparison sets, each with its own limit

The checks read the Card through two lists the caller supplies, so a Page of the soil book (#8)
can reuse them without ColorChecker code in the engine.

- **`references`**: where the Card's patches are, each with a read radius and the luminance it has
  in even light. They carry glare, clipping and the placement test. References marked `ladder`
  are the tonal ladder: the brightest is the white and the darkest the black.
- **`evenness`**: places on the Card that should come out equally bright in even light, with the
  limit that suits them. The ColorChecker supplies its black frame, limit 0.3 stops. A Page will
  supply its white paper, whose limit should be much tighter, since a flat white is easy to
  measure and a shadow on it is easy to see. A limit belongs to its comparison set and is not a
  property of the check: do not reuse 0.3 for paper.

## Reasoning

**What is blown.** A white that touches the top in one channel is normal: warm light puts the
ColorChecker's white at 254/236/188, and the camera color shift puts it at 244/248/255 (247/250/255
through the stronger tone curve of 0.5). Counting one channel at 250 or more flags both, though
the Card check is good (0.68 and 0.76, through the example tone curve of 0.5) and the Reading is right. So a pixel is blown when two
channels are at 253 or more: both examples pass. The shift example flags at 5% more light, and
the warm one at 30% more, when a second channel reaches the top. Crushed uses every channel: dark
soil has almost no blue, so one channel at 0 is not a lost Spot. The one-channel rule (even at 253)
makes 31 of the 54 quality tests fail.

The white itself is judged by its median color, two channels at 254 or more, not by its blown
share. Through the steepest tone curve (0.7) and JPEG 50, the shift light's white reads
249/253/255: JPEG overshoot lifts the green channel a level and, by blown share, half the white
crosses 253 and raises `clipped` on a clean Photo (the review saw 5 of 5 seeds). A median a level
short of the line does not follow it, and a white that really is clipped is over: warm light at
1.3 times reads 255/255/216 (at 1.2 times 255/252/209, still not clipped, and at 1.0 times
254/240/193). None of the 396 clean Photos below raises `clipped`.

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
diagonal neighbors), in a circle a quarter of the way across that diagonal. Each place is read as
the brightness 25% of the way up its pixels, so the bright patch corners in the circle, which a
tap that is a few pixels off lets in, are not counted. A plane is then fitted through the 15
readings (in stops) and the answer is how much the plane rises across the Card.

Three earlier versions failed, each on the evidence below:

- *Read the darkest 15% of the circle, take the spread between the brightest and darkest places.*
  Heavy JPEG puts ringing beside the bright patches, so the darkest pixels at the crossing that
  touches the white patch read 0.25 stops low every time. With JPEG 50 and three times the usual
  noise, 15 of 60 clean straight-on Photos read over 0.2, 28 of 60 tilted both ways at once
  (yaw 30, pitch 30) and 15 of 60 with every corner tapped 10 px off.
- *The same with the 30th percentile.* Clean false alarms fell to 1, 0 and 4 of 60, but the 30th
  percentile only works while the frame is more than about 40% of the circle. At the simulated
  frame (16% of the patch pitch wide, half the circle) it holds; with the frame 8% wide it read
  0.99 stops on every clean Photo (32 of 32 over 0.2). The 25th percentile degrades gently
  instead, so that is what the engine uses.
- *The spread of the places.* A range statistic is set by its two worst places; a plane is set
  by all of them. At the 30th percentile the plane's worst clean Photo read 0.20 where the
  spread's read 0.42.

Clean Photos, all four lights, tone curves 0.3, 0.5 and 0.7, with the whole engine (any warning at
all):

| Photos | Straight on | Tilted (yaw 30, pitch 30) | Every corner tapped 10 px off |
|---|---|---|---|
| JPEG 50, noise x3: 5 seeds each, 60 per view | 0 | 1 | 0 |
| JPEG 50, noise x1: 3 seeds each, 36 per view | 0 | 1 | 0 |
| JPEG 75, noise x2: 3 seeds each, 36 per view | 0 | 0 | 0 |

The one false alarm is the same Photo in both JPEG 50 rows: dim light through curve 0.7, tilted. Its
frame sits at levels 8 to 11, where one level of JPEG or noise is 0.3 stops, and it is excluded
from the clean-Photo test for that reason.

Shadows (tone curve 0.5, JPEG 50, noise x3, 3 seeds x 4 lights = 12 per cell), flagged as uneven
light:

| Shadow | Straight on | Corners 10 px off |
|---|---|---|
| Ramp across the Card, light left 0.8 | 3 of 12 | 4 of 12 |
| Ramp across the Card, light left 0.7 | 11 of 12 | 12 of 12 |
| Edge down the middle, 0.8 | 12 of 12 | 12 of 12 |
| Over the top two rows, 0.8 | 12 of 12 | 12 of 12 |
| Over the gray row, 0.5 | 12 of 12 | 12 of 12 |
| Over the white end (left column), 0.5 | 5 of 12 | 5 of 12 |

So the limit of 0.3 stops finds an edge or a band of a fifth less light every time, a ramp of 30%
less light (11 and 12 of 12), and misses a ramp of a fifth less light (a third of a stop) most of
the time. Without JPEG the plane reads a ramp of 0.7 at 0.35, an edge of 0.7 at 0.60, the top rows at
0.50 and the gray row at 0.28; at 0.5 they read 0.66, 1.21, 1.01 and 0.49. An edge reads about a
fifth more than its size, since a plane through a step runs further than the step.

Tap error and the cap. The reading holds with the whole Card tapped up to 0.2 of a patch off
(15 px at a pitch of 74): clean readings 0.01 to 0.05 stops, JPEG 50 or not. At 0.3 of a patch the
circles find too little frame and read 1.2 stops with the Card check still good (0.7): a false
alarm, and the reason the tap tolerance of the patches (0.22 of a pitch) is not the frame's. With
the taps one and a half patches off across and down it reads 4.1. Deep shadows read up to 2.3
(an edge of 0.2) and half-a-patch errors 1.25, so the cap of 3 stops separates only the badly
misplaced.

Frame width. The simulated frame is 16% of the patch pitch wide, and a real ColorChecker's is not
known here. With the 25th percentile and the limit 0.3, JPEG 50, noise x3 (clean: 32 straight, 32
with every corner 10 px off; shadows: 8 of each):

| Frame / pitch | Clean over 0.3 | Edge 0.8 | Top rows 0.8 | Ramp 0.8 |
|---|---|---|---|---|
| 16% (gap 12 px) | 0, 0 | 8, 8 | 8, 8 | 2, 3 |
| 11% (gap 8 px) | 0, 0 | 6, 6 | 8, 7 | 0, 1 |
| 8% (gap 6 px) | 0, 3 | 8, 7 | 6, 7 | 3, 6 |

(straight on, then corners off). The 30th percentile read every clean Photo at the 8% frame as
uneven; the 25th loses a little detection and gains that robustness. **Least certain:** Jon's real
ColorChecker should settle the frame width and the percentile.

Dark Photos. The black frame is the darkest thing in the Photo, and in a dim Photo it sits
at the bottom of the tone curve, where one level of noise is a quarter stop or more. Places lost in
the dark are not thrown away, since the shaded places are the ones that go dark: each counts at the
crush level (5), as bright as it can be, so what the plane says is at most how uneven the light is.
With fewer than 3 of the 15 places above that level there is nothing to compare, and the Card
gets a `clipped` warning that says the light cannot be checked (JPEG 75, noise x1, 4 lights x 3
seeds = 12 per row; "dark" is that warning or the crushed-black one):

| Exposure | Clean: none / uneven / dark | Edge shadow 0.5: none / uneven / dark |
|---|---|---|
| 0.5 | 12 / 0 / 0 | 3 / 9 / 0 |
| 0.35 | 9 / 0 / 3 | 0 / 9 / 3 |
| 0.25 | 9 / 0 / 3 | 3 / 6 / 3 |
| 0.15 | 0 / 0 / 12 | 0 / 0 / 12 |

Before this, dropping every place with 5% or more crushed pixels removed exactly the shaded ones:
at 0.25 times no place survived, a shadow edge of 0.5 was found in 0 of 3, and the check stayed
silent. The dim-light Photos are the ones that read "dark" at 0.35 and 0.25 and miss a shadow at
0.5; a shadow in a Photo two stops under-exposed is found in half the cases at best.

Glare on the Card also lights the frame near it. Places within one patch spacing of a glared
reference, or that are themselves blown, are left out, and the check needs 6 of the 15 to be left.
Without that rule glare would raise uneven light as well. With it, glare and a shadow are each
flagged: tested with reflections on three patches and a shadow over the top rows. The places and
their radii follow the same homography as the patches, so a Card tilted 40 degrees (the `angled`
example) reads clean, and a shadow or glare on it is still flagged (both tested).

**Card too small.** Patches are read in a circle of 20% of their pitch, from corners the user
tapped, so a tap that is off puts the circle on a gap or a neighbor. In the simulated camera (no
blur, flat patches, tone curve 0.5) the Card check stayed good in 40 of 40 trials with tap errors
of up to 8 px at a pitch of 24.4 px, in 38 of 40 at 20.7 px, and in 23 of 40 at 17.8 px. With
errors up to 6 px it held in 40 of 40 down to 17.8 px and fell to 36 of 40 at 14.8 px. So a pitch of about three times the tap
error is safe, and 24 px allows 8 px of error (about 2 screen pixels on a phone, where a 1600 px
Photo is shown 4 times smaller). The spacing comes from the tapped corners (the shorter diagonal over the
patch grid's diagonal, which is the same whichever order the corners were tapped in), not from the
patch positions they imply or from a side over its patch count: with the corners in the wrong order
those bunch together and would call a good Card small. **Least certain:** real
blur and JPEG blocks eat into this, so 24 px may need to rise.

**Corners off the Card.** With the corners tapped in the wrong order the references are not on
the Card and nothing they show says much. The test: sort the readable grays (not blown or crushed)
white to black and count pairs measured in the wrong order. Light, shadows and tone curves squeeze
the order but keep it. Over 51 right-order Photos (every light, tone curve, exposure, shadow
direction and depth, and glare) it counted 0, except 1 to 3 for shadows of a stop or more that
darken the white end or fall from right to left. Of the 23 wrong orders, 7 are a real view of the
Card turned or flipped, and all 7 count 3 or more (3, 4, 7, 8, 11, 12 and 15). The other 16 cross
the taps over, so the Card's map puts every patch at the middle of the taps: the references read
one pixel, the grays are all equal (0 inversions), the frame places are all one spot (the plane is flat)
and nothing is flagged, and the Card check fails. Off the Card, uneven light and Card too small
are skipped, and the result carries `offCard`, which makes the failed-check text blame the corner
order rather than the Card warnings (they were read from the wrong places). With fewer than 3
readable grays the references are taken as placed. Glare and
clipping are not skipped: with no white to compare to, a reference that is partly blown is glare
and one that is mostly blown is exposure, and mostly blown wins.

## Known limits

Every one of these still leaves a signal: with the corners in any of the 23 wrong orders the Card
check fails (24.8 or worse, against a limit of 2), so the Reading is shown uncorrected, and none of
the 23 raises a warning on a clean Photo.

- With the taps crossed over (16 of the 23 wrong orders) the references see one pixel, so no
  Card warning of any kind can come out of them, glare and clipping included. The Spot warnings
  still work.
- With the corners in the wrong order and the exposure also far off, glare can be reported where
  clipped is true. For a warm light at 1.3 times, the 7 turned or flipped orders all report
  clipped; at 2 times, 6 do and 1 reports glare; at 4 times, 5 do and 2 report glare.
- A shadow of about 2.3 stops that darkens the white end, or falls from right to left, inverts up
  to 3 pairs of grays, so the ladder takes the Card for off the Card: uneven light and Card too
  small are then skipped, and the Card check, which fails at that depth, is the signal.
- The uneven-light reading rests on the black frame's width, which is the simulated 16% of the
  patch pitch and not a measured ColorChecker. It holds down to 8% in the simulation (0 and 3 clean
  Photos of 32 over the limit), but a real frame narrower than that, or taps more than 0.2 of a
  patch off (a false alarm of 1.2 stops at 0.3, with the Card check still good), can raise uneven
  light on an evenly lit Photo.
- It misses a ramp of a fifth less light (3 or 4 of 12 found), and a shadow only over the outer
  column of patches (5 of 12): the 15 places are inside the Card.
- In dim light through a steep tone curve, tilted, with heavy JPEG, one clean Photo in 180 raises
  uneven light: its frame is at levels 8 to 11, where one level is 0.3 stops. In Photos two stops
  under-exposed or more, a shadow is found in half the cases at best, and Photos darker than that
  get the "light cannot be checked" warning instead of an answer.
- Glare that covers the whole white patch is reported as clipped: a reflection on the white is the
  same to the engine as a white that is too bright.
- A single clipped channel (a red-heavy light blowing only red) is not flagged.
- A very light soil under warm light can read near the top without clipping; glare on it is called
  clipped.
- A shadow confined to the outer ring of patches does not reach the black frame inside.
- One warning per kind per place. When the light is both blown and crushed the Card gets one
  clipped warning that says both.

## The Page Card

The same checks run on a Page of the soil book (`pageQuality` in `src/engine/readPhoto.ts`). The
Page describes itself the way the ColorChecker does: its 36 or so Chips are the references, with
the /1 column as the tonal ladder (8/1 is the white, the bottom /1 the black); the spacing is the
column pitch in the Photo, the median over the four taps' pairs (a column is 0.66 of a row); and the
evenness samples are the bare white paper, spread over the whole Page.

- **Evenness samples.** The gutters between the columns, down every row (35). A gutter is a fifth
  of a column wide, so its read circle is 0.35 of a Chip's, and it is paper on every hue Page. The
  empty cells at the bottom right are not (they are Chips on another Page), and with them a Page
  read as the wrong hue raised a false "uneven light" over a failed Card check. Before the gutters
  there were 5 samples on 2.5YR, below `MIN_EVEN_SAMPLES` (6), and 6 crowded into one corner on
  10YR, which a plane fit cannot read a shadow across.
- **Limits.** 0.45 stops where the frame's is 0.3, and 3 stops for off the Page. A Page fills most
  of the Photo, so the light falls off across it: the plane fit over the gutters reads 0.11, 0.16,
  0.27 and 0.33 stops on Jon's four real Pages (10YR, 7.5YR, 2.5Y, 5Y: top to bottom the paper is
  0.2 to 0.3 stops darker), and 0.3 raised a false "uneven light" on the 5Y Page. A shadow of half
  the light across the top or left half (one stop) is well over 0.45. Provisional until the real
  Photos run (#15).
- **Spots.** Each Spot is scanned at the radius it was read at, which on a Page is cut to fit a hole
  (`Reading.radius`); scanned at the Photo's usual radius, a Spot in a hole took in the bright Chips
  around it and raised a false "Glare on this Spot".
- **Checked.** No warning on a clean 10YR, 2.5YR or 5Y Page in warm, dim and shift light, flat or
  tilted, noisy and JPEG-compressed, with a Spot beside the Page and one in every hole; no warning
  on any of Jon's four real Pages (with a Spot in two holes and one on the wood beside the Page); a
  shadow over the top half or the left half of a 10YR and a 2.5YR Page is flagged as uneven light; a
  Page 2600 units away (a column under 24 pixels) is flagged small.
