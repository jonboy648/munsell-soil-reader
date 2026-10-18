import * as munsell from "munsell"
import { it } from "vitest"
import fixture from "./golden/realSensor.json"
import { deltaE2000, readPhoto } from "./index"
import { linearToLab, rgb255ToLinear, type Vec3 } from "./color"
import { fitMatrix, linearizeThen, pchip, type Fit } from "./correction"
import { fitRootPolynomial, piecewiseLinear } from "./correctionCandidates.testkit"
import { PATCH_LINEAR } from "./colorchecker"
import { SIM_CORNERS, SIM_SPOT, simulatePhoto } from "./simulate"

const key = (v: Vec3) => v.map((x) => x.toFixed(9)).join(",")
const methods: Record<string, Fit | undefined> = { shipped: undefined, m3x3: fitMatrix, rp2: fitRootPolynomial(2), pwl: linearizeThen(piecewiseLinear), pchipRp2: linearizeThen(pchip, fitRootPolynomial(2)) }
it("real sensor", () => {
  const lines: string[] = []
  for (const [lname, light] of Object.entries(fixture.lights)) {
    for (const tone of [0, 0.3, 0.5, 0.7]) {
      const stats: Record<string, { checks: number[]; des: number[] }> = {}
      for (const m of Object.keys(methods)) stats[m] = { checks: [], des: [] }
      for (const [soil, cam] of Object.entries(light.soils)) {
        const table = new Map<string, Vec3>()
        PATCH_LINEAR.forEach((p, i) => table.set(key(p), light.patches[i] as Vec3))
        table.set(key(munsell.munsellToLinearRgb(soil) as Vec3), cam as Vec3)
        const sim = simulatePhoto({ camera: { light: (lin) => table.get(key(lin)) ?? lin, toneCurve: tone }, soil })
        const trueLab = linearToLab(munsell.munsellToLinearRgb(soil) as Vec3)
        for (const [m, fit] of Object.entries(methods)) {
          const r = readPhoto({ pixels: sim.pixels, card: { kind: "colorchecker", corners: SIM_CORNERS }, spots: [SIM_SPOT], ...(fit ? { correction: fit } : {}) })
          stats[m].checks.push(r.cardCheck!.meanDE)
          stats[m].des.push(deltaE2000(linearToLab(rgb255ToLinear(r.readings[0].corrected!.rgb)), trueLab))
        }
      }
      const f = (a: number[]) => `${Math.min(...a).toFixed(2)}-${Math.max(...a).toFixed(2)}`
      lines.push(`${lname.padEnd(4)} tone ${tone}: ` + Object.entries(stats).map(([m, s]) => `${m} chk ${f(s.checks)} de ${f(s.des)}`).join(" | "))
    }
  }
  console.log(lines.join("\n"))
})
