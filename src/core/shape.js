// The shape of the world: terrain height, lakes, the path round a lake, the jetty, and where you
// can walk. The land has no edge: its height is a formula of the world's seed and a position,
// so it can be worked out anywhere, in any order (the ground is drawn from it in tiles: see
// world/terrain.js).
//
// Lakes and the places beside them are data, not constants: a lake is an object (makeLake) that
// knows its own outline, and the jetty, campfire, bench, chairs and starting spot are worked out
// from a lake (landmarksOf). Questions about a spot ("how far from the water is this?") go to the
// lake nearest that spot (lakeAt), so the same code holds for one lake or many. Lakes are
// scattered over the whole land by its seed (see "Lakes from the seed"); one of them is HOME, the
// lake you start beside, and the single-lake names (LAKE, lakeR, lakePoint, SPAWN, dockStart, ...)
// stand for whichever lake the landmarks are at (HOME, until they move).
import { TAU, smooth, clamp, fbm, fbmD, hash, mulberry32 } from './math.js';
import { iceFrom, WINTER_CHILL } from './year.js';
import { seasonState } from './state.js';
import { worldSeed } from '../systems/save.js';
import { query } from './env.js';

export const PATH_T = 1.32;       // the path runs round a lake at this many lake-radii

// ── The world's seed ───────────────────────────────────────────
// One number decides the whole landscape: the save picks it (systems/save.js: the address's
// `?seed=`, else your last world, else a new one at random). It shifts where in the endless noise
// the land is read from. The first world, seed 1, reads from the start.
const DEFAULT_SEED = 1;
export const WORLD = { seed: worldSeed };
const shift = mulberry32(WORLD.seed * 7919 + 101);
const SX = WORLD.seed === DEFAULT_SEED ? 0 : Math.floor(shift() * 9000) + 0.37, SZ = WORLD.seed === DEFAULT_SEED ? 0 : Math.floor(shift() * 9000) + 0.61;

// ── Lakes ──────────────────────────────────────────────────────
/**
 * A lake at (x, z). Its shore is a wobbly circle, drawn out long one way: at angle `a` from the
 * centre the radius is
 *   (R0 + A3 sin(3a + P3) + A5 cos(5a + P5) + A7 sin(7a + P7)) x (1 + E cos(2(a - TH)))
 * (the lake's water shader draws its foam and shallows from the same numbers). Lakes differ in
 * more than outline: `beach` is how broad the sand round it is (1 as at home; near 0, grass or
 * snow comes down to the water), `ring` whether a path circles it, `tint` the cast of its water.
 */
export function makeLake({ x, z, R0 = 30, A3 = 4, P3 = 0, A5 = 2.5, P5 = 1.3, A7 = 1.5, P7 = 0.4, E = 0, TH = 0, beach = 1, ring = true, tint = [1, 1, 1] }) {
  const rmax = (R0 + Math.abs(A3) + Math.abs(A5) + Math.abs(A7)) * (1 + E);
  // how far out its bowl runs before the land is its own again, in lake-radii: 1.6 at home, more for a small lake (or it would lie in a pit), but never past 80 m
  const bowl = Math.max(1.6, Math.min(44 / R0, 80 / rmax));
  const L = { x, z, R0, A3, P3, A5, P5, A7, P7, E, TH, beach, ring, tint, rmax, bowl, id: 'home', name: 'Stillwater', frozen: false, reach2: (rmax * 7.5) ** 2 }; // (reach2: beyond this the lake has no say in the land)
  /** Shore radius at angle `a`. */
  L.r = (a) => (R0 + A3 * Math.sin(3 * a + P3) + A5 * Math.cos(5 * a + P5) + A7 * Math.sin(7 * a + P7)) * (1 + E * Math.cos(2 * (a - TH)));
  /** How far out a spot is, in lake-radii: 0 at the centre, 1 on the shore. */
  L.t = (px, pz) => { const dx = px - L.x, dz = pz - L.z; return Math.hypot(dx, dz) / L.r(Math.atan2(dz, dx)); };
  /** The spot at angle `a`, `t` lake-radii out. */
  L.point = (a, t) => ({ x: L.x + Math.cos(a) * L.r(a) * t, z: L.z + Math.sin(a) * L.r(a) * t });
  /** How much a spot is on the path that circles the lake (0..1; 0 everywhere if no path does). */
  L.path = (px, pz) => {
    if (!ring) return 0;
    const dx = px - L.x, dz = pz - L.z;
    const r = L.r(Math.atan2(dz, dx)) * PATH_T;
    return 1 - smooth(1.3, 2.7, Math.abs(Math.hypot(dx, dz) - r));
  };
  return L;
}
// ── Islands ───────────────────────────────────────────────────
// Some of the bigger wild lakes (not home, nor a settled lake: the boat tours the home lake) have an
// island: a low mound of land off the lake's middle, its shore wobbling, sand round its edge and grass
// on top, a tree or two, reeds round it. Its height rises from the lake floor to `top` metres in its
// middle; the water laps it where that is 0. Fixed by the seed from the lake's own square (from its
// own draws, so the lake itself is as it was). You reach it only over the ice, when the lake freezes.
/** How far out a spot is on an island, in its radii (its shore is at `I.shore`). */
export function isleQ(I, x, z) {
  const dx = x - I.x, dz = z - I.z, a = Math.atan2(dz, dx);
  return Math.hypot(dx, dz) / (I.r * (1 + 0.16 * Math.sin(3 * a + I.p1) + 0.09 * Math.sin(5 * a + I.p2)));
}
/** The point at angle `a`, `q` island-radii out. */
export function islePoint(I, a, q) {
  const r = I.r * (1 + 0.16 * Math.sin(3 * a + I.p1) + 0.09 * Math.sin(5 * a + I.p2)) * q;
  return { x: I.x + Math.cos(a) * r, z: I.z + Math.sin(a) * r };
}
/** The island's own ground at a spot (it is the lake floor wherever that is higher). */
const isleH = (I, x, z) => { const q = isleQ(I, x, z); return I.top - (I.top + 0.9) * q * q; };
/** A lake's island, or null. */
function isleOf(L, cx, cz) {
  const sd = WORLD.seed | 0, h = (k) => hash(cx * 53 + k * 101 + sd, cz * 71 + k * 37 + 907);
  if (L.R0 < 20 || h(0) > 0.7) return null;
  const a = h(1) * TAU, r = L.R0 * (0.2 + 0.1 * h(2)), top = 1.4 + 2.2 * h(3);
  // off the middle (whose water stays deep), and well inside the shore on that side
  const I = { x: 0, z: 0, r, top, shore: Math.sqrt(top / (top + 0.9)), p1: h(5) * TAU, p2: h(6) * TAU };
  // with open water all round it (looked at all the way round, a little beyond its shore), moved in toward the middle if need be
  for (let off = Math.min(L.R0 * (0.34 + 0.14 * h(4)), 0.8 * L.r(a) - r * 1.25); off >= r * 1.35; off *= 0.88) { // (the lake's middle stays a metre deep or more)
    I.x = L.x + Math.cos(a) * off; I.z = L.z + Math.sin(a) * off;
    let clear = true;
    for (let k = 0; k < 16 && clear; k++) { const p = islePoint(I, (k / 16) * TAU, I.shore * 1.45); if (L.t(p.x, p.z) > 0.9) clear = false; }
    if (clear) return I;
  }
  return null;
}
/** Is a spot on an island's dry land (`margin` island-radii in from its shore)? */
export function onIsland(x, z, margin = 0) {
  const I = lakeAt(x, z).isle;
  return !!I && isleQ(I, x, z) < I.shore - margin;
}
/** The side of the squares the land is ruled into, one lake (or none) to a square. */
export const LAKE_CELL = 420;
/**
 * The home lake: the one you start beside. Like every lake it comes from the world's seed; unlike
 * the others it is always there (in the square at the world's middle), is always settled, has
 * every landmark, and lies in mild country. It is put at the flattest of a dozen spots in its
 * square, well clear of the mountains, and kept near enough round, and big enough, that a jetty
 * always fits and the boat has room for its tour.
 */
function makeHome() {
  const R = mulberry32((Math.imul(WORLD.seed, 0x2545F491) ^ 0x1B873593) | 0);
  let spot = null;
  for (let k = 0; k < 14; k++) {
    const x = (0.2 + R() * 0.6) * LAKE_CELL, z = (0.2 + R() * 0.6) * LAKE_CELL, rough = rangeAt(x, z) + fbm((x + SX * 31) * 0.0055 - 9.2, (z + SZ * 31) * 0.0055 + 23.6) * 0.3;
    if (!spot || rough < spot.rough) spot = { x, z, rough };
  }
  const R0 = 27 + R() * 6, wob = 0.55 + R() * 0.45;
  return makeLake({ x: spot.x, z: spot.z, R0, A3: R0 * 0.13 * wob, P3: R() * TAU, A5: R0 * 0.085 * wob, P5: R() * TAU, A7: R0 * 0.05 * wob, P7: R() * TAU, E: R() * 0.1, TH: R() * Math.PI });
}
export const HOME = makeHome();
HOME.settled = true;
HOME.clime = { dry: 0, lush: 0, snow: 0 };

// ── Lakes from the seed ────────────────────────────────────────
// The land is ruled into squares LAKE_CELL metres wide, and each square has one lake or none,
// decided by the world's seed and the square's place: where in the square it lies, how big it is
// and the shape of its shore: round ponds, long narrow waters, lakes with deep bays. A lake keeps
// to the middle of its square, which keeps any two far enough apart that their bowls never touch;
// none lies among the mountains. The country it lies in gives it its character: a broad beach in
// the meadows and broader still on the heath, where the water is clear turquoise; grass to the
// water's edge and dark green water in lush country; ice the year round in the snow. Some have a
// path worn round them. One square holds HOME instead.
const lakeCells = new Map(), aroundCells = new Map();
const HOME_CX = Math.floor(HOME.x / LAKE_CELL), HOME_CZ = Math.floor(HOME.z / LAKE_CELL);
const NAME_A = ['Mirror', 'Heron', 'Willow', 'Amber', 'Silver', 'Moss', 'Lark', 'Fern', 'Otter', 'Birch', 'Glass', 'Hollow', 'Mist', 'Reed', 'Thistle', 'Ember', 'Swan', 'Dawn', 'Quiet', 'Lantern'];
const NAME_COLD = ['Frost', 'Snow', 'White', 'Winter', 'Crystal', 'Pale'], NAME_B = ['water', 'mere', 'pool', 'tarn', 'deep', 'rest', 'glass', 'hollow'];
/** The first of a square's draws: whether it has a lake and where (and the random stream, for the rest of the lake). */
function cellSpot(cx, cz) {
  const R = mulberry32((Math.floor(hash(cx * 11 + 7, cz * 17 - 3) * 4294967296) ^ Math.imul(WORLD.seed, 0x85EBCA6B)) | 0);
  const there = R() < 0.62, x = (cx + 0.2 + R() * 0.6) * LAKE_CELL, z = (cz + 0.2 + R() * 0.6) * LAKE_CELL;
  return { R, x, z, there: there && rangeAt(x, z) < 0.3 && seaAt(x, z) < 0.01 };
}
// Settled lakes are the ones with things built beside them: a jetty, a fire, a bench (see kitOf).
/**
 * Whether lakes away from home are settled (with a jetty, fire, bench and lamps of their own). For
 * now they are not: away from home the lakes are wild (the owner's decision: lamps and benches out
 * in the wilds looked out of place). The rules for settled lakes are kept, and `?settlements=1`
 * turns them on (their tests use it).
 */
export const SETTLEMENTS = query.has('settlements');
let sitesReady = false;
// A lake is settled if it outranks every lake in the eight squares round its own, by a rank fixed
// by the seed. So no two settled lakes are neighbours: they lie half a kilometre apart at the
// least, each out of sight of the next. The home lake outranks all.
const cellRank = (cx, cz) => (cx === HOME_CX && cz === HOME_CZ ? 2 : hash(cx * 5 + 1 + WORLD.seed * 3, cz * 9 - 4));
function settledCell(cx, cz) {
  const mine = cellRank(cx, cz);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const nx = cx + dx, nz = cz + dz;
    if (cellRank(nx, nz) > mine && ((nx === HOME_CX && nz === HOME_CZ) || cellSpot(nx, nz).there)) return false;
  }
  return true;
}
function lakeOfCell(cx, cz) {
  const key = cx + ':' + cz;
  let L = lakeCells.get(key);
  if (L !== undefined) return L;
  L = null;
  if (cx === HOME_CX && cz === HOME_CZ) L = HOME;
  else {
    const { R, there, x, z } = cellSpot(cx, cz), settled = SETTLEMENTS && there && settledCell(cx, cz);
    const size = R(), p3 = R() * TAU, p5 = R() * TAU, p7 = R() * TAU, wob = 0.35 + R() * 1.25, n1 = R(), n2 = R(), long = R(), th = R() * Math.PI, worn = R();
    if (there) {
      // size, how deeply the shore is scalloped, and how long and narrow it is (one in three is nearly round);
      // then scaled down, if need be, so the longest reach of the shore stays inside the lake's own square
      let R0 = 12 + size * size * 30;
      const E = long < 0.33 ? long * 0.15 : 0.08 + (long - 0.33) * 0.42, lobes = (0.13 + 0.085 + 0.05) * wob;
      R0 *= Math.min(1, 47 / (R0 * (1 + lobes) * (1 + E)));
      // its character, from the country it lies in
      const rain = rainAt(x, z), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(coldAt(x, z, 1));
      const beach = clamp(1 + dry * 0.5 - lush * 0.8 - snow * 0.9, 0.1, 1.5);
      const tint = [1 - lush * 0.3 - dry * 0.12 - snow * 0.12, 1 + lush * 0.04 + dry * 0.16 - snow * 0.04, 1 - lush * 0.2 + dry * 0.12 + snow * 0.12];
      L = makeLake({ x, z, R0, A3: R0 * 0.13 * wob, P3: p3, A5: R0 * 0.085 * wob, P5: p5, A7: R0 * 0.05 * wob, P7: p7, E, TH: th, beach, ring: settled || (SETTLEMENTS && worn < 0.25), tint }); // (a settled lake always has its path)
      L.id = key;
      L.settled = settled;
      L.clime = { dry, lush, snow }; // (the country it lies in: what grows and lives at it follows from this)
      L.frozen = snow > 0.6;
      if (!settled) L.isle = isleOf(L, cx, cz);
      const first = L.frozen ? NAME_COLD : NAME_A;
      L.name = first[Math.floor(n1 * first.length)] + NAME_B[Math.floor(n2 * NAME_B.length)];
    }
  }
  lakeCells.set(key, L);
  return L;
}
/** The lakes that could matter at a spot: those of its square and the eight round it. */
let lastAround = null, lastCX = NaN, lastCZ = NaN;
function lakesAround(x, z) {
  const cx = Math.floor(x / LAKE_CELL), cz = Math.floor(z / LAKE_CELL);
  if (cx === lastCX && cz === lastCZ) return lastAround;
  const key = cx + ':' + cz;
  let list = aroundCells.get(key);
  if (!list) {
    list = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const L = lakeOfCell(cx + dx, cz + dz); if (L) list.push(L); }
    aroundCells.set(key, list);
  }
  lastCX = cx; lastCZ = cz; lastAround = list;
  return list;
}
/** Every lake within `r` metres of a spot, nearest first. */
export function lakesNear(x, z, r) {
  const out = [], c0 = Math.floor((x - r) / LAKE_CELL), c1 = Math.floor((x + r) / LAKE_CELL), d0 = Math.floor((z - r) / LAKE_CELL), d1 = Math.floor((z + r) / LAKE_CELL);
  for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) { const L = lakeOfCell(cx, cz); if (L && Math.hypot(L.x - x, L.z - z) < r + L.R0) out.push(L); }
  return out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}
/** The lake nearest a spot (by how far out the spot is, in that lake's own radii). There always is one, though it may be far off. */
export function lakeAt(x, z) {
  const list = lakesAround(x, z);
  let best = null, bt = Infinity;
  for (let i = 0; i < list.length; i++) {
    const L = list[i], dx = x - L.x, dz = z - L.z, d2 = dx * dx + dz * dz;
    const t = d2 > L.reach2 ? Math.sqrt(d2) / L.R0 : L.t(x, z); // (far off, the exact shore doesn't matter)
    if (t < bt) { bt = t; best = L; }
  }
  return best || lakesNear(x, z, LAKE_CELL * 4)[0] || HOME;
}
/** How far out a spot is from its nearest lake, in lake-radii (1 = on the shore). */
export const lakeT = (x, z) => lakeAt(x, z).t(x, z);
/** How much a spot is on the path round its nearest lake. */
export const pathAmt = (x, z) => lakeAt(x, z).path(x, z);
// the single-lake names: the lake the landmarks stand at (the home lake, until anchorTo moves them)
export let LAKE = HOME, lakeR = HOME.r;

// ── Terrain ────────────────────────────────────────────────────
/**
 * The lie of the land before any lake is cut into it. Three layers: the gentle meadow underfoot;
 * broad rolling hills; and, in some regions, mountains with long sharp ridges. The hills and
 * mountains are held back round every lake (`open` is 0 by a lake, 1 away from any), so each lake
 * lies in its own valley. Never below 0.6 m: the only water is the lakes.
 */
/**
 * How strongly the mountains' fine relief is worn off their steep sides (see land()). Running water
 * and falling rock strip the small bumps from a steep slope and leave them on the ridges and the
 * flats; here the bumps shrink by 1 / (1 + EROSION * slope²), the slope being that of the broad
 * shape of the mountain beneath them.
 */
export const EROSION = 1.0;
const gH = [0, 0, 0], gC = [0, 0, 0];
function land(x, z, open) {
  const sea = seaAt(x, z), h = landShape(x, z, open);
  return sea > 0 ? h * (1 - sea) - sea * SEA_DEPTH : h; // (the hills too go under the open sea: only the islands stand out of it)
}
function landShape(x, z, open) {
  const u = x + SX * 31, v = z + SZ * 31;
  const meadow = 0.6 + fbm(u * 0.018 + 3.1, v * 0.018 - 7.4) * 7.5;
  if (open <= 0) return meadow;
  const range = rangeAt(x, z);
  const steps = cliffsAt(x, z) * open; // (the windy cliffs: below)
  if (range <= 0) { const hills = fbm(u * 0.0055 - 9.2, v * 0.0055 + 23.6); return stepped(meadow + open * hills * hills * 46 * (1 - 0.8 * plainsAt(x, z)), hills, steps); }
  // the mountains: broad hills and ridged crests (with their slopes, in metres per metre)...
  fbmD(u * 0.0055 - 9.2, v * 0.0055 + 23.6, gH);
  fbmD(u * 0.0038 + 71.1, v * 0.0038 + 5.5, gC);
  const hills = gH[0], f = gC[0], sgn = 2 * f - 1 >= 0 ? 1 : -1;
  const crest = 1 - Math.abs(2 * f - 1); // ridged: sharp along the tops
  const kx = 2 * hills * 46 * gH[1] * 0.0055 - range * 2 * crest * 205 * 2 * sgn * gC[1] * 0.0038;
  const kz = 2 * hills * 46 * gH[2] * 0.0055 - range * 2 * crest * 205 * 2 * sgn * gC[2] * 0.0038;
  // ...and their fine relief, worn off where that broad shape is steep
  const wear = 1 / (1 + EROSION * (kx * kx + kz * kz) * open * open);
  const detail = 0.5 + (fbm(u * 0.021 - 3.3, v * 0.021 + 8.8) - 0.5) * wear;
  const flat = range < 0.18 ? 1 - 0.8 * plainsAt(x, z) : 1;
  const h0 = meadow + open * (hills * hills * 46 * flat + range * (28 + crest * crest * 205 + detail * 24 * range));
  return stepped(h0, hills, steps);
}
/** In the windy cliffs the hills rise higher and step into plateaus. */
function stepped(h, hills, steps) {
  if (steps <= 0) return h;
  const up = h + steps * hills * hills * 40 * (1 - smooth(40, 80, h));
  return up + (terrace(up) - up) * steps;
}
/** The windy cliffs' field (0..1): hilly, mild-to-dry country stepped into high plateaus. */
let CSX = null;
export function cliffsAt(x, z) {
  if (CSX === null) CSX = hash(WORLD.seed, 107) * 9000;
  const f = smooth(0.64, 0.7, fbm((x + CSX) * 0.0009 - 3.7, (z - CSX) * 0.0009 + 1.9)) * smooth(400, 800, Math.hypot(x - HOME.x, z - HOME.z));
  return f > 0 ? f * (1 - smooth(0.08, 0.3, rangeAt(x, z))) * (1 - smooth(0.15, 0.3, Math.abs(coldBase(x, z)))) : 0;
}
/** Land stepped into flat plateaus, each about 16 m above the last, with steep risers between. */
function terrace(h) {
  const S = 16, k = h / S, i = Math.floor(k), f = k - i;
  return (i + smooth(0.72, 0.95, f)) * S;
}
// ── The sea, its continents and islands ────────────────────────
// (docs/endless-world.md, "Plan: a world with places in it".) The world is ruled into squares
// CONTINENT_CELL metres wide, home's square centred on home and every other row pushed half a square
// along, so the continents do not stand in rows and columns. A square holds one continent or none: a
// middle pushed about in its square, a size, a long way and a short way at some angle, and a coast
// bent by noise. Each is smaller than its square, so there is sea between neighbours (now and then two
// touch: an isthmus). Home's square always has one, home inland on it. (One plain field of noise will
// not do: at half land it joins up into one landmass without end.) Islands rise from the shelf near a
// continent, more toward an equator. The land sinks under the sea, its level the lakes' own (0): low
// country goes under first, hills stand out as headlands. Never within 2 km of home.
export const SEA_DEPTH = 26, CONTINENT_CELL = 9000;
let OSX = null, OSZ = 0;
const contCells = new Map();
const CONT_A = ['Raven', 'Silver', 'Ember', 'Willow', 'Frost', 'Amber', 'Heron', 'Thistle', 'Dawn', 'Moss', 'Star', 'Lark', 'Mist', 'Golden', 'Hollow', 'Wind'], CONT_B = ['moor', 'reach', 'mark', 'holm', 'wold', 'shore', 'vale', 'fell', 'land', 'haven'];
/** A square's continent, or null. (Names never repeat within two squares of each other.) */
function contCell(cx, cz) {
  const key = cx * 131071 + cz;
  let c = contCells.get(key);
  if (c !== undefined) return c;
  c = null;
  const sd = WORLD.seed | 0, row = cz & 1 ? 0.5 : 0;
  if (cx === 0 && cz === 0) {
    const a = hash(sd, 311) * TAU;
    c = { x: HOME.x + Math.cos(a) * 800, z: HOME.z + Math.sin(a) * 800, R: 3000 + hash(sd, 313) * 500, s: 1 + hash(sd, 317) * 0.15 };
  } else if (hash(cx * 13 + sd, cz * 7 + 5) > 0.14) {
    c = { x: HOME.x + (cx + row + (hash(cx * 3 + sd, cz * 11) - 0.5) * 0.5) * CONTINENT_CELL, z: HOME.z + (cz + (hash(cz * 5 + sd, cx * 17) - 0.5) * 0.5) * CONTINENT_CELL, R: 2000 + hash(cx + sd * 3, cz * 19) * 1500, s: 1 + hash(cx * 37, cz * 41 + sd) * 0.3 };
  }
  if (c) {
    const a = hash(cx * 29 + sd, cz * 31) * Math.PI, m = ((x, n) => ((x % n) + n) % n);
    c.cos = Math.cos(a); c.sin = Math.sin(a); c.cx = cx; c.cz = cz;
    c.name = CONT_A[m(cx * 5 + cz * 3 + sd, 16)] + CONT_B[m(cx * 3 + cz + (sd >> 4), 10)];
  }
  contCells.set(key, c);
  return c;
}
let lsX = NaN, lsZ = NaN, lsV = 0, lsC = null, lsS = 0;
/** How far inland a spot is by its continent (above 0 land, below 0 sea); `lsC` the continent. */
function continentField(x, z) {
  if (OSX === null) { OSX = hash(WORLD.seed, 211) * 50000; OSZ = hash(WORLD.seed, 223) * 50000; }
  const wx = x + (fbm((x + OSX) * 0.0004 + 3.3, (z + OSZ) * 0.0004 - 8.1) - 0.5) * 2600, wz = z + (fbm((x + OSX) * 0.0004 - 5.7, (z + OSZ) * 0.0004 + 2.9) - 0.5) * 2600;
  const fz = (z - HOME.z) / CONTINENT_CELL + 0.5, cz = Math.floor(fz);
  let best = -9, win = null;
  for (let j = -1; j <= 1; j++) {
    const r = cz + j, row = r & 1 ? 0.5 : 0, cx = Math.floor((x - HOME.x) / CONTINENT_CELL + 0.5 - row);
    for (let i = -1; i <= 1; i++) {
      const c = contCell(cx + i, r);
      if (!c) continue;
      const dx = wx - c.x, dz = wz - c.z, u = dx * c.cos + dz * c.sin, v = dz * c.cos - dx * c.sin;
      const f = 1 - Math.hypot(u / c.s, v * c.s) / c.R;
      if (f > best) { best = f; win = c; }
    }
  }
  lsC = win;
  return best + (fbm((x + OSX) * 0.0011 - 9.0, (z + OSZ) * 0.0011 + 6.0) - 0.5) * 0.3;
}
/** The sea at a spot, worked out in full (seaAt reads it from a grid). */
function seaExact(x, z) {
  const d = Math.hypot(x - HOME.x, z - HOME.z);
  const c = lsV = continentField(x, z);
  if (c >= 0) return 0;
  let s = smooth(0, -0.2, c) * smooth(2000, 3200, d);
  if (c > -0.42) { // islands on the shelf, more of them toward an equator
    const n = fbm((x + OSZ) * 0.0013 + 31.0, (z + OSX) * 0.0013 - 12.0), warm = 1 - smooth(0.15, 0.45, latitudeAt(x, z));
    s *= 1 - smooth(0.68 - warm * 0.06, 0.73 - warm * 0.06, n);
  }
  return s;
}
// The sea is read under every height, and worked out in full it costs several times the rest of the
// land's noise; but it changes only over hundreds of metres, so it is worked out once on a grid of
// SEA_STEP metres (in blocks of SEA_BLOCK squares, the oldest dropped past SEA_KEEP) and read between.
const SEA_STEP = 32, SEA_BLOCK = 64, SEA_KEEP = 900, seaBlocks = new Map();
let sbKey = NaN, sbArr = null;
function seaBlock(bx, bz) {
  const key = bx * 131071 + bz;
  if (key === sbKey) return sbArr;
  let a = seaBlocks.get(key);
  if (!a) {
    const W = SEA_BLOCK + 1, x0 = HOME.x + bx * SEA_BLOCK * SEA_STEP, z0 = HOME.z + bz * SEA_BLOCK * SEA_STEP;
    a = new Float32Array(W * W);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) a[j * W + i] = seaExact(x0 + i * SEA_STEP, z0 + j * SEA_STEP);
    if (seaBlocks.size >= SEA_KEEP) seaBlocks.delete(seaBlocks.keys().next().value);
    seaBlocks.set(key, a);
  }
  sbKey = key; sbArr = a;
  return a;
}
/** How much a spot is out at sea (0 land .. 1 open sea): how far the land there is sunk. */
export function seaAt(x, z) {
  if (x === lsX && z === lsZ) return lsS;
  lsX = x; lsZ = z;
  const dx = x - HOME.x, dz = z - HOME.z;
  if (dx * dx + dz * dz < 4e6) return (lsS = 0);
  const gx = dx / SEA_STEP, gz = dz / SEA_STEP, ix = Math.floor(gx), iz = Math.floor(gz), bx = Math.floor(ix / SEA_BLOCK), bz = Math.floor(iz / SEA_BLOCK);
  const a = seaBlock(bx, bz), W = SEA_BLOCK + 1, k = (iz - bz * SEA_BLOCK) * W + (ix - bx * SEA_BLOCK), fx = gx - ix, fz = gz - iz;
  const s0 = a[k] + (a[k + 1] - a[k]) * fx, s1 = a[k + W] + (a[k + W + 1] - a[k + W]) * fx;
  return (lsS = s0 + (s1 - s0) * fz);
}
/** The continent a spot belongs to (or the one whose shore it is off): { name, x, z, R, cx, cz }. */
export function continentAt(x, z) { continentField(x, z); return lsC; }
/** Is a spot on a continent's own land (not an island off it)? */
export const onContinent = (x, z) => continentField(x, z) >= -0.01;

// ── Harbours and passages ──────────────────────────────────────
// (features/harbours.js.) Neighbouring continents are joined by passages: a skipper at a harbour on
// one sails you to the harbour facing it on the other. Continents are neighbours when their squares
// touch (six about each, the rows being pushed half along), or two squares off when either has fewer
// than two that touch, so the joins always go both ways and every continent can be reached. Each
// continent has a harbour on its coast facing each neighbour (two that would stand within 1200 m are
// one); a harbour stands at the shore's edge on low dry ground, its jetty running out to sea.
const HARBOUR_MERGE = 1200;
/** The continents whose squares touch this one's (unjittered middles about one square apart). */
function touching(c) {
  if (c.touch) return c.touch;
  c.touch = [];
  const rx = (cx, cz) => cx + (cz & 1 ? 0.5 : 0);
  for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) { const cz = c.cz + j, cx = c.cx + i, d = Math.hypot(rx(cx, cz) - rx(c.cx, c.cz), j); if (d > 0 && d < 1.2) { const o = contCell(cx, cz); if (o) c.touch.push(o); } }
  return c.touch;
}
/** The continents joined to this one by passages. */
function linked(c) {
  if (c.links) return c.links;
  const out = touching(c).slice(), rx = (cx, cz) => cx + (cz & 1 ? 0.5 : 0);
  for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) {
    const cz = c.cz + j, cx = c.cx + i, d = Math.hypot(rx(cx, cz) - rx(c.cx, c.cz), j);
    if (d < 1.2 || d > 2.05) continue;
    const o = contCell(cx, cz);
    if (o && (touching(c).length < 2 || touching(o).length < 2)) out.push(o);
  }
  return (c.links = out);
}
/**
 * The foot of a harbour on a continent's coast along a bearing from its middle (`out.foot`; null where
 * the coast will not take one). A job: it stops (yields) between its costly parts, the walk out to the
 * coast and each look round for rivers and buildings, so the work can be spread over frames.
 */
function* coastFoot(c, a, out) {
  out.foot = null;
  const dx = Math.cos(a), dz = Math.sin(a), max = c.R * c.s * 2.6 + 1500;
  let land = false, r = 0;
  for (; r < max; r += 30) { // (the sea from the grid: cheap; the depth only where it is sea)
    const x = c.x + dx * r, z = c.z + dz * r, s = seaAt(x, z);
    if (!land) { if (s === 0) land = true; continue; }
    if (s > 0.15 && rawHeight(x, z) < -1.5) break;
  }
  if (!land || r >= max) return;
  let x = 0, z = 0, b = r;
  for (; b > r - 240; b -= 2) { x = c.x + dx * b; z = c.z + dz * b; if (rawHeight(x, z) >= 0.6) break; }
  if (b <= r - 240) return;
  const h = rawHeight(x, z);
  if (h > 2.6 || rawHeight(x - dx * 5, z - dz * 5) > h + 2.5) return; // (no cliff: low ground, rising gently behind)
  if (continentAt(x, z) !== c || lakeAt(x, z).t(x, z) < 2.5) return;
  yield;
  if (riverHere(x, z)) return;
  for (const k in SITE_KINDS) { yield; if (sitesNear(x, z, 60, k).length) return; } // (clear of every building)
  out.foot = { x, z, dx, dz };
}
const COMPASS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
/**
 * A continent's harbours, each facing the neighbours it serves: `{ id, kind: 'harbour', name, x, z, y,
 * turn, ax, az, cont, serves }`. Working them out means walking the coast along many bearings, so it
 * is done a bearing at a time (harbourWork), a few milliseconds a frame, before you need them; this
 * finishes the work at once.
 */
export function harboursOf(c) { harbourWork(c, Infinity); return c.harbours; }
/** Work at a continent's harbours for up to `ms` milliseconds. Returns whether they are all worked out. */
export function harbourWork(c, ms) {
  if (c.harbours) return true;
  const until = performance.now() + ms;
  if (!c.job) c.job = harbourJob(c);
  while (!c.job.next().done) if (performance.now() >= until) return false;
  c.job = null;
  return true;
}
/** The continents joined to this one by passages (their harbours are wanted next: harbourWork). */
export const linkedContinents = (c) => linked(c);
function* harbourJob(c) {
  const got = {}, list = [], toward = new Map(), ns = linked(c).slice().sort((p, q) => Math.atan2(p.z - c.z, p.x - c.x) - Math.atan2(q.z - c.z, q.x - c.x));
  for (const o of ns) {
    const a0 = Math.atan2(o.z - c.z, o.x - c.x);
    let foot = null;
    for (const off of [0, 15, -15, 30, -30, 45, -45, 60, -60]) { yield* coastFoot(c, a0 + off * Math.PI / 180, got); yield; if ((foot = got.foot)) break; }
    let h = foot && list.find((q) => Math.hypot(q.x - foot.x, q.z - foot.z) < HARBOUR_MERGE);
    if (foot && !h) {
      const k = list.length, turn = Math.atan2(foot.dx, foot.dz);
      h = { id: `harbour:${c.cx}:${c.cz}:${k}`, kind: 'harbour', name: `${c.name} ${COMPASS[Math.round(((Math.atan2(foot.dx, -foot.dz) * 180 / Math.PI) + 360) / 45) % 8]} Harbour`, x: foot.x, z: foot.z, y: 0, turn, variant: k, flat: 0, out: 0, ax: foot.x - foot.dx * 3, az: foot.z - foot.dz * 3, cont: c, serves: [] };
      list.push(h);
    }
    if (h) { h.serves.push(o); toward.set(o, h); }
  }
  // a neighbour whose bearing found no coast: served by the nearest harbour there is
  for (const o of ns) if (!toward.has(o) && list.length) { const h = list.reduce((p, q) => (Math.hypot(q.x - o.x, q.z - o.z) < Math.hypot(p.x - o.x, p.z - o.z) ? q : p)); h.serves.push(o); toward.set(o, h); }
  // a continent whose every bearing failed: any foothold round its coast
  if (!list.length) for (let k = 0; k < 24 && !list.length; k++) { yield* coastFoot(c, (k / 24) * TAU, got); yield; const f = got.foot; if (f) { const h = { id: `harbour:${c.cx}:${c.cz}:0`, kind: 'harbour', name: `${c.name} Harbour`, x: f.x, z: f.z, y: 0, turn: Math.atan2(f.dx, f.dz), variant: 0, flat: 0, out: 0, ax: f.x - f.dx * 3, az: f.z - f.dz * 3, cont: c, serves: ns.slice() }; list.push(h); for (const o of ns) toward.set(o, h); } }
  c.toward = toward;
  c.harbours = list;
}
/** Where a passage from a harbour goes: the harbours facing it on the continents it serves. */
export function passagesFrom(h) {
  const out = [];
  for (const o of h.serves) { harboursOf(o); const t = o.toward.get(h.cont); if (t) out.push(t); }
  return out;
}
/** The continents whose coasts may come within `r` metres of a spot (`c.harbours` is set once worked out: harboursOf). */
export function continentsNear(x, z, r) {
  const out = [], reach = r + CONTINENT_CELL * 1.2, z0 = Math.floor((z - reach - HOME.z) / CONTINENT_CELL + 0.5), z1 = Math.floor((z + reach - HOME.z) / CONTINENT_CELL + 0.5);
  for (let cz = z0; cz <= z1; cz++) {
    const row = cz & 1 ? 0.5 : 0, x0 = Math.floor((x - reach - HOME.x) / CONTINENT_CELL + 0.5 - row), x1 = Math.floor((x + reach - HOME.x) / CONTINENT_CELL + 0.5 - row);
    for (let cx = x0; cx <= x1; cx++) { const c = contCell(cx, cz); if (c) out.push(c); }
  }
  return out;
}
/** Every harbour within `r` metres of a spot, nearest first (`ready`: only those of continents already worked out, so it never stops to work). */
export function harboursNear(x, z, r, ready = false) {
  const out = [];
  for (const c of continentsNear(x, z, r)) { if (ready && !c.harbours) continue; for (const h of harboursOf(c)) if (Math.hypot(h.x - x, h.z - z) < r) out.push(h); }
  return out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}
/** The harbour with this id (ids name their continent's square), or null. */
export function harbourById(id) {
  const m = /^harbour:(-?\d+):(-?\d+):\d+$/.exec(id || '');
  if (!m) return null;
  const c = contCell(+m[1], +m[2]);
  return c ? harboursOf(c).find((h) => h.id === id) || null : null;
}
/** How much a spot is in the mountains (0 none .. 1 the heart of a range). */
export function rangeAt(x, z) { return smooth(0.5, 0.72, fbm((x + SX * 31) * 0.0014 + 41.3, (z + SZ * 31) * 0.0014 - 17.9)); }
let shaped = false; // (did the last rawHeight() land on a lake's own shaped ground: its bowl, shore and path?)
/**
 * The land as the seed gives it, before the ground under any shrine is levelled: held down in the
 * valleys of the lakes within reach, with the nearest lake's bowl and path cut in. (Every lake's
 * valley is a smooth factor and the bowls never overlap, so the land has no seam where "the
 * nearest lake" changes from one to another.) Where a shrine may stand is decided from this.
 */
export function rawHeight(x, z) {
  const list = lakesAround(x, z);
  let open = 1, lake = null, t = 99;
  for (let i = 0; i < list.length; i++) {
    const L = list[i], dx = x - L.x, dz = z - L.z;
    if (dx * dx + dz * dz > L.reach2) continue;
    const lt = L.t(x, z);
    open *= smooth(2.4, 7.5, lt);
    if (lt < t) { t = lt; lake = L; }
  }
  const base = land(x, z, open);
  shaped = !!lake && t < lake.bowl + 0.1;
  if (!shaped) return base; // (beyond the bowl and the path)
  let floor = t < 1 ? -3.2 * (1 - t * t) : (t - 1) * 2.0;
  if (lake.isle && t < 1) floor = Math.max(floor, isleH(lake.isle, x, z)); // (an island rising out of it)
  const k = smooth(0.8, lake.bowl, t);
  return floor * (1 - k) + base * k - lake.path(x, z) * 0.08;
}

/**
 * Exact terrain height: the land, with the ground under each shrine made level (flat for PAD_FLAT
 * metres round its middle, easing back into the lie of the land by PAD_OUT). The ground's tiles
 * are built from it. A shrine never stands on a lake's own ground, so that is left as it is.
 */
export function height(x, z) {
  const h = heightBeforeRivers(x, z);
  if (!sitesReady) return h;
  const r = riverNear(x, z);
  return r ? Math.min(h, riverBed(r)) : h;
}
/** The height, but for the rivers (see height()). */
function heightBeforeRivers(x, z) {
  const h = rawHeight(x, z);
  if (shaped) return h;
  const s = shrineSiteAt(x, z, PAD_OUT);
  if (s) return h + (s.y - h) * (1 - smooth(PAD_FLAT, PAD_OUT, Math.hypot(x - s.x, z - s.z)));
  if (sitesReady) { const ht = heartAt(x, z); if (ht) return heartRise(ht, x, z, h); }
  if (sitesReady) { const v = volcanoAt(x, z); if (v) return h + coneRise(Math.hypot(x - v.x, z - v.z)); }
  const b = sitesReady ? siteAt(x, z) : null; // (a building's levelled ground)
  if (b && b.out > 0) return h + (b.y - h) * (1 - smooth(b.flat, b.out, Math.hypot(x - b.x, z - b.z)));
  return h;
}

// ── Climate ────────────────────────────────────────────────────
// Two broad fields, read from the same seeded noise as the land, decide what kind of country a
// place is: how cold it is and how much rain it gets. Everything that covers the land reads them
// (the ground's colour and snow, the grass, which trees grow and how thickly, the flowers), so
// the kinds of country change together as you travel, and blend where they meet:
//   cold  -> snow in drifts, then snowfields; pines; no flowers      (also: the higher, the colder)
//   dry   -> golden heath, tall pale grass, a few airy trees, more boulders
//   wet   -> lush dark-green country, thick mixed woods, ferns and mushrooms
// and here and there a blossom grove. Round the home lake the country is always mild.
const mild = (x, z) => smooth(140, 330, Math.hypot(x - HOME.x, z - HOME.z)); // (0 by the home lake, 1 beyond it)
// ── Moisture, and what temperature and moisture make together ──
// As in nature (and in Minecraft, which picks its biomes from temperature and humidity), the kind
// of country comes from how cold and how wet it is together: mild and wet, thick lush woods; mild
// and dry, golden heath; cold and wet, deep snow and dark pine woods (taiga); cold and dry, bare
// tundra where little snow lies, for snow needs moisture as well as cold. The ground is wetter near
// water, so a lake's shores are greener than the country about it.
/** How much wetter (in rain's units) dry ground is right by a lake, fading out over a few lake-radii (never past middling: water greens dry country, it does not make a swamp of mild). */
export const WATER_WET = 0.08;
/** How much less snowy cold, dry country is (in coldAt's units): the tundra. */
export const SNOW_DRY = 0.3;
/** How wet the ground is (0 parched .. 1 soaked): the rain, and, in dry country, more of it near a lake. */
export function moistAt(x, z) {
  const rain = rainAt(x, z);
  if (rain >= 0.5) return rain;
  return Math.min(0.5, rain + WATER_WET * (1 - smooth(1.2, 3.5, lakeAt(x, z).t(x, z))));
}
/** Cold, as far as snow goes (pass to snowOf): cold needs moisture to give snow. */
export const snowCold = (cold, moist) => cold - SNOW_DRY * (1 - smooth(0.33, 0.45, moist));

/** How warm the warm country is, in the units of the cold (it takes the chill below zero). */
export const WARMTH = 0.6;
/**
 * How cold the country is at a spot, before its height: 0 mild .. 1 frozen, and below 0 in warm
 * country (to -WARMTH): one broad field of temperature, cold at one end and warm at the other, the
 * home lake in the middle of it.
 */
export function coldBase(x, z) {
  const n = fbm((x + SX * 17) * 0.0011 - 63.4, (z + SZ * 17) * 0.0011 + 28.9), patches = smooth(0.575, 0.7, n) - WARMTH * smooth(0.425, 0.3, n);
  return clamp(latCold(latitudeAt(x, z)) + PATCHES * patches, -WARMTH, 1) * mild(x, z);
}

// ── Latitude ───────────────────────────────────────────────────
// The endless land is divided into lands LAND metres from north to south (north is -z), each with a
// cold pole at its north edge, a warm equator through its middle and a cold pole at its south edge
// (the owner's rule: many small worlds, each with its own north and south, and the kind of year by
// latitude as on Earth). Lands are mirror images of their neighbours, so a pole is shared. Home lies
// HOME_SOUTH metres south of a pole, in a temperate belt. The belts' edges wander (a slow noise
// shifts the latitude a spot feels by up to about BELT_WANDER metres), but not round home. The
// country's cold follows the latitude, the old scattered patches adding PATCHES of their own, so a
// cold valley can lie in a mild belt.
export const LAND = 12000, HOME_SOUTH = 2700, BELT_WANDER = 900, PATCHES = 0.5;
const HALF = LAND / 2, modLand = (d) => ((d % LAND) + LAND) % LAND;
let wX = NaN, wZ = NaN, wV = 0;
/** How far (m, north to south) the latitude a spot feels is shifted from its true one. */
function latShift(x, z) {
  if (x === wX && z === wZ) return wV;
  const away = smooth(330, 1500, Math.hypot(x - HOME.x, z - HOME.z));
  wX = x; wZ = z;
  wV = away <= 0 ? 0 : away * ((fbm((x + SX * 17) * 0.00025 + 91.7, (z + SZ * 17) * 0.00025 - 37.1) - 0.5) * 2 * BELT_WANDER + (fbm((x + SX * 17) * 0.0012 - 13.3, (z + SZ * 17) * 0.0012 + 55.9) - 0.5) * 500);
  return wV;
}
/** The latitude a spot feels: 0 at an equator .. 1 at a pole (home: 0.55). */
export const latitudeAt = (x, z) => Math.abs(1 - modLand(z - (HOME.z - HOME_SOUTH) + latShift(x, z)) / HALF);
/** The belt of a latitude: 'tropical', 'subtropical', 'temperate', 'subpolar' or 'polar'. */
export const beltOf = (L) => (L < 0.2 ? 'tropical' : L < 0.4 ? 'subtropical' : L < 0.7 ? 'temperate' : L < 0.87 ? 'subpolar' : 'polar');
const COLD_BY_LAT = [[0, -0.6], [0.3, -0.3], [0.55, 0], [0.75, 0.3], [0.9, 0.7], [1, 0.9]];
/** The country's cold by its latitude alone. */
function latCold(L) {
  for (let i = 1; i < COLD_BY_LAT.length; i++) if (L <= COLD_BY_LAT[i][0]) { const a = COLD_BY_LAT[i - 1], b = COLD_BY_LAT[i]; return a[1] + (b[1] - a[1]) * (L - a[0]) / (b[0] - a[0]); }
  return 0.9;
}
const year = { A: 1, m: 0 };
/**
 * A spot's year (core/year.js): `A`, how much the year moves it (nothing in the tropics, in full
 * from the temperate belt on), and `m`, which half-year it keeps (0 as at home .. 1 half a year
 * apart, changing across an equator over a few hundred metres, where `A` is nothing; never at a
 * pole). The same object each call: copy what you keep (`yearOf`).
 */
export function yearAt(x, z) {
  const d = z - (HOME.z - HOME_SOUTH), south = smooth(-300, 300, modLand(d) - HALF), odd = ((Math.floor(d / LAND) % 2) + 2) % 2;
  year.A = smooth(0.2, 0.55, latitudeAt(x, z)); // (in full by home's latitude; little enough in the subtropics that no snow lies there in a mild winter)
  year.m = odd ? 1 - south : south;
  return year;
}
/** A thing's own year, worked out once and kept on it (`it.x`, `it.z`). */
export const yearOf = (it) => it.year || (it.year = Object.assign({}, yearAt(it.x, it.z)));
/** How much the tropics' wet season is on at a spot just now (0 dry .. 1 wet; 0.5 away from the tropics): it rains in that side's summer. */
export function wetSeasonAt(x, z, s) {
  const y = yearAt(x, z), tropic = 1 - smooth(0.05, 0.3, y.A);
  return 0.5 + tropic * (0.5 - (s + y.m * (WINTER_CHILL - 2 * s)) / WINTER_CHILL);
}
/**
 * How cold a spot is in summer ("chill"): about 0 mild, 1 frozen, below 0 in warm country; the
 * country's cold and the height (`h`, the ground's height there). Through the year it rises
 * (core/year.js chillNow).
 */
export function coldAt(x, z, h, base = coldBase(x, z)) {
  return clamp(base + smooth(78, 132, h), -1, 1);
}

// ── Treeline, rock and the way a slope faces ─────────────────
// Air is colder the higher you go, so trees give out at a certain height, then grass, then bare
// rock, then snow. Here they all follow one quantity, the height a spot "feels": its height, raised
// in cold country (the treeline is lower there) and on slopes that face north, away from the sun
// (north is -z: systems/time.js), which are colder and hold their snow longer; slopes facing south
// are warmer. Snow follows the same through coldAt(x, z, h + ASPECT * north).
/** Felt height (m) where trees give out, in mild country on level ground. */
export const TREELINE = 64;
/** How much lower (m) the treeline lies in the coldest country. */
export const TREE_COLD = 25;
/** How much higher (m) a slope facing north feels, per unit of its rise (and lower for one facing south). */
export const ASPECT = 14;
const look = { north: 0, scree: 0 };
/**
 * How the land lies at a spot, measured over fixed distances (so it is the same at every scale the
 * ground is drawn), from one shared set of samples:
 *   north: how much it faces north (+) or south (-): its rise toward +z per metre, over 8 m (0 on
 *     low, mild ground, where it would change nothing);
 *   scree (0..1): loose rock fallen from a cliff, lying at its resting angle (about 33 to 37
 *     degrees) at the cliff's foot: a slope of about 22 to 40 degrees with ground steeper than
 *     about 42 between 9 and 15 m above it.
 * The result is reused: copy what you need before the next call. A caller that already has the
 * slope over about 8 m (`slope`: [rise per metre toward +x, toward +z]) may pass it.
 */
export function slopeLook(x, z, h, base = coldBase(x, z), slope = null) {
  look.north = 0; look.scree = 0;
  const wantNorth = h >= 18 || base >= 0.25, wantScree = h >= 10;
  if (!wantNorth && !wantScree) return look;
  const gx = slope ? slope[0] : (height(x + 4, z) - height(x - 4, z)) / 8, gz = slope ? slope[1] : (height(x, z + 4) - height(x, z - 4)) / 8;
  if (wantNorth) look.north = clamp(gz, -1.2, 1.2);
  if (wantScree) {
    const sl = Math.hypot(gx, gz);
    if (sl >= 0.4 && sl <= 0.85) {
      const ux = gx / sl, uz = gz / sl, cliff = (height(x + ux * 15, z + uz * 15) - height(x + ux * 9, z + uz * 9)) / 6; // (uphill)
      look.scree = smooth(0.4, 0.55, sl) * (1 - smooth(0.72, 0.85, sl)) * smooth(0.9, 1.2, cliff);
    }
  }
  return look;
}
/** How much the land at a spot faces north (+) or south (-): see slopeLook. */
export const northness = (x, z, h, base) => slopeLook(x, z, h, base).north;
/** How much a spot is scree (0..1): see slopeLook. */
export const screeAt = (x, z, h) => slopeLook(x, z, h).scree;
/** The height (m) a spot feels like: see above. `north` from northness(). */
export const feltHeight = (x, z, h, north, base = coldBase(x, z)) => h + TREE_COLD * base + ASPECT * north;
/** How far into the treeline band a spot is: 0 below it, 1 at the line and above (no trees). */
export const aboveTrees = (felt) => smooth(TREELINE - 16, TREELINE, felt);
/** How much rain a spot gets, 0 parched .. 1 soaked (0.5 in between, and in the valley). */
export function rainAt(x, z) {
  const n = fbm((x + SX * 17) * 0.0013 + 19.2, (z + SZ * 17) * 0.0013 - 51.7), L = latitudeAt(x, z);
  // (it leans by latitude: a little wetter at the equator, a little drier in the subtropics, where the deserts are)
  const lean = 0.06 * (1 - smooth(0, 0.2, L)) - 0.07 * smooth(0.15, 0.3, L) * (1 - smooth(0.3, 0.45, L));
  return 0.5 + (n - 0.5 + lean) * mild(x, z);
}
/** From the rain: how parched (0..1) and how lush (0..1) a spot is. */
export const dryOf = (rain) => smooth(0.475, 0.37, rain), lushOf = (rain) => smooth(0.535, 0.65, rain);
/** How much a spot is part of a blossom grove (0..1): rare pockets, a hundred metres or so across. */
export function groveAt(x, z) {
  return smooth(0.675, 0.74, fbm((x + SX * 17) * 0.0042 + 133.1, (z + SZ * 17) * 0.0042 - 87.5)) * mild(x, z);
}
/** How much snow lies at a spot with this much cold (before the ragged edge the ground's shader gives it). */
export const snowOf = (cold) => smooth(0.46, 0.62, cold);

// ── The ground as drawn ────────────────────────────────────────
// The ground is drawn in tiles; where a fine tile is loaded, heights are read from its own
// vertices (with the same triangle split), so feet and paws sit exactly on the surface you see and
// a lookup costs a few multiplies instead of several noise evaluations. Anywhere else the exact
// formula answers, so every question about the land works whether or not that land is on screen.
let sampler = null;
/** The ground hands over its lookup: (x, z) -> height, or NaN where no fine tile is loaded. */
export function setGroundSampler(fn) { sampler = fn; }
/** Height of the ground at a spot. */
export function heightAt(x, z) {
  if (sampler) { const h = sampler(x, z); if (h === h) return h; }
  return height(x, z);
}
/** How steep the ground is at a spot (rise over run: 1 is a 45 degree slope). */
export function slopeAt(x, z) {
  const e = 0.6;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

export let lakePoint = HOME.point;

// ── Places beside a lake ───────────────────────────────────────
export let DOCK_A = Math.PI / 2 + 0.55, CHAIR_A = Math.PI / 2 - 0.95; // (where round the lake the jetty and the lawn chairs are)
export const DOCK_BACK = 1.6, DOCK_LEN = 9, DOCK_HALF = 1.05;
/**
 * Where things stand round a lake: the starting spot on the path, the jetty (where it leaves the
 * shore, which way it runs, how high its deck is), the two lawn chairs, the campfire and the bench.
 * The whole arrangement is turned round the lake by the lake's own `turn` (0 at home), so no two
 * lakes are laid out facing the same way.
 */
export function landmarksOf(lake) {
  const kit = kitOf(lake), turn = lake.turn || 0, dockA = Math.PI / 2 + 0.55 + turn, chairA = Math.PI / 2 - 0.95 + turn;
  const start = kit.dock ? lake.point(dockA, 1.03) : { x: PARK.x, z: PARK.z };
  const away = () => ({ x: PARK.x, z: PARK.z });
  return {
    dockA, chairA, kit,
    spawn: lake.point(Math.PI / 2 + turn, PATH_T + 0.04),
    dockStart: start,
    dockDir: { x: -Math.cos(dockA), z: -Math.sin(dockA) },
    dockY: kit.dock ? Math.max(0.5, height(start.x, start.z) + 0.1) : 0.5,
    chairs: kit.bench ? [lake.point(chairA, 1.17), lake.point(chairA + 0.05, 1.17)] : [away(), away()],
    fire: kit.fire ? lake.point(Math.PI / 2 + 0.34 + turn, 1.68) : away(),
    bench: kit.bench ? lake.point(Math.PI / 2 - 0.5 + turn, 1.5) : away(),
  };
}
/**
 * Where the spots of things a lake does not have are put: far beyond anywhere you will walk. A
 * lake with no jetty has its "jetty spot" out there, so nothing can stand on a jetty that isn't
 * to be seen, sit on its chair or board its boat.
 */
export const PARK = { x: 4.0e5, z: 4.0e5 };
/** Would a jetty at this lake, with the arrangement turned this way, stand in deep water with room for the boat's tour? */
function jettyFits(lake, turn) {
  const a = Math.PI / 2 + 0.55 + turn, s0 = lake.point(a, 1.03), dx = -Math.cos(a), dz = -Math.sin(a);
  if (height(s0.x, s0.z) < 0.25) return false;                                                       // it leaves dry land
  for (const s of [3.5, 6, DOCK_LEN]) if (height(s0.x + dx * s, s0.z + dz * s) > -0.35) return false; // and runs out over water
  const mx = s0.x + dx * (DOCK_LEN + 0.85), mz = s0.z + dz * (DOCK_LEN + 0.85), tm = lake.t(mx, mz);
  if (tm > 0.82 || tm < 0.25) return false;                                                           // the mooring is well inside the lake, not across it
  for (let i = 1; i < 28; i++) { const p = lake.point(a + (i / 28) * TAU, tm); if (height(p.x, p.z) > -0.5) return false; } // and the tour floats all the way round
  return true;
}
/**
 * What is built beside a lake: `{ dock, fire, bench }`. Nothing at a lake that isn't settled; at
 * a settled one, most of them: a jetty with the boat and its skipper if the shore allows (not on
 * a frozen lake), a campfire with its logs, a bench with the lawn chairs and the path lamps. Also
 * settles the lake's `turn`: which way the whole arrangement faces. Worked out when first asked
 * for (it needs the shape of the land), then kept on the lake.
 */
export function kitOf(lake) {
  if (lake.kit) return lake.kit;
  if (lake === HOME) {
    // the home lake has everything; its arrangement faces the first of sixteen ways that gives the jetty deep water
    const first = hash(WORLD.seed * 13 + 5, 77) * TAU;
    lake.turn = first;
    let fits = false;
    for (let k = 0; k < 16 && !fits; k++) { const t = first + (k / 16) * TAU; if (jettyFits(lake, t)) { lake.turn = t; fits = true; } }
    // (none of those: try the ways between them; in the 42 worlds checked this was never needed)
    for (let k = 0; k < 64 && !fits; k++) { const t = first + ((k + 0.5) / 64) * TAU; if (jettyFits(lake, t)) { lake.turn = t; fits = true; } }
    return (lake.kit = { dock: true, fire: true, bench: true });
  }
  if (!lake.settled) return (lake.kit = { dock: false, fire: false, bench: false });
  const R = mulberry32((Math.floor(hash(Math.round(lake.x), Math.round(lake.z)) * 4294967296) ^ 0x3C6EF372) | 0);
  const first = R() * TAU, wantDock = R() < 0.85, wantFire = R() < 0.8, wantBench = R() < 0.72;
  let dock = false;
  lake.turn = first;
  if (wantDock && !lake.frozen) for (let k = 0; k < 10 && !dock; k++) { const t = first + (k / 10) * TAU; if (jettyFits(lake, t)) { lake.turn = t; dock = true; } }
  return (lake.kit = { dock, fire: wantFire || (!dock && !wantBench), bench: wantBench });
}
/** The landmark spots of a lake, wherever the landmarks themselves are just now (worked out once, kept on the lake). */
const marksOf = (lake) => lake.marks || (lake.marks = landmarksOf(lake));
/**
 * Is a spot kept clear for something built? Trees, boulders and small plants keep off the path
 * round a settled lake and out of the way of its jetty, fire, bench, chairs and lamps, and off
 * the shrine's ground. The rule is the lake's own (its spots, not where the single set of
 * landmarks happens to be), so a square of land always grows the same things.
 */
export function clearingAt(x, z, strand = true) {
  if (shrineSiteAt(x, z, SHRINE_R + 7)) return true;
  if (sitesReady && siteAt(x, z, -1)) return true; // (and a building's ground)
  if (sitesReady && trailAt(x, z) > 0.25) return true; // (and the trails)
  if (sitesReady) { const r = riverNear(x, z); if (r && r.d < r.w / 2 + 2.5) return true; } // (and the rivers and their banks)
  if (seaAt(x, z) > 0) { const h = height(x, z); if (h < 1 || (strand && beachAt(x, z, h) > 0.4)) return true; } // (and the sea, and its sand but for the palms: `strand` false)
  const L = lakeAt(x, z);
  if (!L.settled) return false;
  const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz), r = L.r(Math.atan2(dz, dx));
  if (d > r * 2.1) return false;
  if (L.path(x, z) > 0.02 || Math.abs(d - r * (PATH_T + 0.085)) < 1.6) return true; // the path, and the lamps along it
  const m = marksOf(L), near = (p, reach) => (x - p.x) ** 2 + (z - p.z) ** 2 < reach * reach;
  return near(m.spawn, 8) || near(m.fire, 5.5) || near(m.bench, 4) || near(m.chairs[0], 3.5) || near(m.chairs[1], 3.5) || near(m.dockStart, 5.5);
}
// ── Shrines ────────────────────────────────────────────────────
// Where a shrine may stand is fixed by the land, so by the seed: one site a little way back from
// the home lake, and others out in the world, in blossom groves. The land is ruled into squares of
// SHRINE_CELL metres and a square has a site if a grove with level, low, snowless ground lies in
// its middle half, clear of every lake. The ground under a site is levelled (see height()), and
// trees, boulders and small plants keep off it (clearingAt). There is one shrine; it stands at
// the site nearest you (world/shrine.js moves it while it is out of sight).
/**
 * How sites are chosen, in metres: the squares' side; how far out the levelled ground is flat and
 * where it has eased back into the land; the ring the shrine and its path lie within; how many
 * spots a square tries; how much of a grove a spot must be; how far the ground may rise or fall
 * round it; and how far a site keeps from the home lake's own.
 */
const SHRINE_CELL = 640, PAD_FLAT = 25, PAD_OUT = 46, SHRINE_R = 17, SHRINE_TRIES = 14, SHRINE_GROVE = 0.6, SHRINE_RELIEF = 5, SHRINE_APART = 320;
const shrineCells = new Map();
const SHRINE_NAMES = ['Petalfall', 'Mistbloom', 'Quietbough', 'Rosecloud', 'Lanternhill', 'Softrain', 'Paleblossom', 'Windchime', 'Moonpetal', 'Hollowcherry', 'Dawnbloom', 'Silkpetal', 'Stillbranch', 'Cloudcherry', 'Duskpetal', 'Fernbloom'];
let homeShrine = null, lastShrine = null, lastSX = NaN, lastSZ = NaN;
/** How much the land rises or falls round a spot (the worst of twelve looks, 18 and 34 m out). */
function reliefAt(x, z, h) {
  let worst = 0;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, d = k % 2 ? 34 : 18; worst = Math.max(worst, Math.abs(rawHeight(x + Math.cos(a) * d, z + Math.sin(a) * d) - h)); }
  return worst;
}
/** Would levelled ground round this spot keep off every lake's own shaped ground (its bowl, shore and path)? */
function clearOfLakes(x, z) {
  const lakes = lakesNear(x, z, 220);
  for (const L of lakes) {
    if (L.t(x, z) < L.bowl + 0.2) return false;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; if (L.t(x + Math.cos(a) * (PAD_OUT + 2), z + Math.sin(a) * (PAD_OUT + 2)) < L.bowl + 0.2) return false; }
  }
  return true;
}
/**
 * The site by the home lake: the most level place back from it, looking toward the water. Near
 * the lake where the country is gentle; where the home lake lies among steep hills, as far off
 * as it takes to find level ground (a few hundred metres at most). `{ id, x, z, y, fx, fz, r }`: its name, its middle, the height its ground is levelled
 * to, the way it faces, and the radius of the ring it lies within.
 */
export function homeShrineSite() {
  if (homeShrine) return homeShrine;
  const L = HOME;
  let best = null;
  for (let a = 0; a < TAU; a += TAU / 60) {
    for (let r = L.rmax * 2.4; r <= L.rmax * 12; r += 7) {
      const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r, h = rawHeight(x, z);
      if (h < 0.8 || h > 70 || snowOf(snowCold(coldAt(x, z, h), moistAt(x, z))) > 0.15 || !clearOfLakes(x, z)) continue;
      const score = reliefAt(x, z, h) + (r / L.rmax) * 0.45; // (level first; of two as level, the nearer)
      if (!best || score < best.score) best = { x, z, score };
    }
  }
  if (!best) best = { x: L.x - L.rmax * 3.4, z: L.z };
  const d = Math.hypot(L.x - best.x, L.z - best.z);
  return (homeShrine = { id: 'home', name: HOME.name + ' Shrine', x: best.x, z: best.z, y: rawHeight(best.x, best.z), fx: (L.x - best.x) / d, fz: (L.z - best.z) / d, r: SHRINE_R });
}
/** The shrine site of one square of the land, or null: most squares have none. Worked out once, then kept. */
function shrineOfCell(cx, cz) {
  const key = cx + ':' + cz;
  if (shrineCells.has(key)) return shrineCells.get(key);
  const R = mulberry32((Math.floor(hash(cx * 5 + 17, cz * 11 - 3) * 4294967296) ^ Math.imul(WORLD.seed, 0x85EBCA6B) ^ 0x51A7E) | 0), home = homeShrineSite();
  let best = null;
  for (let k = 0; k < SHRINE_TRIES; k++) {
    // (in the square's middle half, so two sites are never close and levelled ground never crosses into the next square)
    const x = (cx + 0.25 + R() * 0.5) * SHRINE_CELL, z = (cz + 0.25 + R() * 0.5) * SHRINE_CELL;
    if (groveAt(x, z) < SHRINE_GROVE) continue;
    const h = rawHeight(x, z);
    if (h < 1 || h > 48 || snowOf(snowCold(coldAt(x, z, h), moistAt(x, z))) > 0.15 || Math.hypot(x - home.x, z - home.z) < SHRINE_APART || !clearOfLakes(x, z)) continue;
    const relief = reliefAt(x, z, h);
    if (relief < SHRINE_RELIEF && (!best || relief < best.relief)) best = { x, z, h, relief };
  }
  let site = null;
  if (best) {
    // it looks down the gentlest way out: its path climbs to it from the lowest ground about
    let low = Infinity, fx = 0, fz = 1;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, y = rawHeight(best.x + Math.cos(a) * 34, best.z + Math.sin(a) * 34); if (y < low) { low = y; fx = Math.cos(a); fz = Math.sin(a); } }
    site = { id: key, name: SHRINE_NAMES[Math.floor(hash(cx * 3 - 41, cz * 7 + 19) * SHRINE_NAMES.length) % SHRINE_NAMES.length] + ' Shrine', x: best.x, z: best.z, y: best.h, fx, fz, r: SHRINE_R };
  }
  shrineCells.set(key, site);
  return site;
}
/** The shrine site whose middle is within `reach` metres of a spot (at most PAD_OUT), or null. */
export function shrineSiteAt(x, z, reach = PAD_OUT) {
  const h = homeShrineSite();
  if ((x - h.x) ** 2 + (z - h.z) ** 2 < reach * reach) return h;
  const cx = Math.floor(x / SHRINE_CELL), cz = Math.floor(z / SHRINE_CELL);
  if (cx !== lastSX || cz !== lastSZ) { lastSX = cx; lastSZ = cz; lastShrine = shrineOfCell(cx, cz); }
  const s = lastShrine;
  return s && (x - s.x) ** 2 + (z - s.z) ** 2 < reach * reach ? s : null;
}
/** Every shrine site within `r` metres of a spot, nearest first. */
export function shrineSitesNear(x, z, r) {
  const out = [], h = homeShrineSite(), near = (s) => Math.hypot(s.x - x, s.z - z);
  if (near(h) < r) out.push(h);
  for (let cz = Math.floor((z - r) / SHRINE_CELL); cz <= Math.floor((z + r) / SHRINE_CELL); cz++) for (let cx = Math.floor((x - r) / SHRINE_CELL); cx <= Math.floor((x + r) / SHRINE_CELL); cx++) { const s = shrineOfCell(cx, cz); if (s && near(s) < r) out.push(s); }
  return out.sort((a, b) => near(a) - near(b));
}
// ── Biomes ─────────────────────────────────────────────────────
// (core/biome.js explains them; their weights live here so the land's height can use them for the
// buildings' levelled ground without the two modules needing each other.)
let BSX = null, BSZ = 0;
const awayFromHome = (x, z) => smooth(450, 900, Math.hypot(x - HOME.x, z - HOME.z));
/** The wonder field: rare pockets (0..1), a few hundred metres across, of two kinds (a and b) that never meet. */
export function wonderAt(x, z) {
  if (BSX === null) { BSX = hash(WORLD.seed, 101) * 7000; BSZ = hash(WORLD.seed, 103) * 7000; }
  const n = fbm((x + BSX) * 0.0011 + 5.3, (z + BSZ) * 0.0011 - 8.1), k = fbm((x - BSZ) * 0.0004 - 2.2, (z + BSX) * 0.0004 + 6.6);
  const w = smooth(0.66, 0.74, n) * awayFromHome(x, z);
  return { a: w * smooth(0.45, 0.55, k), b: w * (1 - smooth(0.45, 0.55, k)) };
}
/** The plains (0..1): broad, low, mild country, neither wet nor dry, out of the hills; the land there lies flatter (land()). */
export function plainsAt(x, z, base = coldBase(x, z), rain = rainAt(x, z)) {
  if (BSX === null) wonderAt(0, 0);
  const f = smooth(0.5, 0.58, fbm((x + BSZ) * 0.0007 + 2.2, (z - BSX) * 0.0007 - 9.4)) * awayFromHome(x, z);
  return f > 0 ? f * (1 - smooth(0.06, 0.18, rangeAt(x, z))) * (1 - smooth(0.12, 0.25, Math.abs(base))) * (1 - smooth(0.08, 0.14, Math.abs(rain - 0.5))) : 0;
}
/** A beach (0..1): low ground by the sea. */
export function beachAt(x, z, h) {
  const sea = seaAt(x, z);
  return sea > 0 ? smooth(0.005, 0.04, sea) * smooth(3.4, 1.6, h) : 0;
}
/** The biomes' weights at a spot (0..1 each): desert, swamp, enchanted, volcanic. `base` and `rain` may be passed when known. */
export function biomesAt(x, z, h, base = coldBase(x, z), rain = rainAt(x, z)) {
  const away = awayFromHome(x, z), wonder = wonderAt(x, z), range = rangeAt(x, z);
  return {
    desert: smooth(-0.18, -0.36, base) * smooth(0.45, 0.37, rain) * away,
    swamp: smooth(0.6, 0.68, rain) * (1 - smooth(8, 22, h)) * (1 - range) * (1 - smooth(0.2, 0.4, base)) * away,
    enchanted: wonder.a * smooth(0.5, 0.58, rain) * (1 - smooth(0.3, 0.5, base)),
    volcanic: wonder.b * smooth(0.2, 0.5, range),
    // open grassland with lone trees: flat, mild, neither wet nor dry, in broad stretches
    plains: plainsAt(x, z, base, rain),
    // sand where the land meets the sea
    beach: beachAt(x, z, h),
  };
}
/** The strongest biome at a spot and its weight, or null in ordinary country. */
export function biomeAt(x, z, h, min = 0.5) {
  const w = biomesAt(x, z, h);
  let best = null, bw = min;
  for (const k in w) if (w[k] > bw) { bw = w[k]; best = k; }
  return best ? { id: best, w: bw } : null;
}

// ── Buildings' sites ───────────────────────────────────────────
// Where the biomes' buildings stand (world/landmarks.js builds and sets them down): fixed by the
// land, so by the seed, each kind by its own rule, one or none to a square of its own size, in the
// square's middle half (so two are never close), on ground levelled for it (see height()), clear
// of every lake, of the shrines and of the start. `flat`/`out`: the levelled ground's radii.
/** The side (m) of the square a waystone has to itself (the map looks them up square by square). */
export const WAYSTONE_CELL = 1500;
const SITE_KINDS = {
  // a pagoda in a blossom grove
  pagoda: { cell: 700, flat: 10, out: 18, salt: 0x9A60D, tries: 10, chance: 0.6, rule: (x, z, h) => groveAt(x, z) > 0.6 && h > 1 && h < 45 },
  // a castle on a hilltop in mild, open country
  castle: { cell: 1500, flat: 20, out: 34, relief: 10, salt: 0x2C451E, tries: 16, chance: 0.6, rule: (x, z, h) => Math.abs(coldBase(x, z)) < 0.2 && rangeAt(x, z) < 0.15 && h > 8 && h < 60 && hilltop(x, z, h) > 5 },
  // ruins: in the plains, and sandstone ones in the desert
  ruin: { cell: 900, flat: 7, out: 12, salt: 0x5017, tries: 10, chance: 0.35, rule: (x, z, h) => h > 1 && h < 50 && (biomesAt(x, z, h).desert > 0.5 || (rangeAt(x, z) < 0.2 && Math.abs(coldBase(x, z)) < 0.25)) },
  // a hut on stilts in the swamp (no levelled ground: it stands over the water)
  hut: { cell: 420, flat: 0, out: 0, salt: 0x4D7, tries: 12, rule: (x, z, h) => h < 4 && biomesAt(x, z, h).swamp > 0.5 },
  // a windmill on an open, windy rise
  windmill: { cell: 980, flat: 6, out: 12, salt: 0x3111, tries: 12, chance: 0.7, rule: (x, z, h) => h > 14 && h < 140 && rangeAt(x, z) < 0.5 && Math.abs(coldBase(x, z)) < 0.3 && (hilltop(x, z, h) > 3 || cliffsAt(x, z) > 0.5) },
  // places to find: a ring of standing stones on a hilltop; a cairn on a summit; a hot spring in the snow
  circle: { cell: 1250, flat: 9, out: 15, salt: 0x51C1E, tries: 14, chance: 0.75, rule: (x, z, h) => h > 10 && h < 90 && hilltop(x, z, h) > 7 },
  cairn: { cell: 1100, flat: 3, out: 6, relief: 60, salt: 0xCA12, tries: 20, chance: 0.4, rule: (x, z, h) => h > 90 && hilltop(x, z, h) > 22 },
  spring: { cell: 900, flat: 4, out: 8, salt: 0x5B21, tries: 14, chance: 0.4, rule: (x, z, h) => h > 2 && h < 90 && snowOf(coldAt(x, z, h)) > 0.5 },
  // an ice castle on a snowy height
  icecastle: { cell: 1700, flat: 20, out: 34, relief: 20, salt: 0x1CE, tries: 24, chance: 0.8, rule: (x, z, h) => h > 6 && h < 170 && snowOf(coldAt(x, z, h)) > 0.55 && hilltop(x, z, h) > 2 },
  // a crystal grotto: a basin sunk into the ground and ringed with great glowing crystals (in a wonder)
  grotto: { cell: 1300, flat: 11, out: 24, sink: 6, salt: 0x6207, tries: 12, rule: (x, z, h) => h > 3 && h < 80 && wonderAt(x, z).a > 0.35 },
  // the heart of a blossom grove (see "The heart of a grove" below): a terrace raised over the grove, a cliff on its
  // downhill side with a waterfall off it, pagodas on top (no levelled ground: its terrace, see height())
  heart: { cell: 1100, flat: 0, out: 0, mesa: true, salt: 0x4EA27, tries: 16, chance: 0.8, rule: (x, z, h) => heartFits(x, z, h) },
  // a volcano: a great cone with a crater, raised in a wonder in the mountains (no levelled ground: its cone, see height())
  volcano: { cell: 2200, flat: 0, out: 0, cone: 430, salt: 0xB01C, tries: 10, rule: (x, z, h) => wonderAt(x, z).b > 0.55 && rangeAt(x, z) > 0.2 },
  // floating islands over a wonder in the hills, an updraft below to ride up
  // by the sea: a hut on stilts on the beach, and ships riding at anchor offshore (on the water, no levelled ground)
  beachhut: { cell: 700, flat: 5, out: 9, salt: 0xBEAC4, tries: 14, chance: 0.6, rule: (x, z, h) => h > 1.2 && h < 4.5 && seaAt(x, z) > 0.03 && snowOf(coldAt(x, z, h)) < 0.3 },
  ship: { cell: 1500, flat: 0, out: 0, ship: true, salt: 0x5419, tries: 12, chance: 0.7, rule: (x, z, h) => h < -6 && seaAt(x, z) > 0.5 },
  // a waystone (features/waypoints.js): a standing stone to travel to, one to a square in every kind of country (on a
  // continent's own land: nothing sails to the islands yet), on
  // fairly level dry ground clear of water, rivers and the other buildings (no levelled ground: it changes nothing of the land)
  waystone: { cell: WAYSTONE_CELL, flat: 0, out: 0, salt: 0x3A75, tries: 48, rule: (x, z, h) => h > 1.5 && h < 220 && seaAt(x, z) < 0.02 && onContinent(x, z) && reliefAt(x, z, h) < 5 && !otherSiteNear(x, z, 70) && !riverHere(x, z) },
  skyisle: { cell: 1900, flat: 6, out: 11, salt: 0x5C15, tries: 12, rule: (x, z, h) => h > 4 && h < 90 && wonderAt(x, z).a > 0.3 && rangeAt(x, z) < 0.45 },
};
/** The volcano's cone: how much it raises the land (m) at a distance `r` from its middle; a crater at the top. */
export const VOLCANO = { height: 160, radius: 430, crater: 58, deep: 46 };
const coneRise = (r) => (r >= VOLCANO.radius ? 0 : VOLCANO.height * (1 - r / VOLCANO.radius) ** 1.6 - (r < VOLCANO.crater ? VOLCANO.deep * (1 - (r / VOLCANO.crater) ** 2) : 0));
// ── The heart of a grove ───────────────────────────────────────
// (docs/endless-world.md, "The cherry blossom valley".) A blossom grove's heart is a terrace: the land
// within a rim (about 50 m out, wavering) is raised to one level, `T`. On the side facing downhill the
// rim is a cliff (the level falls away over 4.5 m); round the back it eases down over 75 m, the way up.
// A stream runs across the top to the cliff, pours off it into a pool at its foot (a river laid by
// hand: heartRiver), and pagodas stand on the top (world/landmarks.js). Like the volcano's cone it is
// added to the land after the sites are chosen from the land beneath (`rawHeight`), and everything
// else keeps off it. `th`: the way the cliff faces; `R`: the rim; `T`: the top's level.
export const HEART = { reach: 150, rise: 24 };
/** Is this a place for a heart: deep in a grove, mild, dry, gently rolling, clear of every lake and the sea out to its foot? */
function heartFits(x, z, h) {
  if (groveAt(x, z) < 0.7 || h < 4 || h > 70 || rangeAt(x, z) > 0.3 || seaAt(x, z) > 0 || snowOf(coldAt(x, z, h)) > 0.25) return false;
  if (lakesNear(x, z, HEART.reach + 70).length) return false;
  for (let k = 0; k < 16; k++) {
    const a = (k / 8) * TAU, d = k < 8 ? 60 : 135, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (seaAt(px, pz) > 0 || Math.abs(rawHeight(px, pz) - h) > (k < 8 ? 14 : 26)) return false;
  }
  return true;
}
/** A heart's shape, from the land beneath it: which way its cliff faces (downhill), its rim, its top's level. */
function heartShape(s) {
  const gx = rawHeight(s.x + 50, s.z) - rawHeight(s.x - 50, s.z), gz = rawHeight(s.x, s.z + 50) - rawHeight(s.x, s.z - 50);
  const th = Math.hypot(gx, gz) > 0.5 ? Math.atan2(-gz, -gx) : (s.variant / 1000) * TAU, R = 44 + 14 * hash(s.variant, 71);
  let top = rawHeight(s.x, s.z) + 9;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; top = Math.max(top, rawHeight(s.x + Math.cos(a) * R * 0.7, s.z + Math.sin(a) * R * 0.7) + 2); }
  const T = Math.max(top, rawHeight(s.x + Math.cos(th) * (R + 10), s.z + Math.sin(th) * (R + 10)) + HEART.rise);
  return { th, R, T, p1: hash(s.variant, 73) * TAU, p2: hash(s.variant, 79) * TAU, side: hash(s.variant, 83) < 0.5 ? -1 : 1 };
}
const rimOf = (s, phi) => s.R * (1 + 0.13 * Math.sin(3 * phi + s.p1) + 0.07 * Math.sin(5 * phi + s.p2));
/** The land at a spot within a heart's reach, raised toward its top's level (never lowered). */
function heartRise(s, x, z, h) {
  if (h >= s.T) return h;
  const dx = x - s.x, dz = z - s.z;
  let phi = Math.atan2(dz, dx) - s.th; phi = Math.atan2(Math.sin(phi), Math.cos(phi));
  const Rr = rimOf(s, phi), f = smooth(1.9, 1.15, Math.abs(phi)), k = 1 - smooth(Rr, Rr + 75 - 70.5 * f, Math.hypot(dx, dz)); // (a cliff in front, a long slope behind)
  return k > 0 ? h + k * (s.T - h) : h;
}
let lastHeart = null;
/** The heart whose terrace reaches a spot (or comes within `pad` metres of it), or null. */
export function heartAt(x, z, pad = 0) {
  const K = SITE_KINDS.heart, cx = Math.floor(x / K.cell), cz = Math.floor(z / K.cell);
  if (!lastHeart || lastHeart.cx !== cx || lastHeart.cz !== cz) lastHeart = { cx, cz, s: siteOfCell('heart', cx, cz) };
  const s = lastHeart.s, far = HEART.reach + pad;
  return s && (x - s.x) ** 2 + (z - s.z) ** 2 < far * far ? s : null;
}
/** Is a heart's terrace within `pad` metres of a spot? (Looks in the squares about, for a wide `pad`.) */
function heartNear(x, z, pad) {
  if (pad <= 110) return !!heartAt(x, z, pad);
  const K = SITE_KINDS.heart, far = HEART.reach + pad;
  for (let cz = Math.floor((z - far) / K.cell); cz <= Math.floor((z + far) / K.cell); cz++) for (let cx = Math.floor((x - far) / K.cell); cx <= Math.floor((x + far) / K.cell); cx++) { const s = siteOfCell('heart', cx, cz); if (s && Math.hypot(s.x - x, s.z - z) < far) return true; }
  return false;
}
let lastVolcano = null;
/** The volcano whose cone reaches a spot, or null. */
function volcanoAt(x, z) {
  const K = SITE_KINDS.volcano, cx = Math.floor(x / K.cell), cz = Math.floor(z / K.cell);
  if (!lastVolcano || lastVolcano.cx !== cx || lastVolcano.cz !== cz) lastVolcano = { cx, cz, s: siteOfCell('volcano', cx, cz) };
  const s = lastVolcano.s;
  return s && (x - s.x) ** 2 + (z - s.z) ** 2 < VOLCANO.radius * VOLCANO.radius ? s : null;
}
/** How much higher a spot is than the ground about it (m, the mean of eight looks 70 m out). */
function hilltop(x, z, h) {
  let s = 0;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; s += rawHeight(x + Math.cos(a) * 70, z + Math.sin(a) * 70); }
  return h - s / 8;
}
const siteCells = new Map(), lastSite = {};
/** Is a river within reach of its banks at a spot? (riverNear's shared result is left as it was: a site's rule may run in the middle of someone else's look at a river.) */
function riverHere(x, z) { const keep = Object.assign({}, near), hit = !!riverNear(x, z); Object.assign(near, keep); return hit; }
/** Is a building of another kind (not a waystone) within `r` metres? */
function otherSiteNear(x, z, r) {
  for (const k in SITE_KINDS) {
    if (k === 'waystone') continue;
    const K = SITE_KINDS[k], far = r + (k === 'volcano' ? VOLCANO.radius : k === 'heart' ? 90 : K.out);
    for (let cz = Math.floor((z - far) / K.cell); cz <= Math.floor((z + far) / K.cell); cz++) for (let cx = Math.floor((x - far) / K.cell); cx <= Math.floor((x + far) / K.cell); cx++) { const s = siteOfCell(k, cx, cz); if (s && Math.hypot(s.x - x, s.z - z) < far) return true; }
  }
  return false;
}
function siteOfCell(kind, cx, cz) {
  const key = kind + ':' + cx + ':' + cz;
  if (siteCells.has(key)) return siteCells.get(key);
  const K = SITE_KINDS[kind], R = mulberry32((Math.floor(hash(cx * 13 + 7, cz * 5 - 11) * 4294967296) ^ Math.imul(WORLD.seed, 0x27D4EB2F) ^ K.salt) | 0);
  let site = null;
  const chance = R(), home = homeShrineSite();
  if (chance < (K.chance === undefined ? 1 : K.chance)) {
    let best = null;
    for (let k = 0; k < K.tries; k++) {
      const x = (cx + 0.25 + R() * 0.5) * K.cell, z = (cz + 0.25 + R() * 0.5) * K.cell, turn = R(), variant = R();
      if (Math.hypot(x - HOME.x, z - HOME.z) < 600 || Math.hypot(x - home.x, z - home.z) < 120) continue;
      if (kind !== 'heart' && heartNear(x, z, (K.cone || K.out || 0) + 14)) continue; // (nothing else on a heart's terrace: its own pagodas stand there. A heart asks after no other kind, so the two never chase each other.)
      const h = rawHeight(x, z);
      if (!K.ship && h < 1 && seaAt(x, z) > 0) continue; // (nothing but ships out at sea)
      if (K.sink && h - K.sink < 1.5) continue; // (a sunk basin stays above the water)
      if (!K.rule(x, z, h)) continue;
      if (K.flat > 0 && !clearOfLakes(x, z)) continue;
      if (K.flat === 0 && lakeAt(x, z).t(x, z) < (K.cone ? 12 : 2.2)) continue;
      const relief = K.flat > 0 ? reliefAt(x, z, h) : 0;
      if (relief > (K.relief || 6)) continue; // (how far the ground about may rise or fall: a summit's cairn allows a steep one)
      const near = shrineSitesNear(x, z, K.mesa ? HEART.reach + 50 : 80);
      if (near.length) continue;
      if (!best || relief < best.relief) best = { x, z, h, relief, turn, variant };
    }
    if (best) site = { id: key, kind, x: best.x, z: best.z, y: K.ship ? 0 : best.h - (K.sink || 0), turn: best.turn * TAU, variant: Math.floor(best.variant * 1000), flat: K.flat, out: K.out };
    if (site && K.mesa) { Object.assign(site, heartShape(site)); site.y = site.T; site.turn = Math.atan2(Math.cos(site.th), Math.sin(site.th)); } // (it stands at its top's level, its own front toward the cliff)
  }
  siteCells.set(key, site);
  return site;
}
/** The building site whose levelled ground reaches a spot (within its `out`, or `reach` if given), or null. */
export function siteAt(x, z, reach) {
  for (const kind in SITE_KINDS) {
    const K = SITE_KINDS[kind];
    if (reach === undefined && !K.out) continue; // (no levelled ground: nothing to reach; and a river being traced never asks after a waystone, whose place depends on the rivers)
    const cx = Math.floor(x / K.cell), cz = Math.floor(z / K.cell), m = lastSite[kind];
    let s;
    if (m && m.cx === cx && m.cz === cz) s = m.s; else { s = siteOfCell(kind, cx, cz); lastSite[kind] = { cx, cz, s }; }
    if (!s) continue;
    const r = reach === undefined ? s.out : reach < 0 ? Math.max(s.flat, 8) + 4 : reach; // (reach < 0: the ground kept clear round it)
    if (r > 0 && (x - s.x) ** 2 + (z - s.z) ** 2 < r * r) return s;
  }
  return null;
}
/** Every building site of a kind (or all kinds) within `r` metres of a spot, nearest first. */
export function sitesNear(x, z, r, kind) {
  const out = [], dist = (s) => Math.hypot(s.x - x, s.z - z);
  for (const k in SITE_KINDS) {
    if (kind && k !== kind) continue;
    const K = SITE_KINDS[k];
    for (let cz = Math.floor((z - r) / K.cell); cz <= Math.floor((z + r) / K.cell); cz++) for (let cx = Math.floor((x - r) / K.cell); cx <= Math.floor((x + r) / K.cell); cx++) { const s = siteOfCell(k, cx, cz); if (s && dist(s) < r) out.push(s); }
  }
  return out.sort((a, b) => dist(a) - dist(b));
}
const HOME_PLACES = landmarksOf(HOME);
DOCK_A = HOME_PLACES.dockA; CHAIR_A = HOME_PLACES.chairA;
export const SPAWN = HOME_PLACES.spawn;

// ── Jetty ──────────────────────────────────────────────────────
export const dockStart = HOME_PLACES.dockStart;
export const dockDir = HOME_PLACES.dockDir;
export let DOCK_Y = HOME_PLACES.dockY;
export function onDock(x, z) {
  const rx = x - dockStart.x, rz = z - dockStart.z;
  const s = rx * dockDir.x + rz * dockDir.z;
  const w = rx * dockDir.z - rz * dockDir.x;
  return s > -DOCK_BACK && s < DOCK_LEN && Math.abs(w) < DOCK_HALF;
}
/** A point on the jetty: `s` metres out along it, `w` metres to the side. */
export const dockAt = (s, w) => ({ x: dockStart.x + dockDir.x * s + dockDir.z * w, z: dockStart.z + dockDir.z * s - dockDir.x * w });

// ── Walking ────────────────────────────────────────────────────
/** True when the lake is frozen solid enough to walk on, and (x, z) is over it. */
/** A lake's chill (its place's cold in summer, at the water), kept on the lake. */
export const lakeChill = (L) => (L.chill !== undefined ? L.chill : (L.chill = coldAt(L.x, L.z, 1)));
/**
 * How frozen a lake is just now (0 open water .. 1 ice you can walk on): each by its own place and
 * the season a few weeks back; a lake of the snowfields is frozen all year. The home lake's ice is
 * kept by features/seasons.js (it waits for the boat to be moored).
 */
export function lakeIce(L) {
  if (L === HOME) return seasonState.ice;
  return L.frozen ? 1 : iceFrom(lakeChill(L), seasonState.lagged || 0, yearOf(L));
}
export const onIce = (x, z) => { const lake = lakeAt(x, z); return lakeIce(lake) > 0.85 && lake.t(x, z) < 1.0 && heightAt(x, z) < 0.3; }; // 
export const ICE_Y = 0.09;
/** A river's chill (its middle's cold in summer, at the lakes' height, as the lakes' is taken), kept on the river. */
export const riverChill = (r) => (r.chill !== undefined ? r.chill : (r.chill = coldAt(r.x[r.n >> 1], r.z[r.n >> 1], 1)));
/** How frozen a river is just now (0 running .. 1 ice you can walk on), as its lakes freeze. */
export const riverIce = (r) => iceFrom(riverChill(r), seasonState.lagged || 0, r.year || (r.year = Object.assign({}, yearAt(r.x[r.n >> 1], r.z[r.n >> 1]))));
/** The ice's top where (x, z) is on a frozen river, or null. */
function riverIceAt(x, z) {
  const r = riverNear(x, z);
  if (!r) return null;
  const b = bridgeAt(x, z, r.river);
  if (b !== null) return b; // (on a bridge)
  return r.d < r.w / 2 + 0.3 && riverIce(r.river) > 0.85 ? r.lv : null;
}
/** Over water you can walk on: a bridge's deck, a stepping stone, or a frozen river's ice (its height), or null. */
export function crossingAt(x, z) {
  const st = stonesAt(x, z);
  return st !== null ? st : riverIceAt(x, z);
}
export const groundAt = (x, z) => { if (onDock(x, z)) return Math.max(DOCK_Y + 0.05, heightAt(x, z)); const ri = crossingAt(x, z); if (ri !== null) return Math.max(heightAt(x, z), ri); return onIce(x, z) ? Math.max(heightAt(x, z), ICE_Y) : heightAt(x, z); }; // (a stone or a bridge stands above the ice)
export const MAX_SLOPE = 1.25;    // steeper than this (about 51 degrees) is a cliff, not a hillside
/** Anywhere that is dry land and not too steep to climb (or the jetty, or solid ice). */
export function walkable(x, z) {
  if (onDock(x, z) || onIce(x, z) || stonesAt(x, z) !== null) return true;
  return heightAt(x, z) > 0.22 && slopeAt(x, z) < MAX_SLOPE;
}
export const animalWalkable = (x, z) => onDock(x, z) || (walkable(x, z) && !onIce(x, z) && heightAt(x, z) > 0.35);

/**
 * Somewhere to stand, for someone who is where they can't: out over water (the ice just thawed),
 * the nearest shore going outward from the lake's centre; up on a cliff, the nearest gentler ground.
 */
export function nearestShore(x, z) {
  const lake = lakeAt(x, z);
  if (lake.t(x, z) < 1.4) {
    const a = Math.atan2(z - lake.z, x - lake.x);
    for (let t = Math.max(lake.t(x, z), 0.5); t < 1.8; t += 0.02) {
      const p = lake.point(a, t);
      if (walkable(p.x, p.z) && !onIce(p.x, p.z)) return p;
    }
    return lake.point(a, 1.3);
  }
  for (let r = 1.5; r < 60; r += 1.5) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (walkable(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/** The walkable ground nearest a spot, out to about a kilometre (a ship's place, say, is out at sea). */
export function landNear(x, z) {
  if (walkable(x, z)) return { x, z };
  for (let r = 4; r < 1200; r += r < 60 ? 4 : 12) for (let k = 0; k < 32; k++) {
    const a = (k / 32) * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (walkable(px, pz) && !onIce(px, pz)) return { x: px, z: pz };
  }
  return { x, z };
}
/** First point straight ahead (dir = {x, z}) that is open water, trying several distances. */
export function waterAhead(from, dir, dists = [4.5, 3.5, 6, 7.5, 2.5]) {
  for (const d of dists) {
    const x = from.x + dir.x * d, z = from.z + dir.z * d;
    if (lakeT(x, z) < 0.97 && heightAt(x, z) < -0.05 && !onDock(x, z)) return { x, z };
  }
  return null;
}

// ── Reserved spots: lawn chairs and the campfire ───────────────
export const chairSpots = HOME_PLACES.chairs;
export const FIRE_SPOT = HOME_PLACES.fire;
export const BENCH_SPOT = HOME_PLACES.bench;

// ── Moving the landmarks to another lake ───────────────────────
/** The lake the jetty, the fire and the bench stand at just now, and which of them it has. */
export let ANCHOR = HOME;
export const KIT = { dock: true, fire: true, bench: true };
/**
 * Point the single-lake names at another lake: LAKE, lakeR and lakePoint become that lake, and
 * the landmark spots (SPAWN, dockStart, dockDir, DOCK_Y, chairSpots, FIRE_SPOT, BENCH_SPOT) are
 * worked out afresh round it. The spots are the same objects as before with new numbers in them,
 * so whoever holds one sees it move. This moves only the *places*: the things standing on them
 * are moved by whoever built them, through hooks.anchor (see core/state.js).
 */
export function anchorTo(lake) {
  const m = landmarksOf(lake);
  ANCHOR = LAKE = lake; lakeR = lake.r; lakePoint = lake.point;
  Object.assign(KIT, m.kit);
  DOCK_A = m.dockA; CHAIR_A = m.chairA; DOCK_Y = m.dockY;
  Object.assign(SPAWN, m.spawn); Object.assign(dockStart, m.dockStart); Object.assign(dockDir, m.dockDir);
  Object.assign(FIRE_SPOT, m.fire); Object.assign(BENCH_SPOT, m.bench);
  chairSpots.forEach((c, i) => Object.assign(c, m.chairs[i]));
}
export const nearReserved = (x, z, r) => chairSpots.some((c) => Math.hypot(x - c.x, z - c.z) < r) || Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < r + 1.6;
// ── Trails ─────────────────────────────────────────────────────
// Worn paths between places, as walkers would wear them: each place (the home lake, the shrines,
// the buildings) is joined to its nearest neighbour within TRAIL_REACH. A trail wanders a little
// either side of the straight line (by a slow sine, fixed by its two ends), and keeps off lakes.
// Worked out per square of TRAIL_CELL metres (the trails that pass near it), and kept.
const TRAIL_CELL = 800, TRAIL_REACH = 1400, TRAIL_W = 2.2;
const TRAIL_KINDS = new Set(['heart', 'beachhut', 'pagoda', 'castle', 'ruin', 'hut', 'windmill', 'circle', 'cairn', 'spring', 'icecastle', 'grotto', 'skyisle']);
const trailCells = new Map();
function placesAbout(x, z, r) {
  const out = [];
  if (Math.hypot(HOME.x - x, HOME.z - z) < r) { const d = Math.max(1, Math.hypot(SPAWN.x - HOME.x, SPAWN.z - HOME.z)); out.push({ id: 'home', name: HOME.name, x: SPAWN.x + (SPAWN.x - HOME.x) / d * 6, z: SPAWN.z + (SPAWN.z - HOME.z) / d * 6 }); }
  for (const s of shrineSitesNear(x, z, r)) out.push({ id: 'shrine:' + s.id, name: s.name, x: s.x + s.fx * 24, z: s.z + s.fz * 24 });
  for (const s of sitesNear(x, z, r)) if (TRAIL_KINDS.has(s.kind)) out.push({ id: s.id, kind: s.kind, variant: s.variant, x: s.x, z: s.z, out: s.out || 10 });
  return out;
}
/** The trails that pass near a square: [{ a, b, len, ux, uz, phase }]. */
function trailsOfCell(cx, cz) {
  const key = cx + ':' + cz;
  if (trailCells.has(key)) return trailCells.get(key);
  const mx = (cx + 0.5) * TRAIL_CELL, mz = (cz + 0.5) * TRAIL_CELL;
  const ps = placesAbout(mx, mz, TRAIL_REACH + TRAIL_CELL), segs = [], seen = new Set();
  for (const p of ps) {
    let best = null, bd = TRAIL_REACH;
    for (const q of ps) { if (q === p) continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
    if (!best) continue;
    const id = p.id < best.id ? p.id + '|' + best.id : best.id + '|' + p.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const a = p.id < best.id ? p : best, b = a === p ? best : p, len = Math.hypot(b.x - a.x, b.z - a.z);
    const seg = { id, a, b, len, ux: (b.x - a.x) / len, uz: (b.z - a.z) / len, phase: hash(Math.round(a.x), Math.round(b.z)) * TAU };
    // (only the ones that come near this square)
    const nx = Math.max(Math.min(mx, Math.max(a.x, b.x)), Math.min(a.x, b.x)), nz = Math.max(Math.min(mz, Math.max(a.z, b.z)), Math.min(a.z, b.z));
    if (Math.abs(nx - mx) < TRAIL_CELL && Math.abs(nz - mz) < TRAIL_CELL) segs.push(seg);
  }
  trailCells.set(key, segs);
  return segs;
}
/** How far a trail wanders from the straight line at `t` (0..1) along it. */
const wander = (seg, t) => Math.sin(t * seg.len / 90 + seg.phase) * Math.min(14, seg.len * 0.03) * Math.sin(Math.PI * t);
/** How much a spot is on a trail (0 off it .. 1 in its middle). */
export function trailAt(x, z) {
  if (!sitesReady) return 0;
  const segs = trailsOfCell(Math.floor(x / TRAIL_CELL), Math.floor(z / TRAIL_CELL));
  let best = 0;
  for (const s of segs) {
    const dx = x - s.a.x, dz = z - s.a.z, along = dx * s.ux + dz * s.uz;
    if (along < 0 || along > s.len) continue;
    const t = along / s.len, across = -dx * s.uz + dz * s.ux - wander(s, t);
    if (Math.abs(across) > TRAIL_W * 1.6) continue;
    const w = 1 - smooth(TRAIL_W * 0.55, TRAIL_W * 1.6, Math.abs(across));
    if (w > best) best = w;
  }
  if (best > 0 && lakeAt(x, z).t(x, z) < 1.35) return 0; // (not through a lake, nor its shore)
  return best;
}
/** The trails that pass within about `r` metres of a spot (each: `id`, `len`, and its ends `a`, `b`). */
export function trailsNear(x, z, r) {
  const segs = new Map();
  if (!sitesReady) return [];
  for (let cz = Math.floor((z - r) / TRAIL_CELL); cz <= Math.floor((z + r) / TRAIL_CELL); cz++) for (let cx = Math.floor((x - r) / TRAIL_CELL); cx <= Math.floor((x + r) / TRAIL_CELL); cx++) for (const s of trailsOfCell(cx, cz)) segs.set(s.id, s);
  return [...segs.values()];
}
/** The point `t` (0..1) of the way along a trail, as it wanders. */
export const trailPoint = (s, t) => { const w = wander(s, t); return { x: s.a.x + s.ux * s.len * t - s.uz * w, z: s.a.z + s.uz * s.len * t + s.ux * w }; };
/** For signposts: the trails leaving places near a spot, each with the place at its far end. */
export function trailEndsNear(x, z, r) {
  const out = [], segs = new Map();
  for (let cz = Math.floor((z - r) / TRAIL_CELL); cz <= Math.floor((z + r) / TRAIL_CELL); cz++) for (let cx = Math.floor((x - r) / TRAIL_CELL); cx <= Math.floor((x + r) / TRAIL_CELL); cx++) for (const s of trailsOfCell(cx, cz)) segs.set(s.id, s);
  for (const s of segs.values()) for (const [from, to, dir] of [[s.a, s.b, 1], [s.b, s.a, -1]]) {
    if (Math.hypot(from.x - x, from.z - z) > r) continue;
    const off = (from.out || 8) + 6, t = dir > 0 ? off / s.len : 1 - off / s.len;
    const px = s.a.x + s.ux * s.len * t - s.uz * wander(s, t), pz = s.a.z + s.uz * s.len * t + s.ux * wander(s, t);
    out.push({ id: s.id + ':' + dir, x: px + s.uz * 2.4 * dir, z: pz - s.ux * 2.4 * dir, toward: Math.atan2(to.x - px, to.z - pz), to, far: Math.round(s.len) });
  }
  return out;
}
// ── Rivers ─────────────────────────────────────────────────────
// Rivers run downhill from springs in the hills to a lake or the sea. The land is ruled into squares
// of RIVER_CELL metres; a square may hold a spring (fixed by the seed), on high ground. From it the
// water is traced down the slope of the land (before any river), step by step, carrying on a little
// in the way it was going so it rolls through small hollows instead of stopping; a river is kept
// only if it reaches a lake or the sea within RIVER_MAX metres, and only if it keeps off the home
// neighbourhood, the shrines' and buildings' ground, the volcano, and the settled lakes.
// Its water level never rises on the way down (where the land rises ahead it is cut through, up to
// RIVER_CUT metres; deeper than that, the river is not kept). Every river is worked out from its own
// square alone, so it is the same whichever way you come; each is kept once worked out, and the
// stretches of it are filed by 32 m squares so the ground can find the river beside it quickly.
const RIVER_CELL = 800, RIVER_STEP = 6, RIVER_MAX = 2000, RIVER_HOME = 450, RIVER_CUT = 9;
/** Below the land along its middle, the water (m); how deep the water is in the middle; how steeply the banks rise from the water's edge. */
export const RIVER_SINK = 0.15, RIVER_DEPTH = 0.35, RIVER_BANK = 0.35;
const RIVER_IDX = 32, RIVER_PAD = 26, RIVER_SPAN = Math.ceil((RIVER_MAX + RIVER_CELL) / RIVER_CELL);
const riverCells = new Map(), riverIdx = new Map(), riverRegions = new Set();
export const rivers = []; // every river worked out so far
const ikey = (i, j) => (i + 1e5) * 4e5 + (j + 1e5);
/** The spring in a square, if it has one: the highest of a few spots, on high, dry, open ground. */
function springOf(cx, cz) {
  const sd = WORLD.seed | 0;
  if (hash(cx * 31 + sd, cz * 17 + 4049) > 0.85) return null;
  let best = null;
  for (let k = 0; k < 4; k++) {
    const x = (cx + 0.2 + 0.6 * hash(cx * 7 + k * 101 + sd, cz * 13 + 77)) * RIVER_CELL, z = (cz + 0.2 + 0.6 * hash(cx * 11 + 5, cz * 19 + k * 97 + sd)) * RIVER_CELL;
    if (Math.hypot(x - HOME.x, z - HOME.z) < RIVER_HOME + 200 || seaAt(x, z) > 0 || lakeAt(x, z).t(x, z) < 2) continue;
    const h = rawHeight(x, z);
    if (h > 10 && (!best || h > best.h)) best = { x, z, h };
  }
  return best;
}
/** Is a spot somewhere a river must not run (see above)? */
function riverBarred(x, z) {
  if (Math.hypot(x - HOME.x, z - HOME.z) < RIVER_HOME) return true;
  if (shrineSiteAt(x, z, PAD_OUT + 8) || siteAt(x, z) || volcanoAt(x, z) || heartAt(x, z, 20)) return true;
  const L = lakeAt(x, z);
  return !!L.settled && L.t(x, z) < 2.3; // (a settled lake's shore, path and landmarks: kept clear altogether, since where they stand is worked out from the height rivers change)
}
/**
 * Water caught in a hollow at (x, z), ground height g, rises until it spills over the lowest point of
 * the hollow's rim. That way out, found by flooding outward over 10 m squares from the lowest rim up
 * (as water would), as far as lower ground, a lake or the sea, within 300 m: a list of [x, z] from
 * here (`end` set if it ended in a lake or the sea), or null if the hollow is deeper and wider.
 */
function spillFrom(x, z, g) {
  const C = 10, Rn = 30, N = 2 * Rn + 1, H = new Float32Array(N * N).fill(NaN), from = new Int32Array(N * N).fill(-2);
  const hp = [], key = [];  // a binary heap of squares by the level the water must reach to get there
  const push = (k, v) => { hp.push(v); key.push(k); let i = hp.length - 1; while (i > 0) { const pi = (i - 1) >> 1; if (hp[pi] <= hp[i]) break; [hp[pi], hp[i]] = [hp[i], hp[pi]]; [key[pi], key[i]] = [key[i], key[pi]]; i = pi; } };
  const pop = () => { const k = key[0], v = hp[0], lv = hp.pop(), lk = key.pop(); if (hp.length) { hp[0] = lv; key[0] = lk; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hp.length && hp[l] < hp[m]) m = l; if (r < hp.length && hp[r] < hp[m]) m = r; if (m === i) break; [hp[m], hp[i]] = [hp[i], hp[m]]; [key[m], key[i]] = [key[i], key[m]]; i = m; } } return [k, v]; };
  const at = (i, j) => [x + (i - Rn) * C, z + (j - Rn) * C];
  const c0 = Rn * N + Rn; from[c0] = -1; H[c0] = g; push(c0, g);
  let found = -1, end = null;
  while (hp.length) {
    const [k, lvl] = pop(), i = k % N, j = (k - i) / N, [px, pz] = at(i, j);
    if (k !== c0) {
      if (lakeAt(px, pz).t(px, pz) < 0.95) { found = k; end = 'lake:' + lakeAt(px, pz).id; break; }
      if (H[k] < 0.2 && seaAt(px, pz) > 0.2) { found = k; end = 'sea'; break; }
      if (H[k] < g - 1) { found = k; break; } // (lower ground beyond the rim: downhill from here on)
    }
    if (lvl - g > RIVER_CUT) return null;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if ((!di && !dj) || ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const kk = jj * N + ii;
      if (from[kk] !== -2) continue;
      const [qx, qz] = at(ii, jj);
      H[kk] = rawHeight(qx, qz); from[kk] = k; push(kk, Math.max(lvl, H[kk]));
    }
  }
  if (found < 0) return null;
  const way = [];
  for (let k = found; k >= 0; k = from[k]) { const i = k % N; way.push(at(i, (k - i) / N)); }
  way.reverse();
  way.end = end;
  return way;
}
/** The river from a square's spring, or null. */
const rfail = () => null; // (why a trace failed is passed for reading the code: 'stuck', 'pit', 'cut' ...)
function traceRiver(cx, cz) {
  const src = springOf(cx, cz);
  if (!src) return rfail('nospring');
  let x = src.x, z = src.z, dx = 0, dz = 0, end = null, low = Infinity;
  const X = [], Z = [];
  for (let n = 0; n * RIVER_STEP < RIVER_MAX; n++) {
    const L = lakeAt(x, z);
    if (L.t(x, z) < 0.95) { end = 'lake:' + L.id; X.push(x); Z.push(z); break; }
    const g = rawHeight(x, z);
    if (seaAt(x, z) > 0.2 && g < 0.2) { end = 'sea'; X.push(x); Z.push(z); break; }
    X.push(x); Z.push(z);
    low = Math.min(low, g - RIVER_SINK);
    if (g - low > RIVER_CUT) return rfail('cut');
    // downhill, carrying on a little the way it was going (and straight on across the flat)
    let gx = (rawHeight(x + 4, z) - g) / 4, gz = (rawHeight(x, z + 4) - g) / 4, m = Math.hypot(gx, gz);
    let ux = m > 1e-4 ? -gx / m : dx, uz = m > 1e-4 ? -gz / m : dz;
    if (n > 0) { ux = dx * 0.55 + ux * 0.45; uz = dz * 0.55 + uz * 0.45; }
    m = Math.hypot(ux, uz) || 1; ux /= m; uz /= m;
    // in a hollow (the way on climbs): the water fills it and spills out at its lowest side, so look
    // round, not back, for the lowest ground a few steps on, and go that way (cutting through the rim)
    if (n > 0 && rawHeight(x + ux * RIVER_STEP, z + uz * RIVER_STEP) > g + 0.05) {
      const head = Math.atan2(dz, dx);
      let bh = Infinity;
      for (let k = -6; k <= 6; k++) {
        const a = head + k * 0.29, px = Math.cos(a), pz = Math.sin(a), hh = rawHeight(x + px * 3 * RIVER_STEP, z + pz * 3 * RIVER_STEP);
        if (hh < bh) { bh = hh; ux = px; uz = pz; }
      }
      if (bh > g) { // a hollow wider than that: find where it spills over, and go there
        const way = spillFrom(x, z, g);
        if (!way) return rfail('pit');
        for (let k = 1; k < way.length; k++) { X.push(way[k][0]); Z.push(way[k][1]); }
        const a = way[way.length - 1], b = way[way.length - 2] || [x, z];
        x = a[0]; z = a[1]; m = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; dx = (a[0] - b[0]) / m; dz = (a[1] - b[1]) / m;
        if (way.end) { end = way.end; break; }
        n += way.length; continue;
      }
    }
    dx = ux; dz = uz;
    x += dx * RIVER_STEP; z += dz * RIVER_STEP;
    // (going round in circles, or stuck: not a river)
    if (n > 40 && Math.hypot(x - X[n - 40], z - Z[n - 40]) < 60) return rfail('stuck');
  }
  if (!end) return rfail('noend'); if (X.length < 25) return rfail('short');
  // smoothed (the trace zigzags), then the water level along it, never rising
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < X.length - 1; i++) { X[i] = (X[i - 1] + 2 * X[i] + X[i + 1]) / 4; Z[i] = (Z[i - 1] + 2 * Z[i] + Z[i + 1]) / 4; }
  const n = X.length, lv = new Float32Array(n), gr = new Float32Array(n), w = new Float32Array(n), S = new Float32Array(n);
  let lvl = Infinity, along = 0;
  for (let i = 0; i < n; i++) {
    if (riverBarred(X[i], Z[i])) return rfail('barred'); // (every point: a small building's ground could lie between every fourth)
    if (i > 0) along += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
    // (below the land in its middle, and below both banks, so the water never stands above the ground beside it)
    const g = rawHeight(X[i], Z[i]), a = Math.max(0, i - 1), b = Math.min(X.length - 1, i + 1), tx = X[b] - X[a], tz = Z[b] - Z[a], tl = Math.hypot(tx, tz) || 1, hw = (2.4 + 3.4 * smooth(0, 1600, along)) / 2 + 0.6;
    const gl = rawHeight(X[i] - tz / tl * hw, Z[i] + tx / tl * hw), gr2 = rawHeight(X[i] + tz / tl * hw, Z[i] - tx / tl * hw);
    lvl = Math.max(0, Math.min(lvl, g - RIVER_SINK, gl - 0.08, gr2 - 0.08));
    if (g - lvl > RIVER_CUT && i < n - 3) return rfail('cut');
    lv[i] = lvl; gr[i] = g; S[i] = along; w[i] = 2.4 + 3.4 * smooth(0, 1600, along);
  }
  // (a spring on a brink: the river begins below the drop, not pouring off the top into the air)
  let s0 = 0;
  while (s0 < n - 25 && lv[s0] - lv[s0 + 1] > 6) s0++; // (only a drop taller than any fall: a cascade below the spring is kept)
  if (s0 > 0) {
    const cut = (A) => A.slice(s0), base = S[s0];
    const r = { X: X.slice(s0), Z: Z.slice(s0), lv: cut(lv), g: cut(gr), w: cut(w), S: cut(S).map((v) => v - base) };
    return finishRiver(cx, cz, src, end, r.X, r.Z, r.lv, r.g, r.w, r.S);
  }
  return finishRiver(cx, cz, src, end, X, Z, lv, gr, w, S);
}
/** A traced river's falls (see below), and the river as it is kept. */
function finishRiver(cx, cz, src, end, X, Z, lv, gr, w, S) {
  const n = X.length, along = S[n - 1];
  // Waterfalls: where the water runs steeply it goes down in steps, as a stream does over rock: a lip,
  // a fall of up to FALL_H metres, a pool, the next lip. (The pool is cut into the slope below the lip,
  // its banks steeper there.) `fall` marks the stretch that is a fall; `bk` is how steeply the banks rise.
  const FALL_H = 3.2, seg = (i) => Math.max(0.5, S[i] - S[i - 1]), bk = new Float32Array(n).fill(RIVER_BANK), fall = new Uint8Array(n);
  for (let i = 1; i < n;) {
    if ((lv[i - 1] - lv[i]) / seg(i) <= 0.6) { i++; continue; }
    let b = i;
    while (b < n - 1 && (lv[b] - lv[b + 1]) / seg(b + 1) > 0.3) b++;
    let top = i - 1;
    for (let k = i; k <= b; k++) {
      if (lv[top] - lv[k] < FALL_H && k < b) continue;
      if (lv[top] - lv[k] > 1.2) { fall[top] = 1; for (let q = top + 1; q <= k; q++) { lv[q] = lv[k]; bk[q] = 0.75; } }
      top = k;
    }
    i = b + 1;
  }
  return { id: cx + ':' + cz, cx, cz, n, x: Float32Array.from(X), z: Float32Array.from(Z), lv, g: gr, w, bk, fall, s: S, len: along, end, spring: src };
}
/** File a river's stretches by the 32 m squares within reach of them. */
function fileRiver(r) {
  rivers.push(r);
  for (let i = 0; i < r.n - 1; i++) {
    const pad = r.w[i] / 2 + RIVER_PAD;
    const i0 = Math.floor((Math.min(r.x[i], r.x[i + 1]) - pad) / RIVER_IDX), i1 = Math.floor((Math.max(r.x[i], r.x[i + 1]) + pad) / RIVER_IDX);
    const j0 = Math.floor((Math.min(r.z[i], r.z[i + 1]) - pad) / RIVER_IDX), j1 = Math.floor((Math.max(r.z[i], r.z[i + 1]) + pad) / RIVER_IDX);
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) { const k = ikey(ii, j); let a = riverIdx.get(k); if (!a) riverIdx.set(k, (a = [])); a.push(r, i); }
  }
}
/**
 * A heart's stream and its fall, laid by hand (not traced: a traced river steps its falls at three
 * metres, and must reach a lake or the sea): from a spring on the terrace, across the top to the cliff,
 * down its face in one fall, into a pool at its foot, where it ends. A river like the others to
 * everything that reads rivers (`heart: true`, `end: 'pool'`).
 */
function heartRiver(s) {
  const a = s.th + s.side * 0.5, ca = Math.cos(a), sa = Math.sin(a), Rr = rimOf(s, s.side * 0.5);
  const rows = []; // [how far out, width, how steep its banks, is it the fall]
  for (let r = Rr - 21; r < Rr - 1.4; r += 3.1) rows.push([r, 2 + 0.8 * (r - Rr + 21) / 20, RIVER_BANK, 0]);
  rows.push([Rr - 0.4, 3, 1.5, 1], [Rr + 1.6, 3.2, 5, 1], [Rr + 3.3, 3.4, 5, 1], [Rr + 5.2, 5, 5, 0], [Rr + 9.5, 9, 5, 0], [Rr + 14, 9, 5, 0], [Rr + 18.5, 4.5, 2.5, 0]);
  const n = rows.length, X = new Float32Array(n), Z = new Float32Array(n), lv = new Float32Array(n), g = new Float32Array(n), w = new Float32Array(n), bk = new Float32Array(n), fall = new Uint8Array(n), S = new Float32Array(n);
  let pool = Infinity, lvl = Infinity, lip = 0;
  rows.forEach(([r, wd, b, f], i) => { X[i] = s.x + ca * r; Z[i] = s.z + sa * r; g[i] = heightBeforeRivers(X[i], Z[i]); w[i] = wd; bk[i] = b; S[i] = i ? S[i - 1] + (r - rows[i - 1][0]) : 0; if (f && !lip) lip = i; if (r > Rr + 5) pool = Math.min(pool, g[i] - 0.45); });
  for (let i = 0; i < n; i++) {
    if (i <= lip) { lvl = Math.min(lvl, g[i] - RIVER_SINK); lv[i] = lvl; fall[i] = i === lip ? 1 : 0; continue; }
    const u = Math.min(1, (rows[i][0] - rows[lip][0]) / (Rr + 5.2 - rows[lip][0])); // (down the face in one fall, to the pool's level)
    lv[i] = Math.min(lvl, lvl + (pool - lvl) * u); fall[i] = u < 1 ? 1 : 0;
  }
  return { id: 'heart:' + s.id, heart: true, n, x: X, z: Z, lv, g, w, bk, fall, s: S, len: S[n - 1], end: 'pool', spring: { x: X[0], z: Z[0], h: g[0] }, drop: lv[lip] - pool };
}
function riverOfCell(cx, cz) {
  const k = ikey(cx, cz);
  if (riverCells.has(k)) return riverCells.get(k);
  const r = traceRiver(cx, cz);
  riverCells.set(k, r);
  if (r) fileRiver(r);
  return r;
}
/** Make sure every river that could pass near a spot has been worked out. */
function riversReady(x, z) {
  const rx = Math.floor(x / RIVER_CELL), rz = Math.floor(z / RIVER_CELL), k = ikey(rx, rz);
  if (riverRegions.has(k)) return;
  riverRegions.add(k);
  for (let j = rz - RIVER_SPAN; j <= rz + RIVER_SPAN; j++) for (let i = rx - RIVER_SPAN; i <= rx + RIVER_SPAN; i++) riverOfCell(i, j);
  for (const s of sitesNear((rx + 0.5) * RIVER_CELL, (rz + 0.5) * RIVER_CELL, (RIVER_SPAN + 1) * RIVER_CELL, 'heart')) if (!s.river) { s.river = heartRiver(s); fileRiver(s.river); } // (and the hearts' own streams)
}
const near = { d: 0, lv: 0, w: 0, bk: RIVER_BANK, drop: 0, river: null, i: 0, t: 0 };
/**
 * The river nearest a spot within reach of its banks, or null: `d` how far from its middle (m),
 * `lv` its water level there, `w` its width, `drop` how steeply its water falls there (m per m),
 * and which river and stretch. (The same object each call: copy what you keep.)
 */
export function riverNear(x, z) {
  if (!sitesReady) return null;
  riversReady(x, z);
  const a = riverIdx.get(ikey(Math.floor(x / RIVER_IDX), Math.floor(z / RIVER_IDX)));
  if (!a) return null;
  let best = Infinity;
  for (let k = 0; k < a.length; k += 2) {
    const r = a[k], i = a[k + 1], ax = r.x[i], az = r.z[i], bx = r.x[i + 1] - ax, bz = r.z[i + 1] - az, l2 = bx * bx + bz * bz || 1;
    const t = clamp(((x - ax) * bx + (z - az) * bz) / l2, 0, 1), ex = ax + bx * t - x, ez = az + bz * t - z, d2 = ex * ex + ez * ez;
    if (d2 < best) { best = d2; near.river = r; near.i = i; near.t = t; }
  }
  const r = near.river, i = near.i, t = near.t;
  near.d = Math.sqrt(best);
  near.lv = r.lv[i] + (r.lv[i + 1] - r.lv[i]) * t;
  near.w = r.w[i] + (r.w[i + 1] - r.w[i]) * t;
  near.bk = r.bk[i] + (r.bk[i + 1] - r.bk[i]) * t;
  near.drop = (r.lv[i] - r.lv[i + 1]) / Math.max(0.5, Math.hypot(r.x[i + 1] - r.x[i], r.z[i + 1] - r.z[i]));
  return near.d < near.w / 2 + RIVER_PAD ? near : null;
}
/** The ground a river leaves at a spot near it: its bed, below the water, and banks rising from the water's edge (only ever lower than the land). */
function riverBed(r) {
  const hw = r.w / 2;
  return r.lv - RIVER_DEPTH * (1 - smooth(hw * 0.55, hw, r.d)) + r.bk * Math.max(0, r.d - hw);
}
/** How much a spot is in a river or on its bank (0 dry land .. 1 in the water), for the ground's look: `bank` metres of wet bank beyond the water. */
export function riverBank(x, z, bank = 2.5) {
  const r = riverNear(x, z);
  return r ? 1 - smooth(r.w / 2, r.w / 2 + bank, r.d) : 0;
}
/** How much a spot is in a river (0 on dry land .. 1 in the water). */
export function riverAt(x, z) {
  const r = riverNear(x, z);
  return r ? 1 - smooth(r.w * 0.45, r.w * 0.5 + 1.2, r.d) : 0;
}
/** The rivers within `r` metres of a spot (worked out if need be). */
export function riversNear(x, z, r) {
  for (let j = Math.floor((z - r) / RIVER_CELL); j <= Math.floor((z + r) / RIVER_CELL); j++) for (let i = Math.floor((x - r) / RIVER_CELL); i <= Math.floor((x + r) / RIVER_CELL); i++) riversReady(i * RIVER_CELL, j * RIVER_CELL);
  return rivers.filter((v) => { for (let i = 0; i < v.n; i += 5) if (Math.hypot(v.x[i] - x, v.z[i] - z) < r) return true; return false; });
}

// ── Ways across water ─────────────────────────────────────────
// A wooden footbridge wherever a trail crosses a river (not over a fall), and a line of stepping stones
// from the nearest shore out to each island. You walk on both, as on the jetty. Worked out from the
// river, the trails and the island alone, so they are the same whichever way you come; kept once found.
const BRIDGE_W = 1.0, STONE_W = 0.62, STONE_TOP = 0.2;
/** Where the trails cross a river: [{ x, z, ux, uz (along the trail), half (half its span), y (its deck at the ends), arch }]. */
export function bridgesOf(r) {
  if (r.bridges) return r.bridges;
  const out = (r.bridges = []);
  if (!sitesReady) return out;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < r.n; i++) { x0 = Math.min(x0, r.x[i]); x1 = Math.max(x1, r.x[i]); z0 = Math.min(z0, r.z[i]); z1 = Math.max(z1, r.z[i]); }
  const segs = new Map();
  for (let cz = Math.floor(z0 / TRAIL_CELL); cz <= Math.floor(z1 / TRAIL_CELL); cz++) for (let cx = Math.floor(x0 / TRAIL_CELL); cx <= Math.floor(x1 / TRAIL_CELL); cx++) for (const s of trailsOfCell(cx, cz)) segs.set(s.id, s);
  for (const s of segs.values()) {
    // the trail as a line of points 4 m apart, as it wanders
    let px = null, pz = null;
    for (let d = 0; d <= s.len; d += 4) {
      const t = d / s.len, w = wander(s, t), qx = s.a.x + s.ux * d - s.uz * w, qz = s.a.z + s.uz * d + s.ux * w;
      if (px !== null && qx >= x0 - 8 && qx <= x1 + 8 && qz >= z0 - 8 && qz <= z1 + 8) {
        for (let i = 0; i < r.n - 1; i++) {
          const ax = r.x[i], az = r.z[i], bx = r.x[i + 1] - ax, bz = r.z[i + 1] - az, cx = qx - px, cz = qz - pz, den = bx * cz - bz * cx;
          if (Math.abs(den) < 1e-6) continue;
          const u = ((px - ax) * cz - (pz - az) * cx) / den, v = ((px - ax) * bz - (pz - az) * bx) / den;
          if (u < 0 || u > 1 || v < 0 || v > 1) continue;
          if (r.fall[i] || (i && r.fall[i - 1])) continue; // (not over a fall)
          const x = ax + bx * u, z = az + bz * u, cl = Math.hypot(cx, cz), ux = cx / cl, uz = cz / cl, w2 = r.w[i] + (r.w[i + 1] - r.w[i]) * u, lv = r.lv[i] + (r.lv[i + 1] - r.lv[i]) * u;
          // over the water from bank to bank, each end resting on the ground before rivers
          const half = w2 / 2 / Math.max(0.35, Math.abs(ux * (-bz) + uz * bx) / Math.hypot(bx, bz)) + 1.8;
          const ya = heightBeforeRivers(x - ux * half, z - uz * half), yb = heightBeforeRivers(x + ux * half, z + uz * half);
          if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 12)) continue;
          const grove = smooth(0.35, 0.6, groveAt(x, z)); // (in a blossom grove the bridge is a garden bridge: a high arch, lacquered red; world/crossings.js)
          out.push({ x, z, ux, uz, half, ya, yb, lv, arch: (0.3 + 0.04 * half) * (1 + 1.5 * grove), grove });
        }
      }
      px = qx; pz = qz;
    }
  }
  return out;
}
/** The deck of a bridge at a spot, or null. */
function bridgeAt(x, z, r) {
  for (const b of bridgesOf(r)) {
    const dx = x - b.x, dz = z - b.z, along = dx * b.ux + dz * b.uz, across = -dx * b.uz + dz * b.ux;
    if (Math.abs(along) > b.half || Math.abs(across) > BRIDGE_W) continue;
    return deckY(b, along);
  }
  return null;
}
/** A bridge's deck height `along` metres from its middle: from one bank to the other, arching over the water. */
export const deckY = (b, along) => { const t = (along + b.half) / (2 * b.half); return Math.max(b.ya + (b.yb - b.ya) * t, b.lv + 0.35) + b.arch * Math.sin(Math.PI * t) + 0.12; };
/** An island's stepping stones, from the nearest shore out to it: { ax, az (on the shore), bx, bz (on the island), stones: [{ x, z, s, ry }] }. */
export function stonesOf(L) {
  const I = L.isle;
  if (!I) return null;
  if (I.stones) return I.stones;
  // the shore nearest the island's edge
  let best = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU, p = L.point(a, 1.0), toward = Math.atan2(p.z - I.z, p.x - I.x), q = islePoint(I, toward, I.shore), d = Math.hypot(p.x - q.x, p.z - q.z);
    if (!best || d < best.d) best = { d, a, toward };
  }
  const A = L.point(best.a, 1.03), B = islePoint(I, best.toward, I.shore * 0.92), len = Math.hypot(A.x - B.x, A.z - B.z), n = Math.max(2, Math.round(len / 0.95));
  const stones = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = hash(Math.round(I.x * 7) + i * 13, Math.round(I.z * 7) - i * 7);
    stones.push({ x: A.x + (B.x - A.x) * t + (j - 0.5) * 0.18, z: A.z + (B.z - A.z) * t + (hash(i * 31 + 5, Math.round(I.x)) - 0.5) * 0.18, s: 0.82 + 0.3 * j, ry: j * TAU });
  }
  return (I.stones = { ax: A.x, az: A.z, bx: B.x, bz: B.z, len, stones });
}
/** The top of a stepping stone at a spot, or null. */
function stonesAt(x, z) {
  const L = lakeAt(x, z);
  if (!L.isle || L.t(x, z) > 1.15) return null;
  const S = stonesOf(L), dx = S.bx - S.ax, dz = S.bz - S.az, t = ((x - S.ax) * dx + (z - S.az) * dz) / (S.len * S.len);
  if (t < -0.02 || t > 1.02) return null;
  return Math.hypot(S.ax + dx * t - x, S.az + dz * t - z) < STONE_W ? STONE_TOP : null;
}
sitesReady = true; // (from here on the land's height levels the buildings' ground)
