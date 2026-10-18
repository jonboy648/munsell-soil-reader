# NCNE region package

Northcentral and Northeast, ENG Form 6116-8, Sep 2024.

- `index.ts`: the region as data (form version, measured positions of the Soil page's profile table and
  of the Vegetation pages' rows, totals, plot sizes and remarks).
- `assets.ts`: the blank Soil, Vegetation and Vegetation Continued pages, each as a PDF to draw on and a
  PNG for the preview.
- `plants.json`: the plant list (2022 NWPL for NCNE and its neighbours, with USDA PLANTS names), made by
  `scripts/make_plant_list.py`; see [docs/vegetation.md](../../../../docs/vegetation.md).
- `vegetation-page.pdf` and `vegetation-continued-page.pdf`: pages 2 and 4 of the official form, cut out
  the same way as the Soil page (`node scripts/extract-form-page.mjs <form.pdf> 2 vegetation-page.pdf`).
- `soil-page.pdf`: page 3 of the official form (a US government work, public domain), cut out with
  `node scripts/extract-form-page.mjs <form.pdf> 3 soil-page.pdf`.
- `soil-page.png`: the same page, `pdftoppm -r 144 -png -singlefile soil-page.pdf soil-page`.

The form is a flat PDF with no fillable fields, so every value is drawn at a measured position.
