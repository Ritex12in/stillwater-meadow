// A pine grown from code, to stand in for the downloaded ones (Pine_1..5 and PineTree_1..5 of the
// kit: core/assets.js). Not used by the game yet: tools/studio/pines.html sets it beside the kit's
// for the owner to judge.
//
// How it is made: a straight trunk; whorls of boughs up it, a handful to a whorl, each whorl turned
// against the last; the boughs long at the bottom and short at the top (a cone), leaving the trunk at
// a rising angle, sagging under their own weight toward the tip and turning up again at the very end,
// the lower and older ones sagging most. Each bough carries its needles as two long cards, one each
// side, tilted down like a roof, wearing a painted spray: a stem, side twigs raked forward, needles
// both sides of every twig. Short boughs crowd the top round a leader.
//
// It keeps the kit's contract (world/proctrees.js says what that is): `<name>_Bark` and
// `<name>_Leaves` geometries, indexed, each card and each branch its own connected piece; the spray's
// picture grey with alpha (the game tints it by season and country); vertex colours the shade inside
// the crown; needle normals pointing out of the crown.
import * as THREE from 'three';
import { TAU, lerp, clamp, mulberry32 } from '../core/math.js';
import { Mesh, tube, leafAtlas, barkTexture, furrowed } from './proctrees.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The kinds of pine: `Pine` broad and layered (for the kit's Pine), `SlimPine` tall and narrow (for its PineTree). */
export const PINES = {
  Pine: { seed: 8100, H: 9, bare: 0.26, whorls: 12, per: [7, 6], reach: 3.3, power: 0.8, rise: 0.3, sag: 1.45, width: 1.75, radius: 0.2, lean: 0.05 },
  SlimPine: { seed: 8300, H: 11, bare: 0.3, whorls: 15, per: [6, 5], reach: 1.9, power: 0.7, rise: 0.15, sag: 1.9, width: 1.6, radius: 0.16, lean: 0.07 },
};

/** One pine: { <name>_Bark, <name>_Leaves }. */
export function buildPine(name, P, variant) {
  const r = mulberry32(P.seed + variant * 977);
  const H = P.H * (0.9 + 0.2 * r()), reach = P.reach * (0.85 + 0.3 * r()), whorls = P.whorls + Math.round((r() - 0.5) * 3);
  const wood = new Mesh(), leaf = new Mesh();
  // the trunk: nearly straight, a slight lean and wander, flared into the ground
  const lean = V((r() - 0.5) * P.lean * 2, 1, (r() - 0.5) * P.lean * 2).normalize(), trunk = [], radii = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = V().addScaledVector(lean, t * H); p.x += Math.sin(t * 3.1 + variant) * 0.06 * H * P.lean; p.y -= 0.3 * (1 - t);
    trunk.push(p); radii.push(P.radius * (1 - 0.93 * t) * (1 + (i < 3 ? 0.5 * Math.exp(-i * 1.2) : 0)));
  }
  tube(wood, trunk, radii, 8, (p) => lerp(0.62, 1, clamp(p.y / 1.2, 0, 1)), 2, 0.35);
  const at = (t) => { const k = clamp(t, 0, 1) * N, i = Math.min(N - 1, Math.floor(k)); return V().lerpVectors(trunk[i], trunk[i + 1], k - i); };

  // a bough: where it leaves the trunk, the way out, how long, how far up the tree (0 lowest .. 1 top)
  const bough = (t, az, len, up) => {
    const out = V(Math.cos(az), 0, Math.sin(az)), base = at(t), n = 7, pts = [], rad = [];
    const rise = P.rise * lerp(0.55, 1.5, up), sag = P.sag * lerp(1, 0.6, up) * (0.85 + 0.3 * r()), bend = (r() - 0.5) * 0.25;
    const side = V(-out.z, 0, out.x);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      // up at first, sagging toward the tip, turning up again at the very end
      const y = len * (rise * s - sag * 0.42 * s * s + 0.16 * Math.max(0, s - 0.75) * 4 * (s - 0.75));
      pts.push(V().copy(base).addScaledVector(out, len * s).addScaledVector(side, bend * len * s * s).add(V(0, y, 0)));
      rad.push(Math.max(0.012, P.radius * 0.2 * (1 - 0.6 * t) * (1 - 0.85 * s)));
    }
    tube(wood, pts, rad, 4, () => 0.85, 1, 0.5);
    // its needles: two long cards, one each side, sloping down from the bough like a roof
    const cell = Math.floor(r() * 4), cx = (cell % 2) * 0.5, cy = Math.floor(cell / 2) * 0.5, W = P.width * len * 0.36 * (0.85 + 0.3 * r());
    const dark = lerp(0.8, 1.0, up) * (0.9 + 0.2 * r());
    for (const sd of [-1, 1]) {
      const ids = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n, p = pts[i], fwd = V().subVectors(pts[Math.min(n, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        const across = V().crossVectors(V(0, 1, 0), fwd).normalize().multiplyScalar(sd);
        const w = W * Math.sin(Math.PI * clamp(0.1 + s * 0.9, 0, 1)) * lerp(1, 0.55, s) + 0.04; // (widest a third of the way out, a point at the tip)
        const edge = V().copy(p).addScaledVector(across, w * 0.85).add(V(0, -w * 0.8, 0));
        const shade = dark * lerp(0.78, 1.08, s);
        // (the card's picture: the stem along its inner edge, the tip of the spray at the bough's tip)
        const nIn = V().copy(out).multiplyScalar(0.25).add(V(0, 1, 0)).normalize(), nOut = V().copy(across).multiplyScalar(0.55).add(V(0, 0.75, 0)).addScaledVector(out, 0.3).normalize();
        ids.push([leaf.vert(p, nIn, cx + (sd < 0 ? 0.25 : 0.25), cy + 0.5 - 0.5 * s, shade * 0.9), leaf.vert(edge, nOut, cx + (sd < 0 ? 0.01 : 0.49), cy + 0.5 - 0.5 * s, shade)]);
      }
      for (let i = 0; i < n; i++) { const [a, b] = ids[i], [c, d] = ids[i + 1]; if (sd > 0) leaf.i.push(a, d, b, a, c, d); else leaf.i.push(a, b, d, a, d, c); } // (wound so the upper side is the front: its normals point up and out)
    }
  };
  // the whorls, from the lowest bough to just under the top; each turned against the last
  let az0 = r() * TAU;
  for (let k = 0; k < whorls; k++) {
    const up = k / (whorls - 1), t = lerp(P.bare, 0.93, Math.pow(up, 0.92)), per = Math.round(lerp(P.per[0], P.per[1], up));
    az0 += 2.39996 + (r() - 0.5) * 0.4;
    for (let j = 0; j < per; j++) {
      if (k < 2 && r() < 0.25) continue; // (a gap or two low down, where boughs have been lost)
      const len = reach * Math.pow(1 - up * 0.84, P.power) * (0.68 + 0.6 * r());
      bough(t + (r() - 0.5) * 0.02, az0 + (j / per) * TAU + (r() - 0.5) * 0.45, Math.max(0.35, len), up);
    }
  }
  // the top: a few short boughs standing up round the leader
  for (let j = 0; j < 4; j++) bough(0.965, az0 + j * 1.6 + r(), reach * 0.16, 1.6);
  return { [name + '_Bark']: wood.geometry(), [name + '_Leaves']: leaf.geometry() };
}

/**
 * A spray of pine in one cell of the atlas: the stem up the middle, side twigs raked forward both
 * sides and shorter toward the tip, needles both sides of every twig and of the stem; lighter toward
 * the tips. Grey: the game gives it its colour.
 */
function spray(x, ox, oy, S, r) {
  const line = (a, b, w, v) => { x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
  const needles = (a, b, len, v) => { // along a twig from a to b
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), n = Math.max(3, Math.round(L / (S * 0.011))), ang = Math.atan2(dy, dx);
    for (let i = 0; i <= n; i++) for (const sd of [-1, 1]) {
      const t = i / n, p = [a[0] + dx * t, a[1] + dy * t], q = ang + sd * (0.75 + 0.3 * r()), l = len * (0.7 + 0.5 * r()) * (1 - 0.3 * t);
      line(p, [p[0] + Math.cos(q) * l, p[1] + Math.sin(q) * l], Math.max(1.5, S * 0.011), Math.round(v * (0.8 + 0.25 * r())));
    }
  };
    const foot = [ox + S * 0.5, oy + S * 0.985], tip = [ox + S * (0.5 + (r() - 0.5) * 0.04), oy + S * 0.03];
  const on = (t) => [foot[0] + (tip[0] - foot[0]) * t, foot[1] + (tip[1] - foot[1]) * t];
  // a soft body under the needles, saw-edged, so the spray reads as a mass and not as loose lines
  x.fillStyle = 'rgb(172,172,172)'; x.beginPath(); x.moveTo(foot[0], foot[1]);
  const half = (t) => S * 0.43 * Math.sin(Math.PI * clamp(0.12 + t * 0.88, 0, 1)) * (1 - 0.35 * t);
  for (let i = 0; i <= 40; i++) { const t = i / 40, q = on(t); x.lineTo(q[0] + half(t) * (i % 2 ? 0.98 : 0.8), q[1] - (i % 2 ? S * 0.012 : 0)); }
  for (let i = 40; i >= 0; i--) { const t = i / 40, q = on(t); x.lineTo(q[0] - half(t) * (i % 2 ? 0.98 : 0.8), q[1] - (i % 2 ? S * 0.012 : 0)); }
  x.closePath(); x.fill();
  const twigs = 18;
  for (let i = 0; i < twigs; i++) {
    const t = 0.04 + 0.9 * (i / (twigs - 1)), p = on(t);
    for (const sd of [-1, 1]) {
      const L = S * 0.44 * Math.sin(Math.PI * clamp(0.12 + t * 0.88, 0, 1)) * (1 - 0.35 * t) * (0.8 + 0.3 * r());
      const a = -Math.PI / 2 + sd * (1.0 - 0.3 * t + (r() - 0.5) * 0.15), e = [clamp(p[0] + Math.cos(a) * L, ox + 3, ox + S - 3), p[1] + Math.sin(a) * L];
      const v = 195 + 45 * t + 15 * r();
      needles(p, e, S * 0.05, v);
      line(p, e, Math.max(1.2, S * 0.008), 150);
    }
  }
  needles(foot, tip, S * 0.05, 240);
  line(foot, tip, Math.max(2, S * 0.016), 140);
}

/** The code-grown pines and their textures, in the kit's shape: { models, tex }. */
export function procPines() {
  const models = {}, tex = {};
  for (const [name, P] of Object.entries(PINES)) for (let v = 1; v <= 5; v++) models[name + '_' + v] = buildPine(name, P, v);
  const r = mulberry32(8111);
  tex.codepine_leaves = leafAtlas(512, (x, S) => { for (let c = 0; c < 4; c++) spray(x, (c % 2) * S / 2, Math.floor(c / 2) * S / 2, S / 2, r); }, [185, 185, 185]);
  tex.codepine_bark = barkTexture(256, 256, furrowed('#7d5f4c', 'rgba(48,30,22,0.8)', 81));
  return { models, tex };
}
