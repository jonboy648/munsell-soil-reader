# Vegetation: the plant list and the Vegetation pages

The Vegetation page of the wetland form (ENG Form 6116-8, Northcentral and Northeast) lists each
plant of each stratum with its absolute percent cover and its wetland indicator status. This is how
the app fills it, and the rules behind it. The rules are the NCNE supplement's (ERDC/EL TR-12-1,
chapter 2, pp. 18-31), in `munsell-reference/plant-list/vegetation-rules.md`. The dominance test,
the prevalence index and the hydrophytic vegetation indicators are #34, not here.

## The data

`src/delineation/regions/ncne/plants.json` is made by `scripts/make_plant_list.py` from three official
files, which are US government data (public domain) and are not in the repository:

| File | What it gives |
| --- | --- |
| `2022_NWPL_NCNE.xlsx` | The NCNE ratings, 2,860 species, and the NWPL common names. |
| `2022_NWPL_National.xlsx` | The ratings of the regions next to NCNE, for plants NCNE does not rate. |
| `USDA_PLANTS_Complete-Checklist_plantlst.txt` | USDA symbols, common names (`fall panicgrass`) and synonyms. The NWPL files have none of these. |

```sh
python scripts/make_plant_list.py --ncne 2022_NWPL_NCNE.xlsx --national 2022_NWPL_National.xlsx \
    --plants USDA_PLANTS_Complete-Checklist_plantlst.txt
```

It keeps the 5,425 species NCNE or a neighbour rates: 394 kB, 119 kB gzipped. It is its own chunk,
loaded when the Vegetation entry is first opened, and the service worker caches it with the rest of
the app, so the lookup works offline. The file also holds a few field abbreviations and common names the
sources lack (`RCG`, `creeping thistle`, `lady's thumb`); they are in the script, and the script checks
each names a plant that is in the list. Add to them as users ask.

Two things about the sources decide how the data is read:

- **The 2022 list has no NI or NO.** Those were ratings of the older lists, and the supplement's rule
  for them (p. 22-23) is still in the supplement. In the 2022 list a plant NCNE does not rate is simply
  not listed, and the NWPL's own user note says to check synonyms and the ratings in adjacent regions
  before assuming UPL. So the app treats "not rated in NCNE, rated next door" as the case the rule was
  written for. The code still reads an explicit NI or NO if a list has one, and the tests run both.
- **PLANTS and the NWPL do not always name a plant alike.** PLANTS accepts *Polygonum persicaria* and lists
  *Persicaria maculosa*, which the NWPL rates, as its synonym, so "lady's thumb" would come back unrated by
  name alone. The script reads PLANTS by symbol, so each NWPL species gets its PLANTS symbol, common name
  and synonyms, and when PLANTS lumps two species the NWPL rates apart (*Persicaria puritanorum*) only the
  one that is the group's accepted name, or whose own common name is the group's, takes them.

## What typing a name does

`resolvePlant(list, typed)` (`src/delineation/vegetation/plantList.ts`). Only an exact, single match
resolves by itself; the user always sees what a name came to before it is added.

1. A field abbreviation (`RCG`) or a USDA symbol (`PHAR3`).
2. A scientific name (author, variety and hybrid sign ignored), then a synonym of one. A plant's own name
   comes before anyone's synonym.
3. A common name, spelled as the NWPL, PLANTS or an alias spells it, ignoring case, spaces and hyphens:
   `fall panicgrass` and `Fall Panic Grass` are one name.
4. The words of a name, the last one possibly unfinished (`lady's thumb`, `fall panic gra`): one plant
   resolves. Plants of one genus with one status resolve to the genus (`Sonchus spp.`, FACU, "identified to
   genus only"). Anything else is candidates.
5. A near miss (`fal panicgrass`): candidates, never a guess.

A name that finds nothing is not on the list. The supplement says to assume UPL for a plant that is not
listed (pp. 22-23), so it is recorded as UPL with a note. If it reads as a scientific name of a genus the
list knows it counts as identified; otherwise (a common name the list does not have, like *stiff
greenthread*) it is recorded as typed, as UPL, and as **not identified**, since the supplement leaves
unidentified plants out of the prevalence index (p. 28) and the app cannot tell what it is. #34 reads
`identified` on each plant.

## The status a plant gets (`statusFor`)

1. The plant's NCNE rating, plus and minus modifiers already gone.
2. If NCNE lists it as NI or NO, or does not rate it: the rating of the nearest adjacent region that
   rates it. The order is Midwest, Eastern Mountains and Piedmont, Atlantic and Gulf Coastal Plain, Great
   Plains (by how much of NCNE's border each shares). The supplement says "the nearest adjacent region"
   and does not name it; this order is an assumption, and it only matters for a plant two neighbours rate
   differently.
3. NI or NO and no adjacent rating: no status. The plant is recorded with its listed NI or NO, and left
   out of the calculations (`status` is null).

The two NCNE subregion exceptions in the NWPL cover page (*Populus tremuloides* and *Rubus idaeus* are FAC
in the Northcentral Great Lakes, FACU elsewhere) are not applied: the project has no subregion yet.

## The pages

Rows are counted over the whole stratum. The Vegetation page has 7 tree, 7 sapling/shrub, 12 herb and 4
woody vine rows; the Continued page has the same rows again, numbered on (tree 8-14, herb 13-24, woody vine
5-8). Plants beyond both are warned about and left off: they go on a separate sheet. Each plant is a row:
scientific name, cover, the Dominant Species? column (blank: #34 fills it), status. A stratum with plants has
its plot size (the supplement's suggestion, 30 ft radius for trees, 15 ft for sapling/shrub, 5 ft for herbs,
30 ft for woody vines, unless the user writes another) and its total cover, which the Continued page repeats
as the official automated data sheet does. The Remarks box takes the vegetation remarks, wrapped to the box.
Values are drawn in Helvetica 8 point, as the soil page's are, with the same text helpers (`text.ts`): a
value too wide for its column is drawn smaller, down to 5 point, then cut with "...". Text the font cannot
print is spelled out (`<=`), loses its marks (`cafe`) or becomes a question mark, with a warning. Remarks
that are longer than the Remarks box are cut at its last line, with a warning.

Where each value sits was measured from the official PDF's own drawing (`regions/ncne/index.ts`).
`vegetationLayout.test.ts` checks every rule a value sits on against the PDF, so a mistyped number shows up.
