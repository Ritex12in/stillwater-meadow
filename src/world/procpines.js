// Pines grown from code, to stand in for the downloaded ones (Pine_1..5 and PineTree_1..5 of the
// kit: core/assets.js). Not used by the game yet: tools/studio/pines.html sets them beside the kit's
// for the owner to judge.
//
// They are made after the kit's own patterns, measured part by part (tools/pine-study.mjs; the
// numbers are in docs/endless-world.md, "How the pines are grown from code"):
//   - the needles are in tiers up the trunk, about eleven of them (nine on the slim kind), the gaps
//     between tiers uneven by about a sixth;
//   - a tier has only two to four boughs (three to five on the slim kind), set unevenly round the
//     trunk, leaving wide empty angles; the tree is lopsided, heavier and longer to one side;
//   - each bough is ONE piece of about twenty triangles: a broad frond nearly as wide as it is long,
//     ridged along its stem like a roof, wearing one whole picture of a spray;
//   - the boughs slope down about 0.8 m for every metre out (40 degrees), a little more toward the
//     top, each differing from the next by a fifth;
//   - the broad kind is a cone, widest at its lowest bough (a radius of 0.4 of the height), the
//     needles beginning a quarter of the way up; the slim kind is a spindle, widest half way up;
//   - the trunk thins fast (a tenth of a metre thick half way up) and carries a few bare dead
//     branches below the needles;
//   - the needles are lit from above everywhere (normals 0.7 up, 0.3 outward) and are not darkened
//     by vertex colour.
// Nearly all the triangles go on the needles: no bough has a branch of its own inside its frond (the
// stem is painted on it).
//
// The kit's contract is kept (world/proctrees.js says what that is): `<name>_Bark` and
// `<name>_Leaves` geometries, indexed, each frond and each branch its own connected piece; the
// spray's picture grey with alpha (the game tints it by season and country); needle normals pointing
// up and out of the crown.
import * as THREE from 'three';
import { TAU, lerp, clamp, mulberry32 } from '../core/math.js';
import { Mesh, tube, leafAtlas, barkTexture, furrowed } from './proctrees.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** A frond's half-width along its length (0 at the trunk .. 1 at its end), as a share of its widest: a fan with a blunt end, as the kit's are. */
const fan = (t) => Math.pow(Math.sin(Math.PI * clamp(0.08 + 0.76 * t, 0, 1)), 0.75);

/**
 * The kinds of pine, at the heights the game stands them (`H`, m). `begin`: where the needles start,
 * as a share of the height. `tiers`, `per`: how many tiers and the boughs to a tier (least, most).
 * `reach(u)`: a bough's length (m) by how far up the crown it is (0 lowest tier .. 1 top).
 * `slope`: metres down per metre out. `wide`: a frond's half-width as a share of its length.
 */
export const PINES = {
  Pine: { seed: 8100, H: 6.4, begin: 0.27, tiers: 12, per: [3, 5], reach: (u) => lerp(2.1, 0.9, Math.pow(u, 0.9)), slope: 0.64, wide: 0.42, radius: 0.25, lean: 0.05, lop: 0.3 },
  SlimPine: { seed: 8300, H: 7.6, begin: 0.3, tiers: 12, per: [3, 5], reach: (u) => 0.5 + 1.05 * Math.pow(Math.sin(Math.PI * (0.1 + 0.82 * u)), 1.3), slope: 0.7, wide: 0.3, radius: 0.2, lean: 0.07, lop: 0.2 },
};

/** One pine: { <name>_Bark, <name>_Leaves }. */
export function buildPine(name, P, variant) {
  const r = mulberry32(P.seed + variant * 977), H = P.H;
  const wood = new Mesh(), leaf = new Mesh();
  // the trunk: a slight lean and one slow bend, thinning fast, flared into the ground
  const N = 10, la = r() * TAU, lean = P.lean * (0.5 + r()), bendA = r() * TAU, bend = (r() - 0.3) * 0.035 * H, trunk = [], radii = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, k = Math.sin(Math.PI * t) * bend;
    trunk.push(V(Math.cos(la) * lean * H * t + Math.cos(bendA) * k, t * H - 0.3 * (1 - t), Math.sin(la) * lean * H * t + Math.sin(bendA) * k));
    radii.push(Math.max(0.012, P.radius * Math.pow(1 - t, 1.35) * (1 + (i < 2 ? 0.45 * Math.exp(-i * 1.3) : 0))));
  }
  tube(wood, trunk, radii, 7, (p) => lerp(0.62, 1, clamp(p.y / 1.2, 0, 1)), 2, 0.35);
  const at = (y) => { const k = clamp(y / H, 0, 1) * N, i = Math.min(N - 1, Math.floor(k)); return V().lerpVectors(trunk[i], trunk[i + 1], k - i); };
  // a few bare dead branches below the needles: short, level or drooping, crooked
  const y0 = P.begin * H, dead = 2 + Math.floor(r() * 3);
  for (let k = 0; k < dead; k++) {
    const y = lerp(0.14 * H, y0 * 1.02, r()), az = r() * TAU, len = 0.35 + r() * 0.75, base = at(y), pts = [base.clone()], rad = [0.035];
    const d = V(Math.cos(az), (r() - 0.6) * 0.5, Math.sin(az)).normalize();
    let p = base.clone();
    for (let i = 1; i <= 3; i++) { d.add(V((r() - 0.5) * 0.6, (r() - 0.4) * 0.5, (r() - 0.5) * 0.6)).normalize(); p = p.clone().addScaledVector(d, len / 3); pts.push(p); rad.push(0.035 * (1 - i / 3.4)); }
    tube(wood, pts, rad, 3, () => 0.8, 1, 0.5);
  }

  // a bough: one frond, ridged along its stem; `u` how far up the crown (0..1)
  const SEG = 5;
  const frond = (y, az, len, u, slope) => {
    const out = V(Math.cos(az), 0, Math.sin(az)), side = V(-out.z, 0, out.x), base = at(y), bendS = (r() - 0.5) * 0.3, lift = 0.1 + 0.1 * r();
    const cell = Math.floor(r() * 4), cx = (cell % 2) * 0.5, cy = Math.floor(cell / 2) * 0.5, hw = P.wide * len * (0.85 + 0.3 * r()), flip = r() < 0.5 ? 1 : -1;
    const tone = 0.93 + 0.07 * r();
    const rows = [];
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      // out from the trunk, a little up at first, then down at its slope, the tip turning up a touch
      const drop = -slope * len * Math.pow(s, 1.25) + lift * len * Math.sin(Math.PI * Math.min(1, s * 1.1)) * (1 - 0.5 * s);
      const mid = V().copy(base).addScaledVector(out, len * s).addScaledVector(side, bendS * len * s * s).add(V(0, drop, 0));
      const w = hw * fan(s) + 0.03; // (a fan: narrow at the trunk, widest two thirds of the way out, blunt at the end)
      const sag = w * 0.42; // (the sides hang below the stem: a roof's ridge)
      const v = cy + 0.5 - 0.5 * s, row = [];
      for (const k of [-1, 0, 1]) {
        const p = V().copy(mid).addScaledVector(side, k * w).add(V(0, -Math.abs(k) * sag, 0));
        // lit from above and a little from outside, the same over the whole frond (as the kit's are)
        const n = V().copy(out).multiplyScalar(0.3).addScaledVector(side, k * 0.22).add(V(0, 0.72, 0)).normalize();
        row.push(leaf.vert(p, n, cx + 0.25 + flip * k * 0.24, v, tone * (k === 0 ? lerp(0.9, 1, s) : 1)));
      }
      rows.push(row);
    }
    for (let i = 0; i < SEG; i++) for (let k = 0; k < 2; k++) {
      const a = rows[i][k], b = rows[i][k + 1], c = rows[i + 1][k], d = rows[i + 1][k + 1];
      leaf.i.push(a, b, c, b, d, c); // (wound so the upper side is the front)
    }
  };
  // the tiers: uneven gaps; few boughs to a tier, unevenly round the trunk; heavier to one side
  const heavy = r() * TAU, top = 0.94 * H, tiers = P.tiers + (r() < 0.3 ? -1 : r() > 0.75 ? 1 : 0);
  const gaps = Array.from({ length: tiers - 1 }, (_, i) => (0.72 + 0.56 * r()) * lerp(1.25, 0.75, i / Math.max(1, tiers - 2))) // (uneven, and closer together toward the top)
   , sum = gaps.reduce((a, g) => a + g, 0);
  let y = y0 + 0.2 * H, last = [];
  for (let k = 0; k < tiers; k++) {
    const u = k / (tiers - 1), n = k === tiers - 1 ? 3 : P.per[0] + Math.floor(r() * (P.per[1] - P.per[0] + 1) * 0.999), azs = [];
    for (let j = 0, tries = 0; j < n && tries < 60; tries++) {
      const az = r() * TAU, near = (l, gap) => l.some((q) => Math.abs(Math.atan2(Math.sin(az - q), Math.cos(az - q))) < gap);
      if (near(azs, 0.8) || near(last, 0.4) || r() > 0.5 + 0.5 * P.lop * 2 * Math.cos(az - heavy)) continue; // (not crowding its neighbours, nor straight over a bough below; more of them on the heavy side)
      azs.push(az); j++;
    }
    for (const az of azs) {
      const len = P.reach(u) * (0.72 + 0.36 * r()) * (1 + P.lop * Math.cos(az - heavy));
      frond(y + (r() - 0.5) * 0.1, az, Math.max(0.4, len), u, (P.slope + 0.16 * (u - 0.5)) * (0.78 + 0.44 * r()));
    }
    last = azs;
    if (k < tiers - 1) y += gaps[k] / sum * (top - y0 - 0.2 * H);
  }
  // the leader: a small tuft standing at the very top
  for (let j = 0; j < 3; j++) frond(H * 0.99, heavy + j * 2.1 + r() * 0.5, 0.5, 1, 0.9);
  return { [name + '_Bark']: wood.geometry(), [name + '_Leaves']: leaf.geometry() };
}

/**
 * A spray of pine filling one cell of the atlas: a broad frond pointed at its tip, its edge cut into
 * teeth (the ends of its side twigs), the stem and the twigs drawn darker on it, needles brushed along
 * every twig. Near white: the game gives it its colour, and the kit's own picture is white.
 */
function spray(x, ox, oy, S, r) {
  const g = (v) => { const k = Math.round(clamp(v, 0, 255)); return `rgb(${k},${k},${k})`; };
  const line = (a, b, w, v) => { x.strokeStyle = g(v); x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
  const foot = [ox + S * 0.5, oy + S * 0.99], tip = [ox + S * 0.5, oy + S * 0.02];
  const on = (t) => [foot[0] + (tip[0] - foot[0]) * t, foot[1] + (tip[1] - foot[1]) * t];
  const half = (t) => S * 0.47 * fan(t);
  const twigs = 15, ends = [];
  for (let i = 0; i < twigs; i++) { const t = 0.03 + 0.92 * (i / (twigs - 1)), p = on(t), L = half(t) * (0.86 + 0.14 * r()), rake = 0.95 - 0.35 * t; ends.push([t, p, L, rake]); }
  // the body: from tooth to tooth down one side and back up the other
  x.fillStyle = g(232); x.beginPath(); x.moveTo(foot[0], foot[1]);
  for (const sd of [1, -1]) {
    const list = sd > 0 ? ends : ends.slice().reverse();
    for (const [t, p, L, rake] of list) {
      const e = [p[0] + sd * Math.sin(rake) * L, p[1] - Math.cos(rake) * L], dip = on(t + (sd > 0 ? 0.035 : -0.035));
      if (sd > 0) { x.lineTo(e[0], e[1]); x.lineTo(dip[0] + sd * L * 0.5, dip[1] - L * 0.2); } else { x.lineTo(dip[0] + sd * L * 0.5, dip[1] - L * 0.2); x.lineTo(e[0], e[1]); }
    }
    if (sd > 0) x.lineTo(tip[0], tip[1]);
  }
  x.closePath(); x.fill();
  // needles brushed along the twigs (lighter and darker strokes), then the twigs and the stem
  for (const [t, p, L, rake] of ends) for (const sd of [-1, 1]) {
    const e = [p[0] + sd * Math.sin(rake) * L, p[1] - Math.cos(rake) * L], n = Math.max(4, Math.round(L / (S * 0.03)));
    for (let i = 1; i <= n; i++) for (const q of [-1, 1]) {
      const s = i / (n + 0.5), a = [p[0] + (e[0] - p[0]) * s, p[1] + (e[1] - p[1]) * s], ang = Math.atan2(e[1] - p[1], e[0] - p[0]) + q * (0.65 + 0.3 * r()), l = S * 0.045 * (0.7 + 0.5 * r());
      line(a, [a[0] + Math.cos(ang) * l, a[1] + Math.sin(ang) * l], Math.max(1.2, S * 0.007), r() < 0.5 ? 255 : 206 + 20 * t);
    }
    line(p, e, Math.max(1.2, S * 0.006), 205);
  }
  line(foot, tip, Math.max(1.5, S * 0.008), 198);
}

/** The code-grown pines and their textures, in the kit's shape: { models, tex }. */
export function procPines() {
  const models = {}, tex = {};
  for (const [name, P] of Object.entries(PINES)) for (let v = 1; v <= 5; v++) models[name + '_' + v] = buildPine(name, P, v);
  const r = mulberry32(8111);
  tex.codepine_leaves = leafAtlas(512, (x, S) => { for (let c = 0; c < 4; c++) spray(x, (c % 2) * S / 2, Math.floor(c / 2) * S / 2, S / 2, r); }, [232, 232, 232]);
  tex.codepine_bark = barkTexture(256, 256, furrowed('#7d5f4c', 'rgba(48,30,22,0.8)', 81));
  return { models, tex };
}
