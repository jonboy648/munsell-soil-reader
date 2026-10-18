// Color math in sRGB / D65. Ported from the prototype's logic.js.

export type Vec3 = [number, number, number]
export type Mat3 = [Vec3, Vec3, Vec3]

const map3 = (v: Vec3, f: (x: number, i: number) => number): Vec3 => [f(v[0], 0), f(v[1], 1), f(v[2], 2)]

/** sRGB transfer function, 0-1 encoded to 0-1 linear. */
export const decode = (v: number): number =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
/** Inverse of decode. */
export const encode = (v: number): number =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055

export const rgb255ToLinear = (rgb: Vec3): Vec3 => map3(rgb, (v) => decode(v / 255))
export const linearToRgb255 = (lin: Vec3): Vec3 =>
  map3(lin, (v) => Math.round(255 * Math.min(1, Math.max(0, encode(Math.max(0, v))))))

export const M_RGB_XYZ: Mat3 = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
]
export const M_XYZ_RGB: Mat3 = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
]
export const BRADFORD_D50_TO_D65: Mat3 = [
  [0.9555766, -0.0230393, 0.0631636],
  [-0.0282895, 1.0099416, 0.0210077],
  [0.0122982, -0.020483, 1.3299098],
]
export const BRADFORD_D65_TO_D50: Mat3 = [
  [1.0478112, 0.0228866, -0.050127],
  [0.0295424, 0.9904844, -0.0170491],
  [-0.0092345, 0.0150436, 0.7521316],
]
export const WHITE_D65: Vec3 = [0.95047, 1, 1.08883]
export const WHITE_D50: Vec3 = [0.96422, 1, 0.82521]

export const mul = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
]

const EPSILON = 216 / 24389
const KAPPA = 24389 / 27

export const xyzToLab = (xyz: Vec3, white: Vec3 = WHITE_D65): Vec3 => {
  const f = (t: number) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116)
  const [fx, fy, fz] = map3(xyz, (v, i) => f(v / white[i]))
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export const labToXyz = (lab: Vec3, white: Vec3): Vec3 => {
  const fy = (lab[0] + 16) / 116
  const fx = fy + lab[1] / 500
  const fz = fy - lab[2] / 200
  const inv = (f: number) => (f ** 3 > EPSILON ? f ** 3 : (116 * f - 16) / KAPPA)
  return map3([inv(fx), inv(fy), inv(fz)], (v, i) => v * white[i])
}

export const linearToLab = (lin: Vec3): Vec3 => xyzToLab(mul(M_RGB_XYZ, lin))

/**
 * CIELAB under D50, the way reference colors are published, to linear sRGB (D65), Bradford-adapted.
 * Not clamped: a color outside the sRGB gamut comes out with a channel below 0 or above 1.
 */
export const labD50ToLinear = (lab: Vec3): Vec3 =>
  mul(M_XYZ_RGB, mul(BRADFORD_D50_TO_D65, labToXyz(lab, WHITE_D50)))

/** The inverse of labD50ToLinear. */
export const linearToLabD50 = (lin: Vec3): Vec3 =>
  xyzToLab(mul(BRADFORD_D65_TO_D50, mul(M_RGB_XYZ, lin)), WHITE_D50)

/** Relative luminance (white is 1) of a linear sRGB color. */
export const luminance = (lin: Vec3): number => mul(M_RGB_XYZ, lin)[1]

/** CIEDE2000 color difference (Sharma, Wu and Dalal 2005; kL = kC = kH = 1). */
export const deltaE2000 = (lab1: Vec3, lab2: Vec3): number => {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cb7 = ((C1 + C2) / 2) ** 7
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const hp = (a: number, b: number) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360)
  const h1p = hp(a1p, b1)
  const h2p = hp(a2p, b2)
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad)
  const Lbp = (L1 + L2) / 2
  const Cbp = (C1p + C2p) / 2
  let hbp = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360
    hbp /= 2
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2))
  const Cbp7 = Cbp ** 7
  const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7))
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2)
  const SC = 1 + 0.045 * Cbp
  const SH = 1 + 0.015 * Cbp * T
  const RT = -Math.sin(2 * dTheta * rad) * RC
  return Math.sqrt(
    (dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH),
  )
}
