// Where you have been. The world is ruled into cells of CELL metres; walking about marks the cells
// within REVEAL metres of you as explored, for good. Kept per world with your save, one bit a cell:
// the cells are gathered into regions of SPAN x SPAN (about a kilometre square), each saved as its
// own short string, so the save grows by a couple of hundred characters per square kilometre walked
// and never holds a list of points. The map (ui/map.js) draws only what is marked here.
import { store, onSave } from './save.js';

/** A cell's side (m); cells along a region's side; a region's side (m); how far about you the land is revealed (m). */
export const CELL = 32, SPAN = 32, REGION = CELL * SPAN, REVEAL = 190;
const BYTES = (SPAN * SPAN) >> 3;

const regions = new Map(); // "rx,rz" -> { rx, rz, bits, rev, unsaved }
/** `rev` goes up whenever a new cell is marked; `cells` is how many are. */
export const explored = { rev: 0, cells: 0 };
const key = (rx, rz) => rx + ',' + rz;
/** Every region with a cell explored: `{ rx, rz, bits, rev }` (`rev` goes up when one of its cells is marked). */
export const exploredRegions = () => regions.values();

/** Is the cell (counted in cells from the world's origin) explored? */
export function isExplored(gx, gz) {
  const rx = Math.floor(gx / SPAN), rz = Math.floor(gz / SPAN), R = regions.get(key(rx, rz));
  if (!R) return false;
  const i = (gz - rz * SPAN) * SPAN + (gx - rx * SPAN);
  return ((R.bits[i >> 3] >> (i & 7)) & 1) === 1;
}
/** Is the spot (m) in explored land? */
export const exploredAt = (x, z) => isExplored(Math.floor(x / CELL), Math.floor(z / CELL));

function mark(gx, gz) {
  const rx = Math.floor(gx / SPAN), rz = Math.floor(gz / SPAN), k = key(rx, rz);
  let R = regions.get(k);
  if (!R) regions.set(k, (R = { rx, rz, bits: new Uint8Array(BYTES), rev: 0, unsaved: false }));
  const i = (gz - rz * SPAN) * SPAN + (gx - rx * SPAN), b = 1 << (i & 7);
  if (R.bits[i >> 3] & b) return 0;
  R.bits[i >> 3] |= b; R.rev++; R.unsaved = true;
  return 1;
}
/** Mark the land within `r` metres of a spot as explored. Returns how many cells were new. */
export function reveal(x, z, r = REVEAL) {
  let n = 0;
  for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
    const dx = (gx + 0.5) * CELL - x, dz = (gz + 0.5) * CELL - z;
    if (dx * dx + dz * dz <= r * r) n += mark(gx, gz);
  }
  if (n) { explored.rev++; explored.cells += n; } // (saved with the next regular save, and on leaving: not worth a save of its own every few steps)
  return n;
}

// what the save holds of this world (read defensively: anything odd is left out)
{
  const saved = store.explored && typeof store.explored === 'object' ? store.explored : {};
  for (const k in saved) {
    const m = /^(-?\d+),(-?\d+)$/.exec(k);
    if (!m || typeof saved[k] !== 'string') continue;
    let bin;
    try { bin = atob(saved[k]); } catch (e) { continue; }
    if (bin.length !== BYTES) continue;
    const bits = new Uint8Array(BYTES);
    for (let i = 0; i < BYTES; i++) { bits[i] = bin.charCodeAt(i); for (let v = bits[i]; v; v &= v - 1) explored.cells++; }
    regions.set(k, { rx: +m[1], rz: +m[2], bits, rev: 0, unsaved: false });
  }
}
onSave((s) => {
  if (!s.explored || typeof s.explored !== 'object') s.explored = {};
  for (const [k, R] of regions) if (R.unsaved) { s.explored[k] = btoa(String.fromCharCode.apply(null, R.bits)); R.unsaved = false; }
});
