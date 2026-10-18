// The frame finder: find the printed frame's ArUco markers in a Photo and return the frame's
// outline, ready to give to readPhoto as a frame Card.
//
// LAZY. The app loads this file, and with it js-aruco2, only when the user chooses the frame as
// their Card: `await import("@/engine/frame")`. It is not in `index.ts`, so it is a chunk of its
// own, and users who never use a frame never download it (frame.test.ts checks that).
import aruco from "js-aruco2"
import type { Corners, Pixels, XY } from "./types"

/** The markers' dictionary: see FRAME_MARKER_CODES in frameLayout.ts for the four codes. */
const DICTIONARY = "ARUCO_MIP_36h12"

/**
 * Most bits of the 36 a marker may differ from its code and still be read. At the dictionary's
 * own limit of 11, js-aruco2 reads small squares inside the simulated markers as markers too
 * (ID 129, 10 bits off), which a stricter limit leaves out.
 */
const MAX_HAMMING = 3

/**
 * A detection under this share of the biggest marker's side is a speck, not a marker. The
 * frame's four markers are the same size, and a tilt makes the far one at most about half as
 * big as the near one.
 */
const MIN_SIZE_SHARE = 1 / 3

interface Detection {
  id: number
  /** The marker's own top left, top right, bottom right and bottom left, in Photo pixels. */
  corners: XY[]
  /** The mean length of its four edges. */
  side: number
  centre: XY
}

/** The turn at b on the way from a to c: positive clockwise on the Photo (y points down). */
const turn = (a: XY, b: XY, c: XY) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)

const detectionOf = (id: number, corners: XY[]): Detection => ({
  id,
  corners,
  side: corners.reduce((sum, p, i) => sum + Math.hypot(p.x - corners[(i + 1) % 4].x, p.y - corners[(i + 1) % 4].y), 0) / 4,
  centre: { x: corners.reduce((s, p) => s + p.x, 0) / 4, y: corners.reduce((s, p) => s + p.y, 0) / 4 },
})

/** Whether a point is inside a convex quadrilateral: on the same side of all four edges. */
function inside(quad: XY[], p: XY): boolean {
  const turns = quad.map((a, i) => turn(a, quad[(i + 1) % 4], p))
  return turns.every((t) => t > 0) || turns.every((t) => t < 0)
}

/**
 * The frame's outline: the outer corners of its four markers, top left, top right, bottom
 * right, bottom left (marker 0's top left corner, marker 1's top right, and so on). Null when
 * the frame is not all there: a marker is missing, one shows twice, or the four found are not a
 * frame (not in clockwise order, or a bend).
 *
 * The markers are told apart by their ID, not their place in the Photo, so the corners come
 * back in the frame's own order however the phone was turned.
 *
 * Specks are ignored: a detection that is under a third of the biggest marker's side, or whose
 * centre is inside a bigger one (the cells of a marker can read as a marker of their own).
 *
 * Tuned on simulated Photos about 960 pixels across. Real Photos are for the first real frame.
 */
export function findCard(pixels: Pixels): Corners | null {
  const detector = new aruco.AR.Detector({
    dictionaryName: DICTIONARY,
    maxHammingDistance: MAX_HAMMING + 1, // js-aruco2 accepts distances below the limit
  })
  const seen = detector
    .detect(pixels)
    .filter((marker) => marker.id >= 0 && marker.id <= 3)
    .map((marker) => detectionOf(marker.id, marker.corners))
  const biggest = Math.max(0, ...seen.map((d) => d.side))
  const markers = seen.filter(
    (d) => d.side >= MIN_SIZE_SHARE * biggest && !seen.some((other) => other.side > d.side && inside(other.corners, d.centre)),
  )

  const outline: (XY | undefined)[] = [undefined, undefined, undefined, undefined]
  for (const { id, corners } of markers) {
    // The same ID twice (a second frame, a spare marker): which one is the frame's is a guess.
    if (outline[id]) return null
    outline[id] = corners[id] // marker n's corner n is the frame's own corner n
  }
  if (outline.some((corner) => corner === undefined)) return null
  const found = outline as Corners
  // A frame is a convex quadrilateral that runs clockwise on the Photo.
  if (found.some((p, i) => turn(found[(i + 3) % 4], p, found[(i + 1) % 4]) <= 0)) return null
  return found
}
