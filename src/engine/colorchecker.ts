// The X-Rite ColorChecker Classic 24: reference colors and patch geometry.
import {
  BRADFORD_D50_TO_D65,
  M_RGB_XYZ,
  M_XYZ_RGB,
  WHITE_D50,
  labToXyz,
  mul,
  xyzToLab,
  type Vec3,
} from "./color"
import { gridMap, gridSites, type Four, type GridPoint, type Site } from "./grid"
import type { Corners } from "./types"

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

/**
 * The value row of each patch, for judging the grays by the patches of about their own lightness
 * (see leftOut.ts). The six grays are rows 0 to 5, dark to light; every other patch is in the row
 * of the gray nearest it in L*.
 */
export const PATCH_VALUE_ROWS: number[] = (() => {
  const lightness = PATCH_LINEAR.map((lin) => xyzToLab(mul(M_RGB_XYZ, lin))[0])
  const grays = [...NEUTRAL_PATCHES].sort((a, b) => lightness[a] - lightness[b])
  return PATCH_LINEAR.map((_, i) =>
    grays.reduce((best, g, row) => (Math.abs(lightness[g] - lightness[i]) < Math.abs(lightness[grays[best]] - lightness[i]) ? row : best), 0),
  )
})()

export const PATCH_COLUMNS = 6
export const PATCH_ROWS = 4

/** Grid positions of the four patches the user taps: dark skin, bluish green, black, white. */
export const TAPPED_PATCHES: Four<GridPoint> = [
  { col: 0, row: 0 },
  { col: PATCH_COLUMNS - 1, row: 0 },
  { col: PATCH_COLUMNS - 1, row: PATCH_ROWS - 1 },
  { col: 0, row: PATCH_ROWS - 1 },
]

const ALL_PATCHES: GridPoint[] = Array.from({ length: PATCH_ROWS * PATCH_COLUMNS }, (_, i) => ({
  col: i % PATCH_COLUMNS,
  row: Math.floor(i / PATCH_COLUMNS),
}))

/**
 * Where to read each patch (row by row), from the four corner patch centers the user
 * tapped, in this order: top left (dark skin), top right (bluish green), bottom right
 * (black), bottom left (white). A homography, so an angled Card still lands on every patch.
 */
export const patchSites = (corners: Corners): Site[] =>
  gridSites(TAPPED_PATCHES, corners, ALL_PATCHES)

/** Share of the diagonal between two patches that the frame read circle takes as its radius. */
const FRAME_READ_FRACTION = 0.25

/**
 * Where to read the Card's black frame: the places where four patches meet, 15 of them. Each
 * circle is a quarter of the way across the diagonal between the patches around it, so it holds
 * plenty of frame whichever way the Card is turned, and a tap a few pixels off does not move it
 * off the frame. The radius follows the perspective like the patches' does.
 */
export function frameSites(corners: Corners): Site[] {
  const map = gridMap(TAPPED_PATCHES, corners)
  const sites: Site[] = []
  for (let row = 0; row < PATCH_ROWS - 1; row++) {
    for (let col = 0; col < PATCH_COLUMNS - 1; col++) {
      const [a, b] = [map({ col, row }), map({ col: col + 1, row: row + 1 })]
      sites.push({
        center: map({ col: col + 0.5, row: row + 0.5 }),
        radius: FRAME_READ_FRACTION * Math.hypot(a.x - b.x, a.y - b.y),
      })
    }
  }
  return sites
}
