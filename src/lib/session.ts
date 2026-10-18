// What the user has done so far with one Photo: which Card they marked and which Spots they
// tapped. A plain reducer, so the order of taps and undo live in one place.
import type { Card, Corners, PageHue, XY } from "@/engine"

export interface LoadedPhoto {
  name: string
  pixels: ImageData
  /** Set when the Photo is one of the examples. */
  exampleId?: string
}

export type CardKind = "colorchecker" | "page"

export interface Session {
  photo: LoadedPhoto | null
  /** The user said this Photo has no Card in it. */
  noCard: boolean
  /** Which Card is in the Photo: a ColorChecker, or a Page of the soil book. */
  cardKind: CardKind
  /** The hue of the Page, once the user has chosen it. Only a Page needs it. */
  hue: PageHue | null
  /** Card corners tapped so far, in the order TL, TR, BR, BL (a Page: its four Chips, see `pageModel`). */
  corners: XY[]
  spots: XY[]
}

export type Step = "photo" | "corners" | "spots"

export const CORNER_COUNT = 4

export const initialSession: Session = {
  photo: null,
  noCard: false,
  cardKind: "colorchecker",
  hue: null,
  corners: [],
  spots: [],
}

export type SessionAction =
  | { type: "load"; photo: LoadedPhoto; noCard?: boolean; cardKind?: CardKind }
  | { type: "cardKind"; cardKind: CardKind }
  | { type: "hue"; hue: PageHue }
  | { type: "tap"; point: XY }
  | { type: "undo" }
  | { type: "noCard" }
  | { type: "restart" }

export function stepOf(session: Session): Step {
  if (!session.photo) return "photo"
  if (!session.noCard && session.corners.length < CORNER_COUNT) return "corners"
  return "spots"
}

/** True while a Page is chosen but its hue is not: nothing can be tapped until the Chips are known. */
export const needsHue = (session: Session): boolean =>
  session.cardKind === "page" && session.hue === null && !session.noCard

/** The Card the engine should read against, or null while the corners are still being tapped. */
export function cardOf(session: Session): Card | null {
  if (session.noCard) return { kind: "none" }
  if (session.corners.length === CORNER_COUNT) {
    const corners = session.corners as Corners
    if (session.cardKind === "colorchecker") return { kind: "colorchecker", corners }
    return session.hue ? { kind: "page", hue: session.hue, taps: corners } : null
  }
  return null
}

export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case "load":
      return {
        ...session,
        photo: action.photo,
        noCard: action.noCard ?? false,
        cardKind: action.cardKind ?? session.cardKind,
        corners: [],
        spots: [],
      }
    case "cardKind":
      // The taps mean different places on a different Card, so they start over.
      return { ...session, cardKind: action.cardKind, noCard: false, corners: [], spots: [] }
    case "hue":
      return { ...session, hue: action.hue, corners: [], spots: [] }
    case "tap":
      switch (stepOf(session)) {
        case "corners":
          return needsHue(session) ? session : { ...session, corners: [...session.corners, action.point] }
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
