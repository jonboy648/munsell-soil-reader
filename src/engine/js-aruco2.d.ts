// js-aruco2 ships no types. Only what the frame finder calls is declared here. The package is a
// plain script that sets `AR` on its exports, so it is read from the default import.
declare module "js-aruco2" {
  interface Marker {
    id: number
    /** The marker's own top left, top right, bottom right and bottom left, in Photo pixels. */
    corners: { x: number; y: number }[]
    hammingDistance: number
  }

  class Detector {
    constructor(config?: { dictionaryName?: string; maxHammingDistance?: number })
    detect(image: { width: number; height: number; data: ArrayLike<number> }): Marker[]
  }

  const aruco: { AR: { Detector: typeof Detector } }
  export default aruco
}
