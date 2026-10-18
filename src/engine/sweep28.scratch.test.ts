// Scratch: sweeps for ticket 28. Writes JSON per family to SWEEP_DIR. Not committed.
import { mkdirSync, writeFileSync } from "node:fs"
import * as munsell from "munsell"
import { it } from "vitest"
import fixture from "./golden/realSensor.json"
import { deltaE2000 } from "./index"
import { nearestChips } from "./chips"
import { decode, encode, linearToLab, type Vec3 } from "./color"
import { NEUTRAL_PATCHES, PATCH_LINEAR, PATCH_NAMES, patchCenters } from "./colorchecker"
import { fitMatrix, heldOutErrors, linearizeThen, pchip, type Fit, type Reference } from "./correction"
import { gammaCurve, leastSquaresPolynomial, robustPolynomial } from "./correctionCandidates.testkit"
import { medianLinear, patchRadius, spotRadius } from "./sampling"
import { LIGHTS, SIM_CORNERS, SIM_SPOT, simulatePhoto, type SimCamera, type SimPhoto } from "./simulate"
import type { Corners } from "./types"

const DIR = process.env.SWEEP_DIR!
const FAMILY = process.env.FAMILY!
const FITS: Record<string, Fit> = {
  pchip: linearizeThen(pchip),
  poly2: linearizeThen(leastSquaresPolynomial(2)),
  poly3: linearizeThen(leastSquaresPolynomial(3)),
  rpoly2: linearizeThen(robustPolynomial(2)),
  rpoly3: linearizeThen(robustPolynomial(3)),
  gamma: linearizeThen(gammaCurve),
  m3x3: fitMatrix,
}
const FIT_NAMES = (process.env.FITS ?? "pchip,poly2,poly3,rpoly2,rpoly3,gamma").split(",")

const SOILS = ["10YR 4/3", "7.5YR 5/6", "10YR 6/3", "2.5Y 7/2", "5YR 3/4", "10R 4/6", "10YR 3/1", "2.5Y 8/2", "10YR 2.5/2", "10YR 3/2", "10YR 8/2"]
const SHADE = (l: Vec3): Vec3 => [l[0] * 0.64, l[1] * 0.76, l[2] * 0.96]
const SHIFT_DIM = (l: Vec3) => LIGHTS.shift([l[0] * 0.5, l[1] * 0.5, l[2] * 0.5])
const SIM_LIGHTS: Record<string, SimCamera["light"]> = { shift: LIGHTS.shift, warm: LIGHTS.warm, dim: LIGHTS.dim, shade: SHADE, dimshift: SHIFT_DIM }

const PAGES = ["10R", "2.5YR", "5YR", "7.5YR", "10YR", "2.5Y", "5Y"]
const VALUES = [2, 2.5, 3, 4, 5, 6, 7, 8, 8.5, 9, 9.5]
const CHROMAS = [1, 2, 3, 4, 6, 8]
function steps(a: string, b: string) {
  const parse = (n: string) => { const m = /^(\S+) ([\d.]+)\/([\d.]+)$/.exec(n); return m ? [PAGES.indexOf(m[1]), VALUES.indexOf(Number(m[2])), CHROMAS.indexOf(Number(m[3]))] : null }
  const pa = parse(a), pb = parse(b)
  if (a === b) return 0
  if (!pa || !pb || pa.includes(-1) || pb.includes(-1)) return 99
  return pa.reduce((s, v, i) => s + Math.abs(v - pb[i]), 0)
}
const key = (v: Vec3) => v.map((x) => x.toFixed(9)).join(",")
const FILM = munsell.munsellToLinearRgb("10YR 4/3") as Vec3
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]

type SceneMod = (scene: Vec3) => Vec3
interface Case { family: string; light: string; tone: number; soil: string; damage: string; corners?: Corners }
interface Maker { camera: (c: Case) => SimCamera; post?: (photo: SimPhoto, c: Case) => void }

function build(c: Case, baseLight: SimCamera["light"], tone: number, mods: Map<number, SceneMod> = new Map()): SimPhoto {
  const table = new Map<string, number>()
  PATCH_LINEAR.forEach((p, i) => table.set(key(p), i))
  const light = (lin: Vec3): Vec3 => {
    const i = table.get(key(lin))
    return baseLight(i !== undefined && mods.has(i) ? mods.get(i)!(lin) : lin)
  }
  return simulatePhoto({ camera: { light, toneCurve: tone }, soil: c.soil })
}

function evaluate(photo: SimPhoto, c: Case, out: unknown[]) {
  const corners = c.corners ?? SIM_CORNERS
  const radius = patchRadius(corners)
  const refs: Reference[] = patchCenters(corners).map((p, i) => ({
    measured: medianLinear(photo.pixels, p, radius),
    truth: PATCH_LINEAR[i],
    ladder: NEUTRAL_PATCHES.includes(i),
    name: PATCH_NAMES[i],
  }))
  const spot = medianLinear(photo.pixels, SIM_SPOT, spotRadius(photo.pixels))
  const trueLab = linearToLab(munsell.munsellToLinearRgb(c.soil) as Vec3)
  const read = (correct: (v: Vec3) => Vec3) => {
    const lab = linearToLab(correct(spot))
    const best = nearestChips(lab)[0]
    return { de: deltaE2000(lab, trueLab), steps: steps(best.chip.chip.notation, c.soil), chip: best.chip.chip.notation }
  }
  for (const fitName of FIT_NAMES) {
    const fit = FITS[fitName]
    const errs = heldOutErrors(refs, fit)
    let w = -1
    refs.forEach((r, i) => { if (r.ladder && (w < 0 || errs[i] > errs[w])) w = i })
    const refs2 = refs.filter((_, i) => i !== w)
    const errs2 = heldOutErrors(refs2, fit)
    const full = read(fit(refs))
    const dropped = read(fit(refs2))
    out.push({ ...c, corners: undefined, fit: fitName, errs, w, errs2, ...full, de2: dropped.de, steps2: dropped.steps, chip2: dropped.chip })
  }
}

const round = (a: unknown[]) => JSON.stringify(a, (_k, v) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v))

it("sweep", () => {
  mkdirSync(DIR, { recursive: true })
  const out: unknown[] = []
  if (FAMILY === "honest-sim") {
    for (const soil of SOILS) for (const tone of [0, 0.3, 0.5, 0.7]) for (const [light, fn] of Object.entries(SIM_LIGHTS)) {
      const c = { family: FAMILY, light, tone, soil, damage: "none" }
      evaluate(build(c, fn, tone), c, out)
    }
  }
  if (FAMILY === "honest-real") {
    for (const [lname, lt] of Object.entries(fixture.lights)) for (const soil of SOILS) for (const tone of [0, 0.3, 0.5, 0.7]) {
      const c = { family: FAMILY, light: lname, tone, soil, damage: "none" }
      const table = new Map<string, Vec3>()
      PATCH_LINEAR.forEach((p, i) => table.set(key(p), lt.patches[i] as Vec3))
      table.set(key(munsell.munsellToLinearRgb(soil) as Vec3), (lt.soils as Record<string, number[]>)[soil] as Vec3)
      const photo = simulatePhoto({ camera: { light: (lin) => table.get(key(lin)) ?? lin, toneCurve: tone }, soil })
      evaluate(photo, c, out)
    }
  }
  if (FAMILY === "gradient") {
    for (const soil of ["10YR 4/3", "5YR 3/4", "10YR 8/2", "10YR 2.5/2"]) for (const tone of [0.3, 0.7]) for (const [light, fn] of Object.entries(SIM_LIGHTS)) for (const grad of [0.1, 0.2]) {
      const c = { family: FAMILY, light, tone, soil, damage: `gradient${grad}` }
      const photo = build(c, fn, tone)
      const { width, height, data } = photo.pixels
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const f = 1 - grad * Math.min(1, Math.max(0, (x - 60) / 430))
        const i = (y * width + x) * 4
        for (let k = 0; k < 3; k++) data[i + k] = Math.round(255 * encode(decode(data[i + k] / 255) * f))
      }
      evaluate(photo, c, out)
    }
  }
  if (FAMILY === "damaged-ladder") {
    const lights = ["warm", "dim", "shade"]
    const conds: [string, number, SceneMod][] = []
    for (const g of NEUTRAL_PATCHES) {
      for (const a of [0.1, 0.17, 0.25]) conds.push([`film${a}@${PATCH_NAMES[g]}`, g, (s) => mix(s, FILM, a)])
      if (g <= 19) for (const b of [0.08, 0.2]) conds.push([`yellow${b}@${PATCH_NAMES[g]}`, g, (s) => [s[0], s[1] * (1 - b / 4), s[2] * (1 - b)]])
      if (g >= 22) for (const a of [0.1, 0.2]) conds.push([`haze${a}@${PATCH_NAMES[g]}`, g, (s) => mix(s, [0.2, 0.2, 0.2], a)])
    }
    for (const soil of SOILS) for (const tone of [0.3, 0.7]) for (const light of lights) for (const [name, patch, mod] of conds) {
      const c = { family: FAMILY, light, tone, soil, damage: name }
      evaluate(build(c, SIM_LIGHTS[light], tone, new Map([[patch, mod]])), c, out)
    }
  }
  if (FAMILY === "card-damage") {
    // the old families: dirty color patches, glare, shadows, corners wrong or off
    const [tl, tr, br, bl] = SIM_CORNERS
    const centre = { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 }
    const shift = (dx: number): Corners => SIM_CORNERS.map((p) => ({ x: p.x + dx, y: p.y })) as Corners
    const scale = (k: number): Corners => SIM_CORNERS.map((p) => ({ x: centre.x + (p.x - centre.x) * k, y: centre.y + (p.y - centre.y) * k })) as Corners
    const corners: Record<string, Corners> = {
      "order-rot1": [bl, tl, tr, br], "order-rot2": [br, bl, tl, tr], "order-rot3": [tr, br, bl, tl],
      "order-m1": [tr, tl, bl, br], "order-m2": [tl, bl, br, tr], "order-m3": [bl, br, tr, tl], "order-m4": [br, tr, tl, bl],
      shift24: shift(24), shift36: shift(36), shrink25: scale(0.75), grow10: scale(1.1),
    }
    const colorMods: Record<string, Map<number, SceneMod>> = {
      dirty13: new Map([[13, (s) => mix(s, [0.5, 0.1, 0.1], 0.8)]]),
      dirtyRed8: new Map([[8, (s) => mix(s, [0.1, 0.1, 0.5], 0.6)]]),
      glare1: new Map([[1, (s) => mix(s, [1.2, 1.2, 1.2], 0.7)]]),
      two: new Map([[13, (s) => mix(s, [0.5, 0.1, 0.1], 0.8)], [4, (s) => mix(s, [0.1, 0.1, 0.5], 0.7)]]),
      sat15: new Map([[10, (s) => mix(s, [0.1, 0.3, 0.1], 0.3)]]),
    }
    for (const soil of ["10YR 4/3", "5YR 3/4", "10YR 8/2", "10YR 2.5/2"]) for (const tone of [0.3, 0.7]) for (const light of ["warm", "dim", "shade", "shift", "dimshift"]) {
      const fn = SIM_LIGHTS[light]
      for (const [name, cs] of Object.entries(corners)) {
        const c = { family: FAMILY, light, tone, soil, damage: name, corners: cs }
        evaluate(build(c, fn, tone), c, out)
      }
      for (const [name, mods] of Object.entries(colorMods)) {
        const c = { family: FAMILY, light, tone, soil, damage: name }
        evaluate(build(c, fn, tone, mods), c, out)
      }
      for (const f of [0.85, 0.7, 0.5]) {
        const c = { family: FAMILY, light, tone, soil, damage: `shadow${f}` }
        const photo = build(c, fn, tone)
        const { width, data } = photo.pixels
        patchCenters(SIM_CORNERS).forEach(({ x, y }, patch) => {
          if (patch % 6 < 3) return
          for (let j = Math.round(y) - 31; j <= Math.round(y) + 31; j++) for (let i = Math.round(x) - 31; i <= Math.round(x) + 31; i++) for (let k = 0; k < 3; k++) data[(j * width + i) * 4 + k] *= f
        })
        evaluate(photo, c, out)
      }
    }
  }
  if (FAMILY === "real-gradient" || FAMILY === "real-damage") {
    const conds: [string, number, SceneMod][] = []
    if (FAMILY === "real-damage") {
      for (const g of NEUTRAL_PATCHES) {
        for (const a of [0.1, 0.25]) conds.push([`film${a}@${PATCH_NAMES[g]}`, g, (s) => mix(s, FILM, a)])
        if (g >= 22) conds.push([`haze0.2@${PATCH_NAMES[g]}`, g, (s) => mix(s, [0.2, 0.2, 0.2], 0.2)])
        if (g <= 19) conds.push([`yellow0.2@${PATCH_NAMES[g]}`, g, (s) => [s[0], s[1] * 0.95, s[2] * 0.8]])
      }
    } else conds.push(["gradient0.1", -1, (s) => s], ["gradient0.2", -1, (s) => s])
    for (const [lname, lt] of Object.entries(fixture.lights)) for (const soil of ["10YR 4/3", "5YR 3/4", "10YR 8/2", "10YR 2.5/2", "7.5YR 5/6"]) for (const tone of [0.3, 0.5]) for (const [name, patch, mod] of conds) {
      const c = { family: FAMILY, light: lname, tone, soil, damage: name }
      const table = new Map<string, Vec3>()
      PATCH_LINEAR.forEach((p, i) => table.set(key(p), (patch === i ? mod(lt.patches[i] as Vec3) : (lt.patches[i] as Vec3))))
      table.set(key(munsell.munsellToLinearRgb(soil) as Vec3), (lt.soils as Record<string, number[]>)[soil] as Vec3)
      const photo = simulatePhoto({ camera: { light: (lin) => table.get(key(lin)) ?? lin, toneCurve: tone }, soil })
      if (FAMILY === "real-gradient") {
        const grad = Number(name.slice(8))
        const { width, height, data } = photo.pixels
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const f = 1 - grad * Math.min(1, Math.max(0, (x - 60) / 430))
          const i = (y * width + x) * 4
          for (let k = 0; k < 3; k++) data[i + k] = Math.round(255 * encode(decode(data[i + k] / 255) * f))
        }
      }
      evaluate(photo, c, out)
    }
  }
  writeFileSync(`${DIR}/${FAMILY}.json`, round(out))
})
