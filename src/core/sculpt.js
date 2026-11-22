// Sculpting with distance fields. A shape is a function d(x, y, z): negative inside, positive
// outside, roughly the distance to its surface. Shapes blend with smooth unions, so separate forms
// (a cheek on a skull, a lock of hair on a scalp, a sleeve into a shoulder) melt into one soft
// surface instead of meeting at a seam. `sculpt` then turns the result into a mesh (surface nets),
// with smooth normals from the field's gradient and a colour per vertex from whichever layer of
// the sculpture is nearest. Used for the characters; anything organic can be built this way.
import * as THREE from 'three';

const { sqrt, abs, max, min } = Math;

/** Smooth minimum: like min(a, b), but rounds the crease between two shapes over a width k. */
export const smin = (a, b, k) => { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);

// ───────────── shapes ─────────────
export const sphere = (cx, cy, cz, r) => (x, y, z) => { x -= cx; y -= cy; z -= cz; return sqrt(x * x + y * y + z * z) - r; };
/** An ellipsoid with radii (rx, ry, rz). */
export function ellipsoid(cx, cy, cz, rx, ry, rz) {
  const a = 1 / (rx * rx), b = 1 / (ry * ry), c = 1 / (rz * rz), m = min(rx, ry, rz);
  return (x, y, z) => {
    x -= cx; y -= cy; z -= cz;
    const k0 = sqrt(x * x * a + y * y * b + z * z * c), k1 = sqrt(x * x * a * a + y * y * b * b + z * z * c * c);
    return k1 < 1e-9 ? -m : (k0 * (k0 - 1)) / k1;
  };
}
/** A capsule from A to B whose radius runs from ra to rb. */
export function capsule(A, B, ra, rb = ra) {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], il = 1 / (ux * ux + uy * uy + uz * uz + 1e-12);
  return (x, y, z) => {
    x -= A[0]; y -= A[1]; z -= A[2];
    let h = (x * ux + y * uy + z * uz) * il; h = h < 0 ? 0 : h > 1 ? 1 : h;
    x -= ux * h; y -= uy * h; z -= uz * h;
    return sqrt(x * x + y * y + z * z) - (ra + (rb - ra) * h);
  };
}
/** A box with half-sizes (hx, hy, hz) and edges rounded by r. */
export const rbox = (cx, cy, cz, hx, hy, hz, r = 0) => (x, y, z) => {
  const qx = abs(x - cx) - hx + r, qy = abs(y - cy) - hy + r, qz = abs(z - cz) - hz + r;
  const a = max(qx, 0), b = max(qy, 0), c = max(qz, 0);
  return sqrt(a * a + b * b + c * c) + min(max(qx, qy, qz), 0) - r;
};
/** Skip an expensive shape when the point is well outside a sphere that contains it. */
export const bounded = (f, cx, cy, cz, R, margin = 0.06) => (x, y, z) => {
  const a = x - cx, b = y - cy, c = z - cz, d = sqrt(a * a + b * b + c * c) - R;
  return d > margin ? d : f(x, y, z);
};
/**
 * A curved, tapering strand (a lock of hair, a strap, a tail) through three points: a quadratic
 * curve from A, bending toward B, ending at C, its radius easing from r0 to r1.
 */
export function strand(A, B, C, r0, r1, seg = 7) {
  const pts = [], rs = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    pts.push([a * A[0] + b * B[0] + c * C[0], a * A[1] + b * B[1] + c * C[1], a * A[2] + b * B[2] + c * C[2]]);
    rs.push(r0 + (r1 - r0) * t);
  }
  const parts = []; for (let i = 0; i < seg; i++) parts.push(capsule(pts[i], pts[i + 1], rs[i], rs[i + 1]));
  const f = (x, y, z) => { let d = parts[0](x, y, z); for (let i = 1; i < seg; i++) { const e = parts[i](x, y, z); if (e < d) d = e; } return d; };
  const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3, cz = (A[2] + B[2] + C[2]) / 3;
  let R = 0; for (const P of [A, B, C]) R = max(R, Math.hypot(P[0] - cx, P[1] - cy, P[2] - cz));
  return bounded(f, cx, cy, cz, R + max(r0, r1));
}
/** A ring (torus) lying flat round the y axis at height cy: ring radius R, thickness r. */
export const ring = (cx, cy, cz, R, r) => (x, y, z) => { const q = sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz)) - R; return sqrt(q * q + (y - cy) * (y - cy)) - r; };

// ───────────── combining ─────────────
export const union = (...f) => (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < f.length; i++) { const e = f[i](x, y, z); if (e < d) d = e; } return d; };
/** Union with the creases between shapes rounded over a width k. */
export const blend = (k, ...f) => (x, y, z) => { let d = f[0](x, y, z); for (let i = 1; i < f.length; i++) d = smin(d, f[i](x, y, z), k); return d; };
/** a with b carved out of it (the cut's edge rounded by k). */
export const carve = (a, b, k = 0) => (k ? (x, y, z) => smax(a(x, y, z), -b(x, y, z), k) : (x, y, z) => max(a(x, y, z), -b(x, y, z)));
/** Only where both a and b are. */
export const both = (a, b, k = 0) => (k ? (x, y, z) => smax(a(x, y, z), b(x, y, z), k) : (x, y, z) => max(a(x, y, z), b(x, y, z)));
/** Grow (d > 0) or shrink a shape by d. */
export const grow = (f, d) => (x, y, z) => f(x, y, z) - d;
/** The same shape on both sides: built for x >= 0, mirrored to x < 0. */
export const mirror = (f) => (x, y, z) => f(abs(x), y, z);
/** Turn a shape by (rx, ry, rz) about a pivot. */
export function turned(f, rx, ry, rz, px = 0, py = 0, pz = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).transpose().elements; // inverse rotation
  return (x, y, z) => { x -= px; y -= py; z -= pz; return f(m[0] * x + m[4] * y + m[8] * z + px, m[1] * x + m[5] * y + m[9] * z + py, m[2] * x + m[6] * y + m[10] * z + pz); };
}
/** Everything below (or with `above`, above) a plane y = h(x, z): a half-space to cut shapes with. */
export const below = (h) => (x, y, z) => y - h(x, z);
export const above = (h) => (x, y, z) => h(x, z) - y;

/** Where the surface of f is, looking from the front (+z) at (x, y); null if nothing is there. */
export function frontOf(f, x, y, z0 = 0.6, zMin = -0.2) {
  let z = z0;
  for (let i = 0; i < 80; i++) { const d = f(x, y, z); if (d < 3e-4) return z; z -= max(d * 0.85, 2e-4); if (z < zMin) return null; }
  return z;
}

// ───────────── meshing ─────────────
/**
 * Mesh a sculpture. `layers` is a list of { f, color } (colour as '#rrggbb' or a function of the
 * point returning one); the surface is their union, blended over `k`, and each vertex takes the
 * colour of its nearest layer. `box` is [x0, y0, z0, x1, y1, z1]; `n` cells span its longest side.
 * A layer's `kind` (a number, 1 if not given) goes to every vertex as `aKind`, for a material to tell
 * cloth from skin; `o.ao` (0..1) darkens the colours in creases (see creases).
 */
export function sculpt(layers, box, n = 40, k = 0.02, o = {}) {
  const fs = layers.map((l) => l.f);
  const f = fs.length === 1 ? fs[0] : (k > 0 ? blend(k, ...fs) : union(...fs));
  // (a margin of two cells all round: a surface within a cell of the box's edge would otherwise be left open)
  const h = max(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / n, x0 = box[0] - 2 * h, y0 = box[1] - 2 * h, z0 = box[2] - 2 * h;
  const nx = Math.ceil((box[3] - x0) / h) + 4, ny = Math.ceil((box[4] - y0) / h) + 4, nz = Math.ceil((box[5] - z0) / h) + 4, nxy = nx * ny;
  const g = new Float32Array(nxy * nz);
  for (let kk = 0, p = 0; kk < nz; kk++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, p++) g[p] = f(x0 + i * h, y0 + j * h, z0 + kk * h);
  // surface nets: one vertex in every cell the surface crosses, placed at the average of its edge crossings
  const vi = new Int32Array(nxy * nz).fill(-1), P = [], I = [];
  const co = [0, 1, nx, nx + 1, nxy, nxy + 1, nxy + nx, nxy + nx + 1], ox = [0, 1, 0, 1, 0, 1, 0, 1], oy = [0, 0, 1, 1, 0, 0, 1, 1], oz = [0, 0, 0, 0, 1, 1, 1, 1];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], v = new Float64Array(8);
  for (let kk = 0; kk < nz - 1; kk++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const p = i + nx * j + nxy * kk; let m = 0;
    for (let c = 0; c < 8; c++) { v[c] = g[p + co[c]]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (let e = 0; e < 12; e++) {
      const a = E[e][0], b = E[e][1]; if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += ox[a] + (ox[b] - ox[a]) * t; sy += oy[a] + (oy[b] - oy[a]) * t; sz += oz[a] + (oz[b] - oz[a]) * t; cnt++;
    }
    vi[p] = P.length / 3; P.push(x0 + (i + sx / cnt) * h, y0 + (j + sy / cnt) * h, z0 + (kk + sz / cnt) * h);
  }
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) I.push(a, d, c, a, c, b); else I.push(a, b, c, a, c, d); };
  for (let kk = 1; kk < nz - 1; kk++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const p = i + nx * j + nxy * kk, a = g[p] < 0;
    if (a !== (g[p + 1] < 0)) quad(vi[p - nx - nxy], vi[p - nxy], vi[p], vi[p - nx], !a);
    if (a !== (g[p + nx] < 0)) quad(vi[p - 1 - nxy], vi[p - nxy], vi[p], vi[p - 1], a);
    if (a !== (g[p + nxy] < 0)) quad(vi[p - 1 - nx], vi[p - nx], vi[p], vi[p - 1], !a);
  }
  // snap each vertex onto the surface, take its normal from the gradient and its colour from the nearest layer
  const pos = new Float32Array(P), nor = new Float32Array(P.length), col = new Float32Array(P.length), e = h * 0.5, C = new THREE.Color();
  const colors = layers.map((l) => (typeof l.color === 'function' ? l.color : new THREE.Color(l.color)));
  const lab = new Int32Array(P.length / 3);
  for (let q = 0; q < pos.length; q += 3) {
    let x = pos[q], y = pos[q + 1], z = pos[q + 2], gx = 0, gy = 1, gz = 0;
    for (let it = 0; it < 3; it++) {
      gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const l = sqrt(gx * gx + gy * gy + gz * gz) || 1; gx /= l; gy /= l; gz /= l;
      if (it === 2) break;
      const d = max(-h, min(h, f(x, y, z))); x -= gx * d; y -= gy * d; z -= gz * d;
    }
    pos[q] = x; pos[q + 1] = y; pos[q + 2] = z; nor[q] = gx; nor[q + 1] = gy; nor[q + 2] = gz;
    let best = 0, bd = Infinity;
    for (let i = 0; i < fs.length; i++) { const d = fs[i](x, y, z); if (d < bd) { bd = d; best = i; } }
    lab[q / 3] = best;
    const c = colors[best]; if (typeof c === 'function') C.set(c(x, y, z)); else C.copy(c);
    col[q] = C.r; col[q + 1] = C.g; col[q + 2] = C.b;
  }
  const kinds = layers.map((l) => (l.kind === undefined ? 1 : l.kind));
  if (fs.length > 1) return creases(crispColours({ f, fs, colors, kinds, pos, nor, lab, I, h }), f, o.ao);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(Float32Array.from(lab, (L) => kinds[L]), 1));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(I), 1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return creases(geo, f, o.ao);
}

/**
 * Clean edges between colours: a triangle whose corners belong to two layers is cut along the line
 * where the two layers meet (found on its edges, then laid on the surface), each side taking its own
 * colour, so a sleeve ends at its cuff on a clean line instead of fading into it across a triangle.
 * (Corners of three layers: the triangle takes its middle's.)
 */
function crispColours({ f, fs, colors, kinds, pos, nor, lab, I, h }) {
  const P = [], N = [], Cc = [], K = [], C = new THREE.Color(), e = h * 0.5;
  const colourOf = (L, x, y, z) => { const c = colors[L]; if (typeof c === 'function') C.set(c(x, y, z)); else C.copy(c); return C; };
  const put = (x, y, z, nx, ny, nz, L) => { P.push(x, y, z); N.push(nx, ny, nz); const c = colourOf(L, x, y, z); Cc.push(c.r, c.g, c.b); K.push(kinds[L]); };
  const corner = (i, L) => put(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2], L);
  // the point on edge i->j where layers A and B are equally near, laid on the surface: [x, y, z, nx, ny, nz]
  const meet = (i, j, A, B) => {
    const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2], bx = pos[j * 3], by = pos[j * 3 + 1], bz = pos[j * 3 + 2];
    let lo = 0, hi = 1;
    for (let it = 0; it < 7; it++) {
      const t = (lo + hi) / 2, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
      if (fs[A](x, y, z) - fs[B](x, y, z) < 0) lo = t; else hi = t; // (A nearer at i's end)
    }
    const t = (lo + hi) / 2;
    let x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t, gx = 0, gy = 1, gz = 0;
    for (let it = 0; it < 3; it++) {
      gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1; gx /= l; gy /= l; gz /= l;
      if (it === 2) break;
      const d = Math.max(-h, Math.min(h, f(x, y, z))); x -= gx * d; y -= gy * d; z -= gz * d;
    }
    return [x, y, z, gx, gy, gz];
  };
  const at = (q, L) => put(q[0], q[1], q[2], q[3], q[4], q[5], L);
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t], I[t + 1], I[t + 2]], L = [lab[v[0]], lab[v[1]], lab[v[2]]];
    if (L[0] === L[1] && L[1] === L[2]) { for (let k = 0; k < 3; k++) corner(v[k], L[k]); continue; }
    if (L[0] !== L[1] && L[1] !== L[2] && L[0] !== L[2]) { const mid = L[1]; for (let k = 0; k < 3; k++) corner(v[k], mid); continue; }
    // the odd corner first, keeping the triangle's turn
    const o = L[0] !== L[1] && L[0] !== L[2] ? 0 : L[1] !== L[0] && L[1] !== L[2] ? 1 : 2;
    const vo = v[o], va = v[(o + 1) % 3], vb = v[(o + 2) % 3], B = lab[vo], A = lab[va];
    const p1 = meet(va, vo, A, B), p2 = meet(vb, vo, A, B);
    corner(vo, B); at(p1, B); at(p2, B);
    at(p1, A); corner(va, A); corner(vb, A);
    at(p1, A); corner(vb, A); at(p2, A);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  geo.setAttribute('aKind', new THREE.Float32BufferAttribute(K, 1));
  const n = P.length / 3, idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

/**
 * Shade the creases into a sculpture's colours: a vertex is darkened by how much surface crowds in
 * front of it (the field, sampled a little way out along the normal, is nearer than open air would
 * be), so folds, the seam under a collar or a pocket's edge are darker without any light. `amt`: how dark.
 */
function creases(geo, f, amt = 0) {
  if (!(amt > 0)) return geo;
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array, S = [0.012, 0.03, 0.06];
  for (let q = 0; q < P.length; q += 3) {
    let a = 0;
    for (let i = 0; i < 3; i++) a += min(1, max(0, f(P[q] + N[q] * S[i], P[q + 1] + N[q + 1] * S[i], P[q + 2] + N[q + 2] * S[i]) / S[i]));
    const m = 1 - amt * (1 - a / 3);
    C[q] *= m; C[q + 1] *= m; C[q + 2] *= m;
  }
  return geo;
}
