// Hand-built detail geometry: flower heads, grass tufts and tree shapes. Everything here draws
// from its own fixed random stream, never the layout stream, so adding detail cannot move a
// single tree or flower. Vertex colours carry the shading (dark at the base, light at the tips)
// and are multiplied by each instance's colour.
import * as THREE from 'three';
import { TAU, lerp, mulberry32, hash } from '../core/math.js';
import { mergeGeos } from '../core/materials.js';

const shade = (v) => (typeof v === 'number' ? [v, v, v] : v);

export class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; }
  /** One triangle. `nrm` overrides the face normal (flat leaves and petals use an upward one). */
  tri(a, b, c, ca = 1, cb = ca, cc = ca, nrm = null) {
    let n = nrm;
    if (!n) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
    }
    this.p.push(...a, ...b, ...c); this.n.push(...n, ...n, ...n); this.c.push(...shade(ca), ...shade(cb), ...shade(cc));
  }
  /** A triangle wound so that it faces away from `inside`. */
  triOut(a, b, c, inside, ca = 1, cb = ca, cc = ca) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0] + b[0] + c[0]) / 3 - inside[0], my = (a[1] + b[1] + c[1]) / 3 - inside[1], mz = (a[2] + b[2] + c[2]) / 3 - inside[2];
    if (nx * mx + ny * my + nz * mz < 0) this.tri(a, c, b, ca, cc, cb); else this.tri(a, b, c, ca, cb, cc);
  }
  /** A flat four-cornered leaf or petal: a, b, c, d in order around the edge. */
  quad(a, b, c, d, ca, cb, cc, cd, nrm) { this.tri(a, b, c, ca, cb, cc, nrm); this.tri(a, c, d, ca, cc, cd, nrm); }
  /** Copy a three.js solid in, colouring each corner with `colorFn(x, y, z)` and moving it with `move`. */
  solid(geo, colorFn = () => 1, move = null) {
    const g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position;
    const v = (i) => { const q = [pos.getX(i), pos.getY(i), pos.getZ(i)]; return move ? move(q) : q; };
    for (let i = 0; i < pos.count; i += 3) {
      const a = v(i), b = v(i + 1), c = v(i + 2);
      this.tri(a, b, c, colorFn(...a), colorFn(...b), colorFn(...c));
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

// a point at angle `a`, distance `r` from the stem, height `y`, shifted `side` across the petal
const polar = (a, r, y, side = 0) => [Math.cos(a) * r - Math.sin(a) * side, y, Math.sin(a) * r + Math.cos(a) * side];
const upOut = (a, out) => { const l = Math.hypot(out, 1); return [Math.cos(a) * out / l, 1 / l, Math.sin(a) * out / l]; };

// ───────────────────────── flowers ─────────────────────────
export const STEM_H = 0.38;
export const FLOWER_KINDS = ['daisy', 'tulip', 'poppy', 'lavender', 'allium'];
/** Colour of the centre disc for the kinds that have one. */
export const FLOWER_CENTRE = { daisy: '#f2c230', poppy: '#2b2320' };

function daisy() {
  const b = new Builder(), n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, lift = i % 2 ? 0.008 : 0, len = i % 2 ? 0.105 : 0.118;
    b.quad(polar(a, 0.02, lift), polar(a, 0.07, 0.014 + lift, -0.021), polar(a, len, 0.006 + lift), polar(a, 0.07, 0.014 + lift, 0.021), 0.78, 1, 1.1, 1, upOut(a, 0.3));
  }
  return b.build().translate(0, STEM_H, 0);
}
function tulip() {
  const b = new Builder();
  for (let i = 0; i < 6; i++) {
    const inner = i % 2, a = (i / 6) * TAU, w = inner ? 0.026 : 0.034, top = inner ? 0.135 : 0.12;
    const base = polar(a, 0.01, 0), l = polar(a, inner ? 0.036 : 0.048, 0.06, -w), r = polar(a, inner ? 0.036 : 0.048, 0.06, w), tip = polar(a, inner ? 0.022 : 0.034, top);
    b.quad(base, l, tip, r, 0.62, 0.95, 1.12, 0.95, upOut(a, 1.1));
  }
  return b.build().translate(0, STEM_H, 0);
}
function poppy() {
  const b = new Builder();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.2, lift = i % 2 ? 0.01 : 0;
    b.quad(polar(a, 0.012, lift), polar(a, 0.078, 0.034 + lift, -0.058), polar(a, 0.125, 0.052 + lift), polar(a, 0.078, 0.034 + lift, 0.058), 0.6, 0.95, 1.08, 0.95, upOut(a, 0.45));
  }
  return b.build().translate(0, STEM_H, 0);
}
function lavender() {
  const b = new Builder();
  const bud = new THREE.OctahedronGeometry(0.024, 0).scale(1, 1.35, 1);
  for (let i = 0; i < 8; i++) {
    const f = i / 7, a = i * 2.4, r = lerp(0.024, 0.006, f), y = lerp(-0.13, 0.07, f), s = lerp(1.1, 0.6, f);
    b.solid(bud, () => lerp(0.8, 1.15, f), (q) => [q[0] * s + Math.cos(a) * r, q[1] * s + y, q[2] * s + Math.sin(a) * r]);
  }
  return b.build().translate(0, STEM_H, 0);
}
function allium() {
  const b = new Builder();
  const ball = new THREE.IcosahedronGeometry(0.075, 1);
  b.solid(ball, (x, y) => lerp(0.72, 1.14, (y + 0.075) / 0.15), (q) => { const k = 0.82 + 0.36 * hash(Math.round(q[0] * 900) + 31, Math.round(q[1] * 900 + q[2] * 3100)); return [q[0] * k, q[1] * k + 0.05, q[2] * k]; });
  return b.build().translate(0, STEM_H, 0);
}
export function flowerHeadGeos() { return [daisy(), tulip(), poppy(), lavender(), allium()]; }
export function flowerCentreGeo() { return new THREE.IcosahedronGeometry(0.03, 0).scale(1, 0.6, 1).translate(0, STEM_H + 0.012, 0); }

export function flowerStemGeo() {
  const b = new Builder();
  b.solid(new THREE.CylinderGeometry(0.01, 0.015, STEM_H, 4, 1, true).translate(0, STEM_H / 2, 0), () => 0.9);
  const leaf = (a, y, len, w, rise) => b.quad([0, y, 0], polar(a, len * 0.45, y + rise * 0.6, -w), polar(a, len, y + rise), polar(a, len * 0.45, y + rise * 0.6, w), 0.85, 1.1, 1.25, 1.1, upOut(a, 0.5));
  leaf(0.6, 0.05, 0.15, 0.028, 0.09);
  leaf(0.6 + Math.PI * 0.9, 0.1, 0.12, 0.024, 0.08);
  leaf(0.6 + Math.PI * 1.5, 0.02, 0.1, 0.022, 0.05);
  return b.build();
}

// ───────────────────────── grass ─────────────────────────
function blade(b, R, a, ox, oz, h, w, bend, tint = 1) {
  const ux = Math.cos(a), uz = Math.sin(a), vx = -Math.sin(a), vz = Math.cos(a);
  const ts = [0, 0.38, 0.72, 1], ws = [1, 0.8, 0.5, 0], sh = [0.5, 0.74, 0.96, 1.22];
  const pt = (k, side) => { const t = ts[k], off = bend * t * t, hw = (w * ws[k]) / 2 * side; return [ox + vx * off + ux * hw, h * t * (1 - Math.abs(bend) * 0.5 * t), oz + vz * off + uz * hw]; };
  const up = [0, 1, 0], c = (k) => (typeof tint === 'number' ? sh[k] * tint : tint.map((x) => x * sh[k]));
  for (let k = 0; k < 2; k++) b.quad(pt(k, -1), pt(k, 1), pt(k + 1, 1), pt(k + 1, -1), c(k), c(k), c(k + 1), c(k + 1), up);
  b.tri(pt(2, -1), pt(2, 1), pt(3, 0), c(2), c(2), c(3), up);
}
/** Three kinds of tuft: an upright clump, a low splayed clump and one with a seed stalk. */
export function grassTuftGeos() {
  const R = mulberry32(4117), r = (a, b2) => a + (b2 - a) * R();
  const upright = new Builder();
  for (let i = 0; i < 4; i++) blade(upright, R, (i / 4) * Math.PI + r(-0.3, 0.3), r(-0.1, 0.1), r(-0.1, 0.1), r(0.42, 0.68), r(0.1, 0.13), r(-0.14, 0.14));
  const low = new Builder();
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + r(-0.3, 0.3); blade(low, R, a + Math.PI / 2, Math.cos(a) * 0.05, Math.sin(a) * 0.05, r(0.24, 0.4), r(0.12, 0.16), r(0.16, 0.3) * (Math.sin(a * 7) > 0 ? 1 : -1)); }
  const seed = new Builder();
  for (let i = 0; i < 3; i++) blade(seed, R, (i / 3) * Math.PI + r(-0.3, 0.3), r(-0.1, 0.1), r(-0.1, 0.1), r(0.38, 0.58), r(0.1, 0.13), r(-0.14, 0.14));
  blade(seed, R, 0.4, 0, 0, 0.74, 0.035, 0.1, [1.25, 1.15, 1.0]);
  const tan = [1.75, 1.25, 1.15];
  for (let i = 0; i < 4; i++) {
    const y = 0.6 + i * 0.045, a = i * 2.2, x = -Math.sin(0.4) * 0.1 * ((y / 0.74) ** 2), z = Math.cos(0.4) * 0.1 * ((y / 0.74) ** 2);
    seed.quad([x, y, z], polar(a, 0.03, y + 0.03, -0.014).map((q, k) => q + (k === 0 ? x : k === 2 ? z : 0)), polar(a, 0.045, y + 0.075).map((q, k) => q + (k === 0 ? x : k === 2 ? z : 0)), polar(a, 0.03, y + 0.03, 0.014).map((q, k) => q + (k === 0 ? x : k === 2 ? z : 0)), tan, tan, tan, tan, [0, 1, 0]);
  }
  return [upright.build(), low.build(), seed.build()];
}

// ───────────────────────── trees ─────────────────────────
function limb(from, to, r0, r1, sides = 5) {
  const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides).translate(0, len / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
  return g.translate(from[0], from[1], from[2]);
}

const PINES = [
  { tiers: 6, bottom: 1.25, width: 1.0, top: 5.3 },
  { tiers: 7, bottom: 1.5, width: 0.82, top: 5.7 },
  { tiers: 5, bottom: 1.05, width: 1.08, top: 4.9 },
];
/** Layered boughs with ragged, drooping tips; lighter at the tips, dark underneath. */
function pineTop(v, seed) {
  const R = mulberry32(seed), b = new Builder(), n = 8;
  for (let k = 0; k < v.tiers; k++) {
    const f = k / (v.tiers - 1), y0 = lerp(v.bottom, v.top - 0.95, f), rad = lerp(1.62 * v.width, 0.42, f ** 0.85), ht = lerp(1.55, 0.95, f);
    const rot = R() * TAU, apex = [(R() - 0.5) * 0.08, y0 + ht, (R() - 0.5) * 0.08], inside = [0, y0 + ht * 0.35, 0], under = [0, y0 + 0.22, 0];
    const ring = [];
    for (let j = 0; j < n * 2; j++) {
      const long = j % 2 === 0, a = (j / (n * 2)) * TAU + rot, rr = rad * (long ? 0.92 + R() * 0.2 : 0.6 + R() * 0.12);
      ring.push({ p: [Math.cos(a) * rr, y0 - (long ? 0.2 + R() * 0.14 : 0) * (rad / 1.6), Math.sin(a) * rr], c: long ? 1.14 : 0.9 });
    }
    for (let j = 0; j < ring.length; j++) {
      const p = ring[j], q = ring[(j + 1) % ring.length];
      b.triOut(apex, p.p, q.p, inside, 0.8, p.c, q.c);
      b.triOut(under, p.p, q.p, inside, 0.5, 0.62, 0.62);
    }
  }
  return b.build();
}
function pineTrunk(v, seed) {
  const R = mulberry32(seed + 9), parts = [limb([0, 0, 0], [0, v.top - 0.9, 0], 0.25, 0.06, 6), new THREE.CylinderGeometry(0.25, 0.38, 0.4, 6).translate(0, 0.2, 0)];
  for (let i = 0; i < 3; i++) { const a = R() * TAU, y = 0.6 + R() * (v.bottom - 0.5), l = 0.35 + R() * 0.35; parts.push(limb([0, y, 0], [Math.cos(a) * l, y + 0.08, Math.sin(a) * l], 0.05, 0.02, 4)); }
  return mergeGeos(parts);
}
export function pineGeos() { return PINES.map((v, i) => ({ top: pineTop(v, 300 + i * 17), trunk: pineTrunk(v, 300 + i * 17) })); }

// each crown is a cluster of knobbly balls; [x, y, z, radius]
const CROWNS = [
  { trunk: 2.3, blobs: [[0, 3.35, 0, 1.5], [1.05, 2.95, 0.45, 1.15], [-0.95, 3.05, -0.35, 1.1], [0.15, 4.25, 0.2, 1.0], [-0.3, 3.0, 1.0, 0.95], [0.4, 3.1, -1.05, 0.9], [-0.75, 3.95, 0.35, 0.75]] },
  { trunk: 2.6, blobs: [[0, 3.3, 0, 1.2], [0.25, 4.3, 0.1, 1.05], [-0.1, 5.15, -0.1, 0.8], [0.7, 3.2, -0.4, 0.8], [-0.65, 3.5, 0.45, 0.85], [0.1, 2.8, 0.75, 0.7]] },
  { trunk: 2.0, blobs: [[0, 3.0, 0, 1.35], [1.45, 2.85, 0.2, 1.05], [-1.4, 2.95, -0.25, 1.0], [0.3, 2.9, 1.35, 0.95], [-0.2, 2.95, -1.4, 0.95], [0.75, 3.75, -0.35, 0.9], [-0.7, 3.7, 0.45, 0.85], [1.0, 2.6, -1.0, 0.7]] },
];
function crownTop(v, seed) {
  const b = new Builder();
  let lo = Infinity, hi = -Infinity;
  v.blobs.forEach(([, y, , r]) => { lo = Math.min(lo, y - r * 0.85); hi = Math.max(hi, y + r * 0.85); });
  v.blobs.forEach(([x, y, z, r], i) => {
    const tone = 0.95 + 0.1 * hash(seed + i, 5);
    const move = (q) => { const k = 0.84 + 0.32 * hash(Math.round(q[0] * 700) + seed + i * 13, Math.round(q[1] * 700 + q[2] * 2300)); return [q[0] * k + x, q[1] * k * 0.86 + y, q[2] * k + z]; };
    b.solid(new THREE.IcosahedronGeometry(r, r >= 1.1 ? 1 : 0), (px, py) => lerp(0.68, 1.14, (py - lo) / (hi - lo)) * tone, move);
  });
  return b.build();
}
function crownTrunk(v) {
  const parts = [limb([0, 0, 0], [0, v.trunk + 0.5, 0], 0.3, 0.17, 6), new THREE.CylinderGeometry(0.3, 0.45, 0.4, 6).translate(0, 0.2, 0)];
  v.blobs.slice(1, 5).forEach(([x, y, z], i) => parts.push(limb([0, v.trunk - 0.35 + i * 0.15, 0], [x * 0.8, y - 0.25, z * 0.8], 0.11, 0.05, 4)));
  return mergeGeos(parts);
}
export function crownGeos() { return CROWNS.map((v, i) => ({ top: crownTop(v, 500 + i * 29), trunk: crownTrunk(v) })); }

/** A stable pick in 0..n-1 for something standing at (x, z). */
export const variantAt = (x, z, n, salt = 0) => Math.min(n - 1, Math.floor(hash(Math.round(x * 13) + salt, Math.round(z * 13) - salt) * n));

// ───────────── simple far shapes (same size and colouring, a fraction of the triangles) ─────────────
export function pineFarGeos() {
  return PINES.map((v) => {
    const b = new Builder(), H = v.top - v.bottom;
    [[v.bottom - 0.25, v.bottom + H * 0.55, 1.62 * v.width], [v.bottom + H * 0.3, v.bottom + H * 0.8, 1.15 * v.width], [v.bottom + H * 0.6, v.top, 0.72]].forEach(([y0, y1, r]) => {
      b.solid(new THREE.ConeGeometry(r, y1 - y0, 7).translate(0, (y0 + y1) / 2, 0), (x, y) => (y < y0 + 0.01 ? 0.55 : lerp(0.8, 1.1, Math.hypot(x, 0) / r)));
    });
    return b.build();
  });
}
export function crownFarGeos() {
  return CROWNS.map((v) => {
    const b = new Builder();
    let lo = Infinity, hi = -Infinity;
    v.blobs.forEach(([, y, , r]) => { lo = Math.min(lo, y - r * 0.85); hi = Math.max(hi, y + r * 0.85); });
    v.blobs.slice().sort((p, q) => q[3] - p[3]).slice(0, 4).forEach(([x, y, z, r]) => {
      b.solid(new THREE.IcosahedronGeometry(r * 1.05, 0).scale(1, 0.86, 1).translate(x, y, z), (px, py) => lerp(0.68, 1.14, (py - lo) / (hi - lo)));
    });
    return b.build();
  });
}
export function pineTrunkFarGeos() { return PINES.map((v) => new THREE.CylinderGeometry(0.06, 0.27, v.top - 0.9, 5).translate(0, (v.top - 0.9) / 2, 0)); }
export function crownTrunkFarGeos() { return CROWNS.map((v) => new THREE.CylinderGeometry(0.17, 0.32, v.trunk + 0.5, 5).translate(0, (v.trunk + 0.5) / 2, 0)); }
