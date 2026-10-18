# Munsell Soil Reader

Photograph soil next to an X-Rite ColorChecker Classic (24 patches), tap the card's four
corners and then the soil, and read its Munsell soil color, corrected for the light and the
camera. Runs entirely in the browser; photos are never uploaded.

- `site/index.html`: the website (static, one file). Deploy this folder.
- `logic.js`: the color math (card fit, CIEDE2000, Munsell lookup). Pure functions, no DOM.
- `app.html` + `app.js`: the page. `python build.py` assembles `site/index.html`.
- `page.html` + `page.js`: the original prototype with guided walkthroughs (builds to `munsell-prototype.html`).

How it reads a color: median of the tapped pixels, a 3x3 correction fitted to the 24 card
patches (ColorChecker "after November 2014" reference values), conversion to Munsell with
[munsell.js](https://github.com/privet-kitty/munsell.js) (MPL-2.0), then the nearest chip by
CIEDE2000. The chip grid (10R to 5Y, values 2.5 to 8, chromas 1 to 8) approximates the soil
book; it is not the official chip list.

Limits: the examples use a simulated camera, so real photos do somewhat worse. A card in the
shot, in the same light as the soil, is required for a corrected reading.
