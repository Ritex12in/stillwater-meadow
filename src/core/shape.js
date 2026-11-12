// The shape of the world: terrain height, the lake, the path, the jetty, and where you can walk.
import { smooth, fbm } from './math.js';
import { seasonState } from './state.js';

export const LAKE = { x: 6, z: -30 };
export const PATH_T = 1.32;
export const WORLD_LIMIT = 118;
export function lakeR(a) { return 30 + 4 * Math.sin(3 * a) + 2.5 * Math.cos(5 * a + 1.3) + 1.5 * Math.sin(7 * a + 0.4); }
export function lakeT(x, z) { const dx = x - LAKE.x, dz = z - LAKE.z; return Math.hypot(dx, dz) / lakeR(Math.atan2(dz, dx)); }
export function pathAmt(x, z) {
  const dx = x - LAKE.x, dz = z - LAKE.z;
  const r = lakeR(Math.atan2(dz, dx)) * PATH_T;
  return 1 - smooth(1.3, 2.7, Math.abs(Math.hypot(dx, dz) - r));
}
/** Exact analytic terrain height. Used to build the terrain mesh. */
export function height(x, z) {
  const d = Math.hypot(x, z);
  let base = 0.6 + fbm(x * 0.018 + 3.1, z * 0.018 - 7.4) * 7.5;
  base += smooth(85, 150, d) * (16 + fbm(x * 0.045, z * 0.045) * 24);
  const t = lakeT(x, z);
  const floor = t < 1 ? -3.2 * (1 - t * t) : (t - 1) * 2.0;
  const k = smooth(0.8, 1.6, t);
  return floor * (1 - k) + base * k - pathAmt(x, z) * 0.08;
}

// ── Baked height field ─────────────────────────────────────────
// After the terrain mesh is built we keep its vertex heights and sample them with the same
// triangle split the mesh uses. Feet and paws then sit exactly on the rendered surface, and a
// lookup costs a few multiplies instead of eight noise evaluations.
export const TERRAIN = { size: 360, seg: 200 };
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

export const lakePoint = (a, t) => ({ x: LAKE.x + Math.cos(a) * lakeR(a) * t, z: LAKE.z + Math.sin(a) * lakeR(a) * t });
export const SPAWN = lakePoint(Math.PI / 2, PATH_T + 0.04);

// ── Jetty ──────────────────────────────────────────────────────
export const DOCK_A = Math.PI / 2 + 0.55;
export const dockStart = lakePoint(DOCK_A, 1.03);
export const dockDir = { x: -Math.cos(DOCK_A), z: -Math.sin(DOCK_A) };
export const DOCK_BACK = 1.6, DOCK_LEN = 9, DOCK_HALF = 1.05;
export const DOCK_Y = Math.max(0.5, height(dockStart.x, dockStart.z) + 0.1);
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

/** Nearest walkable spot going outward from the lake centre: used to rescue someone on thawing ice. */
export function nearestShore(x, z) {
  const a = Math.atan2(z - LAKE.z, x - LAKE.x);
  for (let t = Math.max(lakeT(x, z), 0.5); t < 1.8; t += 0.02) {
    const p = lakePoint(a, t);
    if (walkable(p.x, p.z) && !onIce(p.x, p.z)) return p;
  }
  return lakePoint(a, 1.3);
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
export const CHAIR_A = Math.PI / 2 - 0.95;
export const chairSpots = [lakePoint(CHAIR_A, 1.17), lakePoint(CHAIR_A + 0.05, 1.17)];
export const FIRE_SPOT = lakePoint(Math.PI / 2 + 0.34, 1.68);
export const BENCH_SPOT = lakePoint(Math.PI / 2 - 0.5, 1.5);
export const nearReserved = (x, z, r) => chairSpots.some((c) => Math.hypot(x - c.x, z - c.z) < r) || Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < r + 1.6;

