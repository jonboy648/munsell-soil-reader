// A simulated camera: renders a Card and a patch of soil of a known Chip under a chosen
// light, exposure and color shift. It drives the engine tests and the example Photos.
// Ported from the prototype's paintExample, plus a non-linear tone curve (the prototype's
// camera was linear, which flatters the results).
import * as munsell from "munsell"
import type { Batch } from "./batch"
import { encode, linearToLabD50, mul, type Mat3, type Vec3 } from "./color"
import { PATCH_LINEAR } from "./colorchecker"
import {
  FRAME_MARKERS,
  FRAME_PATCHES,
  FRAME_SIZE_MM,
  MARKER_CELLS,
  OUTLINE_MM,
  WINDOW_MM,
  markerCellIsWhite,
} from "./frameLayout"
import type { Four } from "./grid"
import { pageModel, type PageChip, type PageHue } from "./page"
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
  /** How far the camera is from the middle of the scene, in scene pixels. Default: the scene's own. */
  distance?: number
}

/** Where the camera stands: its lens, and the point of the scene it turns about and looks at. */
interface ViewGeometry {
  width: number
  height: number
  /** Pinhole focal length in Photo pixels. */
  focal: number
  /** How far the camera is from the pivot, in scene pixels, unless the tilt says otherwise. */
  distance: number
  pivot: XY
}

const [FIRST, LAST] = [simPatchCenter(0, 0), simPatchCenter(3, 5)]
/**
 * The ColorChecker scene: a focal length of about 70 degrees across the Photo's width, and by
 * default the camera this close to the middle of the Card's patch grid, close enough for strong
 * perspective.
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

function tiltedView(
  { yaw, pitch, distance: tiltDistance }: SimTilt,
  { width, height, focal, distance: sceneDistance, pivot }: ViewGeometry,
): View {
  const distance = tiltDistance ?? sceneDistance
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
  /**
   * Every ColorChecker patch's true center, row by row (a Page scene: every printed Chip).
   * Meaningless when the scene has no Card.
   */
  patches: XY[]
  /** The middle of the soil patch. */
  spot: XY
  /** A Page scene: the center of each hole, with soil behind it. Empty otherwise. */
  holes: XY[]
  /** Where the frame card really is. Present when the scene has one, which then has no ColorChecker, and `corners` is its outline. */
  frame?: {
    /** The outer corners of its four markers, TL, TR, BR, BL: what the finder should return. */
    outline: Corners
    /** Its window, TL, TR, BR, BL. */
    window: Four<XY>
    /** The true center of each reference patch, by ID. */
    patches: Record<string, XY>
    /** The made-up batch that goes with it. */
    batch: Batch
  }
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
  /** Put a Page of the soil book in the shot, with the soil behind its holes, instead of the ColorChecker. */
  page?: PageHue
  /** A Page scene: Chips with dirt on them, as notation to the share of the Chip the dirt covers (0 to 1). */
  smudged?: Record<string, number>
  /** A Page scene: a light film (dust, wax, a faded gloss) over Chips, as notation to its share (0 to 1). A film shows most on a dark Chip. */
  hazed?: Record<string, number>
  /** Put the frame card in the shot instead of the ColorChecker, with the soil in its window. */
  frame?: SimFrame
}

export function simulatePhoto(scene: SimScene): SimPhoto {
  if (scene.frame) return simulateFramePhoto({ ...scene, frame: scene.frame })
  return scene.page ? simulatePagePhoto({ ...scene, page: scene.page }) : simulateCardPhoto(scene)
}

/** The faults a real Photo has, painted over the finished pixels: shadow, glare, then JPEG. */
function paintFaults(data: Uint8ClampedArray, { shadow, glare = [], jpeg }: SimScene) {
  if (shadow) paintShadow(data, SIM_WIDTH, SIM_HEIGHT, shadow)
  paintGlare(data, SIM_WIDTH, SIM_HEIGHT, glare)
  if (jpeg !== undefined) paintJpeg(data, SIM_WIDTH, SIM_HEIGHT, jpeg)
}

function simulateCardPhoto({
  camera,
  card = true,
  soil = SIM_SOIL,
  seed = 7,
  cardScale = 1,
  frameGap,
  noise: noiseScale = 1,
  tilt,
  ...faults
}: SimScene): SimPhoto {
  const rand = mulberry32(seed)
  const layout = cardLayout(cardScale, frameGap)
  const view = tilt ? tiltedView(tilt, CARD_VIEW) : null // null: straight on, scene point = Photo pixel
  const looksAt: XY = { x: 0, y: 0 }
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
  paintFaults(data, { camera, ...faults })
  const at = ({ x, y }: XY) => (view ? view.toPhoto(x, y) : { x, y })
  return {
    pixels: { width: SIM_WIDTH, height: SIM_HEIGHT, data },
    corners: layout.corners.map(at) as Corners,
    patches: Array.from({ length: 24 }, (_, i) => at(layout.center(Math.floor(i / 6), i % 6))),
    spot: at(SIM_SPOT),
    holes: [],
  }
}

// ---- the frame card scene ----
/** The frame card in the scene: where its top left corner is, and how many scene pixels a millimetre is. */
const FRAME_AT = { x: 105, y: 50, scale: 5 }
const frameScene = ({ x, y }: XY): XY => ({ x: FRAME_AT.x + x * FRAME_AT.scale, y: FRAME_AT.y + y * FRAME_AT.scale })
const WINDOW_MIDDLE: XY = { x: (WINDOW_MM[0].x + WINDOW_MM[2].x) / 2, y: (WINDOW_MM[0].y + WINDOW_MM[2].y) / 2 }
/** The middle of the soil in the frame card's window, in the scene (and in a straight-on Photo). */
export const SIM_FRAME_SPOT: XY = frameScene(WINDOW_MIDDLE)
/**
 * How far back the camera stands from a tilted frame card (SimTilt.distance): far enough that the
 * whole card stays in the Photo at 45 degrees to the side and 25 degrees forward or back, and
 * near enough that the far side's markers are still big enough to read (they are not, from 1200).
 */
export const FRAME_DISTANCE = 1000
/** The frame scene is turned about the middle of the card. */
const FRAME_VIEW: ViewGeometry = {
  width: SIM_WIDTH,
  height: SIM_HEIGHT,
  focal: 700,
  distance: FRAME_DISTANCE,
  pivot: frameScene({ x: FRAME_SIZE_MM.width / 2, y: FRAME_SIZE_MM.height / 2 }),
}

/** A frame card in the scene, with its window full of the scene's soil. */
export interface SimFrame {
  /** Which of its four markers, 0 to 3, are printed, so a test can lose some. Default all four. */
  markers?: readonly number[]
  /**
   * How far the batch's measured values are from the tiles' true colors: a measurement error, in
   * CIELAB units, spread over L, a and b with alternating signs. Default 0: measured exactly.
   */
  batchError?: number
}

const SIM_BATCH_CODE = "SIM-1"

/** The color a patch is printed as: its aim, a Munsell notation ("N9.5 white" is the neutral N 9.5/). */
function aimLinear(aim: string): Vec3 {
  const gray = /^N([\d.]+)/.exec(aim)
  return munsell.munsellToLinearRgb(gray ? `N ${gray[1]}/` : aim) as Vec3
}

/**
 * A made-up batch for the simulated frame card: every patch measured as its aim, plus
 * `error` as above. Not a real measurement, and it says so in its method.
 */
export function simFrameBatch(error = 0): Batch {
  return {
    code: SIM_BATCH_CODE,
    patches: FRAME_PATCHES.filter((p) => p.kind !== "reserved").map((p, i) => {
      const lab = linearToLabD50(aimLinear(p.aim)).map((v, k) => v + ((i + k) % 2 === 0 ? error : -error))
      return { id: p.id, lab: lab as Vec3, sd: [0.2, 0.2, 0.2], n: 3, method: "made up for the simulated camera", date: "2026-01-01" }
    }),
  }
}

function simulateFramePhoto({
  camera,
  frame,
  soil = SIM_SOIL,
  seed = 7,
  tilt,
  noise: noiseScale = 1,
  ...faults
}: SimScene & { frame: SimFrame }): SimPhoto {
  const rand = mulberry32(seed)
  const view = tilt ? tiltedView(tilt, FRAME_VIEW) : null // null: straight on, scene point = Photo pixel
  const looksAt: XY = { x: 0, y: 0 }
  const ground = shoot(camera, munsell.munsellToLinearRgb("7.5YR 3/2") as Vec3)
  const soilRgb = shoot(camera, munsell.munsellToLinearRgb(soil) as Vec3)
  const base = shoot(camera, [0.012, 0.012, 0.012])
  const white = shoot(camera, [0.75, 0.75, 0.75])
  const printed = new Set(frame.markers ?? [0, 1, 2, 3])
  const tiles = FRAME_PATCHES.filter((p) => p.kind !== "reserved").map((p) => ({ patch: p, rgb: shoot(camera, aimLinear(p.aim)) }))
  const data = new Uint8ClampedArray(SIM_WIDTH * SIM_HEIGHT * 4)
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
      // Where on the card this pixel looks, in millimetres.
      const mx = (u - FRAME_AT.x) / FRAME_AT.scale
      const my = (v - FRAME_AT.y) / FRAME_AT.scale
      if (mx >= 0 && mx < FRAME_SIZE_MM.width && my >= 0 && my < FRAME_SIZE_MM.height) {
        rgb = base
        noise = 2
        for (const marker of FRAME_MARKERS) {
          if (!printed.has(marker.id)) continue
          const [lx, ly] = [mx - marker.corners[0].x, my - marker.corners[0].y]
          if (lx < -marker.quiet || ly < -marker.quiet || lx >= marker.side + marker.quiet || ly >= marker.side + marker.quiet) continue
          const [cx, cy] = [Math.floor(lx / marker.cell), Math.floor(ly / marker.cell)]
          const inside = cx >= 0 && cy >= 0 && cx < MARKER_CELLS && cy < MARKER_CELLS
          rgb = !inside || markerCellIsWhite(marker.id, cy, cx) ? white : base
        }
        for (const { patch, rgb: tile } of tiles) {
          if (Math.abs(mx - patch.center.x) < patch.size / 2 && Math.abs(my - patch.center.y) < patch.size / 2) rgb = tile
        }
        if (mx >= WINDOW_MM[0].x && mx < WINDOW_MM[2].x && my >= WINDOW_MM[0].y && my < WINDOW_MM[2].y) {
          rgb = soilRgb
          noise = 5
        }
      }
      const i = (y * SIM_WIDTH + x) * 4
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(rgb[k] + (rand() - 0.5) * 2 * noise * noiseScale)
      data[i + 3] = 255
    }
  }
  paintFaults(data, { camera, ...faults })
  const at = ({ x, y }: XY) => (view ? view.toPhoto(x, y) : { x, y })
  const onCard = (mm: XY) => at(frameScene(mm))
  const outline = OUTLINE_MM.map(onCard) as Corners
  return {
    pixels: { width: SIM_WIDTH, height: SIM_HEIGHT, data },
    corners: outline, // a frame scene has no ColorChecker: the outline stands in
    patches: [],
    spot: at(SIM_FRAME_SPOT),
    holes: [],
    frame: {
      outline,
      window: WINDOW_MM.map(onCard) as Four<XY>,
      patches: Object.fromEntries(tiles.map(({ patch }) => [patch.id, onCard(patch.center)])),
      batch: simFrameBatch(frame.batchError),
    },
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
/** What a haze is made of: a light gray film. */
const HAZE_LINEAR: Vec3 = [0.5, 0.5, 0.5]
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
  hazed = {},
  noise: noiseScale = 1,
  ...faults
}: SimScene & { page: PageHue }): SimPhoto {
  const rand = mulberry32(seed)
  const view = tilt ? tiltedView(tilt, PAGE_VIEW) : null
  const looksAt: XY = { x: 0, y: 0 }
  const { chips, taps } = pageModel(page)
  const at = ({ x, y }: XY) => (view ? view.toPhoto(x, y) : { x, y })
  const dirty = (chip: PageChip): Vec3 => {
    const [soot, film] = [smudged[chip.chip.notation] ?? 0, hazed[chip.chip.notation] ?? 0]
    return chip.linear.map((v, k) => (1 - soot) * ((1 - film) * v + film * HAZE_LINEAR[k]) + soot * SMUDGE_LINEAR[k]) as Vec3
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
      for (let k = 0; k < 3; k++) data[i + k] = Math.round(rgb[k] + (rand() - 0.5) * 2 * noise * noiseScale)
      data[i + 3] = 255
    }
  }
  paintFaults(data, { camera, ...faults })
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
export type ExampleId = "shift" | "warm" | "dim" | "wrong" | "nocard" | "angled" | "glare" | "page" | "frame" | "frame-angled" | "frame-hidden"

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
    id: "page",
    name: "Soil-book Page, worn",
    note: "A 10YR Page lies on the soil, and the soil shows through its holes. Pick Soil-book Page and 10YR, tap the four Chips shown, then tap inside a hole. Two Chips are smudged, as on a well-used book; the Card check leaves them out.",
    scene: { camera: phone(LIGHTS.warm), page: "10YR", smudged: WORN_CHIPS },
  },
  {
    id: "frame",
    name: "Frame as the Card",
    note: "The printed frame is a Card of its own. The app finds its four markers, so no corners are tapped: confirm the outline, then tap the soil in the window. The frame's batch is made up for this practice Photo.",
    scene: { camera: phone(LIGHTS.warm), frame: {} },
  },
  {
    id: "frame-angled",
    name: "Frame at an angle",
    note: "The frame is tilted away from the camera, about 40 degrees. The outline follows it, and every patch still lands.",
    scene: { camera: phone(LIGHTS.warm), frame: {}, tilt: ANGLED_TILT },
  },
  {
    id: "frame-hidden",
    name: "Frame with a marker hidden",
    note: "One of the frame's four markers is not in the Photo, so the app cannot find the frame and says why.",
    scene: { camera: phone(LIGHTS.warm), frame: { markers: [0, 1, 3] } },
  },
]
