// The printed frame the frame finder assumes: a board with the Card in its window and one ArUco
// marker in each corner. The simulated camera draws it and the finder reads it, both from this
// one description, so the two cannot drift apart. No js-aruco2 here: the simulated camera is
// part of the app, and the finder is not.
//
// This is the simulation's frame, not a product design: markers around a ColorChecker, as ticket
// #12 assumes. ADR 0003 makes the real frame a card in its own right, so the real frame comes
// later and its layout replaces this one.
import { TAPPED_PATCHES } from "./colorchecker"
import type { Four, GridPoint } from "./grid"

/**
 * The codes of markers 0 to 3 (top left, top right, bottom right, bottom left) in the
 * ARUCO_MIP_36h12 dictionary, as js-aruco2 ships it. Each is 36 bits, a 6x6 grid row by row,
 * 1 for white. The dictionary's codes are at least 12 bits apart, so the four cannot be taken
 * for each other.
 */
export const FRAME_MARKER_CODES: Four<number> = [0xd2b63a09d, 0x6001134e5, 0x1206fbe72, 0xff8ad6cb4]
/** Cells along a marker's side, black border included. */
export const MARKER_CELLS = 8

/** A marker's side, in grid steps (one step is the pitch between two ColorChecker patches). */
export const MARKER_SIZE = 0.9
/** The board's margin outside the markers, in grid steps. */
export const BOARD_MARGIN = 0.2

// The markers' outer edges, in grid steps from the first ColorChecker patch's centre.
const [LEFT, RIGHT, TOP, BOTTOM] = [-0.65, 5.65, -1.75, 4.75]

/** Each marker's top left corner, for markers 0 to 3. */
export const MARKER_ORIGINS: Four<GridPoint> = [
  { col: LEFT, row: TOP },
  { col: RIGHT - MARKER_SIZE, row: TOP },
  { col: RIGHT - MARKER_SIZE, row: BOTTOM - MARKER_SIZE },
  { col: LEFT, row: BOTTOM - MARKER_SIZE },
]

/**
 * The frame's four outer corners: marker 0's top left, marker 1's top right, marker 2's bottom
 * right and marker 3's bottom left. The widest points the markers give, so a corner found a
 * pixel off moves the Card's corners least.
 */
export const FRAME_CORNERS: Four<GridPoint> = [
  { col: LEFT, row: TOP },
  { col: RIGHT, row: TOP },
  { col: RIGHT, row: BOTTOM },
  { col: LEFT, row: BOTTOM },
]

/** The board, in grid steps: left, right, top, bottom. */
export const BOARD: Four<number> = [
  LEFT - BOARD_MARGIN,
  RIGHT + BOARD_MARGIN,
  TOP - BOARD_MARGIN,
  BOTTOM + BOARD_MARGIN,
]

/** Where the finder returns the Card's corners: the corner patches the user would have tapped. */
export const CARD_CORNERS: Four<GridPoint> = TAPPED_PATCHES

/** Whether cell (row, col) of marker `id`'s 8x8 pattern is white. The outer ring is black. */
export function markerCellIsWhite(id: number, row: number, col: number): boolean {
  const inner = MARKER_CELLS - 2
  if (row < 1 || col < 1 || row > inner || col > inner) return false
  const bits = FRAME_MARKER_CODES[id].toString(2).padStart(inner * inner, "0")
  return bits[(row - 1) * inner + (col - 1)] === "1"
}
