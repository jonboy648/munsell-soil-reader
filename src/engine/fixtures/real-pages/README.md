# Real Page Photos

Jon Cackler's Munsell Soil-Color Charts (2009 Revision, 2015 Production), photographed 2026-10-18
on an iPhone, used by `src/engine/realPages.test.ts`. The pages are book pages: no people, places
or personal data are in them.

| File | Page | Behind the holes |
| --- | --- | --- |
| `10yr-fabric.jpg` | 10YR | textured green-gray fabric, warm indoor light |
| `10yr-wood.jpg` | 10YR | wood table, daylight (8/1 and 7/1 are smudged) |
| `7.5yr-wood.jpg` | 7.5YR | wood table, daylight |
| `2.5y-wood.jpg` | 2.5Y | wood table, daylight |
| `5y-wood.jpg` | 5Y | wood table, daylight |

How they were made from the 1512x2016 originals: converted from Display P3 to sRGB (what a browser
gives the app when it opens the original), scaled to 756x1008, and re-encoded as JPEG with no EXIF,
no ICC profile and no other metadata. The originals had no GPS.

The tap coordinates the tests use are in fixture pixels, in the order the app asks for them
(top left /1, last Chip of the top row, lowest Chip of the last column, lowest /1); they are listed
in the `FIXTURES` table at the top of the test file.
