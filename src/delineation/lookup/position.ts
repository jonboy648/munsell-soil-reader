// A position on the earth in degrees (WGS84, as a phone's GPS gives it), and the one error the
// look-ups raise when a service cannot be asked or does not answer in a shape this app knows.
export interface Position {
  lat: number
  long: number
}

export class LookupError extends Error {}

/** A coordinate as it is written on the form: six decimals, about a tenth of a meter. */
export const written = (degrees: number): string => degrees.toFixed(6)

/** The position typed in the Lat and Long boxes, or null when either is not a usable coordinate. */
export function typedPosition(lat: string, long: string): Position | null {
  const parse = (text: string, limit: number) => {
    const n = text.trim() === "" ? NaN : Number(text)
    return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
  }
  const a = parse(lat, 90)
  const b = parse(long, 180)
  return a === null || b === null ? null : { lat: a, long: b }
}
