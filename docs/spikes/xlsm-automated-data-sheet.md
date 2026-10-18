# Spike: filling USACE's Excel automated data sheet from a browser (#39)

Parent spec: #29 (Output, Excel). Run 2026-10-18. Not a feature: nothing here ships, and the official
workbook is not in the repo.

Subject: `ENG_Form_6116-8_Northcentral-Northeast_Automated_Data_Sheet.xlsm`, 3,094,837 bytes, footer
"ENG FORM 6116-8, SEP 2024 / Northcentral and Northeast - Version 2.0", six sheets (Page 1 (Hydrology),
Page 2 (Vegetation), Page 3 (Soil), Vegetation Continued, Privacy Act Information, and a very hidden
Plant List). Tested with Excel 16.0 (build 20430) on this machine, SheetJS Community 0.20.3, ExcelJS
4.4.0, fflate 0.8.3, Edge 155 (headless) for the in-browser run.

## Verdict

Yes, a browser can do it, with one approach: edit the sheet XML inside the .xlsm zip and leave every other
part alone (approach 3). Excel opens the result with no repair dialog, the VBA is byte-identical and runs,
and the workbook's own formulas compute the dependent cells (plant status, dominants, dominance test,
prevalence index, hydric soil and hydrology ticks, the summary). A library round trip does not work:
SheetJS keeps the VBA blob but strips the form (styles, dropdowns, protection, controls); ExcelJS drops the
VBA outright. The plain-workbook fallback in #29 is not needed.

Three traps cost a failed open or wrong numbers each, so they are rules, not tips (see "Rules").

## How the workbook is built (what drives the answer)

- 51 zip parts. Input cells are the unlocked cells: 43 of the 251 cell formats carry `locked="0"`; every
  sheet is protected, so only those cells take typing. The cell map below lists the 80 input cells on Page 1,
  147 on Page 3, 100 on Page 2 and 91 on Vegetation Continued.
- Two mechanisms do the automation, and they behave differently under a file edit:
  - Formulas (about 5,600 across the four form pages, in hidden helper columns to the right of the print area)
    compute plant status, dominance, prevalence index, every hydric soil indicator, the hydrology ticks and
    the Yes/No summary. A tick cell with a default formula (for example Page 1 B27 `=AT27`) shows an
    automatic "X"; typing a literal "X" over it is what a double-click does.
  - Event macros: `Worksheet_BeforeDoubleClick` toggles an "X" (and puts the formula back when unticked),
    `Worksheet_Change` on the soil sheet runs `ColorContrast` and `ReducedMatrix` (they write the
    "Faint/Distinct/Prominent redox concentrations" remark into column AY and a hydric-soil remark into
    B40), `Workbook_Open` re-protects the sheets and hides Vegetation Continued unless a stratum's last
    row is used. None of these fire when we edit the XML.
- `vbaProject.bin` is unsigned. The password that protects the sheets is inside the VBA, so
  protection is a guard rail, not a barrier. We never touch it.
- The VBA contains an importer: `Module1.Import_Field_Data_for_ADS` (with `Soil_Import`, `Veg_Import`),
  behind a button on Page 1, reads an Esri Survey123 "Field Data for ADS" export workbook and writes the
  same input cells. Read from the source, not run (it opens a file dialog). It is a documented second
  route (see Risks) and a cross-check on the cell map below: every input cell it writes is in the map. It also
  writes two helper cells, Page 1 AT2 (the export's file name) and Page 3 DA8 (see rule 7).
- The user guide (ERDC/TN WRAP-17-1, July 2017, "Data Entry") defines the three entry methods the map
  follows: double-click to put an "X", drop-downs, manual entry. It also fixes the formats: depth as
  `start-end` in inches starting at 0, colors as `hue[space]value/chroma` (neutral `N 2.5/`), matrix and
  redox percentages adding to 100, plant names as scientific name, common name (typed after a leading
  space) or synonym. It tells users to open a fresh copy each time, which is what bundling the pristine
  workbook and filling a copy does.

## Approaches tried

Every approach filled the same 34 cells (header, hydrology observations, two soil layers with a redox
feature, three herb plants with cover), then was opened in Excel through COM. Excel macro security was
forced off for the plain opens and on for the macro runs; alerts were on for the repair checks.

### 1. SheetJS CE, `bookVBA: true`, write as xlsm

| Check | Result |
|---|---|
| File | 3,094,837 -> 7,900,393 bytes (27,680,818 if the zip is not compressed, the default) |
| Opens in Excel | Yes, no error. `HasVBProject` True |
| `vbaProject.bin` | Byte-identical (SHA-256 ea3af372f433a665..., 324,608 bytes) |
| Formulas, merges, defined names | Kept (71 / 1,183 / 4,279 / 68 formulas per sheet, 13 names, Plant List still very hidden) |
| Formulas recalculated | Yes: plant status, dominants, prevalence index 2.2, Hydric Soil Present X, hydrology X |
| Lost | Styles (251 cell formats -> 6, 38 fonts -> 1, 33 fills -> 2, 22 borders -> 1, and none of the 43 unlocked flags); all 14 data validations; all 31 conditional-format blocks; sheet protection on all 6 sheets; the ActiveX combo box and the check-box form controls; both drawings; column widths; page setup and the 6 printer settings; calcChain |
| Looks like | An unformatted grid: labels truncated, no underlines, no boxes (page 1 rendered through Excel's PDF export) |

Verdict: macros present and automation populates, but it is no longer the official form. Not acceptable.

### 2. ExcelJS

| Check | Result |
|---|---|
| File | 2,288,015 bytes |
| `vbaProject.bin` | Dropped. ExcelJS has no VBA support and writes the non-macro content type |
| Saved as `.xlsm` | Excel refuses: "Excel cannot open the file ... because the file format or file extension is not valid" |
| Same bytes renamed `.xlsx` | Opens, `HasVBProject` False, formulas recalculate, but no macros |
| Also changed | ActiveX, form controls, drawings, printer settings, calcChain dropped; styles rewritten (251 -> 218 cell formats, 34 of the 43 unlocked flags kept, fills 33 -> 2); data validations re-split (Page 2 3 -> 16, Page 3 6 -> 17); one fewer formula element on Page 2 (1,183 -> 1,182, not investigated) |

Verdict: loses the macros by design. Not acceptable.

### 3. Zip surgery (edit only the cells' XML)

Unzip with fflate, find each `<c r="X">` in the sheet part, replace it (text as an inline string, number as
`<v>`, keeping its `s=` style), re-zip with the same part list. Code: `docs/spikes/xlsm-fill-spike.mjs`
(about 160 lines, no copy of the workbook).

Package diff against the original, 110-cell build (inflated bytes): 43 of 51 parts identical, including
`vbaProject.bin`, `styles.xml`, `sharedStrings.xml`, all comments, drawings, ActiveX, control properties and
printer settings. Changed: `workbook.xml` (calcPr), `[Content_Types].xml`, `workbook.xml.rels`, and the four
sheet XMLs. Removed: `calcChain.xml`. Size 3,094,837 -> 2,750,495 (re-deflated at level 6, no data lost).
Time 1.3 to 3.1 s in Node.

What Excel did with each build:

| Build | Excel |
|---|---|
| A. 34 value cells, `fullCalcOnLoad="1"`, calcChain removed | Opens, no dialog (visible Excel, alerts on). Every dependent cell recomputed with no forced calculation: AM status FACW/FACW/FACU, dominance 2 of 2 = 100%, prevalence index 2.20, Hydrology X, Hydric Soil X |
| B. Same without `fullCalcOnLoad` | Opens, but every formula cell shows its stale cached value: the form still says Hydrophytic Vegetation "No", status and totals blank, until someone recalculates |
| C. Four formula cells replaced by a literal "X", calcChain kept | Excel will not open it ("Unable to get the Open property of the Workbooks class", the same error a deliberately malformed file gives) |
| D. Same, calcChain removed | Opens |
| E. The top-left cell of a shared formula group replaced (Page 2 AM24, group AM24:AM35) | Will not open. With the other 11 cells of the group rewritten as plain formulas first, it opens and AM25 to AM35 still compute |
| F. Opened in Protected View (`ProtectedViewWindows.Open`) | Inputs show, every computed cell is blank (stale cache), until Enable Editing |
| G. Page 3 B23 (A4) and DA8 (a helper cell that is absent from the XML, so inserted) set to X | Opens with no dialog; Soil A4 X and Page 1 C1 X |
| Macros enabled (A and the 110-cell build) | `Workbook_Open` ran: it hid Vegetation Continued in build A (last stratum rows empty) and left it visible in the 110-cell build (a last herb row is used). `Application.Run "Module1.ColorContrast"` wrote "Prominent redox concentrations" into Page 3 AY7 from our matrix 10YR 4/1 and redox 10YR 4/6 |

110-cell build: header text with `&`, `<`, `>`, `"`, accented letters, a degree sign, line breaks and leading spaces;
four soil layers with a second redox feature on a continuation row; every vegetation stratum; Vegetation
Continued; four formula cells replaced; one shared group unshared. Excel read back all 110 cells equal to what
was written, and recomputed the dominance test (13 of 14 dominant species are OBL, FACW or FAC, 92.9%),
prevalence index 2.01 and Hydric Soil Present X.
Rendered through Excel's PDF export the pages match the official layout (17 pages, same as the untouched
workbook) with the entries and the computed fields in place.

The shared-formula rewrite (`shiftFormula`) was checked against an independent reader: it unshared every
shared group on Pages 1 to 3 and the 5,175 resulting formulas equal what SheetJS derives from the same XML
(0 differences).

In a real browser: the same module, run in headless Edge 155 against the real workbook served from
localhost:4184, took 1.7 s to fill and re-zip and produced output identical to the Node build (50 of 50
parts, same size). JS heap read 402 MB after the run (not forced to collect).

## Rules (each one is backed by a build above)

1. Set `fullCalcOnLoad="1"` on `<calcPr>` in `workbook.xml` (build B).
2. Remove `calcChain.xml`, its relationship and its content-type override whenever any formula cell is
   replaced; Excel rebuilds it (C, D). Dropping it always is simpler and was safe.
3. When replacing the top-left cell of a shared formula group (`<f t="shared" ref=... si=N>`), rewrite the
   group's other cells as plain formulas first (E). The tick and status columns are full of these.
4. Write text as `t="inlineStr"` with `xml:space="preserve"`, numbers as `<v>`, keep the cell's `s=`. Text
   cells here are formatted as Text, so "0-8" stays text. Escape `& < >`, strip control characters.
5. A blank (`<c r= s=/>`) is a real value: it replaces an automatic tick and turns it off (checked: in that
   build, blanking Page 1 B27 removed the A2 tick and Wetland Hydrology Present, otherwise X, went blank).
6. Touch nothing else. Dependent cells are never written; the workbook computes them.
7. Some hidden helper cells that macros set are absent from the sheet XML, so they must be inserted in column
   order inside their row (the module does this). The one that matters is Page 3 DA8: a double-click on
   Hydrogen Sulfide (A4, B23) sets it, and it is what turns on Page 1 C1. To tick A4 the way the sheet does,
   write B23 and DA8 together (G). The ADS cannot verify hydrogen sulfide, so this stays the user's call.

## Recommendation for #40

Use approach 3. Bundle the pristine official workbook as a static asset (3.1 MB; the service worker must
cache it for offline export), fetch it, run `fillWorkbook`-style code, and hand the bytes to the share sheet
or a download as `application/vnd.ms-excel.sheet.macroEnabled.12`. No server, no upload.

- Make it a pure function over the form engine's output: `(workbookBytes, cellValues) -> bytes`. The cell
  map below is region data (one per ENG form and version), not code.
- Pin the workbook by SHA-256 and refuse to fill any other file; the map is only valid for the exact file
  it was read from. Fixture test: the map's cells must equal the workbook's unlocked cells (this spike's
  check did exactly that: 0 unmapped and 0 mapped-but-locked once Vegetation Continued B45 was added).
- Write only values the user entered or confirmed, plus a literal "X" for confirmed ticks. Let the
  workbook's formulas compute everything else. Open question for Jon, because #29 story 41 says unconfirmed
  suggestions stay blank on the PDF: the ADS ticks its own indicators from the data (that is the product,
  and it carries USACE's disclaimer). Recommended: leave the ADS automation on, say so on the export
  screen, and write a blank over a tick only for an indicator the user explicitly rejected (rule 5).
- Plant names: write the scientific name exactly as in the workbook's own Plant List (29,717 names with an
  NCNE and an NCGL status column; the sheet does not state its NWPL year). Add a fixture comparing the
  app's plant list with that sheet's statuses. A name not on the list gets a status typed into AM (UPL for
  unlisted species, #29 story 26); rule 3 is what makes that safe.
- Colors: only strings from the workbook's own list (Page 3 BO59:BO494, 436 entries, 20 hues, neutral as
  `N 2.5/`). Dropdown validation does not run on file edits, so the app must enforce the list.
- Depth is text `start-end` in inches from 0; percentages are whole numbers; texture, type and location
  use the dropdown values listed in the map.
- Export screen wording: "Open in Excel, click Enable Editing, then Enable Content." Without Enable Editing
  the computed cells are blank (build F). Say that the ADS verifies nothing for the user.
- CI cannot open Excel. Test by reading the produced XML back (SheetJS in the test only) and asserting the
  part list and the `vbaProject.bin` hash are unchanged; one manual Excel pass by Jon belongs in the
  acceptance step.

## Input cell map

Sheet names are exact. Text cells are written as strings, "n" cells as numbers, tick cells as the literal
"X" (put it in one of a Yes/No pair, never both). `*` marks a cell whose default content is a formula (it
shows an automatic X); a literal value replaces the formula, an empty cell switches it off. Merged ranges
are written at the top-left cell shown. Derived from the unlocked cells, the merged ranges and the VBA
importer, and cross-checked by script (see Reproduce).

### Page 1 (Hydrology)

| Field | Cell |
|---|---|
| Project/Site | G2 |
| City/County | AC2 |
| Sampling Date (text, e.g. 10/18/2026) | AP2 |
| Applicant/Owner | I3 |
| State (list: CT IL IN ME MA MI MN NH NJ NY OH PA RI VT WI) | AI3 |
| Sampling Point | AQ3 |
| Investigator(s) | H4 |
| Section, Township, Range | AI4 |
| Landform / Local relief / Slope % | M5 / AH5 / AR5 |
| Subregion (list of 32, "LRR K" to "LRR S, MLRA 149B", Page 1 AV55:AV86) | L6 |
| Lat / Long / Datum | S6 / AE6 / AP6 |
| Soil Map Unit Name / NWI classification | I7 / AL7 |
| Climatic or hydrologic conditions typical: Yes / No | AD8 / AH8 |
| Vegetation, Soil, Hydrology significantly disturbed | H9, L9, Q9 |
| Vegetation, Soil, Hydrology naturally problematic | H10, L10, Q10 |
| Normal Circumstances present: Yes / No | AO9 / AR9 |
| Hydrophytic Vegetation Present: Yes / No | Q12* / S12* |
| Hydric Soil Present: Yes / No | Q13* / S13* |
| Wetland Hydrology Present: Yes / No (summary) | Q14* / S14* |
| Sampled Area within a Wetland: Yes / No | AJ13* / AN13* |
| Wetland Site ID | AI14 |
| Remarks (B17:AS22) | B17 |
| Primary indicators, column B: A1 B26*, A2 B27*, A3 B28*, B1 B29, B2 B30, B3 B31, B4 B32, B5 B33, B7 B34, B8 B35* | B26 to B35 |
| Primary indicators, column P: B9 P26, B13 P27, B15 P28, C1 P29*, C3 P30, C4 P31*, C6 P32, C7 P33*, Other P34 | P26 to P34 |
| Secondary indicators: B6 AE25, B10 AE26, B16 AE27, C2 AE28*, C8 AE29, C9 AE30, D1 AE31, D2 AE32, D3 AE33*, D4 AE34, D5 AE35* | AE25 to AE35 |
| Surface Water Present: Yes / No / depth (n, inches) | M38 / Q38 / W38 |
| Water Table Present: Yes / No / depth | M39 / Q39 / W39 |
| Saturation Present: Yes / No / depth | M40 / Q40 / W40 |
| Wetland Hydrology Present: Yes / No (field box) | AO40* / AR40* |
| Describe Recorded Data (B43:AS44) / Remarks (B46:AS53) | B43 / B46 |

### Page 3 (Soil)

Twelve layer rows, 6 to 17. For row r: depth `B{r}`, matrix color `H{r}`, matrix % `R{r}` (n), redox color
`V{r}`, redox % `AE{r}` (n), type `AI{r}` (C, D, RM, MS), location `AM{r}` (PL, M, PL/M), texture `AQ{r}`
(Loamy/Clayey, Sandy, Mucky Loam/Clay, Mucky Sand, Muck, Mucky Peat, Peat) and remarks `AY{r}` (AY:BM; the
macro puts the redox contrast here). A further redox feature of the same layer goes on the next row with
only `V`, `AE`, `AI`, `AM` filled (matrix, depth and texture blank); the sheet warns otherwise.

| Field | Cell |
|---|---|
| Restrictive layer type (G36:X36) / depth (n, K37:X37) | G36 / K37 |
| Hydric soil indicators, column 1: A1 B20*, A2 B21*, A3 B22*, A4 B23*, A5 B24*, A11 B25*, A12 B26*, A17 B27*, A18 B29*, S1 B30*, S4 B31*, S5 B32*, S6 B33* | B20 to B33 |
| Column 2: S7 V20*, S8 V21*, S9 V23*, S11 V24*, F1 V25*, F2 V26*, F3 V27*, F6 V28*, F7 V29*, F8 V30*, F10 V31*, F21 (MLRA 145) V32* | V20 to V32 |
| Problematic: A10 AT20*, S3 AT21*, S8 (K, L) AT22*, S9 (K, L) AT23*, F12 AT24*, F19 AT25*, F21 (outside 145) AT26*, F22 AT27*, Other AT28 | AT20 to AT28 |
| Hydric Soil Present: Yes / No | BE37* / BI37* |
| Remarks (B40:BN54) | B40 |

### Page 2 (Vegetation)

Per plant: scientific name `D{r}`, absolute % cover `AA{r}` (n, whole number), status `AM{r}*` (OBL, FACW,
FAC, FACU, UPL; write only to override). The Dominant? column (`AG`), totals and both worksheets are
computed. Plot size is text.

| Stratum | Plot size | Plant rows | Total (computed) |
|---|---|---|---|
| Tree | N3 | 4 to 9, and 10 (merged 10:11) | AA12 |
| Sapling/Shrub | R13 | 14 to 19, and 20 (merged 20:21) | AA22 |
| Herb | N23 | 24 to 35 | AA36 |
| Woody Vine | R37 | 38 to 41 | AA42 |

| Field | Cell |
|---|---|
| Indicator ticks: 1 Rapid Test / 4 Morphological Adaptations / Problematic (2 and 3 are computed in AT23, AT24) | AT22 / AT25 / AT27 |
| Hydrophytic Vegetation Present: Yes / No | BC41* / BH41* |
| Remarks (B45:BM50) | B45 |

Two check boxes (form controls) are linked to BN3 ("passed the Rapid Test, do not calculate the Dominance
Test") and BN11 ("do not calculate the Prevalence Index"). Not exercised in this spike.

### Vegetation Continued

Same grid, no plot sizes or indicators: tree rows 4 to 9 and 10, shrub 14 to 19 and 20, herb 24 to 35, vine
38 to 41 (`D`, `AA`, `AM*`), remarks B45. Its totals feed Page 2's. The workbook shows this sheet only when a
stratum's last row on Page 2 is used (Workbook_Open hides it otherwise), so fill it only for overflow.

## Risks

- Protected View and previewers show blank computed cells (build F): the cached values are the empty
  form's. Excel for the web, Quick Look and mail previews were not tried; expect the same. The app could
  write cached `<v>` values for the cells its own engine computes; not tried, and large.
- Macros only matter inside Excel, and only after Enable Content. Our edits do not fire events, so the
  redox contrast remark (AY) and the reduced-matrix remark (B40) stay blank until the user edits the soil
  sheet; either leave them or compute them in the app. Mac Excel, Excel for iOS and Excel Online were not
  tested (iOS and the web do not run VBA at all).
- The workbook is the form's moving part. USACE revised the form in 2018 and 2024, the user guide is from
  2017, and the Midwest workbook (ENG Form 6116-7) is a different layout. The map is per file; a new
  workbook means re-deriving it, and the unlocked-cell cross-check makes that quick.
- Coupled cells: a literal tick on one sheet can tick its partner. In the 110-cell build, a literal X on
  Page 1 C1 (P29) came back with Soil A4 (B23) ticked, and A4 reaches C1 only through DA8 (rule 7). Treat
  such a pair as one decision.
- Memory and time on a phone. Page 2's XML is 13.5 MB and Vegetation Continued's 4.4 MB (the helper area
  runs to row 30,000); inflating everything gave a 402 MB JS heap in Chromium. iOS Safari was not tried.
  Cheap mitigation: copy untouched zip entries at the container level (which also keeps them byte-identical
  compressed) and inflate only the four sheets. Do this if Jon's iPhone check shows a problem.
- The workbook is a US federal work, 3.1 MB. Not committed here (the ticket says so); #40 decides how it
  ships and records the source URL and hash.
- Second route if surgery ever breaks: write a plain Survey123-shaped .xlsx (SheetJS is fine for that) and
  have the user press the ADS's own Import button. The column layout is in `Import_Field_Data_for_ADS`,
  `Soil_Import` and `Veg_Import`. Not run here, needs Enable Content, and the user does extra steps; keep
  it as a reserve, not the plan.
- Not tested: Mark of the Web from a real download (Protected View was reproduced with
  `ProtectedViewWindows.Open`), the two check-box controls, an off-list color or plant name, and Excel on
  Mac.

## Reproduce

Everything but the module lives outside the repo (the workbook copy was never modified). The surgery module
is `docs/spikes/xlsm-fill-spike.mjs`; the rest was throwaway:

- Packages: `xlsx` 0.20.3 from cdn.sheetjs.com, `exceljs` 4.4.0, `fflate` 0.8.3, `oletools` (olevba) to read
  the VBA, `playwright-core` driving the installed Edge for the browser run.
- Excel checks: PowerShell COM. Open with macros off or on (`AutomationSecurity`), read cells back,
  `ProtectedViewWindows.Open`, `ExportAsFixedFormat` for the render, and a visible instance with alerts on
  plus a UI Automation watcher to catch repair dialogs. A deliberately malformed file calibrated it: Excel
  throws on open rather than showing a dialog, which is how builds C and E failed.
- Cell map: unlocked styles from `styles.xml`, merged anchors and the VBA importer, cross-checked by a
  script that lists unlocked cells not in the map and mapped cells that are locked.
