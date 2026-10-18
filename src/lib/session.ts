// What the user has done so far with one Photo: which Card they marked and which Spots they
// tapped. A plain reducer, so the order of taps and undo live in one place.
import type { Batch, Card, Corners, PageHue, XY } from "@/engine"

export interface LoadedPhoto {
  name: string
  pixels: ImageData
  /** Set when the Photo is one of the examples. */
  exampleId?: string
  /** Set on the examples of the frame: the made-up batch that goes with the simulated frame. */
  batch?: Batch
}

/**
 * Which Card is in the Photo: a ColorChecker or a Page of the soil book, whose corners (a Page: its
 * four Chips) the user taps, or the frame, which the app finds.
 */
export type CardKind = "colorchecker" | "page" | "frame"

/** The frame's batch: typed by the user from the frame, then looked up. */
export type BatchState =
  | { code: string; state: "none" } // nothing typed yet
  | { code: string; state: "loading" }
  | { code: string; state: "ready"; batch: Batch }
  | { code: string; state: "refused"; message: string } // unknown, unmeasured or unreadable: it cannot be a Card

/** Everything the frame adds to a session. */
export interface FrameSession {
  /** The finder has run on this Photo. Until then the app is looking. */
  searched: boolean
  /** The frame's outline: its four markers' outer corners, TL, TR, BR, BL. As found, then as the user moved it. Null when nothing was found. */
  outline: Corners | null
  /** The outlines the user moved away from, oldest first, so Undo and Start over can go back. */
  moves: Corners[]
  /** The user confirmed the outline. */
  confirmed: boolean
  /** The finder could not run at all, as opposed to finding no frame. */
  failed: boolean
  batch: BatchState
}

export interface Session {
  photo: LoadedPhoto | null
  /** The user said this Photo has no Card in it. */
  noCard: boolean
  cardKind: CardKind
  /** The hue of the Page, once the user has chosen it. Only a Page needs it. */
  hue: PageHue | null
  /** Card corners tapped so far, in the order TL, TR, BR, BL (a Page: its four Chips, see `pageModel`). The frame has none. */
  corners: XY[]
  spots: XY[]
  frame: FrameSession
}

export type Step = "photo" | "corners" | "frame" | "spots"

export const CORNER_COUNT = 4

const noBatch: BatchState = { code: "", state: "none" }

const freshFrame = (batch: BatchState = noBatch): FrameSession => ({
  searched: false,
  outline: null,
  moves: [],
  confirmed: false,
  failed: false,
  batch,
})

export const initialSession: Session = {
  photo: null,
  noCard: false,
  cardKind: "colorchecker",
  hue: null,
  corners: [],
  spots: [],
  frame: freshFrame(),
}

export type SessionAction =
  | { type: "load"; photo: LoadedPhoto; noCard?: boolean; cardKind?: CardKind }
  | { type: "cardKind"; cardKind: CardKind }
  | { type: "hue"; hue: PageHue }
  | { type: "frameFound"; outline: Corners | null; failed?: boolean }
  | { type: "frameConfirm" }
  | { type: "batchCode"; code: string }
  | { type: "batchResult"; code: string; result: { state: "ready"; batch: Batch } | { state: "refused"; message: string } }
  | { type: "tap"; point: XY }
  | { type: "undo" }
  | { type: "noCard" }
  | { type: "restart" }

/** A word or two for the frame's step in the step indicator. */
export function frameDetailOf({ searched, outline, confirmed, batch }: FrameSession): string {
  if (!searched) return "looking"
  if (!outline) return "not found"
  if (!confirmed) return "found"
  return batch.state === "ready" ? "ok" : "batch?"
}

/** The frame is found, confirmed, and its batch is measured: it can be the Card. */
export const frameReady = ({ frame }: Pick<Session, "frame">): boolean =>
  frame.outline !== null && frame.confirmed && frame.batch.state === "ready"

export function stepOf(session: Session): Step {
  if (!session.photo) return "photo"
  if (session.noCard) return "spots"
  if (session.cardKind === "frame") return frameReady(session) ? "spots" : "frame"
  return session.corners.length < CORNER_COUNT ? "corners" : "spots"
}

/** True while a Page is chosen but its hue is not: nothing can be tapped until the Chips are known. */
export const needsHue = (session: Pick<Session, "cardKind" | "hue" | "noCard">): boolean =>
  session.cardKind === "page" && session.hue === null && !session.noCard

/** The Card the engine should read against, or null while the corners are still being tapped or the frame is not ready. */
export function cardOf(session: Session): Card | null {
  if (session.noCard) return { kind: "none" }
  if (session.cardKind === "frame") {
    const { outline, batch } = session.frame
    return frameReady(session) && outline && batch.state === "ready" ? { kind: "frame", outline, batch: batch.batch } : null
  }
  if (session.corners.length === CORNER_COUNT) {
    const corners = session.corners as Corners
    if (session.cardKind === "colorchecker") return { kind: "colorchecker", corners }
    return session.hue ? { kind: "page", hue: session.hue, taps: corners } : null
  }
  return null
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Move the outline's nearest corner to a tapped place. A tap far from every corner (further than
 * a fifth of the outline's longest side) moves nothing, so a stray touch does not drag the outline.
 */
function movedOutline(outline: Corners, point: XY): Corners | null {
  const near = outline.reduce((best, c, i) => (dist(c, point) < dist(outline[best], point) ? i : best), 0)
  const longest = Math.max(...outline.flatMap((a) => outline.map((b) => dist(a, b))))
  if (dist(outline[near], point) > 0.2 * longest) return null
  return outline.map((c, i) => (i === near ? point : c)) as Corners
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
        // The examples of the frame bring their own batch. For any other Photo the user names the
        // batch, and what they typed is kept, but never an example's made-up batch.
        frame: freshFrame(
          action.photo.batch
            ? { code: action.photo.batch.code, state: "ready", batch: action.photo.batch }
            : session.photo?.batch
              ? noBatch
              : session.frame.batch,
        ),
      }
    case "cardKind":
      // The taps mean different places on a different Card, so they start over.
      return { ...session, cardKind: action.cardKind, noCard: false, corners: [], spots: [], frame: freshFrame(session.frame.batch) }
    case "hue":
      return { ...session, hue: action.hue, corners: [], spots: [] }
    case "frameFound":
      return { ...session, frame: { ...session.frame, searched: true, outline: action.outline, moves: [], confirmed: false, failed: action.failed ?? false } }
    case "frameConfirm":
      return session.frame.outline ? { ...session, frame: { ...session.frame, confirmed: true } } : session
    case "batchCode":
      return { ...session, frame: { ...session.frame, batch: action.code.trim() === "" ? { code: action.code, state: "none" } : { code: action.code, state: "loading" } } }
    case "batchResult":
      // An answer for a code the user has since changed is out of date.
      return session.frame.batch.code === action.code
        ? { ...session, frame: { ...session.frame, batch: { code: action.code, ...action.result } } }
        : session
    case "tap":
      switch (stepOf(session)) {
        case "corners":
          return needsHue(session) ? session : { ...session, corners: [...session.corners, action.point] }
        case "frame": {
          const { outline, confirmed, moves } = session.frame
          const moved = outline && !confirmed ? movedOutline(outline, action.point) : null
          return outline && moved ? { ...session, frame: { ...session.frame, outline: moved, moves: [...moves, outline] } } : session
        }
        case "spots":
          return { ...session, spots: [...session.spots, action.point] }
        default:
          return session
      }
    case "undo": {
      // Take back the last tap: a Spot first, then the no-Card choice, then the confirmed outline, then a move of it, then a corner.
      if (session.spots.length) return { ...session, spots: session.spots.slice(0, -1) }
      if (session.noCard) return { ...session, noCard: false }
      if (session.cardKind === "frame") {
        const { confirmed, moves } = session.frame
        if (confirmed) return { ...session, frame: { ...session.frame, confirmed: false } }
        if (moves.length) return { ...session, frame: { ...session.frame, outline: moves[moves.length - 1], moves: moves.slice(0, -1) } }
        return session
      }
      return { ...session, corners: session.corners.slice(0, -1) }
    }
    case "noCard":
      return session.photo ? { ...session, noCard: true, corners: [], spots: [] } : session
    case "restart": {
      // The frame goes back to the outline the finder found.
      const { moves, outline } = session.frame
      return {
        ...session,
        noCard: false,
        corners: [],
        spots: [],
        frame: { ...session.frame, outline: moves[0] ?? outline, moves: [], confirmed: false },
      }
    }
  }
}

/** True when there is anything for Undo to take back. */
export const canUndo = (session: Session): boolean =>
  session.spots.length > 0 ||
  session.noCard ||
  (session.cardKind === "frame" ? session.frame.confirmed || session.frame.moves.length > 0 : session.corners.length > 0)
