// Buildings made in code for the biomes (the owner: buildings are welcome where they match their
// place): pagodas in the blossom valleys, a castle on a hill in the plains, ruined arches in the
// plains and the desert, huts on stilts in the swamp, a windmill on the windy heights. Each is built
// once per variant from simple parts, then fused into one mesh per material (a few draw calls),
// and set down whole at its site like the shrine.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, mulberry32 } from '../core/math.js';
import { std, weatherize } from '../core/materials.js';

let M = null;
/** The shared materials (made once). */
export function buildingMats() {
  if (M) return M;
  const w = (c, o = {}) => weatherize(std(c, Object.assign({ flatShading: true }, o)), 'std');
  M = {
    stone: w('#a7a296'), darkStone: w('#7d786e'), sand: w('#d9b47c'), plaster: w('#efe6d4'), wood: w('#7a5236'), darkWood: w('#4f3726'),
    red: w('#c13b2b', { flatShading: false }), slate: w('#4a5a6a'), redRoof: w('#a8452f'), tealRoof: w('#3e6b66'), thatch: w('#b89a5a'),
    gold: std('#d9b24a', { metalness: 0.5, roughness: 0.4 }), cloth: w('#efe9dc', { side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: '#2b3540', emissive: '#ffb45e', emissiveIntensity: 0 }), // (windows: lit at dusk)
  };
  return M;
}

const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const cyl = (r0, r1, h, n, x = 0, y = 0, z = 0) => new THREE.CylinderGeometry(r1, r0, h, n).translate(x, y + h / 2, z);
const cone = (r, h, n, x = 0, y = 0, z = 0) => new THREE.ConeGeometry(r, h, n).translate(x, y + h / 2, z);
/** A square roof whose slopes sweep up at the eaves (as the shrine's). */
function sweptRoof(reach, rise, sx = 1, sz = 1) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(reach * t, rise * (1 - t) ** 2.1 + 0.16 * t ** 6)); }
  return new THREE.LatheGeometry(pts, 4).rotateY(Math.PI / 4).scale(sx, 1, sz);
}

/** Collects geometry by material, then fuses it into one mesh each. */
class Kit {
  constructor() { this.parts = new Map(); }
  add(mat, geo, cast = true) { const k = mat.uuid + (cast ? 'c' : 'n'); if (!this.parts.has(k)) this.parts.set(k, { mat, cast, geos: [] }); this.parts.get(k).geos.push(geo.index ? geo.toNonIndexed() : geo); return this; }
  build() {
    const g = new THREE.Group();
    for (const { mat, cast, geos } of this.parts.values()) {
      geos.forEach((q) => Object.keys(q.attributes).forEach((a) => { if (!['position', 'normal', 'uv'].includes(a)) q.deleteAttribute(a); }));
      const m = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(geos), mat);
      m.castShadow = cast; m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
}

// ───────────── a pagoda (the blossom valleys) ─────────────
/** A tiered pagoda: a stone base, then three to five storeys, each smaller, under sweeping roofs; a gold finial. About 10-16 m tall. */
export function pagoda(variant = 0) {
  const R = mulberry32(7700 + variant * 13), m = buildingMats(), k = new Kit();
  const tiers = 3 + Math.floor(R() * 3), roof = R() < 0.5 ? m.tealRoof : m.redRoof;
  let w = 5.2, y = 0;
  k.add(m.stone, box(w + 1.6, 0.9, w + 1.6, 0, 0, 0));
  for (let i = 0; i < 3; i++) k.add(m.stone, box(2.2, 0.3, 0.6, 0, i * 0.3, w / 2 + 1.1 + (2 - i) * 0.5)); // steps
  y = 0.9;
  for (let t = 0; t < tiers; t++) {
    const h = t === 0 ? 2.6 : 1.7;
    k.add(m.plaster, box(w, h, w, 0, y, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(m.red, cyl(0.16, 0.16, h, 8, sx * w / 2, y, sz * w / 2));
    k.add(m.red, box(w + 0.3, 0.22, w + 0.3, 0, y + h - 0.22, 0));
    if (t === 0) k.add(m.darkWood, box(1.3, 1.9, 0.12, 0, y, w / 2 + 0.01)); // the door
    k.add(m.glass, box(0.8, 0.5, 0.06, -w / 4, y + h * 0.5, w / 2 + 0.02), false); k.add(m.glass, box(0.8, 0.5, 0.06, w / 4, y + h * 0.5, w / 2 + 0.02), false);
    y += h;
    k.add(roof, sweptRoof(w * 0.95, 1.3 - t * 0.1).translate(0, y, 0));
    y += 0.55;
    w *= 0.78;
  }
  k.add(m.gold, cyl(0.12, 0.05, 2.2, 6, 0, y, 0));
  for (let i = 0; i < 4; i++) k.add(m.gold, new THREE.TorusGeometry(0.22 - i * 0.03, 0.04, 4, 8).rotateX(Math.PI / 2).translate(0, y + 0.4 + i * 0.35, 0));
  return { group: k.build(), radius: 5.2, height: y + 2.2 };
}

// ───────────── a castle (a hill in the plains; an ice castle in the highlands) ─────────────
/** A small castle: a square of curtain walls with battlements, round corner towers with pointed roofs, a tall keep, a gate. About 30 m across. */
export function castle(variant = 0, ice = false) {
  const R = mulberry32(7900 + variant * 17), m = buildingMats(), k = new Kit();
  const wall = ice ? m.plaster : m.stone, roof = ice ? m.tealRoof : R() < 0.5 ? m.slate : m.tealRoof, S = 12 + R() * 4, H = 6 + R() * 2;
  // walls, with battlements along their tops
  for (const [x, z, w, d] of [[0, -S, 2 * S, 1.6], [0, S, 2 * S, 1.6], [-S, 0, 1.6, 2 * S], [S, 0, 1.6, 2 * S]]) {
    const gate = z === S;
    if (gate) { k.add(wall, box(S - 2.2, H, d, -(S + 2.2) / 2, 0, z)); k.add(wall, box(S - 2.2, H, d, (S + 2.2) / 2, 0, z)); k.add(wall, box(4.4, H - 4.2, d, 0, 4.2, z)); k.add(m.darkWood, box(4.2, 4.2, 0.3, 0, 0, z + 0.2)); }
    else k.add(wall, box(w, H, d, x, 0, z));
    const n = Math.floor((w > d ? w : d) / 1.6);
    for (let i = 0; i < n; i += 2) { const t = (i + 0.5) / n - 0.5; k.add(wall, box(0.8, 0.8, 0.8, x + (w > d ? t * w : 0), H, z + (w > d ? 0 : t * d))); }
  }
  // corner towers
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const th = H + 4 + R() * 3;
    k.add(wall, cyl(2.6, 2.3, th, 10, sx * S, 0, sz * S));
    k.add(roof, cone(3, 4.5 + R() * 2, 10, sx * S, th, sz * S));
    k.add(m.glass, box(0.5, 1, 0.1, sx * S, th - 2.5, sz * S + 2.3 * Math.sign(sz)), false);
  }
  // the keep
  const kh = H + 9 + R() * 5;
  k.add(wall, box(9, kh, 9, 0, 0, -2));
  k.add(roof, sweptRoof(6.8, 4, 1, 1).translate(0, kh, -2));
  const th = kh + 6;
  k.add(wall, cyl(1.8, 1.6, th, 10, 3, 0, -5));
  k.add(roof, cone(2.4, 5, 10, 3, th, -5));
  k.add(m.gold, cyl(0.06, 0.06, 2.5, 4, 3, th + 5, -5));
  k.add(m.cloth, new THREE.PlaneGeometry(1.6, 0.9).translate(0.8, th + 6.9, -5), false); // a pennant
  for (let i = 0; i < 6; i++) k.add(m.glass, box(0.7, 1.2, 0.1, -3 + (i % 3) * 3, H + 2 + Math.floor(i / 3) * 4, 2.55), false);
  return { group: k.build(), radius: S + 3, height: th + 7 };
}

// ───────────── ruins (the plains, the desert) ─────────────
/** A ruined arch: two pillars, part of the arch between them, fallen stones about. `sandy` for the desert's sandstone. */
export function ruinArch(variant = 0, sandy = false) {
  const R = mulberry32(8100 + variant * 19), m = buildingMats(), k = new Kit(), mat = sandy ? m.sand : m.stone;
  const span = 4 + R() * 3, H = 4.5 + R() * 2.5, P = 1.1;
  for (const sx of [-1, 1]) {
    const h = sx < 0 || R() < 0.6 ? H : H * (0.4 + R() * 0.4);
    for (let y = 0; y < h; y += 0.9) k.add(mat, box(P + (R() - 0.5) * 0.12, 0.88, P + (R() - 0.5) * 0.12, sx * (span / 2 + P / 2), y, 0));
  }
  // the arch: blocks round a half circle, some fallen
  const n = 9, r = span / 2 + P / 2;
  for (let i = 0; i <= n; i++) {
    if (R() < 0.3) continue;
    const a = Math.PI - (i / n) * Math.PI, x = Math.cos(a) * r, y = H + Math.sin(a) * r * 0.75;
    k.add(mat, new THREE.BoxGeometry(P, 0.9, P).rotateZ(a - Math.PI / 2).translate(x, y, 0));
  }
  for (let i = 0; i < 6; i++) { const a = R() * TAU, d = 2 + R() * 4; k.add(mat, new THREE.BoxGeometry(0.9, 0.7, 0.9).rotateY(R() * 3).rotateZ((R() - 0.5) * 0.6).translate(Math.cos(a) * d, 0.3, Math.sin(a) * d)); }
  return { group: k.build(), radius: span / 2 + 5, height: H + r };
}
/** A broken colonnade: a row of columns, some whole, some fallen. */
export function colonnade(variant = 0, sandy = false) {
  const R = mulberry32(8300 + variant * 23), m = buildingMats(), k = new Kit(), mat = sandy ? m.sand : m.stone;
  const n = 4 + Math.floor(R() * 4), gap = 3.2, H = 5;
  k.add(mat, box(n * gap + 2, 0.6, 5, 0, 0, 0));
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap, broken = R() < 0.4, h = broken ? H * (0.25 + R() * 0.5) : H;
    k.add(mat, cyl(0.55, 0.5, h, 10, x, 0.6, -1.4)); k.add(mat, box(1.4, 0.4, 1.4, x, 0.6 + h, -1.4));
    if (broken && R() < 0.6) k.add(mat, new THREE.CylinderGeometry(0.5, 0.5, H * 0.6, 10).rotateZ(Math.PI / 2).rotateY(R() * 3).translate(x + 1, 1.1, 1.2));
  }
  return { group: k.build(), radius: n * gap / 2 + 3, height: H + 1.5 };
}

// ───────────── a hut on stilts (the swamp) ─────────────
/** A wooden hut on stilts over the water: a deck, plank walls, a steep thatched roof, a lit window, a ladder. */
export function stiltHut(variant = 0) {
  const R = mulberry32(8500 + variant * 29), m = buildingMats(), k = new Kit();
  const W = 4 + R() * 1.5, D = 3.6 + R(), lift = 1.8 + R() * 0.8, H = 2.4;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(m.darkWood, cyl(0.16, 0.14, lift + 0.4, 6, sx * (W / 2 + 0.4), -0.4, sz * (D / 2 + 0.4)));
  k.add(m.wood, box(W + 1.4, 0.2, D + 1.4, 0, lift, 0));
  k.add(m.wood, box(W, H, D, 0, lift + 0.2, 0));
  k.add(m.darkWood, box(0.9, 1.7, 0.1, 0, lift + 0.2, D / 2 + 0.02));
  k.add(m.glass, box(0.7, 0.6, 0.08, W / 4, lift + 1.2, D / 2 + 0.03), false);
  const roofH = 2.2 + R() * 0.8;
  k.add(m.thatch, new THREE.ConeGeometry(Math.max(W, D) * 0.85, roofH, 4).rotateY(Math.PI / 4).scale(W / Math.max(W, D), 1, D / Math.max(W, D)).translate(0, lift + 0.2 + H + roofH / 2 - 0.1, 0));
  for (let i = 0; i < 6; i++) k.add(m.darkWood, box(0.7, 0.06, 0.06, 0, i * (lift / 6), D / 2 + 1.2)); // the ladder's rungs
  for (const sx of [-0.35, 0.35]) k.add(m.darkWood, box(0.07, lift + 0.4, 0.07, sx, 0, D / 2 + 1.2));
  return { group: k.build(), radius: Math.max(W, D) / 2 + 2, height: lift + H + roofH };
}

// ───────────── a ship at anchor (the coast) ─────────────
/** A sailing ship riding at anchor: a pointed hull, a deck and a cabin aft, one or two masts with sails. About 15 m long. */
export function ship(variant = 0) {
  const R = mulberry32(9100 + variant * 37), m = buildingMats(), k = new Kit();
  const L = 13 + R() * 4, W = 3.6 + R() * 0.8, masts = variant % 2 ? 2 : 1;
  const hull = new THREE.Shape();
  hull.moveTo(-W / 2, -L / 2); hull.lineTo(W / 2, -L / 2); hull.quadraticCurveTo(W / 2 + 0.3, L * 0.2, 0, L / 2); hull.quadraticCurveTo(-W / 2 - 0.3, L * 0.2, -W / 2, -L / 2);
  // the hull's outline, extruded: the hull itself, a red band round it, and the deck inside it
  const slab = (sc, depth, top) => new THREE.ExtrudeGeometry(hull, { depth, bevelEnabled: false }).rotateX(Math.PI / 2).scale(sc, 1, sc).translate(0, top, 0);
  k.add(m.darkWood, slab(1, 2.4, 1.3));
  k.add(m.red, slab(1.025, 0.28, 0.95));
  k.add(m.wood, slab(0.93, 0.12, 1.36));
  k.add(m.wood, box(W * 0.8, 1.6, L * 0.2, 0, 1.4, -L * 0.36));
  k.add(m.glass, box(0.6, 0.5, 0.08, 0, 2.2, -L * 0.26 + 0.02), false);
  for (let i = 0; i < masts; i++) {
    const z = masts === 1 ? L * 0.05 : (i ? L * 0.22 : -L * 0.1), H = 9 + R() * 2 - i * 1.5;
    k.add(m.darkWood, cyl(0.16, 0.11, H, 6, 0, 1.3, z));
    k.add(m.darkWood, box(W * 1.1, 0.12, 0.12, 0, 1.3 + H * 0.82, z));
    k.add(m.darkWood, box(W * 0.9, 0.1, 0.1, 0, 1.3 + H * 0.4, z));
    k.add(m.cloth, new THREE.PlaneGeometry(W * 1.05, H * 0.4).translate(0, 1.3 + H * 0.61, z + 0.15), false);
  }
  k.add(m.red, new THREE.PlaneGeometry(0.9, 0.5).translate(0.45, 1.3 + 10.2, L * 0.05 + 0.05), false);
  return { group: k.build(), radius: W / 2 + 1, height: 12 };
}

// ───────────── a windmill (the windy heights) ─────────────
/** A windmill: a tapering stone tower, a turning cap of thatch, four sails. `sails` is the part that turns. */
export function windmill(variant = 0) {
  const R = mulberry32(8700 + variant * 31), m = buildingMats(), k = new Kit(), s = new Kit();
  const H = 8 + R() * 2;
  k.add(m.plaster, cyl(3, 2.1, H, 12));
  k.add(m.darkWood, box(1.2, 2, 0.2, 0, 0, 2.9));
  k.add(m.glass, box(0.6, 0.8, 0.1, 0, H * 0.6, 2.5), false);
  k.add(m.thatch, cone(2.6, 2.6, 12, 0, H, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    s.add(m.darkWood, new THREE.BoxGeometry(0.18, 5.6, 0.12).translate(0, 2.8, 0).rotateZ(a));
    s.add(m.cloth, new THREE.PlaneGeometry(1.3, 4.6).translate(0.75, 3.1, 0).rotateZ(a), false);
  }
  const sails = s.build();
  sails.position.set(0, H - 0.4, 3.1);
  const g = k.build();
  g.add(sails);
  return { group: g, sails, radius: 4, height: H + 6 };
}

// ───────────── places to find ─────────────
/** A ring of standing stones on a hilltop, a flat altar stone in the middle; runes on the stones glow at night. */
export function stoneCircle(variant = 0) {
  const R = mulberry32(8900 + variant * 37), m = buildingMats(), k = new Kit();
  const n = 7 + Math.floor(R() * 5), r = 6 + R() * 3;
  if (!M.rune) M.rune = new THREE.MeshStandardMaterial({ color: '#2a3a44', emissive: '#7fe3ff', emissiveIntensity: 0 });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.15, h = 2.4 + R() * 1.6, w = 0.9 + R() * 0.4, lean = (R() - 0.5) * 0.12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    k.add(m.darkStone, new THREE.BoxGeometry(w, h, 0.6).translate(0, h / 2, 0).rotateZ(lean).rotateY(-a + Math.PI / 2).translate(x, -0.2, z));
    k.add(M.rune, new THREE.PlaneGeometry(0.35, 0.9).translate(0, h * 0.55, 0.31).rotateY(-a - Math.PI / 2).translate(x * 0.98, -0.2, z * 0.98), false);
  }
  k.add(m.stone, box(2.2, 0.7, 1.2, 0, 0, 0));
  return { group: k.build(), radius: r + 1.5, height: 4 };
}
/**
 * A waystone (features/waypoints.js): a tall leaning stone on a ring of small ones, a rune cut into
 * each broad face. Asleep, the runes are dark (they glow a little at night, as the circles' do); woken,
 * the bright runes show instead (`on`, its own mesh, shown by world/landmarks.js).
 */
export function waystone(variant = 0) {
  const R = mulberry32(9700 + variant * 53), m = buildingMats(), k = new Kit();
  if (!M.rune) M.rune = new THREE.MeshStandardMaterial({ color: '#2a3a44', emissive: '#7fe3ff', emissiveIntensity: 0 });
  if (!M.wayOn) M.wayOn = new THREE.MeshStandardMaterial({ color: '#bff4ff', emissive: '#7fe3ff', emissiveIntensity: 1.6 });
  const h = 3.1 + R() * 0.9, w = 1.0 + R() * 0.25, d = 0.55, lean = (R() - 0.5) * 0.1, sink = 0.15;
  // the stone: a slab, broader than it is thick, narrowing to its top
  k.add(m.darkStone, new THREE.CylinderGeometry(0.55, 0.8, h, 4).rotateY(Math.PI / 4).scale(w, 1, d).translate(0, h / 2 - sink, 0).rotateZ(lean));
  k.add(m.stone, cyl(1.45, 1.3, 0.22, 9, 0, -0.08, 0));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + R() * 0.5, q = 0.2 + R() * 0.16; k.add(m.stone, new THREE.DodecahedronGeometry(q, 0).scale(1, 0.7, 1).translate(Math.cos(a) * 1.25, 0.16, Math.sin(a) * 1.25)); }
  // the runes: three strokes and a dot up each broad face, lying on the face (which leans in toward the top):
  // dark ones, and a hair in front of them bright ones
  const face = (y) => d * (0.566 - 0.177 * ((y + sink) / h)), tilt = -Math.atan((d * 0.177) / h);
  for (const side of [0, Math.PI]) for (const [mat, off] of [[M.rune, 0.012], [M.wayOn, 0.024]]) {
    const put = (g, x, y) => k.add(mat, g.rotateX(tilt).translate(x, y, face(y) + off).rotateY(side).rotateZ(lean), false);
    put(new THREE.PlaneGeometry(0.1, h * 0.4), 0, h * 0.48);
    put(new THREE.PlaneGeometry(0.34, 0.09).rotateZ(0.6), 0.1, h * 0.6);
    put(new THREE.PlaneGeometry(0.34, 0.09).rotateZ(-0.6), -0.1, h * 0.42);
    put(new THREE.CircleGeometry(0.085, 10), 0, h * 0.78);
  }
  const group = k.build();
  group.children.find((c) => c.material === M.wayOn).name = 'wayOn';
  return { group, radius: 1.5, height: h };
}
/** A cairn on a summit: a heap of stones stacked to a point, and a plain bench beside it looking out. */
export function cairn(variant = 0) {
  const R = mulberry32(9100 + variant * 41), m = buildingMats(), k = new Kit();
  let y = 0, r = 1.2;
  while (r > 0.2) { const n = Math.max(1, Math.round(r * 6)); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + R(); k.add(m.stone, new THREE.DodecahedronGeometry(0.28 + R() * 0.12, 0).translate(Math.cos(a) * r * 0.7, y + 0.2, Math.sin(a) * r * 0.7)); } y += 0.32; r -= 0.18; }
  k.add(m.wood, box(1.8, 0.1, 0.45, 0, 0.45, 2.4)); for (const sx of [-0.75, 0.75]) k.add(m.darkWood, box(0.1, 0.45, 0.4, sx, 0, 2.4));
  return { group: k.build(), radius: 3.2, height: y + 0.5, seats: [{ x: 0, z: 2.4, rot: 0, top: 0.5 }] };
}
/** A hot spring in the snow: a round pool of milky blue water ringed by rocks (steam rises from it: world/landmarks.js). */
export function hotSpring(variant = 0) {
  const R = mulberry32(9300 + variant * 43), m = buildingMats(), k = new Kit();
  const r = 2.6 + R() * 0.8;
  if (!M.spring) M.spring = new THREE.MeshStandardMaterial({ color: '#8fd2d6', roughness: 0.15, metalness: 0.1, emissive: '#2a6c70', emissiveIntensity: 0.25 });
  k.add(M.spring, new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2).translate(0, 0.12, 0), false);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + R() * 0.2, s = 0.45 + R() * 0.35; k.add(m.darkStone, new THREE.DodecahedronGeometry(s, 0).scale(1, 0.6, 1).translate(Math.cos(a) * (r + 0.3), 0.1, Math.sin(a) * (r + 0.3))); }
  return { group: k.build(), radius: r + 1, height: 1, steam: { r }, seats: [0, 1, 2].map((i) => ({ x: Math.cos(i * 2.1) * (r - 0.8), z: Math.sin(i * 2.1) * (r - 0.8), rot: i * 2.1 + Math.PI / 2, top: -0.15, warm: true })) };
}

// ───────────── wonders ─────────────
/** A crystal grotto: great glowing crystal clusters round a sunken basin, and a pool at its heart. */
export function crystalGrotto(variant = 0) {
  const R = mulberry32(9500 + variant * 47), k = new Kit();
  if (!M.crystal) M.crystal = new THREE.MeshStandardMaterial({ color: '#9fe8ff', roughness: 0.15, metalness: 0.2, emissive: '#5fd0ff', emissiveIntensity: 0.4, flatShading: true });
  if (!M.crystalV) M.crystalV = new THREE.MeshStandardMaterial({ color: '#d6b0ff', roughness: 0.15, metalness: 0.2, emissive: '#b07cff', emissiveIntensity: 0.4, flatShading: true });
  const n = 9 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.3, d = 9 + R() * 5, h = 3 + R() * 6, r = h * 0.16, tilt = 0.15 + R() * 0.35;
    const g = new THREE.CylinderGeometry(0.001, r, h * 0.25, 6).translate(0, h * 1.125, 0);
    const body = new THREE.CylinderGeometry(r, r * 1.1, h, 6).translate(0, h / 2, 0);
    for (const q of [g, body]) { q.rotateZ(-tilt); q.rotateY(-a); q.translate(Math.cos(a) * d, -0.4, Math.sin(a) * d); }
    const mat = R() < 0.6 ? M.crystal : M.crystalV;
    k.add(mat, body); k.add(mat, g);
  }
  if (!M.pool) M.pool = new THREE.MeshStandardMaterial({ color: '#163a4a', roughness: 0.08, metalness: 0.4, emissive: '#1e6a8a', emissiveIntensity: 0.5 });
  k.add(M.pool, new THREE.CircleGeometry(4.5, 20).rotateX(-Math.PI / 2).translate(0, 0.08, 0), false);
  return { group: k.build(), radius: 15, height: 10 };
}
/** The volcano's top: a glowing lava lake in its crater (the cone itself is the land: core/shape.js), and smoke. */
export function volcanoTop() {
  const k = new Kit();
  if (!M.lava) M.lava = new THREE.MeshStandardMaterial({ color: '#ff5a1f', emissive: '#ff3a0a', emissiveIntensity: 1.6, roughness: 0.6 });
  k.add(M.lava, new THREE.CircleGeometry(30, 24).rotateX(-Math.PI / 2).translate(0, 1.5, 0), false);
  return { group: k.build(), radius: 40, height: 10, steam: { r: 26 } };
}

/**
 * Floating islands: a large one above an updraft (its flat grassy top is where you stand: `top`,
 * local to the group) and smaller ones about it, rock beneath like an upturned cone, waterfalls
 * pouring off their edges into the air; a ring of light on the ground marks the updraft.
 */
export function skyIsles(variant = 0) {
  const R = mulberry32(9700 + variant * 53), k = new Kit(), m = buildingMats();
  if (!M.isleGrass) M.isleGrass = weatherize(std('#7fb04e', { flatShading: true }), 'std');
  if (!M.fall) M.fall = new THREE.MeshBasicMaterial({ color: '#dff3ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  if (!M.updraft) M.updraft = new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const isles = [{ x: 0, z: 0, y: 70 + R() * 25, r: 13 }];
  for (let i = 0; i < 4; i++) { const a = R() * TAU, d = 28 + R() * 30; isles.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 55 + R() * 55, r: 4 + R() * 6 }); }
  for (const is of isles) {
    k.add(m.darkStone, new THREE.ConeGeometry(is.r, is.r * 1.9, 9).rotateX(Math.PI).translate(is.x, is.y - is.r * 0.95, is.z));
    k.add(M.isleGrass, new THREE.CylinderGeometry(is.r * 1.02, is.r, 0.8, 12).translate(is.x, is.y - 0.4, is.z));
    // a little tree or two
    for (let t = 0; t < Math.round(is.r / 5); t++) { const a = R() * TAU, d = R() * is.r * 0.6, tx = is.x + Math.cos(a) * d, tz = is.z + Math.sin(a) * d; k.add(m.wood, new THREE.CylinderGeometry(0.15, 0.22, 2.2, 5).translate(tx, is.y + 1.1, tz)); k.add(M.isleGrass, new THREE.IcosahedronGeometry(1.4, 0).translate(tx, is.y + 2.8, tz)); }
    // a waterfall off its edge: a long thin sheet hanging into the air
    if (is.r > 5 || R() < 0.5) { const a = R() * TAU; k.add(M.fall, new THREE.PlaneGeometry(1.2 + is.r * 0.1, 40).translate(0, -20, 0).rotateY(-a + Math.PI / 2).translate(is.x + Math.cos(a) * is.r, is.y, is.z + Math.sin(a) * is.r), false); }
  }
  k.add(M.updraft, new THREE.RingGeometry(1.6, 2.4, 24).rotateX(-Math.PI / 2).translate(0, 0.15, 0), false);
  k.add(M.updraft, new THREE.CylinderGeometry(2, 2, 14, 16, 1, true).translate(0, 7, 0), false);
  return { group: k.build(), radius: 60, height: isles[0].y, top: { x: 0, z: 0, y: isles[0].y, r: isles[0].r - 1.2 } };
}
