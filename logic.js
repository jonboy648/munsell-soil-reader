// PROTOTYPE: photo -> Munsell soil color reading, with and without a ColorChecker card.
// Pure functions only (no DOM). The page calls in; nothing calls out. Liftable as-is.
// Needs the munsell.js library (MPL-2.0) passed in as `munsell`.

const MunsellReader = (() => {
  // ---- color math (sRGB / D65) ----
  const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  const rgb255ToLinear = (rgb) => rgb.map((v) => decode(v / 255));
  const linearToRgb255 = (lin) =>
    lin.map((v) => Math.round(255 * Math.min(1, Math.max(0, encode(Math.max(0, v))))));

  const M_RGB_XYZ = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.072175],
    [0.0193339, 0.119192, 0.9503041],
  ];
  const M_XYZ_RGB = [
    [3.2404542, -1.5371385, -0.4985314],
    [-0.969266, 1.8760108, 0.041556],
    [0.0556434, -0.2040259, 1.0572252],
  ];
  const BRADFORD_D50_TO_D65 = [
    [0.9555766, -0.0230393, 0.0631636],
    [-0.0282895, 1.0099416, 0.0210077],
    [0.0122982, -0.020483, 1.3299098],
  ];
  const WHITE_D65 = [0.95047, 1, 1.08883];
  const WHITE_D50 = [0.96422, 1, 0.82521];
  const mul = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

  const xyzToLab = (xyz, white = WHITE_D65) => {
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const [fx, fy, fz] = xyz.map((v, i) => f(v / white[i]));
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const labToXyz = (lab, white) => {
    const fy = (lab[0] + 16) / 116;
    const fx = fy + lab[1] / 500;
    const fz = fy - lab[2] / 200;
    const inv = (f) => (f ** 3 > 216 / 24389 ? f ** 3 : (116 * f - 16) / (24389 / 27));
    return [inv(fx), inv(fy), inv(fz)].map((v, i) => v * white[i]);
  };
  const linearToLab = (lin) => xyzToLab(mul(M_RGB_XYZ, lin));

  // CIEDE2000 color difference (standard formula, kL = kC = kH = 1).
  const deltaE2000 = (lab1, lab2) => {
    const [L1, a1, b1] = lab1;
    const [L2, a2, b2] = lab2;
    const rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1);
    const C2 = Math.hypot(a2, b2);
    const Cb7 = ((C1 + C2) / 2) ** 7;
    const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)));
    const a1p = (1 + G) * a1;
    const a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1);
    const C2p = Math.hypot(a2p, b2);
    const hp = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
    const h1p = hp(a1p, b1);
    const h2p = hp(a2p, b2);
    const dLp = L2 - L1;
    const dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
    const Lbp = (L1 + L2) / 2;
    const Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
      hbp /= 2;
    }
    const T =
      1 -
      0.17 * Math.cos((hbp - 30) * rad) +
      0.24 * Math.cos(2 * hbp * rad) +
      0.32 * Math.cos((3 * hbp + 6) * rad) -
      0.2 * Math.cos((4 * hbp - 63) * rad);
    const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
    const Cbp7 = Cbp ** 7;
    const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7));
    const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
    const SC = 1 + 0.045 * Cbp;
    const SH = 1 + 0.015 * Cbp * T;
    const RT = -Math.sin(2 * dTheta * rad) * RC;
    return Math.sqrt(
      (dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH),
    );
  };

  // ---- the card: X-Rite ColorChecker Classic 24, "after November 2014" Lab (D50) ----
  // Source: colour-science/colour, characterisation/datasets/colour_checkers.
  const CARD_NAMES = [
    'dark skin', 'light skin', 'blue sky', 'foliage', 'blue flower', 'bluish green',
    'orange', 'purplish blue', 'moderate red', 'purple', 'yellow green', 'orange yellow',
    'blue', 'green', 'red', 'yellow', 'magenta', 'cyan',
    'white 9.5', 'neutral 8', 'neutral 6.5', 'neutral 5', 'neutral 3.5', 'black 2',
  ];
  const CARD_LAB_D50 = [
    [37.54, 14.37, 14.92], [64.66, 19.27, 17.5], [49.32, -3.82, -22.54],
    [43.46, -12.74, 22.72], [54.94, 9.61, -24.79], [70.48, -32.26, -0.37],
    [62.73, 35.83, 56.5], [39.43, 10.75, -45.17], [50.57, 48.64, 16.67],
    [30.1, 22.54, -20.87], [71.77, -24.13, 58.19], [71.51, 18.24, 67.37],
    [28.37, 15.42, -49.8], [54.38, -39.72, 32.27], [42.43, 51.05, 28.62],
    [81.8, 2.67, 80.41], [50.63, 51.28, -14.12], [49.57, -29.71, -28.32],
    [95.19, -1.03, 2.93], [81.29, -0.57, 0.44], [66.89, -0.75, -0.06],
    [50.76, -0.13, 0.14], [35.63, -0.46, -0.48], [20.64, 0.07, -0.46],
  ];
  // Reference patch colors as linear sRGB (D65), via Bradford D50 -> D65.
  const CARD_LINEAR = CARD_LAB_D50.map((lab) =>
    mul(M_XYZ_RGB, mul(BRADFORD_D50_TO_D65, labToXyz(lab, WHITE_D50))),
  );
  const NEUTRAL_PATCHES = [18, 19, 20, 21, 22, 23];

  // Patch centers from the 4 corner patch centers the user clicked, in this order:
  // top-left (dark skin), top-right (bluish green), bottom-right (black), bottom-left (white).
  const patchCenters = ([tl, tr, br, bl]) => {
    const out = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const u = c / 5;
        const v = r / 3;
        out.push([0, 1].map((k) =>
          (1 - u) * (1 - v) * tl[k] + u * (1 - v) * tr[k] + u * v * br[k] + (1 - u) * v * bl[k],
        ));
      }
    }
    return out;
  };

  // ---- the three corrections ----
  // White balance: one gain per channel, fitted on the 6 gray patches.
  const fitWhiteBalance = (measured) => {
    const gains = [0, 1, 2].map((ch) => {
      let num = 0;
      let den = 0;
      for (const i of NEUTRAL_PATCHES) {
        num += measured[i][ch] * CARD_LINEAR[i][ch];
        den += measured[i][ch] ** 2;
      }
      return den > 0 ? num / den : 1;
    });
    return (lin) => lin.map((v, ch) => v * gains[ch]);
  };

  // Full card: 3x3 matrix fitted on all 24 patches (least squares).
  const solve3 = (A, b) => {
    const det = (m) =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(A);
    return [0, 1, 2].map((k) => det(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / D);
  };
  const fitMatrix = (measured) => {
    const AtA = [0, 1, 2].map((i) => [0, 1, 2].map((j) =>
      measured.reduce((s, m) => s + m[i] * m[j], 0)));
    const rows = [0, 1, 2].map((ch) => {
      const Atb = [0, 1, 2].map((i) => measured.reduce((s, m, p) => s + m[i] * CARD_LINEAR[p][ch], 0));
      return solve3(AtA, Atb);
    });
    return (lin) => mul(rows, lin);
  };

  // How well a correction reproduces the card itself: average CIEDE2000 over the 24 patches.
  const cardFitError = (measured, correct) => {
    const total = measured.reduce(
      (s, m, i) => s + deltaE2000(linearToLab(correct(m)), linearToLab(CARD_LINEAR[i])), 0);
    return total / measured.length;
  };

  // ---- soil chips: approximate Munsell soil-book grid (not the official chip list) ----
  const SOIL_HUES = [['10R', 10], ['2.5YR', 12.5], ['5YR', 15], ['7.5YR', 17.5], ['10YR', 20], ['2.5Y', 22.5], ['5Y', 25]];
  const SOIL_VALUES = [2.5, 3, 4, 5, 6, 7, 8];
  const SOIL_CHROMAS = [1, 2, 3, 4, 6, 8];
  const buildSoilChips = (munsell) => {
    const chips = [];
    const add = (name, h, v, c) => {
      const lin = munsell.mhvcToLinearRgb(h, v, c);
      if (lin.every((x) => x >= 0 && x <= 1)) chips.push({ name, lin, lab: linearToLab(lin) });
    };
    for (const [hName, h] of SOIL_HUES)
      for (const v of SOIL_VALUES)
        for (const c of SOIL_CHROMAS) add(`${hName} ${v}/${c}`, h, v, c);
    for (const v of SOIL_VALUES) add(`N ${v}`, 0, v, 0);
    return chips;
  };

  const read = (munsell, chips, lin) => {
    const lab = linearToLab(lin);
    let exact = '';
    try {
      exact = munsell.linearRgbToMunsell(...lin.map((v) => Math.max(0, v)), undefined, 1, 1e-6, 200, 'last');
    } catch (e) {
      exact = '(no answer)';
    }
    let best = null;
    for (const chip of chips) {
      const dE = deltaE2000(lab, chip.lab);
      if (!best || dE < best.dE) best = { chip: chip.name, dE };
    }
    return { exact, nearestChip: best.chip, chipDE: best.dE, rgb255: linearToRgb255(lin), lab };
  };

  // One full reading: raw, white balance, full card. `cardMeasured` may be null (no card in shot).
  const readSample = (munsell, chips, sampleLinear, cardMeasured) => {
    const out = { raw: read(munsell, chips, sampleLinear), wb: null, full: null };
    if (cardMeasured) {
      const wb = fitWhiteBalance(cardMeasured);
      const full = fitMatrix(cardMeasured);
      out.wb = { ...read(munsell, chips, wb(sampleLinear)), cardFit: cardFitError(cardMeasured, wb) };
      out.full = { ...read(munsell, chips, full(sampleLinear)), cardFit: cardFitError(cardMeasured, full) };
      out.rawCardFit = cardFitError(cardMeasured, (x) => x);
    }
    return out;
  };

  return {
    rgb255ToLinear, linearToRgb255, linearToLab, deltaE2000,
    CARD_NAMES, CARD_LINEAR, patchCenters, fitWhiteBalance, fitMatrix, cardFitError,
    buildSoilChips, readSample,
  };
})();

if (typeof module !== 'undefined') module.exports = MunsellReader;
