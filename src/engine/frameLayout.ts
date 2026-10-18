// The frame's layout: where its markers, patches and window are on the card, in millimetres.
// It comes from agent-fab's prototype 1 (frameLayout.json, a verbatim copy of `layout.json` from
// the package on the NAS: origin top left, y down). The frame finder reads the markers, the
// engine reads the patches and the window, and the simulated camera draws all three from this
// one description, so they cannot drift apart. A new print of the frame replaces the JSON.
//
// No js-aruco2 here: the simulated camera is part of the app, and the finder is not.
import layout from "./frameLayout.json" with { type: "json" }
import type { Four } from "./grid"
import type { XY } from "./types"

/** A place on the card, in millimetres from its top left corner (`x` to the right, `y` down). */
export type Mm = XY

/** The card's size, in millimetres. */
export const FRAME_SIZE_MM = { width: layout.frame.width_mm, height: layout.frame.height_mm }

/** Which design the layout is: the batch files are made for one. */
export const FRAME_VERSION = layout.frame.version

/**
 * The codes of markers 0 to 3 (top left, top right, bottom right, bottom left) in the
 * ARUCO_MIP_36h12 dictionary, as js-aruco2 ships it. Each is 36 bits, a 6x6 grid row by row,
 * 1 for white. The dictionary's codes are at least 12 bits apart, so the four cannot be taken
 * for each other. (The layout names the dictionary and the IDs, not the cells. agent-fab
 * checked the printed cells against OpenCV's DICT_ARUCO_MIP_36h12, and frame.test.ts holds
 * these four against that.)
 */
export const FRAME_MARKER_CODES: Four<number> = [0xd2b63a09d, 0x6001134e5, 0x1206fbe72, 0xff8ad6cb4]

export interface FrameMarker {
  id: number
  /** The marker's own top left, top right, bottom right and bottom left corners. */
  corners: Four<Mm>
  /** Its side, in millimetres, black border included. */
  side: number
  /** One cell of its pattern, in millimetres. */
  cell: number
  /** The white margin printed around it, in millimetres. */
  quiet: number
}

const point = ([x, y]: number[]): Mm => ({ x, y })

/** Markers 0 to 3, in that order: the card's top left, top right, bottom right, bottom left. */
export const FRAME_MARKERS: Four<FrameMarker> = [0, 1, 2, 3].map((id) => {
  const marker = layout.markers.find((m) => m.id === id)
  if (!marker || marker.corners_tl_tr_br_bl.length !== 4) throw new Error(`The frame layout has no marker ${id}.`)
  return {
    id,
    corners: marker.corners_tl_tr_br_bl.map(point) as Four<Mm>,
    side: marker.side_mm,
    cell: marker.cell_mm,
    quiet: marker.quiet_zone_mm,
  }
}) as Four<FrameMarker>

/** Cells along a marker's side, black border included. */
export const MARKER_CELLS = Math.round(FRAME_MARKERS[0].side / FRAME_MARKERS[0].cell)

/**
 * The card's outline, as the app finds and shows it: the outer corners of the four markers,
 * top left, top right, bottom right, bottom left. Marker n's corner n.
 */
export const OUTLINE_MM: Four<Mm> = FRAME_MARKERS.map((m, i) => m.corners[i]) as Four<Mm>

export interface FramePatch {
  /** G1 to G6 (grays), S01 to S12 (soil colors) and R1 to R4 (reserved for the batch code). */
  id: string
  kind: "gray" | "soil" | "reserved"
  /** What the patch is meant to be: a Munsell notation, or a gray as "N9.5 white". */
  aim: string
  center: Mm
  /** The tile's side, in millimetres. */
  size: number
}

export const FRAME_PATCHES: FramePatch[] = layout.patches.map((p) => ({
  id: p.id,
  kind: p.kind as FramePatch["kind"],
  aim: p.aim,
  center: point(p.center),
  size: p.size[0],
}))

/** The patches that are references: the six grays, white to black, and the soil colors. */
export const REFERENCE_PATCHES = FRAME_PATCHES.filter((p) => p.kind !== "reserved")

/** The window the soil shows through, top left, top right, bottom right, bottom left. */
export const WINDOW_MM: Four<Mm> = [
  { x: layout.window.x0, y: layout.window.y0 },
  { x: layout.window.x1, y: layout.window.y0 },
  { x: layout.window.x1, y: layout.window.y1 },
  { x: layout.window.x0, y: layout.window.y1 },
]

/**
 * Places on the card's black base that should come out equally bright in even light: along the
 * top and bottom edges between the markers, and in the strips just above and below the window.
 * The strips between tiles are too narrow to read. Each is at least `EVENNESS_RADIUS_MM` from
 * every tile, marker margin and the window (frame.test.ts checks).
 */
export const EVENNESS_MM: Mm[] = [
  ...[45, 60, 75, 90, 105].flatMap((x) => [point([x, 5]), point([x, 95])]),
  ...[60, 75, 90].flatMap((x) => [point([x, 27]), point([x, 73])]),
]
/** The radius of the circle read at each of them, in millimetres. */
export const EVENNESS_RADIUS_MM = 2.2

/** Whether cell (row, col) of marker `id`'s pattern is white. The outer ring is black. */
export function markerCellIsWhite(id: number, row: number, col: number): boolean {
  const inner = MARKER_CELLS - 2
  if (row < 1 || col < 1 || row > inner || col > inner) return false
  const bits = FRAME_MARKER_CODES[id].toString(2).padStart(inner * inner, "0")
  return bits[(row - 1) * inner + (col - 1)] === "1"
}
