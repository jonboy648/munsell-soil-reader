# Frame batch files

The frame (ADR 0003) is a Card whose patch colors are measured, once per print batch, because
printed filament colors vary between batches. The measurements travel in a batch file. The app
reads the patches of a frame in a Photo against the colors in its batch file, and refuses the
frame as a Card until every patch has been measured.

## Where the file goes

`src/data/batches/<BATCH CODE>.csv`, named for the batch code printed on the frame, in capitals
(`LOT-A1.csv`). The user types the code on the Card step; the app looks it up. Each file is its
own small chunk, and the service worker precaches them, so a measured batch works offline.

No batch has been measured, so the folder holds no files and every code is refused with
"This frame's batch (CODE) has not been measured yet, so the colors of its patches are not known
and it can't be used as a Card." Do not add made-up values: a made-up batch is a wrong correction.

## The format

A header line, then one row per patch, comma separated, UTF-8. The measurement mode (#54)
exports this format.

```csv
patch,L,a,b,sd,n,method,date
G1,94.8,-0.4,1.9,0.21,5,camera vs ColorChecker,2026-11-02
G2,81.2,-0.5,0.4,0.18,5,camera vs ColorChecker,2026-11-02
S03,47.9,7.9,16.4,0.35,5,camera vs ColorChecker,2026-11-02
```

| Column | Meaning |
| --- | --- |
| `patch` | A patch ID from the frame's layout: `G1` to `G6` (the grays, white to black) and `S01` to `S12` (the soil colors). `R1` to `R4` are reserved for the batch code and are not patches. |
| `L`, `a`, `b` | The measured CIELAB color, illuminant D50 (the ColorChecker's reference values are D50 too). Blank, all three, for a patch that is listed but not measured yet. |
| `sd` | How far the measurements of the patch spread, as a CIEDE2000 distance from their mean. One number per patch. |
| `n` | How many measurements it is the mean of: a whole number, 1 or more. |
| `method` | How it was measured, in words: `camera vs ColorChecker`, `spectrophotometer`. Quote it if it holds a comma. |
| `date` | When, as `YYYY-MM-DD`. |

A file is usable when all 18 patches (six grays and twelve soil colors) have a measured row. With
fewer, the frame is refused, and the message names the patches still to measure. A file that
cannot be read is refused with the line and the reason (`src/engine/batch.ts` has the rules).

The layout the patch IDs belong to is `src/engine/frameLayout.json`, agent-fab's prototype 1
(`layout.json`). A batch is made for one design, so a new layout means new batch files.

## Why the grays matter

The six grays are the tone ladder: the correction draws each channel's curve through them, which
undoes the camera's tone curve before the 3x3 matrix is fitted. They are flagged as the ladder in
the engine, so a gray that is measured badly hurts every Reading. The Card check leaves each patch
out in turn and corrects it with a fit made without it, so a patch measured wrong shows up as a
failed Card check.
