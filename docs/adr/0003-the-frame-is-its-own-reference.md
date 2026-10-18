# The frame carries its own measured references

The frame Variety Vault will sell was first sketched as markers around the soil book or a ColorChecker, so the app could find the card's corners without taps. Jon's correction (2026-10-18): the point of the frame is to not need the book. So the frame is a card in its own right: a window for the soil, a gray ladder and soil-range color patches around it, and four ArUco markers. One photo, no book, no ColorChecker, no taps.

Printed filament colors vary between batches, so the patches' true colors are measured with a spectrophotometer once per print batch, and each frame carries a batch code the app uses to load that batch's values. That is how commercial color cards stay honest.

## Alternatives

- Markers around the book or a ColorChecker. Rejected: it saves four taps and still requires the book.
- Calibrate the frame against the soil book with the app itself. Rejected as the primary method: the frame would inherit the book's fading and the camera's errors. It stays useful as a cross-check.
- Embed a store-bought color card in each frame. Rejected: it carries that card's cost in every frame.

## Consequences

- The app gains a `frame` card kind: markers found by the frame finder, references from the batch's measured values, the same correction and card check as the other cards.
- The patches are a gray ladder (for the curve straightening) plus about 12 soil-range colors, because the correction is strongest near its references and soils occupy a small part of color space. This is a deliberate trade against ColorChecker-style saturated patches.
- A spectrophotometer (or a measurement service) becomes part of making frames. Until a batch is measured, its frames cannot be used as a card.
- Matte surfaces are a hard requirement: glare is the app's main failure mode.
- The soil book stays the ground truth for validation (Jon's 20-soil test), even once users no longer need it.
