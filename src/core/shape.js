// The shape of the world: terrain height, lakes, the path round a lake, the jetty, and where you
// can walk. The land has no edge: its height is a formula of the world's seed and a position,
// so it can be worked out anywhere, in any order (the ground is drawn from it in tiles: see
// world/terrain.js).
//
// Lakes and the places beside them are data, not constants: a lake is an object (makeLake) that
// knows its own outline, and the jetty, campfire, bench, chairs and starting spot are worked out
// from a lake (landmarksOf). Questions about a spot ("how far from the water is this?") go to the
// lake nearest that spot (lakeAt), so the same code holds for one lake or many. For now there is
// one: HOME, the valley's own. The older single-lake names (LAKE, lakeR, lakePoint, SPAWN,
// dockStart, ...) still stand for that lake and its places.
import { smooth, clamp, fbm, mulberry32 } from './math.js';
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
 * A lake at (x, z). Its shore is a wobbly circle: at angle `a` from the centre the radius is
 *   R0 + A3 sin(3a + P3) + A5 cos(5a + P5) + A7 sin(7a + P7)
 * (the lake's water shader draws its foam and shallows from the same numbers).
 */
export function makeLake({ x, z, R0 = 30, A3 = 4, P3 = 0, A5 = 2.5, P5 = 1.3, A7 = 1.5, P7 = 0.4 }) {
  const L = { x, z, R0, A3, P3, A5, P5, A7, P7 };
  /** Shore radius at angle `a`. */
  L.r = (a) => R0 + A3 * Math.sin(3 * a + P3) + A5 * Math.cos(5 * a + P5) + A7 * Math.sin(7 * a + P7);
  /** How far out a spot is, in lake-radii: 0 at the centre, 1 on the shore. */
  L.t = (px, pz) => { const dx = px - L.x, dz = pz - L.z; return Math.hypot(dx, dz) / L.r(Math.atan2(dz, dx)); };
  /** The spot at angle `a`, `t` lake-radii out. */
  L.point = (a, t) => ({ x: L.x + Math.cos(a) * L.r(a) * t, z: L.z + Math.sin(a) * L.r(a) * t });
  /** How much a spot is on the path that circles the lake (0..1). */
  L.path = (px, pz) => {
    const dx = px - L.x, dz = pz - L.z;
    const r = L.r(Math.atan2(dz, dx)) * PATH_T;
    return 1 - smooth(1.3, 2.7, Math.abs(Math.hypot(dx, dz) - r));
  };
  return L;
}
/** The valley's lake. */
export const HOME = makeLake({ x: 6, z: -30 });
const LAKES = [HOME];
/** The lake nearest a spot (by how far out the spot is, in that lake's own radii). */
export function lakeAt(x, z) {
  let best = LAKES[0];
  for (let i = 1, bt = best.t(x, z); i < LAKES.length; i++) { const t = LAKES[i].t(x, z); if (t < bt) { bt = t; best = LAKES[i]; } }
  return best;
}
/** How far out a spot is from its nearest lake, in lake-radii (1 = on the shore). */
export const lakeT = (x, z) => lakeAt(x, z).t(x, z);
/** How much a spot is on the path round its nearest lake. */
export const pathAmt = (x, z) => lakeAt(x, z).path(x, z);
// the single-lake names: the home lake
export const LAKE = HOME;
export const lakeR = HOME.r;

// ── Terrain ────────────────────────────────────────────────────
/**
 * The lie of the land before any lake is cut into it. Three layers: the gentle meadow underfoot;
 * broad rolling hills; and, in some regions, mountains with long sharp ridges. The hills and
 * mountains are held back round a lake (`t` is how far out the spot is, in lake-radii), so every
 * lake lies in its own valley. Never below 0.6 m: the only water is the lakes.
 */
function land(x, z, t) {
  const u = x + SX * 31, v = z + SZ * 31;
  const meadow = 0.6 + fbm(u * 0.018 + 3.1, v * 0.018 - 7.4) * 7.5;
  const open = smooth(2.4, 7.5, t);
  if (open <= 0) return meadow;
  const hills = fbm(u * 0.0055 - 9.2, v * 0.0055 + 23.6);
  let rise = hills * hills * 46;
  const range = smooth(0.5, 0.72, fbm(u * 0.0014 + 41.3, v * 0.0014 - 17.9)); // where the mountains stand
  if (range > 0) {
    const crest = 1 - Math.abs(2 * fbm(u * 0.0038 + 71.1, v * 0.0038 + 5.5) - 1); // ridged: sharp along the tops
    rise += range * (28 + crest * crest * 205 + fbm(u * 0.021 - 3.3, v * 0.021 + 8.8) * 24 * range);
  }
  return meadow + open * rise;
}
/** Exact terrain height: the land, with the nearest lake's bowl and path cut in. The ground's tiles are built from it. */
export function height(x, z) {
  const lake = lakeAt(x, z), t = lake.t(x, z);
  const base = land(x, z, t);
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

export const lakePoint = HOME.point;

// ── Places beside a lake ───────────────────────────────────────
export const DOCK_A = Math.PI / 2 + 0.55, CHAIR_A = Math.PI / 2 - 0.95;
export const DOCK_BACK = 1.6, DOCK_LEN = 9, DOCK_HALF = 1.05;
/**
 * Where things stand round a lake: the starting spot on the path, the jetty (where it leaves the
 * shore, which way it runs, how high its deck is), the two lawn chairs, the campfire and the bench.
 */
export function landmarksOf(lake) {
  const start = lake.point(DOCK_A, 1.03);
  return {
    spawn: lake.point(Math.PI / 2, PATH_T + 0.04),
    dockStart: start,
    dockDir: { x: -Math.cos(DOCK_A), z: -Math.sin(DOCK_A) },
    dockY: Math.max(0.5, height(start.x, start.z) + 0.1),
    chairs: [lake.point(CHAIR_A, 1.17), lake.point(CHAIR_A + 0.05, 1.17)],
    fire: lake.point(Math.PI / 2 + 0.34, 1.68),
    bench: lake.point(Math.PI / 2 - 0.5, 1.5),
  };
}
const HOME_PLACES = landmarksOf(HOME);
export const SPAWN = HOME_PLACES.spawn;

// ── Jetty ──────────────────────────────────────────────────────
export const dockStart = HOME_PLACES.dockStart;
export const dockDir = HOME_PLACES.dockDir;
export const DOCK_Y = HOME_PLACES.dockY;
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
export const onIce = (x, z) => seasonState.ice > 0.85 && lakeT(x, z) < 1.0 && heightAt(x, z) < 0.3;
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
export const nearReserved = (x, z, r) => chairSpots.some((c) => Math.hypot(x - c.x, z - c.z) < r) || Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < r + 1.6;

