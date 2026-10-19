// A position on the earth in degrees (WGS84, as a phone's GPS gives it), and the one error the
// look-ups raise when a service cannot be asked or does not answer in a shape this app knows.
export interface Position {
  lat: number
  long: number
}

export class LookupError extends Error {}

/** A coordinate as it is written on the form: six decimals, about a tenth of a meter. */
export const written = (degrees: number): string => degrees.toFixed(6)

/** What the Lat and Long boxes hold: a position to look up, why they cannot be looked up, or nothing typed. */
export type TypedPosition = { position: Position } | { problem: string } | null

/** The position typed in the Lat and Long boxes, or the plain reason it cannot be looked up. */
export function typedPosition(lat: string, long: string): TypedPosition {
  if (lat.trim() === "" && long.trim() === "") return null
  const parse = (text: string, limit: number) => {
    const n = text.trim() === "" ? NaN : Number(text)
    return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
  }
  const a = parse(lat, 90)
  const b = parse(long, 180)
  if (a === null || b === null) return { problem: "Nothing to look up yet: Lat must be a number from -90 to 90 and Long a number from -180 to 180." }
  // Both services cover the United States, where every longitude is west, and a phone's number keypad can lack a minus.
  if (a > 0 && b > 0) return { problem: "West longitudes are negative, like -93.6. Check the sign of Long. Nothing was sent." }
  return { position: { lat: a, long: b } }
}
