# NCNE region package

Northcentral and Northeast, ENG Form 6116-8, Sep 2024.

- `index.ts`: the region as data (form version, measured positions of page 1's header and Hydrology
  section, of the Soil page's profile table and of the Vegetation pages' rows, totals, plot sizes and remarks).
- `assets.ts`: the blank pages, as PDFs to draw on and PNGs for the previews.
- `page1.pdf`, `vegetation-page.pdf`, `soil-page.pdf`, `vegetation-continued-page.pdf`, `privacy-page.pdf`: pages 1,
  2, 3, 4 and 5 of the official form (a US government work, public domain), each cut out with
  `node scripts/extract-form-page.mjs <form.pdf> <page> <out.pdf>`. Page 1 holds the header, the summary
  of findings and the Hydrology section. Page 5, the Privacy Act page, has nothing to fill.
- `page1.png`, `vegetation-page.png`, `soil-page.png`, `vegetation-continued-page.png`: the same pages,
  `pdftoppm -r 144 -png -singlefile page1.pdf page1`.
- `hydrologyIndicators.ts`, `hydrology-rules.md`: the Hydrology indicators with their definitions, and the
  digest of the supplement's Chapter 4 they come from.
- `plants.json`: the plant list (2022 NWPL for NCNE and its neighbours, with USDA PLANTS names), made by
  `scripts/make_plant_list.py`; see [docs/vegetation.md](../../../../docs/vegetation.md).

Page 1's header lines are filled rectangles about a point thick, each value drawn just above its rule.
The positions in `index.ts` are those rectangles, read from the page's drawing; a test checks every one
of them against `page1.pdf`.

The form is a flat PDF with no fillable fields, so every value is drawn at a measured position.
