// Things made in code for the biomes (the owner's choice: made, not downloaded): low-poly shapes
// in the game's style, shaded by vertex colour (dark at the root, light at the tips) and tinted by
// each instance's colour. Each maker takes a variant number and draws from its own fixed random
// stream, so a variant is the same every time and no two variants are alike.
import * as THREE from 'three';
import { TAU, mulberry32 } from '../core/math.js';
import { Builder } from './detail.js';

const ring = (n, r, y, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
/** A tapering tube along a path of points, `sides` round, its radius at each point from `radii`; colours by height from `shadeAt(t)`. */
function tube(b, pts, radii, sides, shadeAt, cap = true) {
  const rings = pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    let dx = q[0] - o[0], dy = q[1] - o[1], dz = q[2] - o[2];
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    // two axes across the path
    let ax = [0, 1, 0]; if (Math.abs(dy) > 0.9) ax = [1, 0, 0];
    let ux = ax[1] * dz - ax[2] * dy, uy = ax[2] * dx - ax[0] * dz, uz = ax[0] * dy - ax[1] * dx; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    return Array.from({ length: sides }, (_, k) => { const a = (k / sides) * TAU, c = Math.cos(a) * radii[i], s = Math.sin(a) * radii[i]; return [p[0] + ux * c + vx * s, p[1] + uy * c + vy * s, p[2] + uz * c + vz * s]; });
  });
  for (let i = 0; i < rings.length - 1; i++) {
    const t0 = i / (rings.length - 1), t1 = (i + 1) / (rings.length - 1), c0 = shadeAt(t0), c1 = shadeAt(t1);
    for (let k = 0; k < sides; k++) {
      const a = rings[i][k], bb = rings[i][(k + 1) % sides], c = rings[i + 1][(k + 1) % sides], d = rings[i + 1][k];
      b.triOut(a, bb, c, pts[i], c0, c0, c1); b.triOut(a, c, d, pts[i], c0, c1, c1);
    }
  }
  if (cap) { const last = rings[rings.length - 1], tip = pts[pts.length - 1], c = shadeAt(1); for (let k = 0; k < sides; k++) b.triOut(last[k], last[(k + 1) % sides], tip, pts[pts.length - 2], c, c, c); }
}

// ───────────── glowing mushrooms (the enchanted wood) ─────────────
/** A cluster of 1 to 4 mushrooms: stems (pale) and caps (white: the instance colour tints them; they glow at night). Returns { stem, cap }. */
export function glowMushroom(variant) {
  const R = mulberry32(9100 + variant * 31), stem = new Builder(), cap = new Builder();
  const n = 1 + Math.floor(R() * 4);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, d = i ? 0.12 + R() * 0.18 : 0, ox = Math.cos(a) * d, oz = Math.sin(a) * d, h = (i ? 0.18 : 0.32) + R() * 0.22, r = h * (0.32 + R() * 0.15), lean = (R() - 0.5) * 0.25;
    const top = [ox + lean * h, h, oz + lean * h * 0.5];
    tube(stem, [[ox, 0, oz], [ox + lean * h * 0.4, h * 0.5, oz], top], [r * 0.22, r * 0.18, r * 0.16], 5, (t) => 0.75 + t * 0.25, false);
    // the cap: a low dome, gills darker beneath
    const rings = [ring(7, r, top[1], a), ring(7, r * 0.8, top[1] + r * 0.32, a), ring(7, r * 0.42, top[1] + r * 0.55, a)];
    rings.forEach((rg) => rg.forEach((p) => { p[0] += top[0]; p[2] += top[2]; }));
    const peak = [top[0], top[1] + r * 0.62, top[2]], under = [top[0], top[1] - r * 0.08, top[2]];
    for (let k = 0; k < 7; k++) {
      const k1 = (k + 1) % 7;
      for (let j = 0; j < 2; j++) { cap.triOut(rings[j][k], rings[j][k1], rings[j + 1][k1], under, 0.9 + j * 0.05, 0.9 + j * 0.05, 1); cap.triOut(rings[j][k], rings[j + 1][k1], rings[j + 1][k], under, 0.9 + j * 0.05, 1, 1); }
      cap.triOut(rings[2][k], rings[2][k1], peak, under, 1, 1, 1);
      cap.triOut(rings[0][k], rings[0][k1], under, peak, 0.45, 0.45, 0.35); // gills
    }
  }
  return { stem: stem.build(), cap: cap.build() };
}

// ───────────── crystals (the enchanted wood, the grottos) ─────────────
/** A cluster of six-sided crystals with pointed tips, leaning out from one root. White: tinted and lit by their instances. */
export function crystalCluster(variant) {
  const R = mulberry32(9300 + variant * 37), b = new Builder();
  const n = 3 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const h = (i ? 0.4 : 0.9) + R() * 0.7, r = h * (0.13 + R() * 0.06), tilt = i ? 0.25 + R() * 0.55 : R() * 0.15, dir = R() * TAU;
    const ax = Math.sin(tilt) * Math.cos(dir), ay = Math.cos(tilt), az = Math.sin(tilt) * Math.sin(dir);
    const base = [Math.cos(dir) * r * 0.6 * (i ? 1 : 0), -0.05, Math.sin(dir) * r * 0.6 * (i ? 1 : 0)];
    const at = (k) => [base[0] + ax * k, base[1] + ay * k, base[2] + az * k];
    tube(b, [at(0), at(h * 0.78), at(h)], [r, r, 0.001], 6, (t) => 0.55 + t * 0.45, false);
  }
  return b.build();
}

// ───────────── cacti (the desert) ─────────────
/** A saguaro-like cactus: a ribbed trunk with up to three arms that turn upward. Green, darker in the grooves. */
export function cactus(variant) {
  const R = mulberry32(9500 + variant * 41), b = new Builder();
  const H = 2.2 + R() * 1.6, r = 0.26 + R() * 0.08, shadeAt = (t) => 0.6 + t * 0.4;
  const trunk = Array.from({ length: 6 }, (_, i) => [0, (i / 5) * H, 0]);
  tube(b, trunk, trunk.map((_, i) => r * (i === 5 ? 0.75 : 1)), 8, shadeAt);
  const arms = Math.floor(R() * 3.2);
  for (let k = 0; k < arms; k++) {
    const a = R() * TAU + k * 2.1, y0 = H * (0.32 + R() * 0.3), out = 0.45 + R() * 0.3, up = 0.6 + R() * 0.9, ra = r * (0.6 + R() * 0.15);
    const dx = Math.cos(a), dz = Math.sin(a);
    const pts = [[dx * r * 0.5, y0, dz * r * 0.5], [dx * out * 0.7, y0 + 0.05, dz * out * 0.7], [dx * out, y0 + 0.35, dz * out], [dx * out, y0 + up, dz * out]];
    tube(b, pts, [ra, ra, ra, ra * 0.8], 7, shadeAt);
  }
  return b.build();
}

// ───────────── palms (the beaches) ─────────────
/** A palm: a leaning, ringed trunk (`trunk`) and a crown of drooping fronds (`crown`, tinted by its instance). About 6-8 m. */
export function palm(variant) {
  const R = mulberry32(9900 + variant * 47), t = new Builder(), c = new Builder();
  const H = 5.2 + R() * 2.4, lean = 0.8 + R() * 1.0, la = R() * TAU, lx = Math.cos(la), lz = Math.sin(la);
  const pts = Array.from({ length: 8 }, (_, i) => { const q = i / 7; return [lx * lean * q * q, q * H, lz * lean * q * q]; });
  tube(t, pts, pts.map((_, i) => 0.2 - i * 0.014), 7, (q) => 0.62 + 0.38 * q);
  const top = pts[7], n = 7 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + R() * 0.4, dx = Math.cos(a), dz = Math.sin(a), L = 2.6 + R() * 1.0, sx = -dz, sz = dx, shade = 0.8 + R() * 0.2;
    const at = (s) => [top[0] + dx * L * s, top[1] + 0.35 * L * s - 0.95 * L * s * s, top[2] + dz * L * s];
    for (let i = 0; i < 6; i++) {
      const s0 = i / 6, s1 = (i + 1) / 6, w0 = 0.5 * Math.sin(Math.PI * Math.max(s0, 0.08)), w1 = 0.5 * Math.sin(Math.PI * s1);
      const p0 = at(s0), p1 = at(s1);
      const l0 = [p0[0] + sx * w0, p0[1] - 0.05, p0[2] + sz * w0], r0 = [p0[0] - sx * w0, p0[1] - 0.05, p0[2] - sz * w0];
      const l1 = [p1[0] + sx * w1, p1[1] - 0.05, p1[2] + sz * w1], r1 = [p1[0] - sx * w1, p1[1] - 0.05, p1[2] - sz * w1];
      c.tri(p0, l0, l1, shade, shade, shade, [0, 1, 0]); c.tri(p0, l1, p1, shade, shade, shade, [0, 1, 0]);
      c.tri(p0, p1, r1, shade * 0.9, shade * 0.9, shade * 0.9, [0, 1, 0]); c.tri(p0, r1, r0, shade * 0.9, shade * 0.9, shade * 0.9, [0, 1, 0]);
    }
  }
  return { trunk: t.build(), crown: c.build() };
}

// ───────────── the swamp's pools and lotus ─────────────
/** A flat, irregular pool of still water, about 3 m across (scaled by its instance). */
export function poolDisc(variant) {
  const R = mulberry32(9700 + variant * 43), n = 14, pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, r = 1.2 + R() * 0.5 + Math.sin(a * 3 + variant) * 0.2; pts.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
  const b = new Builder();
  for (let i = 0; i < n; i++) b.tri([0, 0, 0], pts[(i + 1) % n], pts[i], 1, 1, 1, [0, 1, 0]);
  return b.build();
}
/** A lotus: a round pad and a flower of pointed petals open on it. White petals: tinted by the instance (they glow at night). */
export function lotus(variant) {
  const R = mulberry32(9900 + variant * 47), b = new Builder(), green = [0.35, 0.55, 0.3];
  const pad = 0.38 + R() * 0.12;
  for (let i = 0; i < 10; i++) { const a0 = (i / 10) * TAU + 0.3, a1 = ((i + 1) / 10) * TAU + 0.3; b.tri([0, 0.02, 0], [Math.cos(a1) * pad, 0.02, Math.sin(a1) * pad], [Math.cos(a0) * pad, 0.02, Math.sin(a0) * pad], green, green, green, [0, 1, 0]); }
  for (const [n, len, lift, turn] of [[8, 0.2, 0.55, 0], [6, 0.15, 1.0, 0.3]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + turn, ca = Math.cos(a), sa = Math.sin(a), cl = Math.cos(lift), sl = Math.sin(lift);
      const tip = [ca * len * cl, 0.06 + len * sl, sa * len * cl], l = [-sa * 0.045, 0.06, ca * 0.045], r = [sa * 0.045, 0.06, -ca * 0.045], mid = [ca * len * 0.5 * cl, 0.06 + len * 0.5 * sl, sa * len * 0.5 * cl];
      const side = 0.06;
      b.tri(l, [mid[0] - sa * side, mid[1], mid[2] + ca * side], tip, 0.8, 0.95, 1); b.tri(r, tip, [mid[0] + sa * side, mid[1], mid[2] - ca * side], 0.8, 1, 0.95);
      b.tri(l, tip, r, 0.85, 1, 0.85);
    }
  }
  return b.build();
}

/** Merge a maker's geometry into one with an upward normal-friendly bounding box (for slot sets). */
export const ready = (g) => { g.computeBoundingSphere(); return g; };
export { THREE };
