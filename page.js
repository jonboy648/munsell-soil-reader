// PROTOTYPE page shell: test photos, clicks, buttons. All color logic lives in logic.js (MunsellReader).
const R = MunsellReader;
const CHIPS = R.buildSoilChips(munsell);
const TRUTH = '10YR 4/3';
const TRUTH_CHIP = CHIPS.find((c) => c.name === TRUTH);

const canvas = document.getElementById('photo');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let pixels = null; // the photo itself, without the marks drawn on top

const state = {
  photo: null, // { label, truth: chip name or null, synthetic: bool }
  mode: 'corners', // what the next click on the photo marks: 'corners' or 'sample'
  corners: [],
  sample: null,
  reading: null,
};
const CORNER_NAMES = [
  'top-left patch (dark skin, brown)',
  'top-right patch (bluish green)',
  'bottom-right patch (black)',
  'bottom-left patch (white)',
];

// ---- simulated cameras for the test photos ----
const mul3 = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const warm = (lin) => lin.map((v, i) => v * 0.9 * [1.25, 1.0, 0.62][i]);
const CAMERAS = {
  warm: { label: 'warm indoor light', cam: warm },
  dim: { label: 'too dark', cam: (lin) => lin.map((v) => v * 0.45) },
  shift: {
    label: 'camera color shift + cool shade',
    cam: (lin) =>
      mul3([[0.85, 0.2, 0.0], [0.1, 0.8, 0.15], [0.0, 0.25, 0.7]], lin).map((v, i) => v * [0.95, 1, 1.25][i]),
  },
  nocard: { label: 'warm indoor light, no card', cam: warm, noCard: true },
};

// Scene layout (test photos only)
const CARD = { x: 60, y: 120, patch: 62, gap: 12 };
const cardSpan = (n) => n * CARD.patch + (n - 1) * CARD.gap;
const patchCenter = (r, c) => [
  CARD.x + c * (CARD.patch + CARD.gap) + CARD.patch / 2,
  CARD.y + r * (CARD.patch + CARD.gap) + CARD.patch / 2,
];
const SAMPLE = { x: 650, y: 150, w: 240, h: 240 };
const AUTO = {
  corners: [patchCenter(0, 0), patchCenter(0, 5), patchCenter(3, 5), patchCenter(3, 0)],
  sample: [SAMPLE.x + SAMPLE.w / 2, SAMPLE.y + SAMPLE.h / 2],
};

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function makeTestPhoto(key) {
  const { label, cam, noCard } = CAMERAS[key];
  canvas.width = 960;
  canvas.height = 600;
  const rand = rng(7);
  const shot = (lin) => R.linearToRgb255(cam(lin));
  const ground = shot(munsell.munsellToLinearRgb('7.5YR 3/2'));
  const soil = shot(TRUTH_CHIP.lin);
  const frame = shot([0.012, 0.012, 0.012]);
  const patches = R.CARD_LINEAR.map(shot);
  const img = ctx.createImageData(960, 600);
  const fx0 = CARD.x - 16, fx1 = CARD.x + cardSpan(6) + 16;
  const fy0 = CARD.y - 16, fy1 = CARD.y + cardSpan(4) + 16;
  for (let y = 0; y < 600; y++) {
    for (let x = 0; x < 960; x++) {
      let rgb = ground;
      let noise = 12;
      if (!noCard && x >= fx0 && x < fx1 && y >= fy0 && y < fy1) {
        rgb = frame;
        noise = 2;
        const cx = x - CARD.x, cy = y - CARD.y;
        const c = Math.floor(cx / (CARD.patch + CARD.gap)), r = Math.floor(cy / (CARD.patch + CARD.gap));
        const inPatch = cx >= 0 && cy >= 0 && cx % (CARD.patch + CARD.gap) < CARD.patch && cy % (CARD.patch + CARD.gap) < CARD.patch;
        if (inPatch && c < 6 && r < 4) rgb = patches[r * 6 + c];
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
  state.photo = { label: `Test photo: ${label}`, truth: TRUTH, synthetic: true };
  clearMarks();
}

function loadOwnPhoto(file) {
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    const scale = Math.min(1, 1400 / im.naturalWidth);
    canvas.width = Math.round(im.naturalWidth * scale);
    canvas.height = Math.round(im.naturalHeight * scale);
    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    state.photo = { label: `Your photo: ${file.name}`, truth: null, synthetic: false };
    clearMarks();
    changed(`Loaded ${file.name}. Click the center of the card's ${CORNER_NAMES[0]} first.`);
    render();
  };
  im.src = url;
}

// Median color of the pixels within radius r of point p.
const radius = () => Math.max(4, Math.round(canvas.width * 0.008));
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

function drawMarks() {
  if (!pixels) {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.putImageData(pixels, 0, 0);
  const s = canvas.width / 960;
  ctx.lineWidth = 2.5 * s;
  ctx.font = `${Math.round(16 * s)}px system-ui, sans-serif`;
  if (state.photo.synthetic) {
    ctx.fillStyle = '#fff';
    ctx.fillText('soil sample', SAMPLE.x + 8, SAMPLE.y - 10);
  }
  if (state.corners.length === 4) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    for (const [x, y] of R.patchCenters(state.corners)) {
      ctx.beginPath();
      ctx.arc(x, y, radius(), 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  state.corners.forEach(([x, y], i) => {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(x, y, 12 * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillText(String(i + 1), x - 4.5 * s, y + 5.5 * s);
  });
  if (state.sample) {
    const [x, y] = state.sample;
    ctx.strokeStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(x, y, radius() * 3, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

// ---- reading ----
function compute() {
  if (!pixels || !state.sample) {
    state.reading = null;
    return;
  }
  const sampleLin = R.rgb255ToLinear(sampleAt(state.sample, radius() * 3));
  const card = state.corners.length === 4
    ? R.patchCenters(state.corners).map((p) => R.rgb255ToLinear(sampleAt(p, radius())))
    : null;
  state.reading = R.readSample(munsell, CHIPS, sampleLin, card);
}

// ---- rendering ----
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toFixed(1);
const CARD_OK = 3;
function changed(msg) {
  $('changed').textContent = msg ? `What just changed: ${msg}` : '';
}

function render() {
  drawMarks();
  const r = state.reading;
  const nextCorner = state.corners.length < 4 ? CORNER_NAMES[state.corners.length] : null;
  let cardCheck = '<span style="color:var(--muted)">needs the 4 corners and a sample</span>';
  if (r && r.full) {
    cardCheck = r.full.cardFit < CARD_OK
      ? `<span class="ok">good</span> (after correction the card patches are off by ${fmt(r.full.cardFit)} on average)`
      : `<span class="bad">FAILED</span>: the card patches are still off by ${fmt(r.full.cardFit)} on average. Corners in the wrong order, glare, or shade on the card. Don't trust the corrected readings.`;
  }
  const rows = [
    ['Photo', state.photo ? state.photo.label : 'none yet'],
    ['Next click marks', !state.photo ? '(load a photo first)' : state.mode === 'corners' && nextCorner ? `card corner ${state.corners.length + 1}: ${nextCorner}` : 'the soil sample'],
    ['Card corners', `${state.corners.length} of 4`],
    ['Soil sample', state.sample ? 'marked' : 'not marked'],
    ['Card check', cardCheck],
  ];
  if (state.photo && state.photo.truth) rows.push(['Real soil color', `<span class="chip">${state.photo.truth}</span> (known, because this is a test photo)`]);
  $('state').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  const lines = [
    ['raw', 'Straight from the photo'],
    ['wb', 'White balance (6 gray patches)'],
    ['full', 'Full card (all 24 patches)'],
  ];
  $('results').innerHTML = lines.map(([key, label]) => {
    const x = r && r[key];
    if (!x) {
      const why = !r ? 'needs a soil sample' : "needs the card's 4 corners";
      return `<tr><td>${label}</td><td></td><td colspan="3" style="color:var(--muted)">${why}</td></tr>`;
    }
    let off = '<span style="color:var(--muted)">unknown</span>';
    if (state.photo.truth) {
      const dE = R.deltaE2000(x.lab, TRUTH_CHIP.lab);
      const cls = x.nearestChip === state.photo.truth && dE < 2 ? 'ok' : dE >= 3 ? 'bad' : '';
      off = `<span class="${cls}">${fmt(dE)}${x.nearestChip === state.photo.truth ? ', right chip' : ', wrong chip'}</span>`;
    }
    return `<tr><td>${label}</td><td><span class="sw" style="background:rgb(${x.rgb255.join(',')})"></span></td>` +
      `<td class="chip">${x.nearestChip}</td><td>${x.exact}</td><td>${off}</td></tr>`;
  }).join('') +
    '<tr><td colspan="5" style="color:var(--muted);font-size:12px">"Off from truth" is the CIEDE2000 color difference from the real soil chip. Under 2 is hard to see, over 3 is a different chip. The numbers in a Munsell code are hue, then value (lightness) / chroma (strength).</td></tr>';

  $('hint').innerHTML = !state.photo
    ? 'Load a photo or make a test photo below.'
    : state.mode === 'corners' && nextCorner
      ? `Click the center of the card's <b>${nextCorner}</b>.`
      : 'Click the middle of the <b>soil sample</b>. Click again to move it.';
  $('btnCorners').disabled = $('btnSample').disabled = $('btnClear').disabled = !state.photo;
}

// ---- actions (each one is a button somewhere on the page) ----
function clearMarks() {
  state.corners = [];
  state.sample = null;
  state.reading = null;
  state.mode = 'corners';
}
function describeReading() {
  const r = state.reading;
  if (!r) return '';
  if (!r.full) return ` Straight from the photo it reads ${r.raw.nearestChip}.`;
  return ` Straight from the photo it reads ${r.raw.nearestChip}; with the full card, ${r.full.nearestChip}.`;
}
const actions = {
  testPhoto(key) {
    makeTestPhoto(key);
    changed(`Made a test photo (${CAMERAS[key].label}). All marks cleared.`);
    render();
  },
  autoCorners(order = [0, 1, 2, 3]) {
    state.corners = order.map((i) => AUTO.corners[i].slice());
    state.mode = 'sample';
    compute();
    changed(order.join() === '0,1,2,3'
      ? 'Marked all 4 card corners. The white rings show where the 24 patches are read from.'
      : 'Marked the 4 corners starting from the WHITE patch instead of the brown one, so every patch is read from the wrong place.' + describeReading());
    render();
  },
  autoSample() {
    state.sample = AUTO.sample.slice();
    compute();
    changed('Marked the soil sample.' + describeReading());
    render();
  },
};

canvas.addEventListener('click', (e) => {
  if (!state.photo) return;
  const rect = canvas.getBoundingClientRect();
  const p = [(e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)];
  if (state.mode === 'corners' && state.corners.length < 4) {
    state.corners.push(p);
    if (state.corners.length === 4) state.mode = 'sample';
    changed(`Marked card corner ${state.corners.length} of 4.`);
  } else {
    state.sample = p;
    changed('Marked the soil sample.');
  }
  compute();
  if (state.reading) changed(`${$('changed').textContent.replace('What just changed: ', '')}${describeReading()}`);
  render();
});
document.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => actions.testPhoto(b.dataset.photo)));
$('btnUpload').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => e.target.files[0] && loadOwnPhoto(e.target.files[0]));
$('btnCorners').addEventListener('click', () => {
  state.corners = [];
  state.mode = 'corners';
  compute();
  changed('Corner marks cleared. Click the 4 corner patches in order.');
  render();
});
$('btnSample').addEventListener('click', () => {
  state.mode = 'sample';
  changed('Next click marks the soil sample.');
  render();
});
$('btnClear').addEventListener('click', () => {
  clearMarks();
  changed('All marks cleared.');
  render();
});

// ---- guided walkthroughs ----
const SCENARIOS = [
  {
    name: 'Warm indoor light',
    text: 'Shop lights make everything orange. Watch the straight reading come out redder and stronger than the real soil (10YR 4/3), then watch the card pull it back.',
    steps: [['Take the photo under warm light', () => actions.testPhoto('warm')], ['Mark the card corners', () => actions.autoCorners()], ['Mark the soil sample', () => actions.autoSample()]],
  },
  {
    name: 'Too dark',
    text: 'An underexposed photo. Watch the value (the lightness number after the hue) come out far too low. White balance alone fixes this one, because darkness hits all three color channels equally.',
    steps: [['Take the dark photo', () => actions.testPhoto('dim')], ['Mark the card corners', () => actions.autoCorners()], ['Mark the soil sample', () => actions.autoSample()]],
  },
  {
    name: 'Camera color shift',
    text: 'Cameras mix their color channels a little, and shade adds a blue cast. Watch white balance alone get close but land on the wrong chip. Only the full 24-patch correction lands on the real chip.',
    steps: [['Take the photo in shade', () => actions.testPhoto('shift')], ['Mark the card corners', () => actions.autoCorners()], ['Mark the soil sample', () => actions.autoSample()]],
  },
  {
    name: 'Corners in the wrong order',
    text: 'Someone marks the white corner first. Every patch is now read from the wrong spot. This should not produce a confident answer: watch the card check fail instead.',
    steps: [['Take the photo under warm light', () => actions.testPhoto('warm')], ['Mark the corners, starting at white', () => actions.autoCorners([3, 0, 1, 2])], ['Mark the soil sample', () => actions.autoSample()]],
  },
  {
    name: 'No card in the shot',
    text: 'Without the card there is nothing to correct against. Only the straight reading exists, and under warm light it is the wrong chip.',
    steps: [['Take the photo without a card', () => actions.testPhoto('nocard')], ['Mark the soil sample', () => actions.autoSample()]],
  },
];
let active = 0;
let progress = 0;
function renderScenario() {
  $('tabs').innerHTML = SCENARIOS.map((s, i) => `<button class="${i === active ? 'active' : ''}" data-tab="${i}">${s.name}</button>`).join('');
  const s = SCENARIOS[active];
  $('scenario').innerHTML = `<p style="margin:0;max-width:820px">${s.text}</p><div class="steps">` +
    s.steps.map(([label], i) => `<button data-step="${i}" class="${i < progress ? 'done' : i === progress ? 'primary' : ''}" ${i === progress ? '' : 'disabled'}>${i + 1}. ${label}</button>`).join('') +
    `${progress >= s.steps.length ? '<button data-restart>Run it again</button>' : ''}</div>`;
}
$('tabs').addEventListener('click', (e) => {
  const i = e.target.dataset.tab;
  if (i === undefined) return;
  active = Number(i);
  progress = 0;
  state.photo = null;
  pixels = null;
  clearMarks();
  changed(`Started the walkthrough "${SCENARIOS[active].name}". Everything reset.`);
  render();
  renderScenario();
});
$('scenario').addEventListener('click', (e) => {
  if (e.target.dataset.restart !== undefined) {
    progress = 0;
    renderScenario();
    return;
  }
  const i = e.target.dataset.step;
  if (i === undefined || Number(i) !== progress) return;
  SCENARIOS[active].steps[progress][1]();
  progress++;
  renderScenario();
});

render();
renderScenario();
