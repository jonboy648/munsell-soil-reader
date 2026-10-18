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
The reference color target photographed beside the sample: either an X-Rite ColorChecker or a page of the soil book.
_Avoid_: chart, target, checker

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
How well the correction predicts each of the card's references when it is fitted without that reference (leave one out); either good or failed.
_Avoid_: calibration score, fit quality

**Neighbouring chip**:
A chip one step away from another in value, in chroma, or on the next page; a reading "within one chip" is the same chip or a neighbouring one.
_Avoid_: adjacent color, close match

**Log**:
The readings saved on the device, grouped by sample, which can be exported as a spreadsheet.
_Avoid_: history, database, records
