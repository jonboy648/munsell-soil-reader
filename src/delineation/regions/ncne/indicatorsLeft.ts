// The hydric soil indicators printed on the NCNE Soil page (ENG Form 6116-8, Sep 2024), one record per
// printed box, in the order the form prints them: the three columns, top to bottom. Definitions are
// from the NRCS Field Indicators of Hydric Soils in the United States, Version 9.3 (2026) and its Feb 2026
// errata, which is what regulators apply now; where the NCNE supplement (2012) words an indicator
// better, or the Field Indicators point to it, that is the quote. Quotes are copied from the PDFs; page
// numbers are the pages printed on them. The indicator list and the scopes are the form's, not the
// 2012 form's: TA6 is A17, TF12 is F22, and A18, S11 and F10 are new.
//
// `box` is where the blank before each label sits on the official page, measured from the PDF's own
// drawing like the profile table: each blank is a filled rectangle about 1 point thick and 15.1 points
// wide, in three columns (x 38.3, 193.3 and 386.3), and the tick is drawn on it.
import type { Indicator } from "../types"
import { ERRATA, FIELD, LEFT, MASKED, box, entry, field, fi, supplement, texture } from "./indicatorKit"

/** The left column: indicators for all soils, then sandy soils. */
export const LEFT_COLUMN: readonly Indicator[] = [
  entry({
    id: "A1", code: "A1", name: "Histosol", list: "hydric", printed: "Histosol (A1)",
    needs: [texture("Organic layers recorded as muck, mucky peat or peat."), field("That the soil classifies as a Histosol, not a Folist: 16 in or more of the upper 32 in is organic soil material.")],
    criteria: FIELD,
    quote: "Classifies as a Histosol (except Folist) or as a Histel (except Folistel).",
    citations: [fi("p. 11"), supplement("p. 44-45")],
    box: box(LEFT, 338.4),
  }),
  entry({
    id: "A2", code: "A2", name: "Histic Epipedon", list: "hydric", printed: "Histic Epipedon (A2)",
    needs: [texture("An organic surface layer recorded as muck, mucky peat or peat."), field("That it is a histic epipedon (about 8 in or more of organic material) with aquic conditions or artificial drainage.")],
    criteria: FIELD,
    quote: "A histic epipedon underlain by mineral soil material with chroma of 2 or less.",
    citations: [fi("p. 12"), supplement("p. 46")],
    box: box(LEFT, 350.7),
  }),
  entry({
    id: "A3", code: "A3", name: "Black Histic", list: "hydric", printed: "Black Histic (A3)",
    needs: [texture("The layer recorded as peat, mucky peat or muck.")],
    criteria: { kind: "organic", terms: ["muck", "mucky peat", "peat"], thickness: 8, startsWithin: 6, valueMax: 3, chromaMax: 1, hueYellowerThan: "10YR", below: { mineralChromaMax: 2 } },
    quote: "A layer of peat, mucky peat, or muck 20 cm (8 inches) or more thick starting at a depth of 15 cm (6 inches) or less from the soil surface with a hue of 10YR or yellower, value of 3 or less, and chroma of 1 or less and underlain by mineral soil material with chroma of 2 or less.",
    citations: [fi("p. 12"), supplement("p. 47")],
    box: box(LEFT, 363.0),
  }),
  entry({
    id: "A4", code: "A4", name: "Hydrogen Sulfide", list: "hydric", printed: "Hydrogen Sulfide (A4)",
    needs: [field("A hydrogen sulfide (rotten egg) odor within 12 in of the soil surface.")],
    criteria: FIELD,
    quote: "A hydrogen sulfide odor starting at a depth of 30 cm (12 inches) or less from the soil surface.",
    citations: [fi("p. 12"), supplement("p. 47")],
    box: box(LEFT, 375.3),
  }),
  entry({
    id: "A5", code: "A5", name: "Stratified Layers", list: "hydric", printed: "Stratified Layers (A5)",
    needs: [field("Stratification seen in an undisturbed sample, the strata dominantly less than 1 in thick."), MASKED],
    criteria: FIELD,
    quote: "Several stratified layers starting at a depth of 15 cm (6 inches) or less from the soil surface. At least one of the layers has value of 3 or less and chroma of 1 or less, or it is muck, mucky peat, peat, or a mucky modified mineral texture. The remaining layers in the upper 15 cm (6 inches) have chroma of 2 or less. For any sandy material that constitutes the layer with value of 3 or less and chroma of 1 or less, at least 70 percent of the visible soil particles must be masked with organic material when viewed through a 10x or 15x hand lens.",
    citations: [fi("p. 12"), supplement("p. 48-49")],
    box: box(LEFT, 387.6),
  }),
  entry({
    id: "A11", code: "A11", name: "Depleted Below Dark Surface", list: "hydric", printed: "Depleted Below Dark Surface (A11)",
    criteria: {
      kind: "belowDark", share: 60, thickness: 6, starts: { within: 12 }, darkStartsWithin: 6,
      above: [], aboveRest: { valueMax: 3, chromaMax: 2 },
    },
    quote: "A layer with a depleted or gleyed matrix that has 60 percent or more chroma of 2 or less, starting at a depth of 30 cm (12 inches) or less from the soil surface and having a minimum thickness of either 1. 15 cm (6 inches), or 2. 5 cm (2 inches) if the 5 cm consists of fragmental soil material. Organic, loamy, or clayey layer(s) above the depleted or gleyed matrix must have value of 3 or less and chroma of 2 or less starting at a depth of less than 15 cm (6 inches) from the soil surface and extend to the depleted or gleyed matrix. Any loamy fine sand and coarser material above the depleted matrix must have value of 3 or less and chroma of 1 or less starting at a depth of 15 cm (6 inches) or less from the soil surface and extend to the depleted or gleyed matrix.",
    citations: [fi("p. 15"), { document: ERRATA, page: "p. 2" }, supplement("p. 49")],
    box: box(LEFT, 399.8),
  }),
  entry({
    id: "A12", code: "A12", name: "Thick Dark Surface", list: "hydric", printed: "Thick Dark Surface (A12)",
    criteria: {
      kind: "belowDark", share: 60, thickness: 6, starts: { below: 12 }, darkStartsWithin: 6,
      above: [{ startsWithin: 12, valueMax: 2.5, chromaMax: 1 }], aboveRest: { valueMax: 3, chromaMax: 1 },
    },
    quote: "A layer 15 cm (6 inches) or more thick with a depleted or gleyed matrix that has 60 percent or more chroma of 2 or less starting at a depth of more than 30 cm (12 inches) from the soil surface. The layer(s) above the depleted or gleyed matrix and starting at a depth of less than 15 cm (6 inches) from the soil surface must have value of 2.5 or less and chroma of 1 or less to a depth of 30 cm (12 inches) or more and a value of 3 or less and chroma of 1 or less in any remaining layers above the depleted or gleyed matrix. In any loamy fine sand and coarser material above the depleted or gleyed matrix, at least 70 percent of the particles must be masked with organic material when viewed through a 10x or 15x hand lens.",
    citations: [fi("p. 17"), supplement("p. 50-51")],
    box: box(LEFT, 412.1),
  }),
  entry({
    id: "A18", code: "A18", name: "Iron Monosulfide", list: "hydric", printed: "Iron Monosulfide (A18)",
    needs: [field("Positive identification of dark-gray or black iron monosulfide concentrations, at least two separate observations, confirmed by oxidation (a rise in value of 1 or more) or by hydrogen sulfide from dilute hydrochloric acid.")],
    criteria: FIELD,
    quote: "Positive identification of dark-gray or black iron monosulfide concentrations with value of 4 or less and chroma of 2 or less, starting at a depth of 25 cm (10 inches) or less from the soil surface.",
    citations: [fi("p. 20")],
    box: box(LEFT, 424.4),
  }),
  entry({
    id: "A17", code: "A17", name: "Mesic Spodic", list: "hydric", printed: "Mesic Spodic (A17) (MLRA 144A, 145, 149B)",
    scope: { mlra: ["144A", "145", "149B"] },
    needs: [field("Spodic materials (an illuvial accumulation of organic carbon and aluminum, typically a Bh, Bhs or Bhsm horizon) in the layer below the dark one.")],
    criteria: FIELD,
    quote: "A layer that is 5 cm (2 inches) or more thick, that starts at a depth of 15 cm (6 inches) or less from the mineral soil surface, that has value of 3 or less and chroma of 2 or less, and that is directly underlain by either 1. one or more layers of spodic materials that have a combined thickness of 8 cm (3 inches) or more, that start at a depth of 30 cm (12 inches) or less from the mineral soil surface, and that have a value and chroma 3 or less; or 2. one or more layers that have a combined thickness of 5 cm (2 inches) or more, that start at a depth of 30 cm (12 inches) or less from the mineral soil surface, that have a value of 4 or more and chroma of 2 or less, and that are directly underlain by one or more layers that have a combined thickness of 8 cm (3 inches) or more, that are spodic materials, and that have a value and chroma of 3 or less.",
    citations: [fi("p. 19"), supplement("p. 74-75 (as TA6)")],
    box: box(LEFT, 436.0),
  }),
  entry({
    id: "S1", code: "S1", name: "Sandy Mucky Mineral", list: "hydric", printed: "Sandy Mucky Mineral (S1)",
    needs: [texture("The layer's texture recorded with the mucky modifier (mucky sand).")],
    criteria: { kind: "mucky", texture: "sandy", thickness: 2, startsWithin: 6 },
    quote: "A layer of mucky modified sandy soil material 5 cm (2 inches) or more thick starting at a depth of 15 cm (6 inches) or less from the soil surface.",
    citations: [fi("p. 20"), supplement("p. 52")],
    box: box(LEFT, 461.5),
  }),
  entry({
    id: "S4", code: "S4", name: "Sandy Gleyed Matrix", list: "hydric", printed: "Sandy Gleyed Matrix (S4)",
    criteria: { kind: "gleyed", texture: "sandy", startsWithin: 6, share: 60 },
    quote: "A gleyed matrix that occupies 60 percent or more of a layer starting at a depth of 15 cm (6 inches) or less from the soil surface.",
    citations: [fi("p. 21"), supplement("p. 53")],
    box: box(LEFT, 472.5),
  }),
  entry({
    id: "S5", code: "S5", name: "Sandy Redox", list: "hydric", printed: "Sandy Redox (S5)",
    criteria: { kind: "sandyRedox", texture: "sandy", share: 60, startsWithin: 6, thickness: 4, redox: 2 },
    quote: "A layer starting at a depth of 15 cm (6 inches) or less from the soil surface that is 10 cm (4 inches) or more thick and has a matrix with 60 percent or more chroma of 2 or less and 2 or more percent distinct or prominent redox concentrations occurring as soft masses and/or pore linings.",
    citations: [fi("p. 21-22"), supplement("p. 54")],
    box: box(LEFT, 484.6),
  }),
  entry({
    id: "S6", code: "S6", name: "Stripped Matrix", list: "hydric", printed: "Stripped Matrix (S6)",
    needs: [field("A pattern of stripped and unstripped areas: two or more colors with diffuse boundaries, the stripped zones rounded and 10 percent or more of the volume.")],
    criteria: FIELD,
    quote: "A layer starting at a depth of 15 cm (6 inches) or less from the soil surface in which iron-manganese oxides and/or organic matter have been stripped from the matrix and the primary base color of the soil material has been exposed. The stripped areas and translocated oxides and/or organic matter form a faintly contrasting pattern of two or more colors with diffuse boundaries. The stripped zones are 10 percent or more of the volume and are rounded.",
    citations: [fi("p. 22"), supplement("p. 55-56")],
    box: box(LEFT, 499.2),
  }),
]
