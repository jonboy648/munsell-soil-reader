# NCNE region package

Northcentral and Northeast, ENG Form 6116-8, Sep 2024.

- `index.ts`: the region as data (form version, measured positions of the Soil page's profile table).
- `assets.ts`: the blank Soil page, as a PDF to draw on and a PNG for the preview.
- `page1.pdf`, `page1.png`: page 1 of the official form (header, summary of findings, Hydrology),
  cut and rendered the same way (`node scripts/extract-form-page.mjs <form.pdf> 1 page1.pdf`).
- `hydrologyIndicators.ts`, `hydrology-rules.md`: the Hydrology indicators with their definitions, and the
  digest of the supplement's Chapter 4 they come from.
- `soil-page.pdf`: page 3 of the official form (a US government work, public domain), cut out with
  `node scripts/extract-form-page.mjs <form.pdf> 3 soil-page.pdf`.
- `soil-page.png`: the same page, `pdftoppm -r 144 -png -singlefile soil-page.pdf soil-page`.

The form is a flat PDF with no fillable fields, so every value is drawn at a measured position.
