import type { Card, ReadPhotoResult, XY } from "@/engine"
import { savedReadings, type SavedReading } from "./log"

/** A reading keeps its ID when a second Spot is added, but gets a new one if its result changes. */
export function readingSnapshots() {
  const cache = new WeakMap<XY, { signature: string; saved: SavedReading }>()
  return (result: ReadPhotoResult | null, card: Card | null, spots: XY[]): SavedReading[] => {
    if (!result || !card) return []
    return result.readings.map((_, i) => {
      const candidate = savedReadings(result, card, [i])[0]
      const signature = JSON.stringify([candidate.reading, candidate.cardCheck, candidate.quality, candidate.card])
      const previous = cache.get(spots[i])
      if (previous?.signature === signature) return previous.saved
      const saved = { ...candidate, measuredAt: candidate.savedAt }
      cache.set(spots[i], { signature, saved })
      return saved
    })
  }
}
