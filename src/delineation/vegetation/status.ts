// The five levels of wetland indicator status the supplement uses (p. 22). Plus and minus modifiers
// are not used: FAC-, FAC and FAC+ are all FAC.
export const STATUSES = ["OBL", "FACW", "FAC", "FACU", "UPL"] as const
export type Status = (typeof STATUSES)[number]
