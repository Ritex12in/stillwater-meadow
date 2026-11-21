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
// valley's own, and the older single-lake names (LAKE, lakeR, lakePoint, SPAWN, dockStart, ...)
// still stand for that lake and its places.
import { TAU, smooth, clamp, fbm, hash, mulberry32 } from './math.js';
import { seasonState } from './state.js';
import { query } from './env.js';

export const PATH_T = 1.32;       // the path runs round a lake at this many lake-radii
export const WORLD_LIMIT = 118;   // how far from the middle the valley's own trees and flowers are planted (you can walk on past it)

// ── The world's seed ───────────────────────────────────────────
// One number decides the whole landscape (`?seed=7` in the address picks another). It shifts where
// in the endless noise the land is read from. The first world, seed 1, reads from the start, which
// leaves the meadow round the home lake as it was first made.
const DEFAULT_SEED = 1;
export const WORLD = { seed: Math.max(1, Math.floor(Math.abs(Number(query.get('seed')) || DEFAULT_SEED))) };
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
  const L = { x, z, R0, A3, P3, A5, P5, A7, P7, E, TH, beach, ring, tint, rmax, id: 'home', name: 'Stillwater', frozen: false, reach2: (rmax * 7.5) ** 2 }; // (reach2: beyond this the lake has no say in the land)
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
/** The valley's lake. */
export const HOME = makeLake({ x: 6, z: -30 });

// ── Lakes from the seed ────────────────────────────────────────
// The land is ruled into squares LAKE_CELL metres wide, and each square has one lake or none,
// decided by the world's seed and the square's place: where in the square it lies, how big it is
// and the shape of its shore: round ponds, long narrow waters, lakes with deep bays. A lake keeps
// to the middle of its square, which keeps any two far enough apart that their bowls never touch;
// none lies among the mountains. The country it lies in gives it its character: a broad beach in
// the meadows and broader still on the heath, where the water is clear turquoise; grass to the
// water's edge and dark green water in lush country; ice the year round in the snow. Some have a
// path worn round them. The square the valley stands in holds HOME instead.
export const LAKE_CELL = 420;
const lakeCells = new Map(), aroundCells = new Map();
const HOME_CX = Math.floor(HOME.x / LAKE_CELL), HOME_CZ = Math.floor(HOME.z / LAKE_CELL);
const NAME_A = ['Mirror', 'Heron', 'Willow', 'Amber', 'Silver', 'Moss', 'Lark', 'Fern', 'Otter', 'Birch', 'Glass', 'Hollow', 'Mist', 'Reed', 'Thistle', 'Ember', 'Swan', 'Dawn', 'Quiet', 'Lantern'];
const NAME_COLD = ['Frost', 'Snow', 'White', 'Winter', 'Crystal', 'Pale'], NAME_B = ['water', 'mere', 'pool', 'tarn', 'deep', 'rest', 'glass', 'hollow'];
function lakeOfCell(cx, cz) {
  const key = cx + ':' + cz;
  let L = lakeCells.get(key);
  if (L !== undefined) return L;
  L = null;
  if (cx === HOME_CX && cz === HOME_CZ) L = HOME;
  else {
    const R = mulberry32((Math.floor(hash(cx * 11 + 7, cz * 17 - 3) * 4294967296) ^ Math.imul(WORLD.seed, 0x85EBCA6B)) | 0);
    const there = R() < 0.62, x = (cx + 0.2 + R() * 0.6) * LAKE_CELL, z = (cz + 0.2 + R() * 0.6) * LAKE_CELL, size = R(), p3 = R() * TAU, p5 = R() * TAU, p7 = R() * TAU, wob = 0.35 + R() * 1.25, n1 = R(), n2 = R(), long = R(), th = R() * Math.PI, worn = R();
    if (there && rangeAt(x, z) < 0.3) {
      // size, how deeply the shore is scalloped, and how long and narrow it is (one in three is nearly round);
      // then scaled down, if need be, so the longest reach of the shore stays inside the lake's own square
      let R0 = 12 + size * size * 30;
      const E = long < 0.33 ? long * 0.15 : 0.08 + (long - 0.33) * 0.42, lobes = (0.13 + 0.085 + 0.05) * wob;
      R0 *= Math.min(1, 47 / (R0 * (1 + lobes) * (1 + E)));
      // its character, from the country it lies in
      const rain = rainAt(x, z), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(coldAt(x, z, 1));
      const beach = clamp(1 + dry * 0.5 - lush * 0.8 - snow * 0.9, 0.1, 1.5);
      const tint = [1 - lush * 0.3 - dry * 0.12 - snow * 0.12, 1 + lush * 0.04 + dry * 0.16 - snow * 0.04, 1 - lush * 0.2 + dry * 0.12 + snow * 0.12];
      L = makeLake({ x, z, R0, A3: R0 * 0.13 * wob, P3: p3, A5: R0 * 0.085 * wob, P5: p5, A7: R0 * 0.05 * wob, P7: p7, E, TH: th, beach, ring: worn < 0.4, tint });
      L.id = key;
      L.frozen = snow > 0.6;
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
function land(x, z, open) {
  const u = x + SX * 31, v = z + SZ * 31;
  const meadow = 0.6 + fbm(u * 0.018 + 3.1, v * 0.018 - 7.4) * 7.5;
  if (open <= 0) return meadow;
  const hills = fbm(u * 0.0055 - 9.2, v * 0.0055 + 23.6);
  let rise = hills * hills * 46;
  const range = rangeAt(x, z);
  if (range > 0) {
    const crest = 1 - Math.abs(2 * fbm(u * 0.0038 + 71.1, v * 0.0038 + 5.5) - 1); // ridged: sharp along the tops
    rise += range * (28 + crest * crest * 205 + fbm(u * 0.021 - 3.3, v * 0.021 + 8.8) * 24 * range);
  }
  return meadow + open * rise;
}
/** How much a spot is in the mountains (0 none .. 1 the heart of a range). */
function rangeAt(x, z) { return smooth(0.5, 0.72, fbm((x + SX * 31) * 0.0014 + 41.3, (z + SZ * 31) * 0.0014 - 17.9)); }
/**
 * Exact terrain height: the land, held down in the valleys of the lakes within reach, with the
 * nearest lake's bowl and path cut in. The ground's tiles are built from it. (Every lake's valley
 * is a smooth factor and the bowls never overlap, so the land has no seam where "the nearest
 * lake" changes from one to another.)
 */
export function height(x, z) {
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
  if (!lake || t >= 1.7) return base; // (beyond the bowl and the path)
  const floor = t < 1 ? -3.2 * (1 - t * t) : (t - 1) * 2.0;
  const k = smooth(0.8, 1.6, t);
  return floor * (1 - k) + base * k - lake.path(x, z) * 0.08;
}

// ── Climate ────────────────────────────────────────────────────
// Two broad fields, read from the same seeded noise as the land, decide what kind of country a
// place is: how cold it is and how much rain it gets. Everything that covers the land reads them
// (the ground's colour and snow, the grass, which trees grow and how thickly, the flowers), so
// the kinds of country change together as you travel, and blend where they meet:
//   cold  -> snow in drifts, then snowfields; pines; no flowers      (also: the higher, the colder)
//   dry   -> golden heath, tall pale grass, a few airy trees, more boulders
//   wet   -> lush dark-green country, thick mixed woods, ferns and mushrooms
// and here and there a blossom grove. The valley round the home lake keeps its own mild weather.
const mild = (x, z) => smooth(140, 330, Math.hypot(x, z)); // (0 in the valley, 1 beyond it: goes when the valley does)
/** How cold a spot is, 0 mild .. 1 frozen. `h` is the ground's height there. */
export function coldAt(x, z, h) {
  const n = fbm((x + SX * 17) * 0.0011 - 63.4, (z + SZ * 17) * 0.0011 + 28.9);
  return clamp(smooth(0.575, 0.7, n) * mild(x, z) + smooth(78, 132, h), 0, 1);
}
/** How much rain a spot gets, 0 parched .. 1 soaked (0.5 in between, and in the valley). */
export function rainAt(x, z) {
  const n = fbm((x + SX * 17) * 0.0013 + 19.2, (z + SZ * 17) * 0.0013 - 51.7);
  return 0.5 + (n - 0.5) * mild(x, z);
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
  const turn = lake.turn || 0, dockA = Math.PI / 2 + 0.55 + turn, chairA = Math.PI / 2 - 0.95 + turn;
  const start = lake.point(dockA, 1.03);
  return {
    dockA, chairA,
    spawn: lake.point(Math.PI / 2 + turn, PATH_T + 0.04),
    dockStart: start,
    dockDir: { x: -Math.cos(dockA), z: -Math.sin(dockA) },
    dockY: Math.max(0.5, height(start.x, start.z) + 0.1),
    chairs: [lake.point(chairA, 1.17), lake.point(chairA + 0.05, 1.17)],
    fire: lake.point(Math.PI / 2 + 0.34 + turn, 1.68),
    bench: lake.point(Math.PI / 2 - 0.5 + turn, 1.5),
  };
}
const HOME_PLACES = landmarksOf(HOME);
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
export const onIce = (x, z) => { const lake = lakeAt(x, z); return (seasonState.ice > 0.85 || lake.frozen) && lake.t(x, z) < 1.0 && heightAt(x, z) < 0.3; }; // (in winter, or on a lake of the snow country at any time)
export const ICE_Y = 0.09;
export const groundAt = (x, z) => (onDock(x, z) ? Math.max(DOCK_Y + 0.05, heightAt(x, z)) : onIce(x, z) ? Math.max(heightAt(x, z), ICE_Y) : heightAt(x, z));
export const MAX_SLOPE = 1.25;    // steeper than this (about 51 degrees) is a cliff, not a hillside
/** Anywhere that is dry land and not too steep to climb (or the jetty, or solid ice). */
export function walkable(x, z) {
  if (onDock(x, z) || onIce(x, z)) return true;
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
/** The lake the jetty, the fire and the bench stand at just now. */
export let ANCHOR = HOME;
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
  DOCK_A = m.dockA; CHAIR_A = m.chairA; DOCK_Y = m.dockY;
  Object.assign(SPAWN, m.spawn); Object.assign(dockStart, m.dockStart); Object.assign(dockDir, m.dockDir);
  Object.assign(FIRE_SPOT, m.fire); Object.assign(BENCH_SPOT, m.bench);
  chairSpots.forEach((c, i) => Object.assign(c, m.chairs[i]));
}
export const nearReserved = (x, z, r) => chairSpots.some((c) => Math.hypot(x - c.x, z - c.z) < r) || Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < r + 1.6;

