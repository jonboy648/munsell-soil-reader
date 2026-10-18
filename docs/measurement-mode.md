# Measurement mode

A maker tool, not a user feature: it measures the printed swatches of a filament lot against an
X-Rite ColorChecker and writes the batch file the frame card (#49) reads for its patch colors. It
is the camera half of the decision on #50 (ColorChecker baseline plus one outside check, no
spectrophotometer). Open it at `/?measure`; the reader never loads its code.

The code is `src/engine/measure.ts` (the measuring), `src/engine/batchFile.ts` (the file format),
`src/lib/measureSession.ts` (the shots a session holds) and `src/MeasureApp.tsx` (the screen).

## Using it

1. Photograph agent-fab's swatch card (18 tiles, 20 mm, `swatch_01` to `swatch_18` debossed on the
   backs) beside the ColorChecker, in soft daylight. Take several shots from different places.
2. At `/?measure`, take or choose a Photo. Tap the ColorChecker's four corner patches, as in the
   reader.
3. Tap each swatch. The label starts at `swatch_01` and moves on to the first swatch not yet
   tapped, so tapping in order needs no more than the taps. To tap out of order, pick the label
   from the list first. Tapping a swatch that is already down moves it. Undo takes back the last
   tap.
4. The shot's Card check shows as soon as the corners and one swatch are down. Add shot keeps the
   shot and starts the next one.
5. Export batch CSV downloads the means. Name the file for the print batch before the frame card
   reads it.

A shot whose Card check is not good is kept in the list but left out of every mean, and the
screen says which. Remove (the cross) drops a shot.

## What it computes

Each shot is corrected with the reader's own correction and Card check (`fitCard` in
`readPhoto.ts`). Each swatch is read as the median of a circle, corrected, and turned into
CIELAB under D50, the scale the ColorChecker's published values use. Per swatch, across the shots
whose Card check is good: the mean of L, a and b; their sample standard deviation (n - 1; none
for one shot); and the number of shots.

The read circle is half the size of the circle the ColorChecker's nearest patch is read in. A
swatch is 20 mm and a ColorChecker patch about 40 mm, so the circle sits well inside the tile
and shrinks with it when the card is tilted. This leans on those two sizes; the tile is not
detected.

## The batch file

`src/engine/batchFile.ts` writes and reads it, for this tool and for #49 alike.

```
patch,L,a,b,sd_L,sd_a,sd_b,n,method,date
G1,95.12,-0.41,1.20,0.31,0.05,0.12,6,camera vs ColorChecker,2026-10-18
```

- `patch`: the frame slot from `layout.json`, G1 to G6 and S01 to S12. Swatch `swatch_01` to
  `swatch_06` are measured for G1 to G6 and `swatch_07` to `swatch_18` for S01 to S12 (`swatchSlot`).
  That mapping is an assumption taken from the brief ("mapping to the frame slots G1-G6 and
  S01-S12"); it is one table, in one place, if the assignment turns out to be different.
- `L`, `a`, `b`: CIELAB under D50, two decimals.
- `sd_L`, `sd_a`, `sd_b`, `n`: spread and shot count; empty for a value that did not come from
  shots, such as a spectrophotometer's.
- `method`: how it was measured, free text. `camera vs ColorChecker` here.
- `date`: ISO.
- UTF-8, LF, one row per patch, a fixed header. The batch code is the file's name. Fields are
  quoted only when they hold a comma or a quote.

`parseBatchCsv` is what the frame card reads it with. It forgives what a spreadsheet does to a
file (CRLF, a byte order mark, blank lines, the header's case, quoted fields) and refuses what is
wrong for any reader, saying the line (the header is line 1) and the column: a wrong header or
column count, a number that is not one or is out of range (L 0 to 100, a and b within 128, a
spread of 0 or more, n a whole number of 1 or more), a date that is not a real YYYY-MM-DD, an empty
patch or method. It does not know which patch ids a frame has, whether one repeats or whether
the file is complete; the frame card checks those against its layout.

## How accurate it is

From simulated Photos only: a swatch card of known color, 960 x 600, photographed under the engine
tests' lights (neutral, warm, dim, camera color shift), tone curves (0, 0.3 and 0.5) and straight
on or tilted. The error is CIEDE2000 between the measured and the true color of a swatch, for one
shot. The tolerances are in `src/engine/measure.test.ts`, with what was found when they were set:

| Light | Tolerance, every swatch | Found: worst swatch | Found: mean of 18 |
|---|---|---|---|
| neutral, warm, dim | 1.5 | 1.22 (warm, tone curve 0.3) | 0.33 to 0.56 |
| camera color shift | 3.5, except swatch_01: 5.5 | 2.90; swatch_01 5.08 | 0.87 to 1.02 |

Tilting the card (yaw 25, pitch 10) does not move the worst swatch's error at all and the mean by
at most 0.04. Averaging helps little, because most of the error is the correction's and shared
between shots, not noise: two shots, a light and a place apart (warm; neutral and tilted), gave
a mean of 0.44 and a worst of 0.90 for the first, 0.30 and 0.89 for the second, and 0.28 and 0.68
for their average.

Two things the Card check does not see, both visible in the table:

- A swatch lighter than the ColorChecker's own white (L 95.2) is read past the last reference. In
  the color shift light the white clips its blue channel, and a swatch as light as the white
  (`swatch_01`, aimed at N9.5) reads up to 5 dE00 out while the Card check says 0.5 to 0.8. The
  same goes, less sharply, for a swatch darker than the black.
- Nothing here checks for glare, shade or clipping on the swatches: measurement mode does not run
  the reader's Photo quality checks. Shoot in soft, even light.

## The method, in the words the app uses

A camera has three broad channels where a spectrophotometer measures the whole spectrum, so two
materials that match for the camera can differ for the eye. That metamerism leaves roughly 1 to
2 dE00 of systematic error in a camera measurement, which taking more shots does not average
away. So the first lot's swatch card is also sent to a measurement service once (the decision on
#50). If the camera is within about 1 dE00 of it, the camera method stands for later lots; if not,
a spectrophotometer is bought.

This text is in the app, under How this is measured. The app's method page (#13) does not exist
yet; it should link here or take the paragraph.

## Not built

- The shots live in the page. A reload (iOS can drop a page that goes to the camera) loses them.
  Export before leaving, or ask for them to be kept on the device.
- The swatch card's real layout is not known to the app: any layout works, since each swatch is
  tapped. The simulated card is six rows of three.
- The Photo quality warnings of the reader.
