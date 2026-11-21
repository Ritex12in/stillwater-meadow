// The shape of the world: terrain height, lakes, the path round a lake, the jetty, and where you
// can walk.
//
// Lakes and the places beside them are data, not constants: a lake is an object (makeLake) that
// knows its own outline, and the jetty, campfire, bench, chairs and starting spot are worked out
// from a lake (landmarksOf). Questions about a spot ("how far from the water is this?") go to the
// lake nearest that spot (lakeAt), so the same code holds for one lake or many. For now there is
// one: HOME, the valley's own. The older single-lake names (LAKE, lakeR, lakePoint, SPAWN,
// dockStart, ...) still stand for that lake and its places.
import { smooth, fbm } from './math.js';
import { seasonState } from './state.js';

export const PATH_T = 1.32;       // the path runs round a lake at this many lake-radii
export const WORLD_LIMIT = 118;

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
/** The lie of the land before any lake is cut into it: rolling meadow, rising to hills round the valley. */
function land(x, z) {
  const d = Math.hypot(x, z);
  let base = 0.6 + fbm(x * 0.018 + 3.1, z * 0.018 - 7.4) * 7.5;
  base += smooth(85, 150, d) * (16 + fbm(x * 0.045, z * 0.045) * 24);
  return base;
}
/** Exact analytic terrain height: the land, with the nearest lake's bowl and path cut in. Used to build the terrain mesh. */
export function height(x, z) {
  const base = land(x, z);
  const lake = lakeAt(x, z), t = lake.t(x, z);
  const floor = t < 1 ? -3.2 * (1 - t * t) : (t - 1) * 2.0;
  const k = smooth(0.8, 1.6, t);
  return floor * (1 - k) + base * k - lake.path(x, z) * 0.08;
}

// ── Baked height field ─────────────────────────────────────────
// After the terrain mesh is built we keep its vertex heights and sample them with the same
// triangle split the mesh uses. Feet and paws then sit exactly on the rendered surface, and a
// lookup costs a few multiplies instead of eight noise evaluations.
export const TERRAIN = { size: 360, seg: 300 };
let baked = null;
export function bakeHeights(positionAttr) {
  const n = TERRAIN.seg + 1;
  baked = new Float32Array(n * n);
  // PlaneGeometry rotated -90° about X: vertex index = iz * n + ix, x and z both increase with index
  for (let i = 0; i < positionAttr.count; i++) baked[i] = positionAttr.getY(i);
}
/** Height of the rendered ground. Falls back to the analytic height outside the mesh or before baking. */
export function heightAt(x, z) {
  if (!baked) return height(x, z);
  const half = TERRAIN.size / 2, step = TERRAIN.size / TERRAIN.seg, n = TERRAIN.seg + 1;
  const fx = (x + half) / step, fz = (z + half) / step;
  if (fx < 0 || fz < 0 || fx >= TERRAIN.seg || fz >= TERRAIN.seg) return height(x, z);
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz;
  const ha = baked[iz * n + ix], hd = baked[iz * n + ix + 1], hb = baked[(iz + 1) * n + ix], hc = baked[(iz + 1) * n + ix + 1];
  // the plane splits each cell along the b–d diagonal
  return u + v <= 1 ? ha + u * (hd - ha) + v * (hb - ha) : hc + (1 - u) * (hb - hc) + (1 - v) * (hd - hc);
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
export function walkable(x, z) {
  if (onDock(x, z) || onIce(x, z)) return true;
  if (Math.hypot(x, z) > WORLD_LIMIT) return false;
  const h = heightAt(x, z);
  return h > 0.22 && h < 18;
}
export const animalWalkable = (x, z) => onDock(x, z) || (walkable(x, z) && !onIce(x, z) && heightAt(x, z) > 0.35);

/** Nearest walkable spot going outward from the centre of the lake you are on: used to rescue someone on thawing ice. */
export function nearestShore(x, z) {
  const lake = lakeAt(x, z), a = Math.atan2(z - lake.z, x - lake.x);
  for (let t = Math.max(lake.t(x, z), 0.5); t < 1.8; t += 0.02) {
    const p = lake.point(a, t);
    if (walkable(p.x, p.z) && !onIce(p.x, p.z)) return p;
  }
  return lake.point(a, 1.3);
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

