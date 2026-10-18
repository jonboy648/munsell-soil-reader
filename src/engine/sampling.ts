// Median sampling of a Photo around a point.
import { rgb255ToLinear, type Vec3 } from "./color"
import type { Pixels, XY } from "./types"

/** Read radius for a Spot. It follows the Photo's size. */
export const spotRadius = (pixels: Pick<Pixels, "width" | "height">): number =>
  Math.max(6, Math.round(Math.max(pixels.width, pixels.height) * 0.025))

const median = (values: number[]): number =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** Per-channel median 8-bit color inside the circle (clipped to the Photo). */
export function medianRgb255(pixels: Pixels, center: XY, radius: number): Vec3 {
  const { width, height, data } = pixels
  const vals: number[][] = [[], [], []]
  const y0 = Math.max(0, Math.round(center.y - radius))
  const y1 = Math.min(height - 1, Math.round(center.y + radius))
  const x0 = Math.max(0, Math.round(center.x - radius))
  const x1 = Math.min(width - 1, Math.round(center.x + radius))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if ((x - center.x) ** 2 + (y - center.y) ** 2 > radius * radius) continue
      const i = (y * width + x) * 4
      for (let k = 0; k < 3; k++) vals[k].push(data[i + k])
    }
  }
  if (vals[0].length === 0) {
    // The circle holds no pixel (a tap on or past the edge): use the nearest one.
    const x = Math.min(width - 1, Math.max(0, Math.round(center.x)))
    const y = Math.min(height - 1, Math.max(0, Math.round(center.y)))
    const i = (y * width + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  }
  return [median(vals[0]), median(vals[1]), median(vals[2])]
}

/** Median color inside the circle, as linear sRGB. */
export const medianLinear = (pixels: Pixels, center: XY, radius: number): Vec3 =>
  rgb255ToLinear(medianRgb255(pixels, center, radius))
