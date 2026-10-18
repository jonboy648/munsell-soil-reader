// The phone's position, asked for once when the user taps for it. Never asked for on its own.
import { LookupError, type Position } from "@/delineation/lookup/position"

const WHY: Record<number, string> = {
  1: "Location permission was refused. Allow it for this site in the browser's settings, or type the position.",
  2: "The phone could not work out its position. Try again with a clearer view of the sky, or type it.",
  3: "Finding the position took too long. Try again, or type it.",
}

export function devicePosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new LookupError("This browser cannot give a position. Type the latitude and longitude."))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, long: coords.longitude }),
      (error) => reject(new LookupError(WHY[error.code] ?? WHY[2])),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    )
  })
}
