// What the user has done so far with one Photo: which Card they marked and which Spots they
// tapped. A plain reducer, so the order of taps and undo live in one place.
import type { Card, Corners, XY } from "@/engine"

export interface LoadedPhoto {
  name: string
  pixels: ImageData
  /** Set when the Photo is one of the examples. */
  exampleId?: string
}

export interface Session {
  photo: LoadedPhoto | null
  /** The user said this Photo has no Card in it. */
  noCard: boolean
  /** Card corners tapped so far, in the order TL, TR, BR, BL. */
  corners: XY[]
  spots: XY[]
}

export type Step = "photo" | "corners" | "spots"

export const CORNER_COUNT = 4

export const initialSession: Session = { photo: null, noCard: false, corners: [], spots: [] }

export type SessionAction =
  | { type: "load"; photo: LoadedPhoto; noCard?: boolean }
  | { type: "tap"; point: XY }
  | { type: "undo" }
  | { type: "noCard" }
  | { type: "restart" }

export function stepOf(session: Session): Step {
  if (!session.photo) return "photo"
  if (!session.noCard && session.corners.length < CORNER_COUNT) return "corners"
  return "spots"
}

/** The Card the engine should read against, or null while the corners are still being tapped. */
export function cardOf(session: Session): Card | null {
  if (session.noCard) return { kind: "none" }
  if (session.corners.length === CORNER_COUNT) {
    return { kind: "colorchecker", corners: session.corners as Corners }
  }
  return null
}

export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case "load":
      return { photo: action.photo, noCard: action.noCard ?? false, corners: [], spots: [] }
    case "tap":
      switch (stepOf(session)) {
        case "corners":
          return { ...session, corners: [...session.corners, action.point] }
        case "spots":
          return { ...session, spots: [...session.spots, action.point] }
        default:
          return session
      }
    case "undo":
      // Take back the last tap: a Spot first, then the no-Card choice, then a corner.
      if (session.spots.length) return { ...session, spots: session.spots.slice(0, -1) }
      if (session.noCard) return { ...session, noCard: false }
      return { ...session, corners: session.corners.slice(0, -1) }
    case "noCard":
      return session.photo ? { ...session, noCard: true, corners: [], spots: [] } : session
    case "restart":
      return { ...session, noCard: false, corners: [], spots: [] }
  }
}

/** True when there is anything for Undo to take back. */
export const canUndo = (session: Session): boolean =>
  session.spots.length > 0 || session.noCard || session.corners.length > 0
