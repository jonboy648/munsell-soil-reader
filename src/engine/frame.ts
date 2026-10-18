// The frame finder: find the printed frame's ArUco markers in a Photo and return the Card's
// corners, ready to give to readPhoto. Built and tested on simulated Photos only.
//
// HIDDEN. Nothing in the app imports this file, and it is not in `index.ts`, so js-aruco2 is not
// in the app bundle (frame.test.ts checks that). To switch it on, wire it in on purpose:
// `const { findCard } = await import("@/engine/frame")` where the Photo is loaded, so it stays
// a separate chunk loaded only when a frame is in use.
import aruco from "js-aruco2"
import { gridMap } from "./grid"
import { CARD_CORNERS, FRAME_CORNERS } from "./frameLayout"
import type { Corners, Pixels, XY } from "./types"

/** The markers' dictionary: see FRAME_MARKER_CODES in frameLayout.ts for the four codes. */
const DICTIONARY = "ARUCO_MIP_36h12"

/**
 * Most bits of the 36 a marker may differ from its code and still be read. At the dictionary's
 * own limit of 11, js-aruco2 reads small squares inside the simulated markers as markers too
 * (ID 129, 10 bits off), which a stricter limit leaves out.
 */
const MAX_HAMMING = 3

/** The turn at b on the way from a to c: positive clockwise on the Photo (y points down). */
const turn = (a: XY, b: XY, c: XY) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)

/**
 * The Card's four corners, as the corner patches' centres top left, top right, bottom right,
 * bottom left (the corners `readPhoto` wants), or null when the frame is not all there: a
 * marker is missing, or the four found are not a frame (not in clockwise order, or a bend).
 *
 * The markers are told apart by their ID, not their place in the Photo, so the corners come
 * back in the Card's own order however the phone was turned. Markers 0 to 3 are the frame's
 * top left, top right, bottom right and bottom left.
 *
 * Tuned on simulated Photos about 960 pixels across. The real frame and real Photos are for the
 * ticket that switches this on.
 */
export function findCard(pixels: Pixels): Corners | null {
  const detector = new aruco.AR.Detector({
    dictionaryName: DICTIONARY,
    maxHammingDistance: MAX_HAMMING + 1, // js-aruco2 accepts distances below the limit
  })
  // Marker n's corner n is the frame's own corner n (its outer top left for marker 0, and so on).
  const found: (XY | undefined)[] = [undefined, undefined, undefined, undefined]
  const distance: number[] = [Infinity, Infinity, Infinity, Infinity]
  for (const marker of detector.detect(pixels)) {
    if (marker.id < 0 || marker.id > 3 || marker.hammingDistance >= distance[marker.id]) continue
    found[marker.id] = marker.corners[marker.id]
    distance[marker.id] = marker.hammingDistance
  }
  if (found.some((corner) => corner === undefined)) return null
  const frame = found as [XY, XY, XY, XY]
  // A frame is a convex quadrilateral that runs clockwise on the Photo.
  if (frame.some((p, i) => turn(frame[(i + 3) % 4], p, frame[(i + 1) % 4]) <= 0)) return null

  const map = gridMap(FRAME_CORNERS, frame)
  return CARD_CORNERS.map(map) as Corners
}
