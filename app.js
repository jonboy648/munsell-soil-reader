// Munsell Soil Reader page: photos, taps, rendering. Color logic lives in logic.js (MunsellReader).
import * as munsell from 'https://cdn.jsdelivr.net/npm/munsell@1.1.7/+esm';

const R = MunsellReader;
const CHIPS = R.buildSoilChips(munsell);
const TRUTH = '10YR 4/3';
const TRUTH_CHIP = CHIPS.find((c) => c.name === TRUTH);
const chipByName = new Map(CHIPS.map((c) => [c.name, c]));
const CORNER_NAMES = ['brown patch (top left)', 'bluish-green patch (top right)', 'black patch (bottom right)', 'white patch (bottom left)'];
const CARD_OK = 3;

const $ = (id) => document.getElementById(id);
const canvas = $('photo');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let pixels = null;

const state = { photo: null, noCard: false, corners: [], sample: null, reading: null, example: null };

// ---- simulated cameras for the examples ----
const mul3 = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const warm = (lin) => lin.map((v, i) => v * 0.9 * [1.25, 1.0, 0.62][i]);
const EXAMPLES = {
  shift: { name: 'Camera color shift', note: 'White balance alone lands on the wrong chip. The full card fixes it.',
    cam: (lin) => mul3([[0.85, 0.2, 0], [0.1, 0.8, 0.15], [0, 0.25, 0.7]], lin).map((v, i) => v * [0.95, 1, 1.25][i]) },
  warm: { name: 'Warm shop light', note: 'Orange light makes the raw reading redder and stronger.', cam: warm },
  dim: { name: 'Too dark', note: 'Underexposed. The raw value (lightness) comes out far too low.', cam: (lin) => lin.map((v) => v * 0.45) },
  wrong: { name: 'Corners tapped out of order', note: 'Started on the white patch. The card check catches it.', cam: warm, order: [3, 0, 1, 2] },
  nocard: { name: 'No card in the shot', note: 'Nothing to correct against, so the reading is off.', cam: warm, noCard: true },
};

const CARD = { x: 60, y: 120, patch: 62, gap: 12 };
const pitch = CARD.patch + CARD.gap;
const patchCenter = (r, c) => [CARD.x + c * pitch + CARD.patch / 2, CARD.y + r * pitch + CARD.patch / 2];
const SAMPLE = { x: 650, y: 150, w: 240, h: 240 };
const AUTO_CORNERS = [patchCenter(0, 0), patchCenter(0, 5), patchCenter(3, 5), patchCenter(3, 0)];

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function paintExample(ex) {
  canvas.width = 960;
  canvas.height = 600;
  const rand = rng(7);
  const shot = (lin) => R.linearToRgb255(ex.cam(lin));
  const ground = shot(munsell.munsellToLinearRgb('7.5YR 3/2'));
  const soil = shot(TRUTH_CHIP.lin);
  const frame = shot([0.012, 0.012, 0.012]);
  const patches = R.CARD_LINEAR.map(shot);
  const img = ctx.createImageData(960, 600);
  const [fx0, fx1, fy0, fy1] = [CARD.x - 16, CARD.x + 6 * pitch - CARD.gap + 16, CARD.y - 16, CARD.y + 4 * pitch - CARD.gap + 16];
  for (let y = 0; y < 600; y++) {
    for (let x = 0; x < 960; x++) {
      let rgb = ground;
      let noise = 12;
      if (!ex.noCard && x >= fx0 && x < fx1 && y >= fy0 && y < fy1) {
        rgb = frame;
        noise = 2;
        const cx = x - CARD.x, cy = y - CARD.y;
        const c = Math.floor(cx / pitch), r = Math.floor(cy / pitch);
        if (cx >= 0 && cy >= 0 && cx % pitch < CARD.patch && cy % pitch < CARD.patch && c < 6 && r < 4) rgb = patches[r * 6 + c];
      }
      if (x >= SAMPLE.x && x < SAMPLE.x + SAMPLE.w && y >= SAMPLE.y && y < SAMPLE.y + SAMPLE.h) {
        rgb = soil;
        noise = 5;
      }
      const i = (y * 960 + x) * 4;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, Math.round(rgb[k] + (rand() - 0.5) * 2 * noise)));
      img.data[i + 3] = 255;
    }
  }
  pixels = img;
}

function loadExample(key) {
  const ex = EXAMPLES[key];
  paintExample(ex);
  state.example = key;
  state.photo = { name: `Example: ${ex.name.toLowerCase()} (simulated camera)`, truth: TRUTH };
  state.noCard = !!ex.noCard;
  state.corners = ex.noCard ? [] : (ex.order || [0, 1, 2, 3]).map((i) => AUTO_CORNERS[i].slice());
  state.sample = [SAMPLE.x + SAMPLE.w / 2, SAMPLE.y + SAMPLE.h / 2];
  compute();
  render();
}

function loadOwnPhoto(file) {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    const scale = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    canvas.width = Math.round(im.naturalWidth * scale);
    canvas.height = Math.round(im.naturalHeight * scale);
    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    state.example = null;
    state.photo = { name: `Your photo: ${file.name}`, truth: null };
    restartMarks();
    render();
  };
  im.onerror = () => {
    $('hint').textContent = "That file didn't open as an image. Try a JPEG or PNG.";
  };
  im.src = url;
}

// ---- sampling ----
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// Patch read radius follows the card's size in the photo; soil radius follows the photo size.
const patchRadius = () => (state.corners.length > 1 ? Math.max(2, 0.2 * dist(state.corners[0], state.corners[1]) / 5) : 6);
const soilRadius = () => Math.max(6, Math.round(Math.max(canvas.width, canvas.height) * 0.025));
function sampleAt([px, py], r) {
  const vals = [[], [], []];
  for (let y = Math.max(0, Math.round(py - r)); y <= Math.min(canvas.height - 1, Math.round(py + r)); y++) {
    for (let x = Math.max(0, Math.round(px - r)); x <= Math.min(canvas.width - 1, Math.round(px + r)); x++) {
      if ((x - px) ** 2 + (y - py) ** 2 > r * r) continue;
      const i = (y * canvas.width + x) * 4;
      for (let k = 0; k < 3; k++) vals[k].push(pixels.data[i + k]);
    }
  }
  return vals.map((v) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)]);
}

function compute() {
  if (!pixels || !state.sample) {
    state.reading = null;
    return;
  }
  const soil = R.rgb255ToLinear(sampleAt(state.sample, soilRadius()));
  const card = state.corners.length === 4
    ? R.patchCenters(state.corners).map((p) => R.rgb255ToLinear(sampleAt(p, patchRadius())))
    : null;
  state.reading = R.readSample(munsell, CHIPS, soil, card);
}

// ---- drawing ----
function drawPhoto() {
  if (!pixels) return;
  ctx.putImageData(pixels, 0, 0);
  const s = Math.max(canvas.width, canvas.height) / 960;
  if (state.corners.length === 4) {
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y] of R.patchCenters(state.corners)) {
      ctx.beginPath();
      ctx.arc(x, y, patchRadius(), 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.font = `700 ${Math.round(15 * s)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.corners.forEach(([x, y], i) => {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(x, y, 12 * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(String(i + 1), x, y + s);
  });
  if (state.sample) {
    const [x, y] = state.sample;
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(x, y, soilRadius(), 0, 2 * Math.PI);
    ctx.stroke();
  }
}

// ---- rendering ----
const fmt = (n) => n.toFixed(1);
const rgbCss = (rgb) => `rgb(${rgb.join(',')})`;
const step = () => (!state.photo ? 0 : !state.noCard && state.corners.length < 4 ? 1 : 2);

function render() {
  drawPhoto();
  const r = state.reading;
  const now = step();

  const cornerText = state.noCard ? 'Card: skipped' : `Mark the card · ${state.corners.length}/4`;
  $('steps').innerHTML = [
    [cornerText, now === 1 ? 'now' : now > 1 ? 'done' : ''],
    ['Tap the soil', now === 2 && !state.sample ? 'now' : state.sample ? 'done' : ''],
  ].map(([t, cls], i) => `<li class="${cls}"><b>${i + 1}</b>${t}</li>`).join('');

  $('hint').innerHTML = now === 0
    ? 'Take or choose a photo with the card beside the soil.'
    : now === 1
      ? `Tap the middle of the card's <b>${CORNER_NAMES[state.corners.length]}</b>.`
      : state.sample
        ? 'Tap the soil again to read a different spot.'
        : 'Tap the middle of the <b>soil</b>.';
  $('photoName').textContent = state.photo ? state.photo.name : '';
  $('btnUndo').disabled = !state.photo || (!state.sample && !state.corners.length && !state.noCard);
  $('btnNoCard').disabled = !state.photo || state.noCard;
  $('btnRestart').disabled = !state.photo;
  document.querySelectorAll('.ex').forEach((b) => b.classList.toggle('active', b.dataset.ex === state.example));

  // The answer: full card when the card checks out, otherwise the uncorrected reading, flagged.
  let main = null, pill = ['idle', 'Waiting for taps'], why = '';
  if (r) {
    if (r.full && r.full.cardFit < CARD_OK) {
      main = r.full;
      pill = ['good', 'Corrected with the card'];
      why = `After correction the 24 card patches are off by ${fmt(r.full.cardFit)} on average, so the correction is trustworthy.`;
    } else if (r.full) {
      main = r.raw;
      pill = ['bad', 'Card check failed'];
      why = `The card patches are still off by ${fmt(r.full.cardFit)} after correction. The corners were probably tapped out of order, or there is glare or shade on the card. Showing the uncorrected reading. Tap Start over and begin at the brown patch.`;
    } else {
      main = r.raw;
      pill = ['warn', 'Not corrected'];
      why = 'No card was marked, so this is straight from the photo. The light and the camera shift it, often by a whole chip.';
    }
  }
  const chip = main && chipByName.get(main.nearestChip);
  $('notation').textContent = main ? main.nearestChip : '–';
  $('exact').textContent = main ? `exact ${main.exact}` : '';
  $('swSoil').style.background = main ? rgbCss(main.rgb255) : '';
  $('swChip').style.background = chip ? rgbCss(R.linearToRgb255(chip.lin)) : '';
  $('swSoil').classList.toggle('empty', !main);
  $('swChip').classList.toggle('empty', !chip);
  $('pill').className = `pill ${pill[0]}`;
  $('pill').textContent = pill[1];
  $('why').textContent = why;

  const lines = [['raw', 'Straight from photo'], ['wb', 'White balance only'], ['full', 'Full card']];
  $('thTruth').hidden = !(state.photo && state.photo.truth);
  $('rows').innerHTML = lines.map(([key, label]) => {
    const x = r && r[key];
    if (!x) return `<tr><td>${label}</td><td></td><td colspan="3" class="small">${!r ? 'waiting for the soil tap' : 'needs the card'}</td></tr>`;
    let off = '';
    if (state.photo.truth) {
      const dE = R.deltaE2000(x.lab, TRUTH_CHIP.lab);
      const right = x.nearestChip === state.photo.truth;
      off = `<td class="mono ${right && dE < 2 ? 'ok' : dE >= CARD_OK || !right ? 'no' : ''}">${fmt(dE)}</td>`;
    }
    return `<tr><td>${label}</td><td><span class="dot" style="background:${rgbCss(x.rgb255)}"></span></td>` +
      `<td class="mono">${x.nearestChip}</td><td class="mono">${x.exact}</td>${off}</tr>`;
  }).join('');
}

// ---- input ----
function restartMarks() {
  state.corners = [];
  state.sample = null;
  state.noCard = false;
  state.reading = null;
}

canvas.addEventListener('click', (e) => {
  if (!state.photo) return;
  const rect = canvas.getBoundingClientRect();
  const p = [(e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)];
  state.example = null;
  if (step() === 1) state.corners.push(p);
  else state.sample = p;
  compute();
  render();
});
$('btnPhoto').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => {
  if (e.target.files[0]) loadOwnPhoto(e.target.files[0]);
  e.target.value = '';
});
$('btnUndo').addEventListener('click', () => {
  if (state.sample) state.sample = null;
  else if (state.noCard) state.noCard = false;
  else state.corners.pop();
  compute();
  render();
});
$('btnNoCard').addEventListener('click', () => {
  state.noCard = true;
  state.corners = [];
  compute();
  render();
});
$('btnRestart').addEventListener('click', () => {
  restartMarks();
  render();
});

$('examples').innerHTML = Object.entries(EXAMPLES)
  .map(([key, ex]) => `<button class="ex" data-ex="${key}"><strong>${ex.name}</strong><span>${ex.note}</span></button>`)
  .join('');
$('examples').addEventListener('click', (e) => {
  const b = e.target.closest('.ex');
  if (b) loadExample(b.dataset.ex);
});

loadExample('shift');
