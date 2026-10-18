// Faults a real Photo has and a clean simulated one does not: glare on shiny surfaces and a
// shadow across part of the scene. They are painted over the finished pixels, so they stand
// in for what the camera recorded, not for the light itself.
import { decode, encode } from "./color"
import type { XY } from "./types"

/** A specular reflection: a soft white blob. The core clips to pure white. */
export interface Glare {
  at: XY
  /** Where the blob fades out completely, in Photo pixels. */
  radius: number
  /** White added at the center, as a share of full scale. 1 is just enough to clip a mid-gray. */
  strength: number
}

/**
 * A shadow edge running down the Photo: full light left of `x0`, `gain` of the light right of
 * `x1`, and a straight blend between. `gain` is a share of the linear light, so 0.5 is one
 * stop darker.
 */
export interface Shadow {
  x0: number
  x1: number
  gain: number
}

const smooth = (t: number) => t * t * (3 - 2 * t)

export function paintGlare(data: Uint8ClampedArray, width: number, height: number, glares: Glare[]) {
  for (const { at, radius, strength } of glares) {
    const y0 = Math.max(0, Math.floor(at.y - radius))
    const y1 = Math.min(height - 1, Math.ceil(at.y + radius))
    const x0 = Math.max(0, Math.floor(at.x - radius))
    const x1 = Math.min(width - 1, Math.ceil(at.x + radius))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - at.x, y - at.y)
        if (d >= radius) continue
        const add = 255 * strength * smooth(1 - d / radius)
        const i = (y * width + x) * 4
        for (let k = 0; k < 3; k++) data[i + k] += add // the array clamps at 255
      }
    }
  }
}

export function paintShadow(data: Uint8ClampedArray, width: number, height: number, shadow: Shadow) {
  const lut = (gain: number) => Array.from({ length: 256 }, (_, v) => Math.round(255 * encode(decode(v / 255) * gain)))
  const gainAt = (x: number) =>
    x <= shadow.x0 ? 1 : x >= shadow.x1 ? shadow.gain : 1 + ((x - shadow.x0) / (shadow.x1 - shadow.x0)) * (shadow.gain - 1)
  for (let x = 0; x < width; x++) {
    const gain = gainAt(x)
    if (gain === 1) continue
    const map = lut(gain)
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = map[data[i + k]]
    }
  }
}
