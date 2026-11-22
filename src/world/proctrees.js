// Trees grown from code instead of loaded from model files. Each one is a branching skeleton
// (tapering tubes for the wood) with leaf cards at the twig ends; the cards carry an atlas of
// leaf clusters painted on a canvas at load. The output keeps the loaded kit's contract, so
// placement, wind, seasons, far versions and impostors all work unchanged:
//   models[name] = { <Family>_Bark: geometry, <Family>_Leaves: geometry }
//   indexed; every leaf card and every branch is its own connected piece (far trees thin by piece);
//   leaf atlases are grey with alpha (each tree's colour comes from the seasons, per instance);
//   leaf vertex colours carry the shade inside the crown, leaf normals point out of the crown.
// Each tree draws from its own seeded stream, so nothing here touches the world's layout.
import * as THREE from 'three';
import { TAU, lerp, clamp, mulberry32 } from '../core/math.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ───────────── geometry ─────────────
class Mesh {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  vert(p, n, u, v, c) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u, v); this.c.push(c, c, c);
    return this.p.length / 3 - 1;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/** A unit vector at angle `a` round the plane square to `d`. */
function perp(d, a, out = V()) {
  const u = Math.abs(d.y) < 0.9 ? UP : V(1, 0, 0);
  const x = V().crossVectors(d, u).normalize(), y = V().crossVectors(d, x);
  return out.copy(x).multiplyScalar(Math.cos(a)).addScaledVector(y, Math.sin(a));
}

/** A tapering tube along `pts`; u goes round (`wrap` times), v runs along at `vPerM` per metre. */
function tube(m, pts, radii, sides, shade, wrap, vPerM) {
  const n = pts.length, T = V(), N = V(0.31, 0.2, 0.93), B = V(), dir = V(), pos = V();
  const base = m.p.length / 3;
  let along = 0;
  for (let i = 0; i < n; i++) {
    T.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-6) perp(T, 0, N); N.normalize();   // carried along, so the bark doesn't twist
    B.crossVectors(T, N);
    if (i > 0) along += pts[i].distanceTo(pts[i - 1]);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * TAU;
      dir.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.copy(pts[i]).addScaledVector(dir, radii[i]);
      m.vert(pos, dir, (j / sides) * wrap, along * vPerM, shade(pts[i], i / (n - 1)));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
    const a = base + i * (sides + 1) + j, b = a + sides + 1;
    m.i.push(a, a + 1, b, b, a + 1, b + 1); // wound so the outside is the front face
  }
}

// ───────────── the skeleton ─────────────
/**
 * Grow a tree: a trunk, optional limbs where it forks, and side branches down to `P.depth`.
 * Returns the branches (as polylines with radii) and the twig sites where leaves go.
 */
function grow(r, P) {
  const branches = [], sites = [];
  function branch(p0, d0, len, rad, depth) {
    const n = Math.max(3, Math.round(len / P.step)), pts = [p0.clone()], radii = [rad], d = d0.clone();
    let p = p0.clone();
    const w = P.wiggle[depth], rise = P.rise[depth];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      d.x += (r() - 0.5) * w; d.z += (r() - 0.5) * w; d.y += rise + (r() - 0.5) * w * 0.4; d.normalize();
      p = p.clone().addScaledVector(d, len / n);
      pts.push(p); radii.push(rad * (1 - P.taper * t));
      if (depth < P.depth && t >= P.sideFrom[depth] && t < 0.96 && r() < P.side[depth]) {
        const sd = perp(d, r() * TAU), ang = P.sideAngle[depth] * (0.8 + 0.4 * r());
        const cd = d.clone().multiplyScalar(Math.cos(ang)).addScaledVector(sd, Math.sin(ang)).normalize();
        if (depth === 0) cd.y = Math.max(cd.y, P.minRise); cd.normalize();
        branch(p, cd, len * P.sideLen[depth] * (1 - P.shorten * t) * (0.8 + 0.4 * r()), radii[i] * 0.62, depth + 1);
      }
      if ((depth >= P.leafDepth && t > P.leafFrom) || (depth === 0 && P.topLeaves && t > P.topLeaves)) sites.push({ p: p.clone(), d: d.clone(), depth });
    }
    if (depth === 0 && P.limbs) {
      const a0 = r() * TAU;
      for (let k = 0; k < P.limbs; k++) {
        const az = a0 + (k / P.limbs) * TAU + (r() - 0.5) * 0.6, ang = P.limbAngle * (0.8 + 0.4 * r());
        const cd = UP.clone().multiplyScalar(Math.cos(ang)).addScaledVector(perp(UP, az), Math.sin(ang)).normalize();
        branch(p, cd, P.limbLen * (0.8 + 0.35 * r()), rad * (1 - P.taper) * 1.25, 1);
      }
    }
    if (depth >= P.leafDepth - 1) sites.push({ p: p.clone(), d: d.clone(), depth, end: true });
    branches.push({ pts, radii, depth });
  }
  const lean = V((r() - 0.5) * P.lean, 1, (r() - 0.5) * P.lean).normalize();
  branch(V(0, -0.3, 0), lean, P.trunk, P.radius, 0);
  return { branches, sites };
}

// ───────────── leaves ─────────────
/**
 * Leaf cards at the twig sites: each card's foot sits at its twig and it reaches outward and up,
 * tilted toward the sky. Its normals point out of the crown (so the crown lights as one soft
 * mass) and its vertex colour is the shade from the cards above it.
 */
function crown(r, P, sites) {
  // leaf clusters ("blobs") at the branch ends, each a rounded mass of cards laid over its surface
  // and facing out of it: the crown reads as a few soft, rounded masses rather than loose cards
  const ends = sites.filter((s) => s.end), rest = sites.filter((s) => !s.end);
  for (const l of [ends, rest]) for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; }
  const seeds = sites.filter((s) => s.keep).concat(ends.concat(rest).filter((s) => !s.keep)).slice(0, P.blobs);
  const centre = V(); seeds.forEach((s) => centre.add(s.p)); centre.divideScalar(Math.max(1, seeds.length));
  let R = 0.1; seeds.forEach((s) => { R = Math.max(R, s.p.distanceTo(centre)); });
  const quads = [], dir = V();
  let y0 = Infinity, y1 = -Infinity; seeds.forEach((s) => { y0 = Math.min(y0, s.p.y); y1 = Math.max(y1, s.p.y); });
  for (const s of seeds) {
    const up = P.coneBlobs ? clamp((s.p.y - y0) / Math.max(0.1, y1 - y0), 0, 1) : 0;
    const rb = P.blob * (0.75 + 0.5 * r()) * (P.coneBlobs ? lerp(1.2, 0.55, up) : 1);
    const bc = V().copy(s.p).addScaledVector(V().subVectors(s.p, centre).normalize(), rb * 0.35);
    const n = Math.round(P.perBlob * (rb / P.blob) ** 2);
    for (let k = 0; k < n; k++) {
      // spread evenly over the sphere (golden spiral), jittered; fewer underneath
      const y = 1 - 2 * (k + 0.5) / n, rr = Math.sqrt(1 - y * y), th = k * 2.39996 + r() * 0.6;
      dir.set(Math.cos(th) * rr, y, Math.sin(th) * rr).normalize();
      if (dir.y < -0.55 && r() < 0.6) continue;
      const mid = V().copy(bc).addScaledVector(dir, rb * (0.72 + 0.2 * r()));
      const nrm = V().copy(dir).addScaledVector(V(r() - 0.5, r() - 0.5, r() - 0.5), P.scatter).normalize();
      const along = perp(nrm, r() * TAU), side = V().crossVectors(along, nrm).normalize();
      const L = P.leaf * (0.8 + 0.4 * r()), W = L * (0.9 + 0.2 * r());
      quads.push({ foot: V().copy(mid).addScaledVector(along, -L * 0.5), along, side, L, W, droop: 0, cell: Math.floor(r() * 4), mid, bc });
    }
  }
  // shade inside the crown: how much leaf hangs above each card, and how deep in it sits
  quads.forEach((q) => {
    let over = 0;
    for (const o of quads) { const dy = o.mid.y - q.mid.y; if (dy > 0.5 && Math.hypot(o.mid.x - q.mid.x, o.mid.z - q.mid.z) < 0.5 + dy * 0.25) over++; }
    const depth = q.mid.distanceTo(centre) / R;
    q.shade = clamp((0.62 + 0.38 / (1 + 0.06 * over)) * lerp(0.82, 1.06, clamp(depth, 0, 1)), 0.55, 1);
  });
  const m = new Mesh(), c = V(), n = V();
  const soft = (p, bc) => n.subVectors(p, bc).normalize().multiplyScalar(0.65).add(V().subVectors(p, centre).normalize().multiplyScalar(0.35)).add(V(0, 0.35, 0)).normalize();
  for (const q of quads) {
    const cx = (q.cell % 2) * 0.5, cy = Math.floor(q.cell / 2) * 0.5, hw = q.W / 2;
    const corners = [[-hw, 0, cx, cy + 0.5], [hw, 0, cx + 0.5, cy + 0.5], [hw, q.L, cx + 0.5, cy], [-hw, q.L, cx, cy]];
    const ids = corners.map(([x, y, u, v]) => {
      c.copy(q.foot).addScaledVector(q.side, x).addScaledVector(q.along, y);
      if (y > 0) c.y -= q.droop;
      return m.vert(c, soft(c, q.bc), u, v, q.shade);
    });
    // wind the card so its front face looks out of the crown, the way its normals do: seen from
    // behind, a double-sided card turns its normals round, and an inward one would light it dark
    const face = V().crossVectors(q.side, q.along), outward = V().subVectors(q.mid, q.bc).dot(face) >= 0;
    if (outward) m.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    else m.i.push(ids[0], ids[2], ids[1], ids[0], ids[3], ids[2]);
  }
  return m.geometry();
}

// ───────────── painted textures ─────────────
/** A canvas painted by `draw`, turned into a texture whose empty texels carry leaf grey (no dark mip fringes). */
function leafAtlas(size, draw, bleed = [196, 196, 196], toGrey = false) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const x = cv.getContext('2d', { willReadFrequently: true });
  draw(x, size);
  const img = x.getImageData(0, 0, size, size), d = img.data;
  if (toGrey) for (let i = 0; i < d.length; i += 4) { const l = Math.min(255, 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] + 40); d[i] = d[i + 1] = d[i + 2] = l; }
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 10) { d[i] = bleed[0]; d[i + 1] = bleed[1]; d[i + 2] = bleed[2]; d[i + 3] = 0; }
  const t = new THREE.DataTexture(new Uint8Array(d.buffer.slice(0)), size, size, THREE.RGBAFormat);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4; t.flipY = false; t.needsUpdate = true;
  return t;
}
function barkTexture(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.flipY = false;
  return t;
}
const grey = (v) => { const k = clamp(Math.round(v), 0, 255); return `rgb(${k},${k},${k})`; };

/** One leaf, drawn pointing up the canvas from its stalk at (0, 0), `len` long. */
const LEAF = {
  // a broad leaf with five pointed lobes
  palm(x, len) {
    const lobes = [[0, 1, 0.34], [0.95, 0.82, 0.3], [-0.95, 0.82, 0.3], [1.85, 0.5, 0.24], [-1.85, 0.5, 0.24]];
    x.beginPath();
    lobes.forEach(([a, l, w]) => {
      const tip = [Math.sin(a) * len * l, -Math.cos(a) * len * l], sa = Math.sin(a + 1.5708), ca = -Math.cos(a + 1.5708);
      x.moveTo(0, 0);
      x.quadraticCurveTo(tip[0] * 0.5 + sa * len * w, tip[1] * 0.5 + ca * len * w, tip[0], tip[1]);
      x.quadraticCurveTo(tip[0] * 0.5 - sa * len * w, tip[1] * 0.5 - ca * len * w, 0, 0);
    });
    x.fill();
  },
  // a pointed oval
  oval(x, len, wide = 0.42) {
    x.beginPath(); x.moveTo(0, 0);
    x.bezierCurveTo(len * wide, -len * 0.2, len * wide * 0.8, -len * 0.75, 0, -len);
    x.bezierCurveTo(-len * wide * 0.8, -len * 0.75, -len * wide, -len * 0.2, 0, 0);
    x.fill();
  },
};

/**
 * A cluster of leaves in one atlas cell: a twig up the middle with side twigs, leaves at every node,
 * lighter toward the top and the rim of the cluster. The cell's bottom edge is the twig's foot.
 */
function cluster(x, ox, oy, S, r, o) {
  const twig = (a, b, wdt) => { if (!o.twigs) return; x.strokeStyle = grey(120); x.lineWidth = wdt; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
  const leaves = [];
  const bend = (r() - 0.5) * 0.25, spine = (t) => [ox + S * (0.5 + bend * Math.sin(t * 2.5)), oy + S * (0.98 - 0.86 * t)];
  let prev = spine(0);
  for (let i = 1; i <= 16; i++) { const p = spine(i / 16); twig(prev, p, S * (0.02 - 0.012 * i / 16)); prev = p; }
  for (let i = 0; i < o.nodes; i++) {
    const t = 0.12 + 0.88 * (i / (o.nodes - 1)), p = spine(t), sd = i % 2 ? 1 : -1;
    const a = sd * (0.7 + 0.5 * r()) + bend, L = S * o.reach * (1 - 0.45 * t) * (0.7 + 0.5 * r());
    let pp = p;
    for (let k = 1; k <= 4; k++) {
      const e = [p[0] + Math.sin(a) * L * (k / 4), p[1] - Math.cos(a) * L * (k / 4)];
      twig(pp, e, S * 0.008); pp = e;
      leaves.push([e[0], e[1], a + 0.9 + r() * 0.5], [e[0], e[1], a - 0.9 - r() * 0.5]);
      if (k === 4) leaves.push([e[0], e[1], a]);
    }
    leaves.push([p[0], p[1], sd * (0.9 + 0.5 * r())]);
  }
  leaves.push([...spine(1), (r() - 0.5) * 0.4]);
  // fill in: more leaves inside the spray's teardrop outline, so the cell reads as a leafy mass
  for (let i = 0; i < o.fill; i++) {
    const t = Math.pow(r(), 0.8), sp = spine(t), half = S * o.reach * 1.05 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (1 - 0.35 * t);
    leaves.push([sp[0] + (r() * 2 - 1) * half, sp[1] + (r() - 0.5) * S * 0.06, (r() - 0.5) * 2.6]);
  }
  for (let i = leaves.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = leaves[i]; leaves[i] = leaves[j]; leaves[j] = t; }
  for (const [lx, ly, a] of leaves) {
    const len = S * o.size * (0.8 + 0.45 * r());
    const rim = Math.hypot((lx - ox) / S - 0.5, (ly - oy) / S - 0.55) * 2, high = 1 - (ly - oy) / S;
    const v = 170 + 70 * r() + 16 * rim + 12 * high;
    x.save(); x.translate(clamp(lx, ox + len, ox + S - len), clamp(ly, oy + len, oy + S - 2)); x.rotate(a);
    const g = x.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, grey(v * 0.82)); g.addColorStop(1, grey(v));
    x.fillStyle = g;
    LEAF[o.shape](x, len, o.wide);
    x.strokeStyle = grey(v * 0.8); x.lineWidth = Math.max(1, len * 0.05); x.stroke();                    // a darker rim keeps the leaves apart
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -len * 0.75); x.stroke();
    x.restore();
  }
}

/** Furrowed bark: vertical ridges of varying darkness over a base colour, and a few cross cracks. */
function furrowed(base, dark, seed) {
  return (x, w, h) => {
    const r = mulberry32(seed);
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const cx = r() * w, len = h * (0.1 + 0.4 * r()), y0 = r() * h, wd = 1 + r() * 4;
      x.strokeStyle = r() < 0.6 ? dark : 'rgba(255,255,255,0.08)'; x.lineWidth = wd; x.globalAlpha = 0.25 + 0.5 * r();
      x.beginPath(); x.moveTo(cx, y0);
      for (let k = 1; k <= 6; k++) x.lineTo(cx + (r() - 0.5) * 6, y0 + (len * k) / 6);
      x.stroke();
      [cx - w, cx + w].forEach((xx) => { x.beginPath(); x.moveTo(xx, y0); x.lineTo(xx, y0 + len); x.stroke(); }); // wraps round the trunk
    }
    x.globalAlpha = 1;
  };
}
/** Birch: chalk white, dark horizontal lenticels and a few black scars. */
function birchBark(seed) {
  return (x, w, h) => {
    const r = mulberry32(seed);
    x.fillStyle = '#d8d3c8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(150,140,125,${0.08 + 0.12 * r()})`; x.fillRect(0, r() * h, w, 2 + r() * 10); }
    for (let i = 0; i < 180; i++) { x.fillStyle = `rgba(40,34,30,${0.35 + 0.5 * r()})`; const y = r() * h, cx = r() * w, l = 4 + r() * 22; x.fillRect(cx, y, l, 1 + r() * 2.5); x.fillRect(cx - w, y, l, 1 + r() * 2.5); }
    for (let i = 0; i < 9; i++) {
      const cx = r() * w, cy = r() * h, s = 6 + r() * 16;
      x.fillStyle = 'rgba(28,24,22,0.85)'; x.beginPath(); x.moveTo(cx - s, cy); x.lineTo(cx, cy - s * 0.45); x.lineTo(cx + s, cy); x.lineTo(cx, cy + s * 0.45); x.fill();
    }
  };
}

// ───────────── the families ─────────────
// Proportions only: the meadow scales each model to its family's height when it plants it.
const FAMILIES = {
  // broad and spreading: a short trunk forking into a few big limbs
  MapleTree: {
    seed: 4100, trunk: 2.3, radius: 0.24, lean: 0.25, limbs: 4, limbAngle: 0.78, limbLen: 3.6, step: 0.42, taper: 0.62,
    depth: 3, side: [0.12, 0.55, 0.5], sideFrom: [0.5, 0.15, 0.1], sideAngle: [0.9, 0.85, 0.8], sideLen: [0.5, 0.55, 0.5], shorten: 0.5,
    wiggle: [0.22, 0.3, 0.42, 0.5], rise: [0.02, -0.01, 0.0, 0.0], minRise: 0.2, leafDepth: 1, leafFrom: 0.45,
    blobs: 16, blob: 1.2, perBlob: 26, leaf: 0.95, scatter: 0.8, jitter: 0.35, roll: 0.6,
    leaves: { shape: 'palm', size: 0.13, nodes: 8, reach: 0.42, fill: 70 }, bark: furrowed('#857a72', 'rgba(45,38,34,0.75)', 41),
  },
  // tall and slender, the leader running to the top, short side branches that droop at the tips
  BirchTree: {
    seed: 5200, trunk: 6.8, radius: 0.15, lean: 0.18, limbs: 0, step: 0.4, taper: 0.85,
    depth: 2, side: [0.75, 0.55], sideFrom: [0.3, 0.15], sideAngle: [1.0, 0.75], sideLen: [0.42, 0.55], shorten: 0.75,
    wiggle: [0.06, 0.32, 0.45], rise: [0.03, -0.03, -0.045], minRise: 0.22, leafDepth: 1, leafFrom: 0.2, topLeaves: 0.55,
    blobs: 18, blob: 0.8, perBlob: 16, leaf: 0.7, scatter: 0.8, jitter: 0.3, roll: 0.4,
    leaves: { shape: 'oval', wide: 0.5, size: 0.1, nodes: 9, reach: 0.38, fill: 80 }, bark: birchBark(52),
  },
  // a rounded crown: a leader with limbs round it
  NormalTree: {
    seed: 6300, trunk: 3.0, radius: 0.2, lean: 0.22, limbs: 3, limbAngle: 0.62, limbLen: 2.8, step: 0.4, taper: 0.55,
    depth: 3, side: [0.3, 0.55, 0.5], sideFrom: [0.45, 0.15, 0.1], sideAngle: [0.85, 0.8, 0.75], sideLen: [0.55, 0.55, 0.5], shorten: 0.55,
    wiggle: [0.18, 0.3, 0.4, 0.5], rise: [0.03, 0.0, 0.0, 0.0], minRise: 0.25, leafDepth: 1, leafFrom: 0.4,
    blobs: 15, blob: 1.1, perBlob: 24, leaf: 0.9, scatter: 0.8, jitter: 0.35, roll: 0.5,
    leaves: { shape: 'oval', wide: 0.45, size: 0.12, nodes: 8, reach: 0.42, fill: 80 }, bark: furrowed('#94705a', 'rgba(55,34,24,0.75)', 63),
  },
  // the enchanted wood's giants: a vast flared trunk, great limbs reaching out and up, a deep crown
  GiantTree: {
    seed: 7100, trunk: 3.2, radius: 0.42, lean: 0.12, limbs: 6, limbAngle: 0.85, limbLen: 4.6, step: 0.45, taper: 0.6,
    depth: 3, side: [0.2, 0.6, 0.55], sideFrom: [0.4, 0.15, 0.1], sideAngle: [0.85, 0.8, 0.75], sideLen: [0.55, 0.55, 0.5], shorten: 0.55,
    wiggle: [0.25, 0.32, 0.42, 0.5], rise: [0.03, 0.0, -0.01, 0.0], minRise: 0.15, leafDepth: 1, leafFrom: 0.4,
    blobs: 22, blob: 1.35, perBlob: 28, leaf: 1.0, scatter: 0.85, jitter: 0.4, roll: 0.6,
    leaves: { shape: 'oval', wide: 0.55, size: 0.14, nodes: 8, reach: 0.44, fill: 75 }, bark: furrowed('#6f6257', 'rgba(35,30,26,0.8)', 71),
  },
  // the swamp's willows: a short trunk, long limbs arching out and their twigs hanging down
  WillowTree: {
    seed: 7300, trunk: 2.2, radius: 0.22, lean: 0.3, limbs: 5, limbAngle: 0.7, limbLen: 3.2, step: 0.4, taper: 0.62,
    depth: 3, side: [0.4, 0.7, 0.6], sideFrom: [0.35, 0.15, 0.1], sideAngle: [0.9, 1.1, 1.2], sideLen: [0.6, 0.7, 0.8], shorten: 0.6,
    wiggle: [0.2, 0.3, 0.35, 0.4], rise: [0.02, -0.06, -0.1, -0.12], minRise: -0.9, leafDepth: 1, leafFrom: 0.25,
    blobs: 20, blob: 0.9, perBlob: 26, leaf: 0.8, scatter: 0.6, jitter: 0.25, roll: 0.3,
    leaves: { shape: 'oval', wide: 0.3, size: 0.12, nodes: 9, reach: 0.4, fill: 85 }, bark: furrowed('#6b5d4a', 'rgba(40,34,26,0.75)', 73),
  },
};
const TEX_NAMES = { MapleTree: 'maple', BirchTree: 'birch', NormalTree: 'normal', GiantTree: 'giant', WillowTree: 'willow' };

function buildTree(name, P, variant) {
  const r = mulberry32(P.seed + variant * 977);
  const { branches, sites } = grow(r, P);
  const wood = new Mesh();
  for (const b of branches) {
    if (b.radii[0] < 0.02) continue;
    const sides = b.depth === 0 ? 9 : b.depth === 1 ? 6 : 4;
    const radii = b.radii.slice();
    if (b.depth === 0) for (let i = 0; i < Math.min(3, radii.length); i++) radii[i] *= 1 + 0.5 * Math.exp(-i * 1.2); // the trunk flares into the ground
    tube(wood, b.pts, radii, sides, (p) => (b.depth === 0 ? lerp(0.62, 1, clamp(p.y / 1.2, 0, 1)) : 0.9), b.depth === 0 ? 2 : 1, 0.35);
  }
  return { [name + '_Bark']: wood.geometry(), [name + '_Leaves']: crown(r, P, sites) };
}

// ───────────── the great cherry ─────────────
/** One petal pointing up from (0, 0): rounded, widest past the middle, with the cherry's notched tip. */
function petal(x, len, w) {
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(w * 0.9, -len * 0.2, w * 1.1, -len * 0.8, w * 0.38, -len);
  x.lineTo(0, -len * 0.84);
  x.lineTo(-w * 0.38, -len);
  x.bezierCurveTo(-w * 1.1, -len * 0.8, -w * 0.9, -len * 0.2, 0, 0);
  x.fill();
}
const PINKS = ['#ff5f97', '#ff7aa8', '#ff8fb6', '#ffa6c6', '#ff4f8a', '#ffbfd4', '#ff6ea0'];
/** A spray of five-petal blossom in one atlas cell: dense in the middle, ragged at the rim, buds at the edge. */
function blossomCluster(x, ox, oy, S, r) {
  const flowers = [];
  for (let i = 0; i < 150; i++) {
    const a = r() * TAU, d = Math.pow(r(), 0.75) * S * 0.44;
    flowers.push([ox + S * 0.5 + Math.cos(a) * d, oy + S * 0.52 + Math.sin(a) * d * 0.95, d / (S * 0.44)]);
  }
  flowers.sort((a, b) => a[1] - b[1]);                                   // lower ones first, so the upper overlap them
  for (const [fx, fy, rim] of flowers) {
    const R = S * (0.042 + 0.028 * r()) * (1 - 0.3 * rim), base = PINKS[Math.floor(r() * PINKS.length)], a0 = r() * TAU;
    x.save(); x.translate(fx, fy);
    if (rim > 0.85 && r() < 0.5) {                                      // a bud
      x.fillStyle = '#e8487e'; x.beginPath(); x.ellipse(0, 0, R * 0.32, R * 0.45, a0, 0, TAU); x.fill(); x.restore(); continue;
    }
    for (let k = 0; k < 5; k++) {
      x.save(); x.rotate(a0 + (k * TAU) / 5);
      const g = x.createLinearGradient(0, 0, 0, -R);
      g.addColorStop(0, '#d93d76'); g.addColorStop(0.35, base); g.addColorStop(1, '#ffe3ec');
      x.fillStyle = g; petal(x, R, R * 0.55);
      x.restore();
    }
    x.fillStyle = '#b8285f'; x.beginPath(); x.arc(0, 0, R * 0.2, 0, TAU); x.fill();
    x.strokeStyle = '#ffd6e3'; x.lineWidth = Math.max(0.6, R * 0.04);
    for (let k = 0; k < 7; k++) { const a = r() * TAU, l = R * (0.3 + 0.15 * r()); x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * l, Math.sin(a) * l); x.stroke(); x.fillStyle = '#ffc95a'; x.fillRect(Math.cos(a) * l - 0.8, Math.sin(a) * l - 0.8, 1.6, 1.6); }
    x.restore();
  }
}
/** Cherry bark: dark, smooth, with pale horizontal bands (its lenticels) and a few furrows. */
function cherryBark(seed) {
  return (x, w, h) => {
    const r = mulberry32(seed);
    x.fillStyle = '#5a4540'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(30,20,18,${0.2 + 0.3 * r()})`; const cx = r() * w; x.fillRect(cx, 0, 1 + r() * 3, h); }
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(170,140,128,${0.25 + 0.35 * r()})`; const y = r() * h, cx = r() * w, l = 8 + r() * 40; x.fillRect(cx, y, l, 1 + r() * 2); x.fillRect(cx - w, y, l, 1 + r() * 2); }
  };
}
// The great cherry is a cone, as in the reference photo: a clear trunk, then a crown widest a third of
// the way up that tapers to a rounded point. Its skeleton is built to that plan (a leader with
// branches spiralling up it, each shorter than the last) and its blossom clusters fill the cone.
const HERO = { H: 12, base: 3.6, reach: 5.6, radius: 0.62, blob: 1.05, perBlob: 18, tips: 64, coneBlobs: true, leaf: 1.25, scatter: 0.8, roll: 0.5, bark: cherryBark(88), seed: 8800 };
const coneRadius = (u) => HERO.reach * Math.pow(1 - clamp(u, 0, 1), 0.8) * (0.72 + 0.28 * clamp(u / 0.25, 0, 1));
const coneU = (y) => (y - HERO.base) / (HERO.H - HERO.base);

function coneSkeleton(r) {
  const { H, base } = HERO, branches = [], sites = [], trunkR = (y) => HERO.radius * (1 - 0.82 * clamp(y / H, 0, 1));
  // a stem from p0 along dir (curving by `bend` per step), with radius r0 tapering away
  const stem = (p0, dir, len, r0, depth, bend = 0) => {
    const n = Math.max(3, Math.round(len / 0.55)), pts = [p0.clone()], radii = [r0], d = dir.clone();
    for (let k = 1; k <= n; k++) {
      d.x += (r() - 0.5) * 0.18; d.z += (r() - 0.5) * 0.18; d.y += bend; d.normalize();
      pts.push(pts[k - 1].clone().addScaledVector(d, len / n)); radii.push(r0 * (1 - 0.72 * (k / n)));
    }
    branches.push({ pts, radii, depth });
    return { pts, radii };
  };
  // side branches spiralling up a stem, each reaching out to the cone's outline, blossom at their ends
  const sides = (st, from, gap, depth) => {
    let a = r() * TAU;
    for (let i = 1; i < st.pts.length; i++) {
      const p = st.pts[i]; if (p.y < from) continue;
      for (let h = 0; h < 1; h += gap / 0.55) {
        a += 2.4 + (r() - 0.5) * 0.4;
        const q = st.pts[i - 1].clone().lerp(p, h), u = coneU(q.y);
        if (u > 0.95) continue;
        const dir = V(Math.cos(a), 0.34 + 0.5 * u + 0.15 * r(), Math.sin(a)).normalize();
        // long enough that its tip reaches the cone's outline, however steeply it climbs
        const out = Math.max(0.7, coneRadius(u) - Math.hypot(q.x, q.z)) * (0.8 + 0.25 * r()) / Math.max(0.35, Math.hypot(dir.x, dir.z));
        const b = stem(q, dir, out, st.radii[i] * 0.5, depth, 0.02);
        const tip = b.pts[b.pts.length - 1];
        sites.push({ p: tip, d: dir, end: true });
        if (r() < 0.75) {                                                  // a shoot off it, with its own spray
          const m = b.pts[Math.min(b.pts.length - 1, 2)], cd = dir.clone().add(perp(dir, r() * TAU).multiplyScalar(0.9)).normalize();
          const sh = stem(m, cd, out * 0.45, b.radii[2] * 0.7 || 0.04, depth + 1, 0.03);
          sites.push({ p: sh.pts[sh.pts.length - 1], d: cd, end: true });
        }
      }
    }
  };
  const lean = V((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3), lead = [], lr = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, y = -0.3 + (H + 0.3) * t; lead.push(V(lean.x * t * t + Math.sin(t * 5) * 0.08, y, lean.z * t * t)); lr.push(trunkR(y) * (i < 3 ? 1 + 0.5 * Math.exp(-i * 1.2) : 1)); }
  branches.push({ pts: lead, radii: lr, depth: 0 });
  const leader = { pts: lead, radii: lr };
  sides(leader, base + 1.7, 0.75, 1);
  sites.unshift({ p: lead[lead.length - 1].clone(), d: V(0, 1, 0), end: true, keep: true });          // the very top gets its spray
  // three big limbs fork from the trunk where the crown begins and climb at a slant beside the leader
  const a0 = r() * TAU;
  for (let k = 0; k < 3; k++) {
    const az = a0 + (k * TAU) / 3 + (r() - 0.5) * 0.5, p0 = V(lean.x * 0.1, base - 0.3, lean.z * 0.1);
    const limb = stem(p0, V(Math.cos(az) * 0.5, 1, Math.sin(az) * 0.5).normalize(), (H - base) * (0.55 + 0.12 * r()), trunkR(base) * 0.62, 1, 0.012);
    sides(limb, base + 1.6, 0.9, 2);
  }
  return { branches, sites };
}
/** The great cherry of the shrine grove: { bark, blossom } geometries in metres, and their textures. */
export function cherryHero() {
  const r = mulberry32(HERO.seed), { branches, sites } = coneSkeleton(r);
  const wood = new Mesh();
  for (const b of branches) if (b.radii[0] > 0.015) tube(wood, b.pts, b.radii, b.depth === 0 ? 10 : b.depth === 1 ? 6 : 4, (p) => (b.depth === 0 ? lerp(0.6, 1, clamp(p.y / 1.5, 0, 1)) : 0.85), b.depth === 0 ? 2 : 1, 0.35);
  const blossom = crown(r, Object.assign({ blobs: HERO.tips }, HERO), sites), rt = mulberry32(HERO.seed + 31);
  const blossomTex = leafAtlas(1024, (x, S) => { for (let c = 0; c < 4; c++) blossomCluster(x, (c % 2) * S / 2, Math.floor(c / 2) * S / 2, S / 2, rt); }, [215, 215, 215], true); // grey: tinted pink like the grove's other cherries
  return { bark: wood.geometry(), blossom, barkTex: barkTexture(256, 256, HERO.bark), blossomTex };
}

/** Generated trees and their textures, in the kit's shape: { models, tex }. */
export function procTrees() {
  const models = {}, tex = {};
  for (const [name, P] of Object.entries(FAMILIES)) {
    for (let v = 1; v <= 5; v++) models[name + '_' + v] = buildTree(name, P, v);
    const t = TEX_NAMES[name], r = mulberry32(P.seed + 13);
    tex[t + '_leaves'] = leafAtlas(512, (x, S) => { for (let c = 0; c < 4; c++) cluster(x, (c % 2) * S / 2, Math.floor(c / 2) * S / 2, S / 2, r, P.leaves); });
    tex[t + '_bark'] = barkTexture(256, 256, P.bark);
  }
  return { models, tex };
}
