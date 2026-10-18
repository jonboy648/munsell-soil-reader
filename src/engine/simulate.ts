// A simulated camera: renders a Card and a patch of soil of a known Chip under a chosen
// light, exposure and color shift. It drives the engine tests and the example Photos.
// Ported from the prototype's paintExample, plus a non-linear tone curve (the prototype's
// camera was linear, which flatters the results).
import * as munsell from "munsell"
import { encode, mul, type Mat3, type Vec3 } from "./color"
import { PATCH_LINEAR } from "./colorchecker"
import { pageModel, type PageChip, type PageHue } from "./page"
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
const PITCH = CARD.patch + CARD.gap

const patchCenter = (r: number, c: number): XY => ({
  x: CARD.x + c * PITCH + CARD.patch / 2,
  y: CARD.y + r * PITCH + CARD.patch / 2,
})

const PATCH_CENTERS: XY[] = Array.from({ length: 24 }, (_, i) => patchCenter(Math.floor(i / 6), i % 6))

/** The Card's corner patch centers in the order the user taps them: TL, TR, BR, BL. */
export const SIM_CORNERS: Corners = [patchCenter(0, 0), patchCenter(0, 5), patchCenter(3, 5), patchCenter(3, 0)]
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
}

/** Where the camera stands: its lens, and the point of the scene it turns about and looks at. */
interface ViewGeometry {
  width: number
  height: number
  /** Pinhole focal length in Photo pixels. */
  focal: number
  /** How far the camera is from the pivot, in scene pixels. */
  distance: number
  pivot: XY
}

const [FIRST, LAST] = [patchCenter(0, 0), patchCenter(3, 5)]
/**
 * The ColorChecker scene: a focal length of about 70 degrees across the Photo's width, and the
 * camera this close to the middle of the Card's patch grid, close enough for strong perspective.
 */
const CARD_VIEW: ViewGeometry = {
  width: SIM_WIDTH,
  height: SIM_HEIGHT,
  focal: 700,
  distance: 500,
  pivot: { x: (FIRST.x + LAST.x) / 2, y: (FIRST.y + LAST.y) / 2 },
}

/** The scene is a flat plane. A view maps its points to the Photo and the Photo's pixels back. */
interface View {
  toPhoto: (u: number, v: number) => XY
  /** Writes the scene point that Photo pixel (x, y) looks at into `out`; -Infinity above the horizon. */
  toScene: (x: number, y: number, out: XY) => void
}

function tiltedView({ yaw, pitch }: SimTilt, { width, height, focal, distance, pivot }: ViewGeometry): View {
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
      const a = u - pivot.x
      const b = v - pivot.y
      const z = distance + a * right[2] + b * down[2]
      return {
        x: width / 2 + (focal * (a * right[0] + b * down[0])) / z,
        y: height / 2 + (focal * (a * right[1] + b * down[1])) / z,
      }
    },
    toScene: (x, y, out) => {
      const rx = (x - width / 2) / focal
      const ry = (y - height / 2) / focal
      const facing = normal[0] * rx + normal[1] * ry + normal[2]
      if (facing <= 0) {
        out.x = out.y = -Infinity
        return
      }
      out.x = pivot.x + (distance * (ux * rx + uy * ry)) / facing
      out.y = pivot.y + (distance * (vx * rx + vy * ry)) / facing
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
  /**
   * Corner patch centers, TL, TR, BR, BL. Meaningless when the scene has no Card. A Page scene
   * has the four Chips the user taps instead (`pageModel(hue).taps`), in the same order.
   */
  corners: Corners
  /** Every ColorChecker patch's true center, row by row (a Page scene: every printed Chip). Meaningless when the scene has no Card. */
  patches: XY[]
  /** The middle of the soil patch. */
  spot: XY
  /** A Page scene: the center of each hole, with soil behind it. Empty otherwise. */
  holes: XY[]
}

export interface SimScene {
  camera: SimCamera
  /** Put a ColorChecker in the shot. Default true. */
  card?: boolean
  /** The soil's true Chip, as Munsell notation. Default SIM_SOIL. */
  soil?: string
  /** Noise seed. Default 7. */
  seed?: number
  /** Photograph the scene at an angle, so the Card is in perspective. Default: straight on. */
  tilt?: SimTilt
  /** Put a Page of the soil book in the shot, with the soil behind its holes, instead of the ColorChecker. */
  page?: PageHue
  /** A Page scene: Chips with dirt on them, as notation to the share of the Chip the dirt covers (0 to 1). */
  smudged?: Record<string, number>
}

export function simulatePhoto(scene: SimScene): SimPhoto {
  if (scene.page) return simulatePagePhoto({ ...scene, page: scene.page })
  const { camera, card = true, soil = SIM_SOIL, seed = 7, tilt } = scene
  const rand = mulberry32(seed)
  const view = tilt ? tiltedView(tilt, CARD_VIEW) : null // null: straight on, scene point = Photo pixel
  const looksAt: XY = { x: 0, y: 0 }
  const ground = shoot(camera, munsell.munsellToLinearRgb("7.5YR 3/2") as Vec3)
  const soilRgb = shoot(camera, munsell.munsellToLinearRgb(soil) as Vec3)
  const frame = shoot(camera, [0.012, 0.012, 0.012])
  const patches = PATCH_LINEAR.map((lin) => shoot(camera, lin))
  const data = new Uint8ClampedArray(SIM_WIDTH * SIM_HEIGHT * 4)
  const fx0 = CARD.x - 16
  const fx1 = CARD.x + 6 * PITCH - CARD.gap + 16
  const fy0 = CARD.y - 16
  const fy1 = CARD.y + 4 * PITCH - CARD.gap + 16
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
      if (card && u >= fx0 && u < fx1 && v >= fy0 && v < fy1) {
        rgb = frame
        noise = 2
        const cx = u - CARD.x
        const cy = v - CARD.y
        const c = Math.floor(cx / PITCH)
        const r = Math.floor(cy / PITCH)
        if (cx >= 0 && cy >= 0 && cx % PITCH < CARD.patch && cy % PITCH < CARD.patch && c < 6 && r < 4) {
          rgb = patches[r * 6 + c]
        }
      }
      if (u >= SOIL_BOX.x && u < SOIL_BOX.x + SOIL_BOX.w && v >= SOIL_BOX.y && v < SOIL_BOX.y + SOIL_BOX.h) {
        rgb = soilRgb
        noise = 5
      }
      const i = (y * SIM_WIDTH + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(rgb[k] + (rand() - 0.5) * 2 * noise)
      data[i + 3] = 255
    }
  }
  const at = ({ x, y }: XY) => (view ? view.toPhoto(x, y) : { x, y })
  return {
    pixels: { width: SIM_WIDTH, height: SIM_HEIGHT, data },
    corners: SIM_CORNERS.map(at) as Corners,
    patches: PATCH_CENTERS.map(at),
    spot: at(SIM_SPOT),
    holes: [],
  }
}

// ---- the Page scene ----
// A Page lies on the soil. It is white paper with the Chips printed as rectangles in a grid, and
// round holes punched between vertically neighbouring Chips; the soil shows through them. The
// proportions are measured on a photo of a real 10YR Page: the Chips are four fifths of a column
// wide and two thirds of a row tall, and a hole is as wide as a Chip, so it bites into the Chip
// above and the Chip below and leaves a solid middle on each.
const PAGE = { x: 110, y: 80, col: 49, row: 74 } // the center of the first Chip, and the pitch
const PAGE_CHIP = { w: 39, h: 50 }
const PAGE_HOLE_DIAMETER = 39
const PAGE_PAPER = { x0: 58, x1: 395, y0: 20, y1: 584 }
const PAGE_PAPER_LINEAR: Vec3 = [0.78, 0.78, 0.8]
/** What a smudge is made of: soot, nearly black. */
const SMUDGE_LINEAR: Vec3 = [0.015, 0.014, 0.012]
/** The Page scene is turned about the middle of the Photo, with the camera farther off than for the Card. */
const PAGE_VIEW: ViewGeometry = {
  width: SIM_WIDTH,
  height: SIM_HEIGHT,
  focal: 700,
  distance: 1000,
  pivot: { x: SIM_WIDTH / 2, y: SIM_HEIGHT / 2 },
}

const pageCenter = (col: number, row: number): XY => ({ x: PAGE.x + col * PAGE.col, y: PAGE.y + row * PAGE.row })

function simulatePagePhoto({
  camera,
  page,
  soil = SIM_SOIL,
  seed = 7,
  tilt,
  smudged = {},
}: SimScene & { page: PageHue }): SimPhoto {
  const rand = mulberry32(seed)
  const view = tilt ? tiltedView(tilt, PAGE_VIEW) : null
  const looksAt: XY = { x: 0, y: 0 }
  const { chips, taps } = pageModel(page)
  const at = ({ x, y }: XY) => (view ? view.toPhoto(x, y) : { x, y })
  const dirty = (chip: PageChip): Vec3 => {
    const share = smudged[chip.chip.notation] ?? 0
    return chip.linear.map((v, k) => (1 - share) * v + share * SMUDGE_LINEAR[k]) as Vec3
  }
  const printed = new Map<string, Vec3>(chips.map((c) => [`${c.col},${c.row}`, shoot(camera, dirty(c))]))
  const ground = shoot(camera, munsell.munsellToLinearRgb("7.5YR 3/2") as Vec3)
  const soilRgb = shoot(camera, munsell.munsellToLinearRgb(soil) as Vec3)
  const paper = shoot(camera, PAGE_PAPER_LINEAR)
  const data = new Uint8ClampedArray(SIM_WIDTH * SIM_HEIGHT * 4)
  for (let y = 0; y < SIM_HEIGHT; y++) {
    for (let x = 0; x < SIM_WIDTH; x++) {
      let u = x
      let v = y
      if (view) {
        view.toScene(x, y, looksAt)
        u = looksAt.x
        v = looksAt.y
      }
      let rgb = ground
      let noise = 12
      if (u >= PAGE_PAPER.x0 && u < PAGE_PAPER.x1 && v >= PAGE_PAPER.y0 && v < PAGE_PAPER.y1) {
        rgb = paper
        noise = 2
        const col = Math.round((u - PAGE.x) / PAGE.col)
        const row = Math.round((v - PAGE.y) / PAGE.row)
        const chip = printed.get(`${col},${row}`)
        const middle = pageCenter(col, row)
        if (chip && Math.abs(u - middle.x) <= PAGE_CHIP.w / 2 && Math.abs(v - middle.y) <= PAGE_CHIP.h / 2) rgb = chip
        // The hole below the nearest Chip row boundary exists when the Chips above and below it do.
        const above = Math.floor((v - PAGE.y) / PAGE.row)
        const hole = pageCenter(col, above + 0.5)
        if (
          printed.has(`${col},${above}`) &&
          printed.has(`${col},${above + 1}`) &&
          (u - hole.x) ** 2 + (v - hole.y) ** 2 <= (PAGE_HOLE_DIAMETER / 2) ** 2
        ) {
          rgb = soilRgb
          noise = 5
        }
      }
      if (u >= SOIL_BOX.x && u < SOIL_BOX.x + SOIL_BOX.w && v >= SOIL_BOX.y && v < SOIL_BOX.y + SOIL_BOX.h) {
        rgb = soilRgb
        noise = 5
      }
      const i = (y * SIM_WIDTH + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(rgb[k] + (rand() - 0.5) * 2 * noise)
      data[i + 3] = 255
    }
  }
  const holes: XY[] = chips
    .filter((c) => chips.some((d) => d.col === c.col && d.row === c.row + 1))
    .map((c) => at(pageCenter(c.col, c.row + 0.5)))
  return {
    pixels: { width: SIM_WIDTH, height: SIM_HEIGHT, data },
    corners: taps.map((c) => at(pageCenter(c.col, c.row))) as Corners,
    patches: chips.map((c) => at(pageCenter(c.col, c.row))),
    spot: at(SIM_SPOT),
    holes,
  }
}

// ---- the example Photos ----
export type ExampleId = "shift" | "warm" | "dim" | "wrong" | "nocard" | "angled" | "page"

export interface ExamplePhoto {
  id: ExampleId
  name: string
  note: string
  scene: SimScene
}

const phone = (light: SimCamera["light"]): SimCamera => ({ light, toneCurve: PHONE_TONE_CURVE })

/** A strong tilt: the right side of the scene turned 40 degrees away. */
export const ANGLED_TILT: SimTilt = { yaw: 40, pitch: 0 }

/** Jon's 10YR Page has dark smudges on 8/1 and 7/1, which are steps of the ladder. */
const WORN_CHIPS = { "10YR 8/1": 0.3, "10YR 7/1": 0.3 }

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
    id: "page",
    name: "Soil-book Page, worn",
    note: "A 10YR Page lies on the soil, and the soil shows through its holes. Pick Soil-book Page and 10YR, tap the four Chips shown, then tap inside a hole. Two Chips are smudged, as on a well-used book; the Card check leaves them out.",
    scene: { camera: phone(LIGHTS.warm), page: "10YR", smudged: WORN_CHIPS },
  },
]
