// The right column of the Soil page: indicators for problematic hydric soils. Where the form prints the
// same indicator in both lists (S8, S9, F21) the right-hand box has its own record, with its own scope.
// See indicatorsLeft.ts for the sources.
import type { Indicator } from "../types"
import { FIELD, MASKED, RIGHT, box, entry, field, fi, supplement, texture } from "./indicatorKit"

export const RIGHT_COLUMN: readonly Indicator[] = [
  entry({
    id: "A10", code: "A10", name: "2 cm Muck", list: "problematic", printed: "2 cm Muck (A10) (LRR K, L, MLRA 149B)",
    scope: { lrr: ["K", "L"], mlra: ["149B"] },
    needs: [texture("The layer recorded as muck (sapric). Mucky peat and peat do not qualify.")],
    criteria: { kind: "organic", terms: ["muck"], thickness: 0.75, startsWithin: 6, valueMax: 3, chromaMax: 1 },
    quote: "A layer of muck 2 cm (0.75 inch) or more thick with value of 3 or less and chroma of 1 or less, starting at a depth of 15 cm (6 inches) or less from the soil surface.",
    citations: [fi("p. 15"), supplement("p. 68-69")],
    box: box(RIGHT, 338.1),
  }),
  entry({
    id: "S3", code: "S3", name: "5 cm Mucky Peat or Peat", list: "problematic", printed: "5 cm Mucky Peat or Peat (S3) (LRR K, L, R)",
    scope: { lrr: ["K", "L", "R"] },
    needs: [texture("The layer recorded as mucky peat or peat, with a sandy layer below it.")],
    criteria: { kind: "organic", terms: ["mucky peat", "peat"], thickness: 2, startsWithin: 6, valueMax: 3, chromaMax: 2, below: { sandy: true } },
    quote: "A layer of mucky peat or peat 2 in. (5 cm) or more thick with a value of 3 or less and chroma of 2 or less, starting within 6 in. (15 cm) of the soil surface, and underlain by sandy soil material.",
    citations: [supplement("p. 69"), fi("p. 21")],
    box: box(RIGHT, 350.4),
  }),
  entry({
    id: "S8-problematic", code: "S8", name: "Polyvalue Below Surface", list: "problematic", printed: "Polyvalue Below Surface (S8) (LRR K, L)",
    scope: { lrr: ["K", "L"] },
    needs: [MASKED, field("Where the spodic horizon begins, if it is above 12 in.")],
    criteria: FIELD,
    quote: "A layer with a value of 3 or less and chroma of 1 or less starting at a depth of 15 cm (6 inches) or less from the soil surface. At least 70 percent of the visible soil particles must be masked with organic material when viewed through a 10x or 15x hand lens. Directly below this layer, 5 percent or more of the soil volume has a value of 3 or less and chroma of 1 or less, and the remainder of the soil volume has value of 4 or more and chroma of 1 or less to a depth of 30 cm (12 inches) or to the spodic horizon.",
    citations: [fi("p. 23-24"), supplement("p. 57, 70-71")],
    box: box(RIGHT, 362.8),
  }),
  entry({
    id: "S9-problematic", code: "S9", name: "Thin Dark Surface", list: "problematic", printed: "Thin Dark Surface (S9) (LRR K, L)",
    scope: { lrr: ["K", "L"] },
    needs: [MASKED, field("Where the spodic horizon begins, if it is above 12 in.")],
    criteria: FIELD,
    quote: "A layer 5 cm (2 inches) or more thick, starting at a depth of 15 cm (6 inches) or less from the soil surface, with value of 3 or less and chroma of 1 or less. At least 70 percent of the visible soil particles must be masked with organic material when viewed through a 10x or 15x hand lens. This layer is underlain by a layer or layers with value of 4 or less and chroma of 1 or less to a depth of 30 cm or a spodic horizon.",
    citations: [fi("p. 24"), supplement("p. 59, 70-71")],
    box: box(RIGHT, 375.1),
  }),
  entry({
    id: "F12", code: "F12", name: "Iron-Manganese Masses", list: "problematic", printed: "Iron-Manganese Masses (F12) (LRR K, L, R)",
    scope: { lrr: ["K", "L", "R"] },
    needs: [field("That the soil is on a floodplain, and that the masses are soft iron-manganese masses with diffuse boundaries (not nodules or concretions).")],
    criteria: FIELD,
    quote: "On floodplains, a layer 4 in. (10 cm) or more thick with 40 percent or more chroma of 2 or less and 2 percent or more distinct or prominent redox concentrations occurring as soft iron-manganese masses with diffuse boundaries. The layer occurs entirely within 12 in. (30 cm) of the soil surface. Iron-manganese masses have a value and chroma of 3 or less. Most commonly, they are black. The thickness requirement is waived if the layer is the mineral surface layer.",
    citations: [supplement("p. 71"), fi("p. 28-29")],
    box: box(RIGHT, 387.5),
  }),
  entry({
    id: "F19", code: "F19", name: "Piedmont Floodplain Soils", list: "problematic", printed: "Piedmont Floodplain Soils (F19) (MLRA 149B)",
    scope: { mlra: ["149B"] },
    needs: [field("That the soil is on an active floodplain.")],
    criteria: FIELD,
    quote: "On flood plains, a mineral layer 15 cm (6 inches) or more thick, starting at a depth of 25 cm (10 inches) or less from the soil surface, with a matrix (60 percent or more of the volume) chroma of less than 4 and 20 percent or more distinct or prominent redox concentrations occurring as soft masses or pore linings.",
    citations: [fi("p. 31"), supplement("p. 72")],
    box: box(RIGHT, 399.8),
  }),
  entry({
    id: "F21-outside-MLRA-145", code: "F21", name: "Red Parent Material", list: "problematic", printed: "Red Parent Material (F21) (outside MLRA 145)",
    scope: { outsideMlra: ["145"] },
    needs: [field("That the layer is derived from red parent material (a Color Change Propensity Index below 30).")],
    criteria: FIELD,
    quote: "A layer derived from red parent materials (see glossary) that is at least 10 cm (4 inches) thick, starting within 25 cm (10 inches) of the soil surface with a hue of 7.5YR or redder. The matrix has a value and chroma greater than 2 and less than or equal to 4. The layer must contain 10 percent or more depletions and/or distinct or prominent redox concentrations occurring as soft masses or pore linings.",
    citations: [fi("p. 31-32"), supplement("p. 73-74")],
    box: box(RIGHT, 412.2),
  }),
  entry({
    id: "F22", code: "F22", name: "Very Shallow Dark Surface", list: "problematic", printed: "Very Shallow Dark Surface (F22)",
    needs: [field("That the soil is in a depression or floodplain subject to frequent ponding or flooding, and the depth to bedrock.")],
    criteria: FIELD,
    quote: "In depressions and flood plains subject to frequent ponding and/or flooding, one of the following must be observed: 1. If bedrock occurs between 15 cm (6 inches) and 25 cm (10 inches) of the soil surface, a layer of 15 cm (6 inches) or more thick starting at a depth 10 cm (4 inches) or less from the soil surface with value of 2.5 or less and chroma 1 or less, and the remaining soil to bedrock must have the same colors as above or any other color that has chroma of 2 or less; or 2. If bedrock occurs at a depth of 15 cm (6 inches) or less from the soil surface, more than half of the soil thickness must have value of 2.5 or less and chroma 1 or less, and the remaining soil to bedrock must have the same color as above or any other color that has a chroma of 2 or less.",
    citations: [fi("p. 33"), supplement("p. 75 (as TF12)")],
    box: box(RIGHT, 424.5),
  }),
  entry({
    id: "other", code: "", name: "Other (Explain in Remarks)", list: "problematic", printed: "Other (Explain in Remarks)",
    needs: [field("Your own judgment, explained in Remarks. The app never suggests it.")],
    criteria: FIELD,
    quote: "Other (Explain in Remarks)",
    citations: [{ document: "ENG Form 6116-8, Sep 2024, Soil page", page: "Indicators for Problematic Hydric Soils" }],
    box: box(RIGHT, 436.9),
  }),
]
