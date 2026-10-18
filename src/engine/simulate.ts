// A simulated camera: renders a Card and a patch of soil of a known Chip under a chosen
// light, exposure and color shift. It drives the engine tests and the example Photos.
// Ported from the prototype's paintExample, plus a non-linear tone curve (the prototype's
// camera was linear, which flatters the results).
import * as munsell from "munsell"
import { encode, mul, type Mat3, type Vec3 } from "./color"
import { PATCH_LINEAR } from "./colorchecker"
import { paintGlare, paintJpeg, paintShadow, type Glare, type Shadow } from "./simulateFaults"
import type { Corners, Pixels, XY } from "./types"

/** What the camera does to the light before and after the sensor. */
export interface SimCamera {
  /** Scene linear RGB to camera linear RGB: the light, the exposure and the color shift. */
  light: (lin: Vec3) => Vec3
  /**
   * Non-linear tone curve applied to the display-encoded values, 0 to 1. 0 is the
   * prototype's linear camera. At strength k the curve is (1-k)*v + k*smoothstep(v): an
   * S-curve with mid-tone slope 1 + k/2 and slope 1 - k at the ends, so it crushes shadows
   * and compresses highlights the way a phone's processing does.
   */
  toneCurve?: number
}

export const LIGHTS = {
  /** A camera that sees the scene as it is. */
  neutral: (lin: Vec3): Vec3 => lin,
  /** Camera color shift: channel crosstalk plus a blue-heavy white balance. */
  shift: (lin: Vec3): Vec3 => {
    const crosstalk: Mat3 = [[0.85, 0.2, 0], [0.1, 0.8, 0.15], [0, 0.25, 0.7]]
    const [r, g, b] = mul(crosstalk, lin)
    return [r * 0.95, g, b * 1.25]
  },
  /** Orange shop light. */
  warm: (lin: Vec3): Vec3 => [lin[0] * 0.9 * 1.25, lin[1] * 0.9, lin[2] * 0.9 * 0.62],
  /** Underexposed. */
  dim: (lin: Vec3): Vec3 => [lin[0] * 0.45, lin[1] * 0.45, lin[2] * 0.45],
}

/**
 * A mild phone-like S-curve: mid-tone slope 1.15, slope 0.7 at black and white. A 3x3
 * correction copes with this. At 0.5 the warm-light case lands two Chips away, and at 0.7
 * several do. Root-polynomial correction does not fix that on this simulated camera (see
 * docs/correction-comparison.md), so the standard stays 0.3.
 */
export const PHONE_TONE_CURVE = 0.5

// ---- the scene ----
export const SIM_WIDTH = 960
export const SIM_HEIGHT = 600
const CARD = { x: 60, y: 120, patch: 62, gap: 12 }
const SOIL_BOX = { x: 650, y: 150, w: 240, h: 240 }

/** The Card's layout at a size: its top left corner stays put, patches and gaps scale. */
function cardLayout(scale: number) {
  const patch = CARD.patch * scale
  const gap = CARD.gap * scale
  const pitch = patch + gap
  const center = (r: number, c: number): XY => ({
    x: CARD.x + c * pitch + patch / 2,
    y: CARD.y + r * pitch + patch / 2,
  })
  return { patch, gap, pitch, center, frame: 16 * scale, corners: [center(0, 0), center(0, 5), center(3, 5), center(3, 0)] as Corners }
}

/** The Card's corner patch centers in the order the user taps them: TL, TR, BR, BL. */
export const SIM_CORNERS: Corners = cardLayout(1).corners
/** The middle of one patch of the usual-size Card, by row (0 to 3) and column (0 to 5). */
export const simPatchCenter = (row: number, column: number): XY => cardLayout(1).center(row, column)
/** The middle of the soil patch. */
export const SIM_SPOT: XY = { x: SOIL_BOX.x + SOIL_BOX.w / 2, y: SOIL_BOX.y + SOIL_BOX.h / 2 }
/** The Chip the simulated soil really is. */
export const SIM_SOIL = "10YR 4/3"

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const tone = (v: number, k: number) => (1 - k) * v + k * (v * v * (3 - 2 * v))

/** What the camera records for a scene color: 8-bit display RGB, clipped like a sensor. */
function shoot(camera: SimCamera, lin: Vec3): Vec3 {
  const seen = camera.light(lin)
  const k = camera.toneCurve ?? 0
  const out = seen.map((v) => {
    const encoded = Math.min(1, Math.max(0, encode(Math.max(0, v))))
    return Math.round(255 * tone(encoded, k))
  })
  return [out[0], out[1], out[2]]
}

export interface SimPhoto {
  pixels: Pixels & { data: Uint8ClampedArray<ArrayBuffer> }
  /** Corner patch centers, TL, TR, BR, BL. Meaningless when the scene has no Card. */
  corners: Corners
  /** The middle of the soil patch. */
  spot: XY
}

export interface SimScene {
  camera: SimCamera
  /** Put a ColorChecker in the shot. Default true. */
  card?: boolean
  /** The soil's true Chip, as Munsell notation. Default SIM_SOIL. */
  soil?: string
  /** Noise seed. Default 7. */
  seed?: number
  /** How big the Card is, 1 being the usual size. Its top left corner stays put. */
  cardScale?: number
  /** Reflections painted over the finished Photo. */
  glare?: Glare[]
  /** A shadow edge painted over the finished Photo. */
  shadow?: Shadow
  /** Sensor noise, as a multiple of the usual amount. Default 1. */
  noise?: number
  /** JPEG quality, 1 to 100, applied last. Absent: the Photo is not compressed. */
  jpeg?: number
}

export function simulatePhoto({
  camera,
  card = true,
  soil = SIM_SOIL,
  seed = 7,
  cardScale = 1,
  glare = [],
  shadow,
  noise: noiseScale = 1,
  jpeg,
}: SimScene): SimPhoto {
  const rand = mulberry32(seed)
  const layout = cardLayout(cardScale)
  const ground = shoot(camera, munsell.munsellToLinearRgb("7.5YR 3/2") as Vec3)
  const soilRgb = shoot(camera, munsell.munsellToLinearRgb(soil) as Vec3)
  const frame = shoot(camera, [0.012, 0.012, 0.012])
  const patches = PATCH_LINEAR.map((lin) => shoot(camera, lin))
  const data = new Uint8ClampedArray(SIM_WIDTH * SIM_HEIGHT * 4)
  const fx0 = CARD.x - layout.frame
  const fx1 = CARD.x + 6 * layout.pitch - layout.gap + layout.frame
  const fy0 = CARD.y - layout.frame
  const fy1 = CARD.y + 4 * layout.pitch - layout.gap + layout.frame
  for (let y = 0; y < SIM_HEIGHT; y++) {
    for (let x = 0; x < SIM_WIDTH; x++) {
      let rgb = ground
      let noise = 12
      if (card && x >= fx0 && x < fx1 && y >= fy0 && y < fy1) {
        rgb = frame
        noise = 2
        const cx = x - CARD.x
        const cy = y - CARD.y
        const c = Math.floor(cx / layout.pitch)
        const r = Math.floor(cy / layout.pitch)
        if (cx >= 0 && cy >= 0 && cx % layout.pitch < layout.patch && cy % layout.pitch < layout.patch && c < 6 && r < 4) {
          rgb = patches[r * 6 + c]
        }
      }
      if (x >= SOIL_BOX.x && x < SOIL_BOX.x + SOIL_BOX.w && y >= SOIL_BOX.y && y < SOIL_BOX.y + SOIL_BOX.h) {
        rgb = soilRgb
        noise = 5
      }
      const i = (y * SIM_WIDTH + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(rgb[k] + (rand() - 0.5) * 2 * noise * noiseScale)
      data[i + 3] = 255
    }
  }
  if (shadow) paintShadow(data, SIM_WIDTH, SIM_HEIGHT, shadow)
  paintGlare(data, SIM_WIDTH, SIM_HEIGHT, glare)
  if (jpeg !== undefined) paintJpeg(data, SIM_WIDTH, SIM_HEIGHT, jpeg)
  return { pixels: { width: SIM_WIDTH, height: SIM_HEIGHT, data }, corners: layout.corners, spot: SIM_SPOT }
}

// ---- the example Photos ----
export type ExampleId = "shift" | "warm" | "dim" | "wrong" | "nocard" | "glare"

export interface ExamplePhoto {
  id: ExampleId
  name: string
  note: string
  scene: SimScene
}

const phone = (light: SimCamera["light"]): SimCamera => ({ light, toneCurve: PHONE_TONE_CURVE })

export const EXAMPLES: ExamplePhoto[] = [
  {
    id: "shift",
    name: "Camera color shift",
    note: "The camera tints every color, so the raw Reading lands on the wrong Chip. The Card fixes it.",
    scene: { camera: phone(LIGHTS.shift) },
  },
  {
    id: "warm",
    name: "Warm shop light",
    note: "Orange light makes the raw Reading redder and stronger.",
    scene: { camera: phone(LIGHTS.warm) },
  },
  {
    id: "dim",
    name: "Too dark",
    note: "Underexposed. The raw value (lightness) comes out far too low.",
    scene: { camera: phone(LIGHTS.dim) },
  },
  {
    id: "wrong",
    name: "Corners out of order",
    note: "Tap the white patch (bottom left) first, then go clockwise. The Card check catches it.",
    scene: { camera: phone(LIGHTS.warm) },
  },
  {
    id: "nocard",
    name: "No Card in the shot",
    note: "Nothing to correct against, so the Reading is off.",
    scene: { camera: phone(LIGHTS.warm), card: false },
  },
  {
    id: "glare",
    name: "Glare on the Card and the soil",
    note: "Bright reflections fall on one Card patch and on the soil. Each is flagged where it is, with what to do.",
    scene: {
      camera: phone(LIGHTS.warm),
      glare: [
        { at: simPatchCenter(1, 4), radius: 34, strength: 1.5 },
        { at: { x: SIM_SPOT.x + 25, y: SIM_SPOT.y }, radius: 50, strength: 1.5 },
      ],
    },
  },
]
