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
 * A shadow edge: full light at `from`, `gain` of the light at `to` and beyond, and a straight
 * blend between. `from` can be larger than `to`, which puts the shadow on the low side. `gain`
 * is a share of the linear light, so 0.5 is one stop darker. The edge runs across the Photo
 * along `axis`: "x" (the default) is an edge with a vertical line, so the light changes left to
 * right, and "y" an edge with a horizontal line, so it changes top to bottom.
 */
export interface Shadow {
  from: number
  to: number
  gain: number
  axis?: "x" | "y"
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
  const gainAt = (t: number) => {
    const along = Math.min(1, Math.max(0, (t - shadow.from) / (shadow.to - shadow.from)))
    return 1 + along * (shadow.gain - 1)
  }
  const byX = shadow.axis !== "y"
  for (let a = 0; a < (byX ? width : height); a++) {
    const gain = gainAt(a)
    if (gain === 1) continue
    const map = lut(gain)
    for (let b = 0; b < (byX ? height : width); b++) {
      const i = (byX ? b * width + a : a * width + b) * 4
      for (let k = 0; k < 3; k++) data[i + k] = map[data[i + k]]
    }
  }
}

// ---- JPEG ----
// The standard JPEG quantization tables (ITU T.81, Annex K), scaled by quality as libjpeg does.
const Q_LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51,
  87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
]
const Q_CHROMA = Array.from({ length: 64 }, (_, i) => {
  const [r, c] = [i >> 3, i & 7]
  if (r < 4 && c < 4) return [[17, 18, 24, 47], [18, 21, 26, 66], [24, 26, 56, 99], [47, 66, 99, 99]][r][c]
  return 99
})
const COS = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: 8 }, (_, x) => (u === 0 ? Math.SQRT1_2 : 1) * 0.5 * Math.cos(((2 * x + 1) * u * Math.PI) / 16)),
)

/** Quantize every 8x8 block of a plane in place: forward DCT, divide and round, inverse DCT. */
function codePlane(plane: Float32Array, w: number, h: number, table: number[]) {
  const block = new Float64Array(64)
  const tmp = new Float64Array(64)
  for (let by = 0; by < h; by += 8) {
    for (let bx = 0; bx < w; bx += 8) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          block[y * 8 + x] = plane[Math.min(h - 1, by + y) * w + Math.min(w - 1, bx + x)] - 128
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        // The first pass along rows, the second along columns: F = C B C^T.
        for (let a = 0; a < 8; a++) {
          for (let u = 0; u < 8; u++) {
            let sum = 0
            for (let x = 0; x < 8; x++) sum += COS[u][x] * (pass === 0 ? block[a * 8 + x] : block[x * 8 + a])
            tmp[pass === 0 ? a * 8 + u : u * 8 + a] = sum
          }
        }
        block.set(tmp)
      }
      for (let i = 0; i < 64; i++) block[i] = Math.round(block[i] / table[i]) * table[i]
      for (let pass = 0; pass < 2; pass++) {
        for (let a = 0; a < 8; a++) {
          for (let x = 0; x < 8; x++) {
            let sum = 0
            for (let u = 0; u < 8; u++) sum += COS[u][x] * (pass === 0 ? block[a * 8 + u] : block[u * 8 + a])
            tmp[pass === 0 ? a * 8 + x : x * 8 + a] = sum
          }
        }
        block.set(tmp)
      }
      for (let y = 0; y < 8 && by + y < h; y++) {
        for (let x = 0; x < 8 && bx + x < w; x++) plane[(by + y) * w + bx + x] = block[y * 8 + x] + 128
      }
    }
  }
}

/**
 * Compress and decompress the Photo the way a camera's JPEG does: luma at full size, color
 * at half size in each direction, each 8x8 block quantized. Thin dark lines next to bright
 * patches pick up ringing and color bleed this way, which is why the Card's black frame is a
 * hard thing to measure.
 */
export function paintJpeg(data: Uint8ClampedArray, width: number, height: number, quality: number) {
  const scale = quality < 50 ? 5000 / quality : 200 - 2 * quality
  const tables = [Q_LUMA, Q_CHROMA].map((t) => t.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100)))))
  const n = width * height
  const [cw, ch] = [Math.ceil(width / 2), Math.ceil(height / 2)]
  const y = new Float32Array(n)
  const cb = new Float32Array(cw * ch)
  const cr = new Float32Array(cw * ch)
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const p = (j * width + i) * 4
      const [r, g, b] = [data[p], data[p + 1], data[p + 2]]
      y[j * width + i] = 0.299 * r + 0.587 * g + 0.114 * b
      const c = (j >> 1) * cw + (i >> 1)
      cb[c] += (128 - 0.168736 * r - 0.331264 * g + 0.5 * b) / 4
      cr[c] += (128 + 0.5 * r - 0.418688 * g - 0.081312 * b) / 4
    }
  }
  codePlane(y, width, height, tables[0])
  codePlane(cb, cw, ch, tables[1])
  codePlane(cr, cw, ch, tables[1])
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const c = (j >> 1) * cw + (i >> 1)
      const [l, u, v] = [y[j * width + i], cb[c] - 128, cr[c] - 128]
      const p = (j * width + i) * 4
      data[p] = l + 1.402 * v
      data[p + 1] = l - 0.344136 * u - 0.714136 * v
      data[p + 2] = l + 1.772 * u
    }
  }
}
