// A simulated camera: renders a Card and a patch of soil of a known Chip under a chosen
// light, exposure and color shift. It drives the engine tests and the example Photos.
// Ported from the prototype's paintExample, plus a non-linear tone curve (the prototype's
// camera was linear, which flatters the results).
import * as munsell from "munsell"
import { encode, mul, type Mat3, type Vec3 } from "./color"
import { PATCH_LINEAR } from "./colorchecker"
import { BOARD, MARKER_CELLS, MARKER_ORIGINS, MARKER_SIZE, markerCellIsWhite } from "./frameLayout"
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
function cardLayout(scale: number, frameGap = CARD.gap) {
  const patch = CARD.patch * scale
  const gap = frameGap * scale
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

// ---- the camera's angle on the scene ----
/**
 * Degrees. Yaw turns the right side of the scene away from the camera, pitch turns the
 * bottom away. Positive yaw keeps the Card near and the soil far, so both stay in the Photo.
 */
export interface SimTilt {
  yaw: number
  pitch: number
  /** How far the camera is from the middle of the Card, in scene pixels. Default DISTANCE. */
  distance?: number
}

/** Pinhole focal length in Photo pixels: about 70 degrees across the Photo's width. */
const FOCAL = 700
/** By default the camera is this far from the middle of the Card, close enough for strong perspective. */
const DISTANCE = 500
/** The scene is turned about the middle of the Card's patch grid. */
/** The usual-size Card's patch pitch: the printed frame is laid out in its grid steps. */
const PITCH = cardLayout(1).pitch
const [FIRST, LAST] = [simPatchCenter(0, 0), simPatchCenter(3, 5)]
const PIVOT: XY = { x: (FIRST.x + LAST.x) / 2, y: (FIRST.y + LAST.y) / 2 }

/** The scene is a flat plane. A view maps its points to the Photo and the Photo's pixels back. */
interface View {
  toPhoto: (u: number, v: number) => XY
  /** Writes the scene point that Photo pixel (x, y) looks at into `out`; -Infinity above the horizon. */
  toScene: (x: number, y: number, out: XY) => void
}

function tiltedView({ yaw, pitch, distance = DISTANCE }: SimTilt): View {
  const rad = Math.PI / 180
  const [sy, cy] = [Math.sin(yaw * rad), Math.cos(yaw * rad)]
  const [sp, cp] = [Math.sin(pitch * rad), Math.cos(pitch * rad)]
  // Where the scene's right, down and out-of-plane directions point after the turn.
  const right = [cy, -sp * sy, cp * sy]
  const down = [0, cp, sp]
  const normal = [-sy, -sp * cy, cp * cy]
  // A pixel's ray hits the plane at t = distance * normal.z / (ray . normal), which makes the
  // scene point a ratio of two linear functions of the ray: the same for u (right) and v (down).
  const across = (axis: number[], k: number) => normal[2] * axis[k] - axis[2] * normal[k]
  const [ux, uy, vx, vy] = [across(right, 0), across(right, 1), across(down, 0), across(down, 1)]
  return {
    toPhoto: (u, v) => {
      const a = u - PIVOT.x
      const b = v - PIVOT.y
      const z = distance + a * right[2] + b * down[2]
      return {
        x: SIM_WIDTH / 2 + (FOCAL * (a * right[0] + b * down[0])) / z,
        y: SIM_HEIGHT / 2 + (FOCAL * (a * right[1] + b * down[1])) / z,
      }
    },
    toScene: (x, y, out) => {
      const rx = (x - SIM_WIDTH / 2) / FOCAL
      const ry = (y - SIM_HEIGHT / 2) / FOCAL
      const facing = normal[0] * rx + normal[1] * ry + normal[2]
      if (facing <= 0) {
        out.x = out.y = -Infinity
        return
      }
      out.x = PIVOT.x + (distance * (ux * rx + uy * ry)) / facing
      out.y = PIVOT.y + (distance * (vx * rx + vy * ry)) / facing
    },
  }
}

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
  /** Every ColorChecker patch's true center, row by row. Meaningless when the scene has no Card. */
  patches: XY[]
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
  /** The black frame between patches, in pixels at Card scale 1 (the patches are 62). Default 12. */
  frameGap?: number
  /** Sensor noise, as a multiple of the usual amount. Default 1. */
  noise?: number
  /** JPEG quality, 1 to 100, applied last. Absent: the Photo is not compressed. */
  jpeg?: number
  /** Photograph the scene at an angle, so the Card is in perspective. Default: straight on. */
  tilt?: SimTilt
  /**
   * Put the printed frame around the Card: a light board with an ArUco marker in each corner
   * (see frameLayout.ts). Default false.
   */
  frame?: boolean
  /** Which of the frame's markers, 0 to 3, are printed, so a test can lose some. Default all four. */
  frameMarkers?: readonly number[]
}

export function simulatePhoto({
  camera,
  card = true,
  soil = SIM_SOIL,
  seed = 7,
  cardScale = 1,
  frameGap,
  glare = [],
  shadow,
  noise: noiseScale = 1,
  jpeg,
  tilt,
  frame: framed = false,
  frameMarkers = [0, 1, 2, 3],
}: SimScene): SimPhoto {
  const rand = mulberry32(seed)
  const layout = cardLayout(cardScale, frameGap)
  const view = tilt ? tiltedView(tilt) : null // null: straight on, scene point = Photo pixel
  const looksAt: XY = { x: 0, y: 0 }
  const ground = shoot(camera, munsell.munsellToLinearRgb("7.5YR 3/2") as Vec3)
  const soilRgb = shoot(camera, munsell.munsellToLinearRgb(soil) as Vec3)
  const frame = shoot(camera, [0.012, 0.012, 0.012])
  const board = shoot(camera, [0.6, 0.6, 0.6])
  const patches = PATCH_LINEAR.map((lin) => shoot(camera, lin))
  const data = new Uint8ClampedArray(SIM_WIDTH * SIM_HEIGHT * 4)
  const fx0 = CARD.x - layout.frame
  const fx1 = CARD.x + 6 * layout.pitch - layout.gap + layout.frame
  const fy0 = CARD.y - layout.frame
  const fy1 = CARD.y + 4 * layout.pitch - layout.gap + layout.frame
  for (let y = 0; y < SIM_HEIGHT; y++) {
    for (let x = 0; x < SIM_WIDTH; x++) {
      // Where in the flat scene this pixel looks.
      let u = x
      let v = y
      if (view) {
        view.toScene(x, y, looksAt)
        u = looksAt.x
        v = looksAt.y
      }
      let rgb = ground
      let noise = 12
      if (framed) {
        // Where in the Card's grid steps this scene point is.
        const col = (u - FIRST.x) / PITCH
        const row = (v - FIRST.y) / PITCH
        if (col >= BOARD[0] && col < BOARD[1] && row >= BOARD[2] && row < BOARD[3]) {
          rgb = board
          noise = 2
          for (const id of frameMarkers) {
            const cellCol = Math.floor(((col - MARKER_ORIGINS[id].col) / MARKER_SIZE) * MARKER_CELLS)
            const cellRow = Math.floor(((row - MARKER_ORIGINS[id].row) / MARKER_SIZE) * MARKER_CELLS)
            if (cellCol >= 0 && cellRow >= 0 && cellCol < MARKER_CELLS && cellRow < MARKER_CELLS) {
              rgb = markerCellIsWhite(id, cellRow, cellCol) ? board : frame
            }
          }
        }
      }
      if (card && u >= fx0 && u < fx1 && v >= fy0 && v < fy1) {
        rgb = frame
        noise = 2
        const cx = u - CARD.x
        const cy = v - CARD.y
        const c = Math.floor(cx / layout.pitch)
        const r = Math.floor(cy / layout.pitch)
        if (cx >= 0 && cy >= 0 && cx % layout.pitch < layout.patch && cy % layout.pitch < layout.patch && c < 6 && r < 4) {
          rgb = patches[r * 6 + c]
        }
      }
      if (u >= SOIL_BOX.x && u < SOIL_BOX.x + SOIL_BOX.w && v >= SOIL_BOX.y && v < SOIL_BOX.y + SOIL_BOX.h) {
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
  const at = ({ x, y }: XY) => (view ? view.toPhoto(x, y) : { x, y })
  return {
    pixels: { width: SIM_WIDTH, height: SIM_HEIGHT, data },
    corners: layout.corners.map(at) as Corners,
    patches: Array.from({ length: 24 }, (_, i) => at(layout.center(Math.floor(i / 6), i % 6))),
    spot: at(SIM_SPOT),
  }
}

// ---- the example Photos ----
export type ExampleId = "shift" | "warm" | "dim" | "wrong" | "nocard" | "angled" | "glare" | "smudge"

export interface ExamplePhoto {
  id: ExampleId
  name: string
  note: string
  scene: SimScene
}

const phone = (light: SimCamera["light"]): SimCamera => ({ light, toneCurve: PHONE_TONE_CURVE })

/** A strong tilt: the right side of the scene turned 40 degrees away. */
export const ANGLED_TILT: SimTilt = { yaw: 40, pitch: 0 }

/** A black patch gone gray with handling: the scene color lifted toward a dull gray before the camera sees it. */
const hazyBlack =
  (light: SimCamera["light"]): SimCamera["light"] =>
  (lin) =>
    light(lin === PATCH_LINEAR[23] ? [lin[0] * 0.8 + 0.04, lin[1] * 0.8 + 0.04, lin[2] * 0.8 + 0.04] : lin)

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
    id: "angled",
    name: "Card at an angle",
    note: "The Card is tilted away from the camera, about 40 degrees. Tap its four corner patches where they are; every patch still lands.",
    scene: { camera: phone(LIGHTS.warm), tilt: ANGLED_TILT },
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
  {
    id: "smudge",
    name: "Smudged black patch",
    note: "The Card's black patch has gone gray with handling, and the soil is dark. The Card check names the patch, leaves it out and still reads the soil.",
    scene: { camera: phone(hazyBlack(LIGHTS.warm)), soil: "10YR 2.5/2" },
  },
]
