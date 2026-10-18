// Where a Card's patches (or Chips) sit in the Photo. A Card is a flat grid. Seen at an
// angle, the grid goes through a perspective transform (a homography), and four points fix
// it. This is the one place that knows that, so every kind of Card shares it.
import type { XY } from "./types"

/**
 * A position on the Card's grid in grid steps: the column counts to the right and the row
 * downwards from the first patch. Positions between patches are allowed.
 */
export interface GridPoint {
  col: number
  row: number
}

export type Four<T> = [T, T, T, T]

/** Where to read one patch: its centre in the Photo and the radius of the circle to read. */
export interface Site {
  center: XY
  radius: number
}

export type GridMap = (position: GridPoint) => XY

/** Share of the local patch pitch that the read circle takes as its radius. */
const READ_FRACTION = 0.2
/** Read radius floor, in Photo pixels. */
const MIN_RADIUS = 2
/** Below this the transform sends the point toward the horizon, so it is not a view of the Card. */
const MIN_SCALE = 1e-3

/** Solve A x = b by Gaussian elimination with partial pivoting; null when A is singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  const scale = Math.max(...A.flat().map(Math.abs))
  for (let k = 0; k < n; k++) {
    let p = k
    for (let r = k + 1; r < n; r++) if (Math.abs(M[r][k]) > Math.abs(M[p][k])) p = r
    if (Math.abs(M[p][k]) < 1e-9 * scale) return null
    ;[M[k], M[p]] = [M[p], M[k]]
    for (let r = k + 1; r < n; r++) {
      const f = M[r][k] / M[k][k]
      for (let c = k; c <= n; c++) M[r][c] -= f * M[k][c]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c]
    x[r] = s / M[r][r]
  }
  return x
}

/**
 * The map from the Card's grid to the Photo, fixed by four grid positions and the four Photo
 * points the user tapped on them. The positions need not be the grid's corners, or a
 * rectangle, but no three of them may lie on a line.
 *
 * Taps that cannot be a view of a Card (repeated, in a line, or crossed over) give a map that
 * puts everything at the centre of the taps, so the Card check fails instead of the app.
 */
export function gridMap(known: Four<GridPoint>, tapped: Four<XY>): GridMap {
  // x = (a X + b Y + c) / (g X + h Y + 1), y = (d X + e Y + f) / (g X + h Y + 1)
  const A: number[][] = []
  const b: number[] = []
  known.forEach(({ col: X, row: Y }, i) => {
    const { x, y } = tapped[i]
    A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x], [0, 0, 0, X, Y, 1, -X * y, -Y * y])
    b.push(x, y)
  })
  const centre: XY = {
    x: tapped.reduce((s, p) => s + p.x, 0) / 4,
    y: tapped.reduce((s, p) => s + p.y, 0) / 4,
  }
  const h = solve(A, b)
  if (!h) return () => centre
  const [a, b2, c, d, e, f, g, h2] = h
  return ({ col: X, row: Y }) => {
    const w = g * X + h2 * Y + 1
    if (w < MIN_SCALE) return centre
    return { x: (a * X + b2 * Y + c) / w, y: (d * X + e * Y + f) / w }
  }
}

/**
 * Read sites for the wanted grid positions. The radius follows the local patch size, so it
 * shrinks on the far side of a tilted Card: it is a share of the pitch to the neighbouring
 * patch, in whichever direction the pitch is smaller.
 */
export function gridSites(known: Four<GridPoint>, tapped: Four<XY>, wanted: GridPoint[]): Site[] {
  const map = gridMap(known, tapped)
  const pitch = ({ col, row }: GridPoint, dc: number, dr: number) => {
    const a = map({ col: col - dc / 2, row: row - dr / 2 })
    const b = map({ col: col + dc / 2, row: row + dr / 2 })
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  return wanted.map((position) => ({
    center: map(position),
    radius: Math.max(
      MIN_RADIUS,
      READ_FRACTION * Math.min(pitch(position, 1, 0), pitch(position, 0, 1)),
    ),
  }))
}
