# Munsell Soil Reader

Reads the Munsell soil color of soil in a photo, corrected against a color card in the same shot, for people who already describe soil with the Munsell soil book.

## Language

### In the field

**Sample**:
One physical soil specimen, taken from one place at one depth.
_Avoid_: specimen, soil (when the specimen is meant)

**Condition**:
Whether a sample is read moist or dry; the same sample gives a different chip in each.
_Avoid_: state, wetness

### In the photo

**Photo**:
One picture of a sample with the card in it.
_Avoid_: image, shot

**Card**:
The reference color target photographed with the sample: an X-Rite ColorChecker, a page of the soil book, or the frame.
_Avoid_: chart, target, checker

**Frame**:
A printed card with a window for the soil, measured color patches around it and a marker in each corner; the app finds the markers itself, so no corners are tapped. Its patch colors belong to its print batch.
_Avoid_: holder, jig, template

**Page**:
One page of the soil book, holding chips in a grid. Most pages hold one hue, in rows of value and columns of chroma; the 10Y-5GY, Gley and White pages mix hues across the grid. A chip can be printed on more than one page. When a page is used as the card, its chips are the reference colors.
_Avoid_: hue card, sheet

**Spot**:
One tapped place on the soil in a photo; a sample can have several, for example on mottled soil.
_Avoid_: point, sample (for the tapped place), ROI

### In the answer

**Reading**:
What one spot gives: a raw reading straight from the photo, a corrected reading fitted to the card, the nearest chip, and the top candidates.
_Avoid_: result, measurement, match

**Chip**:
One color in the soil book, named by its notation (`10YR 4/3`) and its color name ("brown").
_Avoid_: swatch, patch (patches belong to the card)

**Card check**:
How well the correction predicts each of the card's references when it is fitted without that reference (leave one out); good, caution or failed. Caution still shows the corrected reading, with the raw one beside it.
_Avoid_: calibration score, fit quality

**Neighbouring chip**:
A chip one step away from another in value, in chroma, or on the next page; a reading "within one chip" is the same chip or a neighbouring one.
_Avoid_: adjacent color, close match

**Left out**:
A Chip on the Page that the fit sets aside because it disagrees with the rest, as a smudged or worn Chip does; the Card check names the Chips it left out.
_Avoid_: ignored, excluded, rejected

**Log**:
Everything saved on the device: projects, sampling points, layers and their readings. It can be exported as a spreadsheet or as forms.
_Avoid_: history, database, records

### In the delineation

**Project**:
One wetland delineation job: a site, a region and subregion, the people doing it, and its sampling points.
_Avoid_: job, site (when the whole delineation is meant)

**Sampling point**:
One place on a project where the soil, vegetation and hydrology are recorded; it fills one form.
_Avoid_: plot (that is the vegetation plot), station, pit

**Layer**:
One depth range of soil at a sampling point, top and bottom in inches, with its matrix reading and any redox readings; one row of the form's profile description.
_Avoid_: horizon, sample (when the depth range is meant)

**Plot**:
The vegetation plot at a sampling point: the plants of each stratum with their cover.
_Avoid_: quadrat, transect

**Indicator**:
One named test from the regional supplement or the hydric soil field indicators (`A12 Thick Dark Surface`, `F3 Depleted Matrix`); the form has a box for each.
_Avoid_: criterion, flag

**Suggestion**:
An indicator the app finds satisfied by the recorded data, shown with the rule it used; it becomes a tick on the form only when the user confirms it.
_Avoid_: auto-fill, result

**Form**:
The USACE Wetland Determination Data Form for one sampling point, in its current official version for the project's region.
_Avoid_: data sheet (the Excel version is the "automated data sheet"), report

**Region**:
One of the USACE regional supplements (Northcentral and Northeast, Midwest); it decides the form, the indicators and the plant list.
_Avoid_: area, zone

**Subregion**:
The LRR or MLRA a project lies in; some indicators apply only in certain subregions.
_Avoid_: district
