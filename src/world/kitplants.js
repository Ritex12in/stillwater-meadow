// The meadow's plants and rocks built from Quaternius' Stylized Nature MegaKit (CC0), when it
// loaded. Placement stays with vegetation.js; this file only supplies shapes and materials, plus
// the undergrowth (bushes, ferns, clover, mushrooms), which draws from its own random stream so
// it can never move a tree or a flower.
import * as THREE from 'three';
import { TAU, lerp, mulberry32, fbm } from '../core/math.js';
import { height, lakeT, pathAmt, SPAWN, nearReserved } from '../core/shape.js';
import { std, col, weatherize, addWind, bothSides, instancedVariants, lodSet, cutoutDepth } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { Builder, variantAt } from './detail.js';
import { world } from '../core/state.js';

export const KIT_GRASS_FADE = [12, 20];  // detailed grass near you; the light tufts take over beyond
export const KIT_FLOWER_FADE = [38, 52];
const UNDERGROWTH_FADE = [40, 55];

const tex = (n) => kit.tex[n];
const leafStd = (map, extra = {}) => weatherize(std('#ffffff', Object.assign({ map, alphaTest: 0.5, side: THREE.DoubleSide, flatShading: false, vertexColors: true }, extra)), 'std');
const pieces = (name) => kit.models[name];
const first = (parts, re) => Object.entries(parts).find(([k]) => re.test(k))[1];
/** The kit keeps wind weights in its vertex colours; give small plants a root-to-tip shade instead. */
function shadeByHeight(geo, lo, hi) {
  const p = geo.attributes.position, c = geo.attributes.color, top = geo.boundingBox.max.y || 1;
  for (let i = 0; i < p.count; i++) { const v = lerp(lo, hi, Math.max(0, p.getY(i)) / top); c.setXYZ(i, v, v, v); }
  c.needsUpdate = true;
  return upNormals(geo);
}
/** Thin blades and leaves lit evenly from above (as the hand-built grass is), not edge-on dark. */
function upNormals(geo) {
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  n.needsUpdate = true;
  return geo;
}
/** Leafy clumps lit like a ball, so the cards read as one soft mass. */
function roundNormals(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, c = new THREE.Vector3(), v = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  for (let i = 0; i < p.count; i++) { v.set(p.getX(i) - c.x, (p.getY(i) - c.y) * 0.7 + 0.3, p.getZ(i) - c.z).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  n.needsUpdate = true;
  return geo;
}

// ───────────── trees ─────────────
// simple far shapes sized to each model, with vertex colours so they share the tint
function farPine(leaf) {
  const b = new Builder(), bb = leaf.boundingBox, H = bb.max.y - bb.min.y;
  const r = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.45;
  [[bb.min.y, bb.min.y + H * 0.55, r], [bb.min.y + H * 0.3, bb.min.y + H * 0.8, r * 0.72], [bb.min.y + H * 0.6, bb.max.y, r * 0.45]].forEach(([y0, y1, rr]) => {
    b.solid(new THREE.ConeGeometry(rr, y1 - y0, 7).translate(0, (y0 + y1) / 2, 0), (x, y) => (y < y0 + 0.01 ? 0.55 : lerp(0.78, 1.05, Math.hypot(x, 0) / rr)));
  });
  return b.build();
}
function farCrown(leaf) {
  const b = new Builder(), bb = leaf.boundingBox, c = new THREE.Vector3(), e = new THREE.Vector3();
  bb.getCenter(c); bb.getSize(e).multiplyScalar(0.5);
  const r = Math.min(e.x, e.z) * 0.68; // the kit crowns are airy; a solid blob that size looks heavier
  [[0, 0, 0, 1], [0.45, -0.15, 0.2, 0.7], [-0.45, -0.1, -0.2, 0.7], [0.05, 0.4, -0.05, 0.65]].forEach(([dx, dy, dz, k]) => {
    b.solid(new THREE.IcosahedronGeometry(r * k, 0).scale(1, e.y / Math.max(e.x, e.z) * 1.1, 1).translate(c.x + dx * e.x, c.y + dy * e.y, c.z + dz * e.z), (x, y) => lerp(0.68, 1.1, (y - bb.min.y) / (bb.max.y - bb.min.y)));
  });
  return b.build();
}
const farTrunk = (leaf) => { const top = leaf.boundingBox.min.y + 0.8; return new THREE.CylinderGeometry(0.1, 0.28, top, 5).translate(0, top / 2, 0); };

/** Kit trees in place of the hand-built ones. Returns the leaf handle seasons recolour. */
export function kitTrees(pines, pineItems, rounds, roundItems, lod, procLeaf, procBark) {
  const pineModels = [1, 2, 3, 4, 5].map((i) => fit(pieces('Pine_' + i), 6.4, 0.15));
  const roundModels = [1, 2, 3, 4, 5].map((i) => fit(pieces('CommonTree_' + i), 6.2, 0.15));
  const bark = weatherize(std('#ffffff', { map: tex('bark'), flatShading: false, vertexColors: true }), 'std');
  const pineLeaf = leafStd(tex('leaves_pine')), roundLeaf = leafStd(tex('leaves_round'));
  const pineKind = (t) => variantAt(t.x, t.z, 5, 3), roundKind = (t) => variantAt(t.x, t.z, 5, 8);
  const pl = pineModels.map((m) => first(m, /Leaves/)), rl = roundModels.map((m) => first(m, /Leaves/));
  const L = Object.assign({}, lod, { lift: 3.2, radius: 4 });
  lodSet(pineModels.map((m) => first(m, /Bark/)), pl.map(farTrunk), bark, pines, pineKind, Object.assign({}, L, { farMat: procBark }));
  lodSet(pl, pl.map(farPine), pineLeaf, pineItems, pineKind, Object.assign({}, L, { farMat: procLeaf, depthMat: cutoutDepth(tex('leaves_pine')) }));
  lodSet(roundModels.map((m) => first(m, /Bark/)), rl.map(farTrunk), bark, rounds, roundKind, Object.assign({}, L, { farMat: procBark }));
  return lodSet(rl, rl.map(farCrown), roundLeaf, roundItems, roundKind, Object.assign({}, L, { farMat: procLeaf, depthMat: cutoutDepth(tex('leaves_round')) }));
}

// ───────────── rocks ─────────────
export function kitRocks(rocks, opts) {
  const geos = [1, 2, 3].map((i) => first(fit(pieces('Rock_Medium_' + i), 1.45), /Rock/));
  const mat = weatherize(std('#ffffff', { map: tex('rocks'), flatShading: false }), 'std');
  // the rock texture is dark and mossy; lift the per-rock greys so the shore reads as before
  const items = rocks.map((r) => Object.assign({}, r, { sx: r.sx * 0.95, sz: r.sz * 0.95, sy: r.sy * 1.2, color: r.color.clone().multiplyScalar(2.4) }));
  instancedVariants(geos, mat, items, (r) => variantAt(r.x, r.z, 3, 11), opts);
}

// ───────────── grass near you ─────────────
export function kitGrass(blades) {
  const short = shadeByHeight(first(fit(pieces('Grass_Common_Short'), 0.62), /Grass/), 0.5, 1.2), tall = shadeByHeight(first(fit(pieces('Grass_Common_Tall'), 0.8), /Grass/), 0.5, 1.2);
  // (the kit's grass texture is only a palette strip; the meadow's own grass colours do that job)
  world.grassKitMat = bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.55, KIT_GRASS_FADE), 'lam'));
  // a kit clump is fuller than a light tuft, so it takes the place of only some of them
  const kind = (b) => { const h = variantAt(b.x, b.z, 100, 31); return h < 52 ? 0 : h < 62 ? 1 : -1; };
  instancedVariants([short, tall], world.grassKitMat, blades, kind, { cast: false, cell: 16, far: KIT_GRASS_FADE[1] });
}

// ───────────── two more flower kinds ─────────────
/** Kinds 5 (cup flower) and 6 (yellow bells) come from the kit; their colour is in the texture. */
export const KIT_FLOWER_COLOURS = { 5: col('#e7785c'), 6: col('#f2c53d') };
export function kitFlowerParts(flowers) {
  const f3 = fit(pieces('Flower_3_Single'), 0.62), f4 = fit(pieces('Flower_4_Single'), 0.6);
  [f3, f4].forEach((m) => Object.values(m).forEach((g) => shadeByHeight(g, 0.7, 1.1)));
  const fade = (m) => bothSides(addWind(m, 0.6, KIT_FLOWER_FADE));
  const leafMat = fade(new THREE.MeshLambertMaterial({ map: tex('leaves'), alphaTest: 0.5, vertexColors: true }));
  const petalMat = bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ map: tex('flowers'), alphaTest: 0.5, vertexColors: true }), 0.6, KIT_FLOWER_FADE), 'lam'));
  const plain = flowers.map((f) => Object.assign({}, f, { color: null }));
  const kind = (f) => (f.kind >= 5 ? f.kind - 5 : -1);
  const o = { cell: 40, far: KIT_FLOWER_FADE[1] };
  return [
    instancedVariants([first(f3, /Leaves/), first(f4, /Leaves/)], leafMat, plain, kind, o),
    instancedVariants([first(f3, /Flowers/), first(f4, /Flowers/)], petalMat, plain, kind, o),
  ];
}

// ───────────── undergrowth ─────────────
export function buildUndergrowth(treeSpots) {
  const R = mulberry32(51507), r = (a, b) => a + (b - a) * R();
  const free = (x, z, room) => lakeT(x, z) > 1.15 && pathAmt(x, z) < 0.05 && !nearReserved(x, z, room) && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 5 && Math.hypot(x, z) < 125;
  const bushes = [], ferns = [], clover = [], shrooms = [];
  const greens = ['#7aa84a', '#86b352', '#6b9a40', '#93bb5a'].map(col);
  for (const t of treeSpots) {
    if (R() < 0.38) {
      const a = r(0, TAU), d = r(2.2, 3.6), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (free(x, z, 1.6)) bushes.push({ x, z, y: height(x, z) - 0.05, s: r(0.75, 1.3), ry: r(0, TAU), flowers: R() < 0.3, color: greens[Math.floor(R() * greens.length)] });
    }
    if (t.type === 'pine' && R() < 0.5) {
      const a = r(0, TAU), d = r(1.0, 2.2), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (free(x, z, 1.2)) ferns.push({ x, z, y: height(x, z) - 0.03, s: r(0.8, 1.3), ry: r(0, TAU) });
    }
    if (t.type !== 'pine' && R() < 0.28) {
      for (let k = 0; k < 1 + Math.floor(R() * 3); k++) {
        const a = r(0, TAU), d = r(0.7, 1.4), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (free(x, z, 1)) shrooms.push({ x, z, y: height(x, z) - 0.02, s: r(0.7, 1.3), ry: r(0, TAU) });
      }
    }
  }
  for (let i = 0; i < 900 && clover.length < 150; i++) {
    const a = r(0, TAU), d = Math.sqrt(R()) * 95, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (fbm(x * 0.08 - 13, z * 0.08 + 5) < 0.55 || !free(x, z, 1.1)) continue;
    clover.push({ x, z, y: height(x, z) - 0.02, s: r(0.8, 1.4), ry: r(0, TAU) });
  }

  const wind = (m, k) => addWind(m, k, UNDERGROWTH_FADE);
  const bushPlain = roundNormals(first(fit(pieces('Bush_Common'), 1.0, 0.1), /Leaves/));
  const bushFl = fit(pieces('Bush_Common_Flowers'), 1.0, 0.1);
  Object.values(bushFl).forEach(roundNormals);
  const leafMat = (map) => weatherize(wind(std('#ffffff', { map, alphaTest: 0.5, side: THREE.DoubleSide, flatShading: false, vertexColors: true }), 0.05), 'std');
  // the two bushes are laid out on different leaf textures
  const o = { cast: true, shadowRange: 40, cell: 40, far: UNDERGROWTH_FADE[1] };
  world.bushes = instancedVariants([bushPlain], leafMat(tex('leaves_bush')), bushes, (b) => (b.flowers ? -1 : 0), Object.assign({ depthMat: cutoutDepth(tex('leaves_bush')) }, o));
  world.bushesInBloom = instancedVariants([first(bushFl, /Leaves/)], leafMat(tex('leaves_round')), bushes, (b) => (b.flowers ? 0 : -1), Object.assign({ depthMat: cutoutDepth(tex('leaves_round')) }, o));
  const bloom = bothSides(wind(new THREE.MeshLambertMaterial({ map: tex('flowers'), alphaTest: 0.5, vertexColors: true }), 0.05));
  world.bushBlooms = instancedVariants([first(bushFl, /Flowers/)], bloom, bushes.map((b) => Object.assign({}, b, { color: null })), (b) => (b.flowers ? 0 : -1), { cell: 40, far: UNDERGROWTH_FADE[1] });
  const leafy = bothSides(wind(new THREE.MeshLambertMaterial({ map: tex('leaves'), alphaTest: 0.5, vertexColors: true }), 0.3));
  world.ferns = instancedVariants([shadeByHeight(first(fit(pieces('Fern_1'), 0.45), /Leaves/), 0.6, 1.1)], leafy, ferns, () => 0, { cell: 40, far: UNDERGROWTH_FADE[1] });
  const leafyNear = bothSides(addWind(new THREE.MeshLambertMaterial({ map: tex('leaves'), alphaTest: 0.5, vertexColors: true }), 0.3, [22, 32]));
  world.clover = instancedVariants([shadeByHeight(first(fit(pieces('Clover_1'), 0.3), /Leaves/), 0.6, 1.1)], leafyNear, clover, () => 0, { cell: 30, far: 32 });
  const shroomMat = wind(std('#ffffff', { map: tex('mushrooms'), flatShading: false }), 0);
  world.mushrooms = instancedVariants([first(fit(pieces('Mushroom_Common'), 0.22), /Mushroom/)], shroomMat, shrooms, () => 0, { cell: 40, far: UNDERGROWTH_FADE[1] });
  world.undergrowth = { bushes: bushes.length, ferns: ferns.length, clover: clover.length, mushrooms: shrooms.length };
}
