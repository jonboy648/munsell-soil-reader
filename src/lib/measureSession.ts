// Measurement mode's session: the shot being taken (a Photo, the ColorChecker's corners and the
// swatches tapped on it, each with its label) and the shots finished so far. It wraps the main
// flow's session reducer, so the corner taps, Undo and Start over work the same way.
import { SWATCH_IDS, measureShot, type Corners, type ShotMeasurement } from "@/engine"
import { CORNER_COUNT, initialSession, sessionReducer, stepOf, type Session, type SessionAction } from "@/lib/session"

/** A finished shot: what the Photo measured, and which Photo it was. */
export interface Shot extends ShotMeasurement {
  name: string
}

export interface MeasureState {
  session: Session
  /** The label of each tapped swatch, in the order of `session.spots`. */
  labels: string[]
  /** The label the next tap on the Photo gets. */
  next: string
  shots: Shot[]
}

export type MeasureAction =
  | Exclude<SessionAction, { type: "noCard" | "cardKind" | "hue" }>
  | { type: "pick"; id: string }
  | { type: "addShot" }
  | { type: "dropShot"; index: number }

export const initialMeasure: MeasureState = { session: initialSession, labels: [], next: SWATCH_IDS[0], shots: [] }

/** The first swatch not yet tapped in this shot; `fallback` when all eighteen are. */
const firstFree = (labels: string[], fallback: string) => SWATCH_IDS.find((id) => !labels.includes(id)) ?? fallback

/** Where the next shot starts: no Photo, no taps. The finished shots stay. */
const fresh = (state: MeasureState, session: Session = initialSession): MeasureState => ({
  ...state,
  session,
  labels: [],
  next: SWATCH_IDS[0],
})

export function measureReducer(state: MeasureState, action: MeasureAction): MeasureState {
  const { session, labels, next } = state
  switch (action.type) {
    case "pick":
      return { ...state, next: action.id }
    case "load":
      return fresh(state, sessionReducer(session, action))
    case "restart":
      return fresh(state, sessionReducer(session, action))
    case "tap": {
      if (stepOf(session) !== "spots") return { ...state, session: sessionReducer(session, action) }
      // Tapping a swatch that is already down moves it; otherwise this is a new one.
      const at = labels.indexOf(next)
      const spots = at >= 0 ? session.spots.map((spot, i) => (i === at ? action.point : spot)) : [...session.spots, action.point]
      const named = at >= 0 ? labels : [...labels, next]
      return { ...state, session: { ...session, spots }, labels: named, next: firstFree(named, next) }
    }
    case "undo": {
      if (session.spots.length === 0) return { ...state, session: sessionReducer(session, action) }
      return {
        ...state,
        session: { ...session, spots: session.spots.slice(0, -1) },
        labels: labels.slice(0, -1),
        next: labels[labels.length - 1],
      }
    }
    case "addShot": {
      const { photo, corners, spots } = session
      if (!photo || corners.length < CORNER_COUNT || spots.length === 0) return state
      const taps = spots.map((at, i) => ({ id: labels[i], at }))
      const shot: Shot = { name: photo.name, ...measureShot(photo.pixels, corners as Corners, taps) }
      return { ...fresh(state), shots: [...state.shots, shot] }
    }
    case "dropShot":
      return { ...state, shots: state.shots.filter((_, i) => i !== action.index) }
  }
}
