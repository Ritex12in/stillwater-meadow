// The map (M): the land you have explored, seen from above with north at the top, the places you
// have found marked on it, and you. Unexplored land is left dark; it fills in as you walk
// (systems/explored.js keeps where you have been).
//
// The land's picture is not saved: it is worked out from the seed, as the land itself is. Each
// region of the explored grid (about a kilometre square) has a small picture of its own, PX pixels to
// a cell, painted a cell at a time and only for explored cells and those beside them, a few
// milliseconds a frame while the map is open, nearest the middle of the view first. A painted cell
// is never painted again: what hides the unexplored land is a mask laid over the pictures when the
// map is drawn (one soft-edged dot per cell), so walking on only adds cells. The colours are the
// country's own in summer (meadow, lush wood, heath, grove, snow, desert, swamp and the rest), lit
// from the north-west so the hills stand out, with a faint line every 20 m of height.
import { clamp, smooth } from '../core/math.js';
import { rawHeight, seaAt, lakeAt, coldBase, coldAt, rainAt, snowCold, snowOf, dryOf, lushOf, groveAt, biomesAt, aboveTrees, TREE_COLD, ASPECT, riverNear } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { camState } from '../systems/input.js';
import { store } from '../systems/save.js';
import { bindKey } from '../systems/actions.js';
import { togglePanel, onPanel } from './hud.js';
import { CELL, SPAN, REGION, explored, exploredRegions, isExplored, reveal } from '../systems/explored.js';
import { KIND_LABEL } from '../features/places.js';

const $ = (id) => document.getElementById(id);
const PX = 8, M = CELL / PX, SIDE = SPAN * PX;   // pixels to a cell; metres to a pixel; a region's picture
const MIN_SCALE = 0.03, MAX_SCALE = 1.4, START_SCALE = 0.55; // screen pixels to a metre
const BUILD_MS = 6;                             // spent painting new cells each frame while the map is open
const BACK = '#172027';

// ── The land's colours ─────────────────────────────────────────
const C = {
  meadow: [128, 174, 94], lush: [70, 130, 74], dry: [204, 184, 112], grove: [233, 170, 198], plains: [162, 200, 110],
  desert: [231, 204, 143], swamp: [84, 104, 70], enchanted: [60, 150, 140], volcanic: [62, 54, 58], beach: [237, 221, 171],
  tundra: [176, 160, 128], rock: [150, 146, 138], snow: [240, 245, 252],
  lake: [92, 166, 226], lakeDeep: [54, 122, 200], ice: [208, 230, 244], sea: [58, 122, 192], seaDeep: [30, 74, 142], river: [84, 156, 224],
};
let r = 0, g = 0, b = 0;
const set = (c) => { r = c[0]; g = c[1]; b = c[2]; };
const mix = (c, t) => { if (t <= 0) return; if (t > 1) t = 1; r += (c[0] - r) * t; g += (c[1] - g) * t; b += (c[2] - b) * t; };
/** The colour (into r, g, b) of the land at a spot: `h` its height, `sx`, `sz` its rise per metre east and south. */
function colour(x, z, h, sx, sz, contour) {
  const L = lakeAt(x, z), lt = L.t(x, z);
  if (h < 0) { // water: a lake (ice in frozen country), or the sea
    if (lt < 1.1 || seaAt(x, z) <= 0) { if (L.frozen) set(C.ice); else { set(C.lake); mix(C.lakeDeep, -h / 3); } }
    else { set(C.sea); mix(C.seaDeep, -h / 22); }
    return;
  }
  const base = coldBase(x, z), rain = rainAt(x, z), cold = coldAt(x, z, h, base), snow = snowOf(snowCold(cold, rain)), bio = biomesAt(x, z, h, base, rain);
  set(C.meadow);
  mix(C.lush, lushOf(rain)); mix(C.dry, dryOf(rain)); mix(C.plains, bio.plains * 0.8);
  mix(C.desert, bio.desert); mix(C.swamp, bio.swamp); mix(C.enchanted, bio.enchanted); mix(C.volcanic, bio.volcanic);
  mix(C.grove, groveAt(x, z) * 0.85);
  mix(C.tundra, smooth(0.45, 0.6, cold) * (1 - snow));
  mix(C.rock, Math.max(aboveTrees(h + TREE_COLD * base + ASPECT * clamp(sz, -1.2, 1.2)) * 0.75, smooth(0.75, 1.2, Math.hypot(sx, sz))));
  mix(C.beach, Math.max(bio.beach, (1 - smooth(1.02, 1.16, lt)) * Math.min(1, L.beach)));
  mix(C.snow, snow);
  const rv = riverNear(x, z);
  if (rv) { const half = Math.max(2, rv.w * 0.5); mix(C.river, 1 - smooth(half, half + 4, rv.d)); }
  let k = (0.9 + 0.2 * clamp(h / 140, 0, 1)) * clamp(1 + (sx + sz) * 0.5, 0.6, 1.3); // (higher is paler; slopes facing north-west are lit)
  if (contour) k *= 0.93;
  r *= k; g *= k; b *= k;
}

// ── The regions' pictures ──────────────────────────────────────
const tiles = new Map(); // "rx,rz" -> { rx, rz, want (per cell: 0 not wanted, 1 to paint, 2 painted), pending, canvas, ctx, mask, mctx, mimg, maskRev, seen }
let pendingCells = 0;
function tileAt(rx, rz) {
  const k = rx + ',' + rz;
  let T = tiles.get(k);
  if (!T) tiles.set(k, (T = { rx, rz, want: new Uint8Array(SPAN * SPAN), pending: [], canvas: null, ctx: null, mask: null, mctx: null, mimg: null, maskRev: -1, seen: -1 }));
  return T;
}
function wantCell(gx, gz) {
  const rx = Math.floor(gx / SPAN), rz = Math.floor(gz / SPAN), T = tileAt(rx, rz), i = (gz - rz * SPAN) * SPAN + (gx - rx * SPAN);
  if (!T.want[i]) { T.want[i] = 1; T.pending.push(i); pendingCells++; }
}
/** Every explored cell and the cells within two of it are wanted in the picture (the mask fades out over those). */
function syncWants() {
  for (const R of exploredRegions()) {
    const T = tileAt(R.rx, R.rz);
    if (T.seen === R.rev) continue;
    T.seen = R.rev;
    for (let i = 0; i < SPAN * SPAN; i++) {
      if (!((R.bits[i >> 3] >> (i & 7)) & 1)) continue;
      const gx = R.rx * SPAN + (i % SPAN), gz = R.rz * SPAN + ((i / SPAN) | 0);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) wantCell(gx + dx, gz + dz);
    }
  }
}
const hs = new Float32Array((PX + 1) * (PX + 1));
let cellImg = null;
function paintCell(T, i) {
  if (!T.canvas) { T.canvas = document.createElement('canvas'); T.canvas.width = T.canvas.height = SIDE; T.ctx = T.canvas.getContext('2d'); }
  cellImg = cellImg || new ImageData(PX, PX);
  const lx = i % SPAN, lz = (i / SPAN) | 0, x0 = (T.rx * SPAN + lx) * CELL, z0 = (T.rz * SPAN + lz) * CELL, d = cellImg.data, W = PX + 1;
  for (let j = 0; j <= PX; j++) for (let k = 0; k <= PX; k++) hs[j * W + k] = rawHeight(x0 + k * M, z0 + j * M);
  for (let j = 0; j < PX; j++) for (let k = 0; k < PX; k++) {
    const a = hs[j * W + k], e = hs[j * W + k + 1], c = hs[(j + 1) * W + k], f = hs[(j + 1) * W + k + 1], o = (j * PX + k) * 4;
    colour(x0 + (k + 0.5) * M, z0 + (j + 0.5) * M, (a + e + c + f) / 4, (e + f - a - c) / (2 * M), (c + f - a - e) / (2 * M), Math.floor(a / 20) !== Math.floor(f / 20) || Math.floor(e / 20) !== Math.floor(c / 20));
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  T.ctx.putImageData(cellImg, lx * PX, lz * PX);
  T.want[i] = 2; pendingCells--;
}
/**
 * A region's mask: a dot per cell (and a ring of the cells round the region, so the soft edge runs on
 * into its neighbours). A cell shows in full when most of the cells about it are explored, and half
 * when a few are, so the explored land has a soft, rounded edge reaching a cell or two beyond it.
 */
const N = SPAN + 2, near = new Uint8Array((N + 2) * (N + 2));
function buildMask(T) {
  if (!T.mask) { T.mask = document.createElement('canvas'); T.mask.width = T.mask.height = N; T.mctx = T.mask.getContext('2d'); T.mimg = T.mctx.createImageData(N, N); }
  const d = T.mimg.data, W = N + 2, gx0 = T.rx * SPAN - 2, gz0 = T.rz * SPAN - 2;
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) near[j * W + i] = isExplored(gx0 + i, gz0 + j) ? 1 : 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let n = 0;
    for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) n += near[(j + dz) * W + i + dx];
    const o = (j * N + i) * 4;
    d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.min(255, n * 43);
  }
  T.mctx.putImageData(T.mimg, 0, 0);
  T.maskRev = explored.rev;
}

// ── The places' marks ──────────────────────────────────────────
// (each drawn in a 16 x 16 box; `line` ones are drawn as strokes)
const GLYPH = {
  shrine: { d: 'M2.500 5h11M4 7.500h8M5 5v9M11 5v9', line: true },
  castle: { d: 'M3 14V5h2v2h2V5h2v2h2V5h2v9z' }, icecastle: { d: 'M3 14V5h2v2h2V5h2v2h2V5h2v9z' },
  pagoda: { d: 'M8 2l5 4H3zM8 6l6 4H2zM5 10h6v4H5z' },
  ruin: { d: 'M3 14V8a5 5 0 0 1 10 0v6h-2.500V8a2.500 2.500 0 0 0-5 0v6z' },
  hut: { d: 'M2 8l6-5 6 5h-2v6H4V8z' }, beachhut: { d: 'M2 8l6-5 6 5h-2v6H4V8z' },
  windmill: { d: 'M8 8L3 3M8 8l5-5M8 8l-5 5M8 8l5 5', line: true },
  circle: { d: 'M8 3a5 5 0 1 0 0.010 0z', line: true },
  cairn: { d: 'M8 3l5 11H3z' }, volcano: { d: 'M2 14l4-9h4l4 9z' },
  spring: { d: 'M8 2c3 4 4.500 6 4.500 8a4.500 4.500 0 0 1-9 0c0-2 1.500-4 4.500-8z' },
  grotto: { d: 'M8 2l5 6-5 6-5-6z' }, skyisle: { d: 'M2 6h12l-6 8z' },
  ship: { d: 'M2 10h12l-2 4H4zM7.500 2v7h1V4l3.500 5H8.500' },
  camp: { d: 'M8 3l6 11H9l-1-4-1 4H2z' },
};
const paths = {};
const glyph = (kind) => { const G = GLYPH[kind]; if (!G) return null; return paths[kind] || (paths[kind] = { path: new Path2D(G.d), line: !!G.line }); };
const farText = (m) => (m < 60 ? 'here' : m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km');
const WAYS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const wayTo = (dx, dz) => WAYS[Math.round(((Math.atan2(dx, -dz) * 180) / Math.PI + 360) / 45) % 8]; // (north is -z)

// ── The panel ──────────────────────────────────────────────────
const view = { x: 0, z: 0, scale: START_SCALE };
let open = false, follow = true, dirty = true, chosen = null, marks = [];
let panel = null, canvas = null, ctx = null, maskLayer = null, mctx = null, cssW = 0, cssH = 0, dpr = 1;

/** The places to mark: those you have found (your camp where it stands now). */
function places() {
  const out = [];
  for (const f of store.found || []) {
    if (f.id === 'camp') { if (store.camp) out.push({ id: f.id, kind: 'camp', name: f.name, x: store.camp.x, z: store.camp.z }); continue; }
    out.push(f);
  }
  return out;
}

function draw() {
  dirty = false;
  if (!ctx || !cssW) return;
  const w = canvas.width, h = canvas.height, s = view.scale * dpr;
  const X = (x) => (x - view.x) * s + w / 2, Z = (z) => (z - view.z) * s + h / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h);
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = mctx.imageSmoothingEnabled = true;
  // the land's pictures, and over them the mask of what is explored
  const rx0 = Math.floor((view.x - w / 2 / s) / REGION), rx1 = Math.floor((view.x + w / 2 / s) / REGION), rz0 = Math.floor((view.z - h / 2 / s) / REGION), rz1 = Math.floor((view.z + h / 2 / s) / REGION);
  for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
    const T = tiles.get(rx + ',' + rz);
    if (!T) continue;
    // (whole pixels: the pictures meet without a seam)
    const x0 = Math.round(X(rx * REGION)), x1 = Math.round(X((rx + 1) * REGION)), z0 = Math.round(Z(rz * REGION)), z1 = Math.round(Z((rz + 1) * REGION));
    if (T.canvas) ctx.drawImage(T.canvas, x0, z0, x1 - x0, z1 - z0);
    if (T.maskRev !== explored.rev) buildMask(T);
    const cw = (x1 - x0) / SPAN, ch = (z1 - z0) / SPAN;
    mctx.save(); mctx.beginPath(); mctx.rect(x0, z0, x1 - x0, z1 - z0); mctx.clip();
    mctx.drawImage(T.mask, x0 - cw, z0 - ch, cw * (SPAN + 2), ch * (SPAN + 2));
    mctx.restore();
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskLayer, 0, 0);
  // behind it: the unexplored dark, ruled every kilometre
  ctx.globalCompositeOperation = 'destination-over';
  if (REGION * s > 36 * dpr) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = dpr; ctx.beginPath();
    for (let rx = rx0; rx <= rx1 + 1; rx++) { const x = Math.round(X(rx * REGION)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let rz = rz0; rz <= rz1 + 1; rz++) { const z = Math.round(Z(rz * REGION)) + 0.5; ctx.moveTo(0, z); ctx.lineTo(w, z); }
    ctx.stroke();
  }
  ctx.fillStyle = BACK; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // over it, in screen pixels: the places, you, north and the scale
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const px = (x) => (x - view.x) * view.scale + cssW / 2, pz = (z) => (z - view.z) * view.scale + cssH / 2;
  const named = [], list = places().map((f) => ({ f, x: px(f.x), y: pz(f.z) })).filter((m) => m.x > -40 && m.x < cssW + 40 && m.y > -40 && m.y < cssH + 40);
  // (the chosen place first, then those nearest the middle: where names would run together, the later ones go without)
  list.sort((p, q) => (q.f === chosen) - (p.f === chosen) || Math.hypot(p.x - cssW / 2, p.y - cssH / 2) - Math.hypot(q.x - cssW / 2, q.y - cssH / 2));
  marks = [];
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const m of list) {
    const f = m.f, lake = f.kind === 'lake', G = glyph(f.kind), on = f === chosen;
    if (!lake) {
      ctx.beginPath(); ctx.arc(m.x, m.y, on ? 11 : 9.5, 0, 7);
      ctx.fillStyle = 'rgba(14, 20, 24, 0.86)'; ctx.fill();
      ctx.strokeStyle = on ? '#ffd27a' : 'rgba(255, 255, 255, 0.75)'; ctx.lineWidth = on ? 2 : 1.2; ctx.stroke();
      if (G) {
        ctx.save(); ctx.translate(m.x - 6, m.y - 6.2); ctx.scale(0.75, 0.75);
        if (G.line) { ctx.strokeStyle = '#f7f4ec'; ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.stroke(G.path); } else { ctx.fillStyle = '#f7f4ec'; ctx.fill(G.path); }
        ctx.restore();
      } else { ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, 7); ctx.fillStyle = '#f7f4ec'; ctx.fill(); }
    }
    // the name: under the lake's water, or under the place's mark
    let label = false;
    if (view.scale >= 0.1 || on) {
      ctx.font = lake ? 'italic 600 16px "Cormorant Garamond", Georgia, serif' : '600 11px Manrope, system-ui, sans-serif';
      const tw = ctx.measureText(f.name).width / 2 + 5, ty = lake ? m.y + Math.max(16, 46 * view.scale + 14) : m.y + 23, box = { x0: m.x - tw, x1: m.x + tw, y0: ty - 14, y1: ty + 5 };
      if (on || !named.some((q) => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) {
        named.push(box); label = true;
        ctx.strokeStyle = 'rgba(12, 18, 22, 0.85)'; ctx.lineWidth = 3.5; ctx.strokeText(f.name, m.x, ty);
        ctx.fillStyle = on ? '#ffd27a' : '#f7f4ec'; ctx.fillText(f.name, m.x, ty);
      }
    }
    marks.push({ id: f.id, name: f.name, kind: f.kind, x: Math.round(m.x), y: Math.round(m.y), label });
  }
  // you: an arrow pointing the way you look
  {
    const x = px(player.x), y = pz(player.z), a = Math.atan2(-Math.cos(camState.yaw), -Math.sin(camState.yaw));
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3.5, 0); ctx.lineTo(-7, -7); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(12, 18, 22, 0.9)'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  // north, and a scale
  ctx.font = '700 12px Manrope, system-ui, sans-serif'; ctx.fillStyle = 'rgba(247, 244, 236, 0.85)'; ctx.strokeStyle = 'rgba(247, 244, 236, 0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.fillText('N', cssW - 26, 50);
  ctx.beginPath(); ctx.moveTo(cssW - 26, 34); ctx.lineTo(cssW - 26, 14); ctx.moveTo(cssW - 31, 20); ctx.lineTo(cssW - 26, 14); ctx.lineTo(cssW - 21, 20); ctx.stroke();
  const len = [20, 50, 100, 250, 500, 1000, 2000, 5000, 10000].find((v) => v * view.scale >= 70) || 20000, bar = len * view.scale;
  ctx.beginPath(); ctx.moveTo(16, cssH - 22); ctx.lineTo(16, cssH - 16); ctx.lineTo(16 + bar, cssH - 16); ctx.lineTo(16 + bar, cssH - 22); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = '600 11px Manrope, system-ui, sans-serif';
  ctx.fillText(len < 1000 ? len + ' m' : len / 1000 + ' km', 16, cssH - 28);
}

/** Paint cells still to be painted in the regions in view, nearest the middle first, for `ms` milliseconds. */
function build(ms) {
  if (!pendingCells || !cssW) return false;
  const t0 = performance.now(), hw = cssW / 2 / view.scale + REGION / 2, hh = cssH / 2 / view.scale + REGION / 2, mid = (T, at, c) => (at + 0.5) * REGION - c;
  const list = [...tiles.values()].filter((T) => T.pending.length && Math.abs(mid(T, T.rx, view.x)) < hw && Math.abs(mid(T, T.rz, view.z)) < hh)
    .sort((p, q) => Math.hypot(mid(p, p.rx, view.x), mid(p, p.rz, view.z)) - Math.hypot(mid(q, q.rx, view.x), mid(q, q.rz, view.z)));
  let did = false;
  for (const T of list) while (T.pending.length) {
    paintCell(T, T.pending.pop()); did = true;
    if (performance.now() - t0 > ms) return true;
  }
  return did;
}

function resize() {
  const box = $('mapView');
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cssW = box.clientWidth; cssH = box.clientHeight;
  if (!cssW || !cssH) return;
  canvas.width = maskLayer.width = Math.round(cssW * dpr); canvas.height = maskLayer.height = Math.round(cssH * dpr);
  dirty = true;
}
function zoomBy(k, x = cssW / 2, y = cssH / 2) {
  const to = clamp(view.scale * k, MIN_SCALE, MAX_SCALE);
  if (!follow) { view.x += (x - cssW / 2) * (1 / view.scale - 1 / to); view.z += (y - cssH / 2) * (1 / view.scale - 1 / to); } // (what is under the pointer stays under it)
  view.scale = to; dirty = true;
}
function say() {
  const sum = $('mapSummary'), km2 = (explored.cells * CELL * CELL) / 1e6, n = (store.found || []).length;
  sum.textContent = `${km2 < 10 ? km2.toFixed(1) : Math.round(km2)} km² explored · ${n} ${n === 1 ? 'place' : 'places'}`;
  const place = $('mapPlace'), go = $('mapGo');
  if (chosen) {
    const far = Math.hypot(chosen.x - player.x, chosen.z - player.z), b1 = document.createElement('b');
    b1.textContent = chosen.name;
    place.replaceChildren(b1, ` · ${KIND_LABEL[chosen.kind] || chosen.kind} · ${far < 60 ? 'you are here' : farText(far) + ' to the ' + wayTo(chosen.x - player.x, chosen.z - player.z)}`);
  } else place.textContent = 'Drag to move the map, scroll to zoom. Choose a place you have found to go back to it.';
  go.hidden = !chosen;
}

/** For tests: how the map stands, a way to finish painting it, and the colour drawn at a spot. */
export const mapView = () => ({
  open: open && !!panel && !panel.hidden, cells: explored.cells, pending: pendingCells, follow, x: view.x, z: view.z, scale: view.scale, chosen: chosen && chosen.id, marks: marks.slice(),
  settle: () => { syncWants(); while (build(1e9)); draw(); return pendingCells; },
  /** The colour drawn at a spot in the world ([r, g, b]), or null off the map's edge. */
  colourAt: (x, z) => { const sx = Math.round(((x - view.x) * view.scale + cssW / 2) * dpr), sy = Math.round(((z - view.z) * view.scale + cssH / 2) * dpr); return ctx && sx >= 0 && sy >= 0 && sx < canvas.width && sy < canvas.height ? Array.from(ctx.getImageData(sx, sy, 1, 1).data.slice(0, 3)) : null; },
  explored: (x, z) => isExplored(Math.floor(x / CELL), Math.floor(z / CELL)),
});

/** `goTo(x, z)` takes you to a place chosen on the map. */
export function initMap(goTo) {
  canvas = $('mapCanvas');
  if (!canvas) return;
  panel = $('mapPanel');
  ctx = canvas.getContext('2d');
  maskLayer = document.createElement('canvas'); mctx = maskLayer.getContext('2d');
  onPanel('mapPanel', (o) => {
    open = o;
    if (!o) return;
    if (document.pointerLockElement) document.exitPointerLock(); // (the cursor is freed to use the map)
    follow = true; chosen = null; view.x = player.x; view.z = player.z;
    reveal(player.x, player.z);
    resize(); syncWants(); say(); dirty = true;
  });
  bindKey('KeyM', () => togglePanel('mapPanel'));
  window.addEventListener('resize', () => { if (open) resize(); });

  // drag to move, two fingers or the wheel to zoom, a click or tap to choose a place
  const ptrs = new Map();
  let moved = 0, span0 = 0, scale0 = 1;
  const spread = () => { const [p, q] = [...ptrs.values()]; return Math.max(20, Math.hypot(p.x - q.x, p.y - q.y)); };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) moved = 0;
    if (ptrs.size === 2) { span0 = spread(); scale0 = view.scale; moved = 99; }
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 4) { follow = false; view.x -= dx / view.scale; view.z -= dy / view.scale; dirty = true; }
    } else if (ptrs.size === 2) { view.scale = clamp(scale0 * spread() / span0, MIN_SCALE, MAX_SCALE); dirty = true; }
  });
  const end = (e) => {
    if (!ptrs.delete(e.pointerId)) return;
    if (!ptrs.size) canvas.classList.remove('dragging');
    if (e.type !== 'pointerup' || ptrs.size || moved > 4) return;
    // a click: the place nearest it, if one is close
    const box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
    let best = null, bd = 24;
    for (const f of places()) { const d = Math.hypot((f.x - view.x) * view.scale + cssW / 2 - x, (f.z - view.z) * view.scale + cssH / 2 - y); if (d < bd) { bd = d; best = f; } }
    chosen = best; say(); dirty = true;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const box = canvas.getBoundingClientRect(); zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top); }, { passive: false });
  $('mapIn').addEventListener('click', () => zoomBy(1.5));
  $('mapOut').addEventListener('click', () => zoomBy(1 / 1.5));
  $('mapMe').addEventListener('click', () => { follow = true; dirty = true; });
  $('mapGo').addEventListener('click', () => { if (!chosen) return; goTo(chosen.x, chosen.z); reveal(player.x, player.z); follow = true; say(); dirty = true; });

  // walking reveals the land; while the map is open it is kept up to date
  let lookIn = 0, lastX = NaN, lastZ = NaN, seenRev = -1, drawnX = NaN, drawnZ = NaN, drawnYaw = NaN, sayIn = 0;
  hooks.frame.push((dt) => {
    lookIn -= dt;
    if (lookIn <= 0) {
      lookIn = 0.4;
      if (!(Math.hypot(player.x - lastX, player.z - lastZ) < CELL / 2)) { lastX = player.x; lastZ = player.z; reveal(player.x, player.z); }
    }
    if (open && panel.hidden) open = false; // (another panel took its place: that hides it without a word)
    if (!open) return;
    if (seenRev !== explored.rev) { seenRev = explored.rev; syncWants(); dirty = true; }
    if (follow && (view.x !== player.x || view.z !== player.z)) { view.x = player.x; view.z = player.z; dirty = true; }
    if (Math.hypot(player.x - drawnX, player.z - drawnZ) * view.scale > 0.5 || Math.abs(camState.yaw - drawnYaw) > 0.02) dirty = true;
    if (build(BUILD_MS)) dirty = true;
    sayIn -= dt;
    if (sayIn <= 0) { sayIn = 1; say(); }
    if (dirty) { drawnX = player.x; drawnZ = player.z; drawnYaw = camState.yaw; draw(); }
  });
}
