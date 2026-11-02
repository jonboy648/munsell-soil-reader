// The codes the Soil page asks for. The redox codes are the form's own, from the footnotes under the
// profile table; the restriction kinds are the Field Book's (v4.0, Nov 2024, pp. 1-29 and 1-30).
import type { RedoxLocation, RedoxType } from "./model"

/** "Type: C=Concentration, D=Depletion, RM=Reduced Matrix, MS=Masked Sand Grains." */
export const REDOX_TYPES: readonly { code: RedoxType; name: string }[] = [
  { code: "C", name: "Concentration" },
  { code: "D", name: "Depletion" },
  { code: "RM", name: "Reduced Matrix" },
  { code: "MS", name: "Masked Sand Grains" },
]

/** "Location: PL=Pore Lining, M=Matrix." */
export const REDOX_LOCATIONS: readonly { code: RedoxLocation; name: string }[] = [
  { code: "PL", name: "Pore Lining" },
  { code: "M", name: "Matrix" },
]

/** The kinds of root-limiting layer the Field Book lists, for the Restrictive Layer box. */
export const RESTRICTION_KINDS: readonly string[] = [
  "abrupt textural change",
  "cemented horizon",
  "densic bedrock",
  "densic material",
  "duripan",
  "fragipan",
  "lithic bedrock",
  "manufactured layer",
  "natric",
  "ortstein",
  "paralithic bedrock",
  "permafrost",
  "petrocalcic",
  "petroferric",
  "petrogypsic",
  "placic",
  "plinthite",
  "salic",
  "strongly contrasting textural stratification",
  "sulfuric",
]
