// The X-Rite ColorChecker Classic 24: reference colors and patch geometry.
import {
  BRADFORD_D50_TO_D65,
  M_XYZ_RGB,
  WHITE_D50,
  labToXyz,
  mul,
  type Vec3,
} from "./color"
import type { Corners, XY } from "./types"

export const PATCH_NAMES = [
  "dark skin", "light skin", "blue sky", "foliage", "blue flower", "bluish green",
  "orange", "purplish blue", "moderate red", "purple", "yellow green", "orange yellow",
  "blue", "green", "red", "yellow", "magenta", "cyan",
  "white 9.5", "neutral 8", "neutral 6.5", "neutral 5", "neutral 3.5", "black 2",
] as const

// "After November 2014" Lab (D50). Source: colour-science/colour,
// characterisation/datasets/colour_checkers.
const PATCH_LAB_D50: Vec3[] = [
  [37.54, 14.37, 14.92], [64.66, 19.27, 17.5], [49.32, -3.82, -22.54],
  [43.46, -12.74, 22.72], [54.94, 9.61, -24.79], [70.48, -32.26, -0.37],
  [62.73, 35.83, 56.5], [39.43, 10.75, -45.17], [50.57, 48.64, 16.67],
  [30.1, 22.54, -20.87], [71.77, -24.13, 58.19], [71.51, 18.24, 67.37],
  [28.37, 15.42, -49.8], [54.38, -39.72, 32.27], [42.43, 51.05, 28.62],
  [81.8, 2.67, 80.41], [50.63, 51.28, -14.12], [49.57, -29.71, -28.32],
  [95.19, -1.03, 2.93], [81.29, -0.57, 0.44], [66.89, -0.75, -0.06],
  [50.76, -0.13, 0.14], [35.63, -0.46, -0.48], [20.64, 0.07, -0.46],
]

/** Reference patch colors as linear sRGB (D65), via Bradford D50 -> D65. */
export const PATCH_LINEAR: Vec3[] = PATCH_LAB_D50.map((lab) =>
  mul(M_XYZ_RGB, mul(BRADFORD_D50_TO_D65, labToXyz(lab, WHITE_D50))),
)

/** The six gray patches along the bottom row, used for white balance. */
export const NEUTRAL_PATCHES = [18, 19, 20, 21, 22, 23]

export const PATCH_COLUMNS = 6
export const PATCH_ROWS = 4

/**
 * Patch centers (row by row) from the four corner patch centers the user tapped, in this
 * order: top left (dark skin), top right (bluish green), bottom right (black), bottom left
 * (white). Bilinear between the corners.
 */
export function patchCenters([tl, tr, br, bl]: Corners): XY[] {
  const out: XY[] = []
  for (let r = 0; r < PATCH_ROWS; r++) {
    for (let c = 0; c < PATCH_COLUMNS; c++) {
      const u = c / (PATCH_COLUMNS - 1)
      const v = r / (PATCH_ROWS - 1)
      const at = (k: "x" | "y") =>
        (1 - u) * (1 - v) * tl[k] + u * (1 - v) * tr[k] + u * v * br[k] + (1 - u) * v * bl[k]
      out.push({ x: at("x"), y: at("y") })
    }
  }
  return out
}
