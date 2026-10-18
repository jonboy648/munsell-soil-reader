# The soil reader is the instrument; the wetland data form is the output

Jon does wetland delineations and fills the USACE Wetland Determination Data Form by hand. Every soil color on that form is a Munsell reading, and the form's hydric soil indicators are rules over colors and depths. So the reader stops being a standalone color tool with a spreadsheet export and becomes the instrument that fills the form: the Log holds projects and sampling points, each layer's readings become a row of the profile description, and the app suggests indicators for the user to confirm. One app, one deploy, one test suite; the color reader stays usable on its own.

Decided 2026-10-18 with Jon, from his filled JF-1 sheets (Northcentral and Northeast Region, Version 2.0) and the official documents pulled that morning.

## Alternatives

- A second app that reads the Log and fills the form. Rejected: two deploys and two test suites for one workflow, and the form needs readings in a shape (layers with depths, matrix plus redox) the reader should record in the first place.
- Keep the reader as is and leave the form on paper. Rejected: the form is the reason the color is read.

## Consequences

- The Log's shape changes: project, then sampling point, then layers in inches, plus the vegetation plot, hydrology and summary. The flat Sample list and the CSV export remain for people who only want colors.
- The app never decides a regulatory question alone. Indicators and the yes/no conclusions are suggestions with the rule quoted, confirmed by the user. The same stance as USACE's own automated data sheet, whose guide puts verification on the user.
- Region and subregion become data: the form version, indicator set and plant list are chosen per project. Northcentral and Northeast and Midwest first.
- Two things leave the phone only on purpose: an online plant identification photo, and location lookups (soil map unit, NWI class) when the user turns location on.
- The form version tracked is the current official one (ENG Form 6116 series), not the superseded Version 2.0 sheets Jon has on paper.
