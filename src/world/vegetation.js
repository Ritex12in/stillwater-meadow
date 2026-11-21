// The models, materials and drawing slots for trees, boulders, reeds and lily pads (what grows
// where is decided per square of land in world/wilds.js and per lake in world/lakelife.js), the
// grass, and the flowers you can pick by the home lake.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, fbm, vnoise, mulberry32 } from '../core/math.js';
import { height, lakeT, lakeR, pathAmt, onDock, nearReserved, PATH_T, LAKE, HOME, WORLD } from '../core/shape.js';
import { std, col, weatherize, addWind, bothSides, instancedVariants, lodSet, slotSet, softEdges, neonAtNight } from '../core/materials.js';
import { pineFarGeos, crownFarGeos, pineTrunkFarGeos, crownTrunkFarGeos, pineGeos, crownGeos, flowerHeadGeos, flowerCentreGeo, flowerStemGeo, variantAt, FLOWER_KINDS, FLOWER_CENTRE } from './detail.js';
import { world, obstacles } from '../core/state.js';
import { kit, fit } from '../core/assets.js';
import { kitTrees, kitRocks, kitFlowerParts, KIT_FLOWER_COLOURS } from './kitplants.js';
import { setLakeLifeSets, updateLakeLife } from './lakelife.js';
import { buildGrassField } from './grassfield.js';
export { buildUndergrowth } from './kitplants.js';

export const treeSpots = [];

// how far from the camera things keep their full detail (metres)
export const TREE_NEAR = 55;          // trees switch to a thinned-out copy and stop casting shadows
export const MODEL_FAR = 118;         // beyond this a tree is drawn as a flat card instead (world/farforest.js)
/** How far tree models are drawn just now: MODEL_FAR while the cards are showing, any distance when they are not. */
export const TREE_REACH = { value: MODEL_FAR };
const TREE_SLOTS = 512;               // how many trees of one shape can be drawn at once
/** Summer leaf colours by kind of tree (the valley's trees and the wild ones share them). */
export const TREE_COLOURS = {
  pine: ['#2f5a3a', '#3b6a40', '#2a4e37', '#456f43'].map(col),
  round: ['#5b8f3e', '#6fa04a', '#4d7f3a', '#86a948', '#7a9c3c'].map(col),
  blossom: ['#f2b8c6', '#eaa3b8', '#f7cdd8'].map(col),
};
export const GRASS_FADE = [18, 66];   // grass thins out gradually between these distances
export const FLOWER_FADE = [30, 70];
let wildBlocks = [];
/**
 * The trees standing near you (world/wilds.js grows them, square by square, and hands over the
 * ones close enough to be drawn as models). The camera, walkers and animals find them in
 * `treeSpots`, and each blocks the way.
 */
export function setWildTrees(wild) {
  if (!world.roundTop) return;
  treeSpots.length = 0;
  wildBlocks.forEach((b) => { const i = obstacles.indexOf(b); if (i >= 0) obstacles.splice(i, 1); });
  wildBlocks = [];
  const wp = [], wr = [];
  for (const t of wild) {
    treeSpots.push(t);
    (t.type === 'pine' ? wp : wr).push(t);
    const b = t.block || (t.block = { x: t.x, z: t.z, r: 0.32 * t.s });
    obstacles.push(b); wildBlocks.push(b);
  }
  world.roundItems = wr;
  world.roundTop.setItems({ pines: wp, pineItems: wp, rounds: wr, roundItems: wr });
}

/** Make the tree sets: every shape of tree, with slots to draw the trees near you in (none stand until the wilds hand some over). */
export function buildTrees() {
  const bark = std('#6b4f3a');
  const leaf = weatherize(std('#ffffff', { vertexColors: true }), 'std');
  const pg = pineGeos(), cg = crownGeos();
  const pineKind = (t) => variantAt(t.x, t.z, pg.length, 3), crownKind = (t) => variantAt(t.x, t.z, cg.length, 8);
  // detailed (and shadow-casting) near the camera, a cheaper version further out; past MODEL_FAR a card stands in
  const lod = { cast: true, near: TREE_NEAR, lift: 2.8, radius: 3.6, capacity: TREE_SLOTS, maxDist: TREE_REACH };
  world.roundItems = [];
  if (kit) world.roundTop = kitTrees({ pines: [], pineItems: [], rounds: [], roundItems: world.roundItems }, lod);
  else {
    const plain = Object.assign({ colored: false }, lod), tinted = Object.assign({ colored: true }, lod);
    const sets = [
      ['pines', lodSet(pg.map((g) => g.trunk), pineTrunkFarGeos(), bark, [], pineKind, plain)],
      ['pineItems', lodSet(pg.map((g) => g.top), pineFarGeos(), leaf, [], pineKind, tinted)],
      ['rounds', lodSet(cg.map((g) => g.trunk), crownTrunkFarGeos(), bark, [], crownKind, plain)],
      ['roundItems', lodSet(cg.map((g) => g.top), crownFarGeos(), leaf, [], crownKind, tinted)],
    ];
    const crown = sets[3][1];
    world.roundTop = {
      get count() { return world.roundItems.length; },
      material: leaf,
      setColorAt(i, c) { crown.setColorAt(i, c); },
      commit() {},
      set visible(v) { crown.visible = v; },
      setItems(lists) { sets.forEach(([role, set]) => set.setItems(lists[role])); },
      get dropped() { return sets.reduce((a, [, set]) => a + set.dropped, 0); },
    };
  }
}

/** Make the boulders' shapes and the slots the wilds' boulders are drawn from. */
export function buildRocks() {
  if (kit) { kitRocks(); return; }
  const wild = slotSet([new THREE.IcosahedronGeometry(1, 0)], weatherize(std('#ffffff'), 'std'), 300, { cast: true, colored: true });
  world.setWildRocks = (list) => { wild.setItems(list, () => 0); return wild.dropped; };
}

/** The grass is made on the GPU (world/grassfield.js): two draw calls, wherever you are. */
export function buildGrass() {
  world.grassMat = buildGrassField();
}

/**
 * Dense drifts of one flower along the path and just above the shore, where you walk and look.
 * Own random stream, appended after the scattered flowers: nothing placed before them moves.
 */
function addDrifts(flowers, petals) {
  const r = mulberry32(90417), first = flowers.length;
  const spot = (x, z) => lakeT(x, z) >= 1.15 && pathAmt(x, z) <= 0.15 && !nearReserved(x, z, 1.4) && !onDock(x, z);
  const centres = [];
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU, R = lakeR(a);
    // two in three by the path (either side of it), the rest on the bank above the sand
    const t = i % 3 < 2 ? PATH_T + (r() < 0.5 ? -1 : 1) * (3.4 + r() * 2.5) / R : 1.19 + r() * 0.07;
    centres.push({ x: LAKE.x + Math.cos(a) * R * t, z: LAKE.z + Math.sin(a) * R * t, kind: Math.floor(r() * 64), size: 1.3 + r() * 1.3, n: 30 + Math.floor(r() * 26) });
  }
  for (const c of centres) {
    if (!spot(c.x, c.z)) continue;
    const colour = petals[c.kind % petals.length];
    for (let k = 0; k < c.n; k++) {
      const a = r() * TAU, d = c.size * Math.sqrt(r()) * (0.6 + 0.4 * r());
      const x = c.x + Math.cos(a) * d * 1.4, z = c.z + Math.sin(a) * d; // drifts are a little long
      if (!spot(x, z)) continue;
      flowers.push({ x, z, y: height(x, z) - 0.02, s: 0.8 + r() * 0.6, ry: r() * TAU, color: r() < 0.9 ? colour : petals[Math.floor(r() * petals.length)], drift: c.kind });
    }
  }
  world.driftCount = flowers.length - first;
}

/**
 * The meadow pack's flower clumps (CC0) standing in for the five hand-built kinds, in the order
 * daisy, tulip, poppy, lavender, allium; `colour` is what a picked one adds to the bouquet.
 */
const MEADOW_FLOWERS = [
  { model: 'Flower_2_Clump', colour: col('#f3d36a') },  // yellow cosmos
  { model: 'Flower_4_Clump', colour: col('#f3a6c4') },  // pink cosmos
  { model: 'Flower_3_Clump', colour: col('#56c3d6') },  // cyan bloom
  { model: 'Flower_5_Clump', colour: col('#b98ae6') },  // violet iris
  { model: 'Flower_1_Clump', colour: col('#4aa9d0') },  // blue hydrangea
];
function meadowFlowerParts(flowers) {
  const geos = MEADOW_FLOWERS.map(({ model }) => {
    const parts = fit(Object.fromEntries(Object.entries(kit.models[model]).map(([k, g]) => [k, g.clone()])), model === 'Flower_1_Clump' ? 0.62 : 0.52);
    const g = Object.values(parts)[0], n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // petals lit evenly from above, not edge-on dark
    return g;
  });
  const mat = softEdges(neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ map: kit.tex.meadow_flowers, alphaTest: 0.5, vertexColors: true }), 0.6, FLOWER_FADE), 'lam'))));
  return instancedVariants(geos, mat, flowers.map((f) => Object.assign({}, f, { color: null })), (f) => (f.kind < FLOWER_KINDS.length ? f.kind : -1), { cell: 50, far: FLOWER_FADE[1] });
}

export function buildFlowers() {
  const flowers = [];
  const petals = ['#ffffff', '#f6d65a', '#f19cb7', '#b7a3e6', '#ff9f7a', '#fdf0b0'].map(col);
  // (scattered over the meadow round the home lake, from a random stream of their own)
  const R = mulberry32(WORLD.seed * 7 + 40417), reach = HOME.rmax * 2.4;
  for (let i = 0; i < 9000 && flowers.length < 1800; i++) {
    const a = R() * TAU, r = Math.sqrt(R()) * reach;
    const x = HOME.x + Math.cos(a) * r, z = HOME.z + Math.sin(a) * r;
    if (lakeT(x, z) < 1.14 || pathAmt(x, z) > 0.2 || nearReserved(x, z, 1.1)) continue;
    if (fbm(x * 0.07 + 20, z * 0.07 - 4) < 0.56) continue;
    const patch = Math.floor(vnoise(x * 0.15, z * 0.15) * petals.length) % petals.length;
    flowers.push({ x, z, y: height(x, z) - 0.02, s: 0.8 + R() * 0.6, ry: R() * TAU, color: R() < 0.8 ? petals[patch] : petals[Math.floor(R() * petals.length)] });
  }
  addDrifts(flowers, petals);
  // kinds grow in drifts, with a few strays; stems vary in height
  // (with the kit there are two more kinds, 5 and 6, whose colour comes with the model)
  const kinds = kit ? FLOWER_KINDS.length + 2 : FLOWER_KINDS.length;
  const meadow = !!(kit && kit.models.Flower_1_Clump);
  flowers.forEach((f) => {
    const drift = Math.floor(vnoise(f.x * 0.12 + 7, f.z * 0.12 + 3) * kinds * 1.6) % kinds;
    f.kind = f.drift !== undefined ? f.drift % kinds : variantAt(f.x, f.z, 10, 5) < 7 ? drift : variantAt(f.x, f.z, kinds, 6);
    if (KIT_FLOWER_COLOURS[f.kind]) f.color = KIT_FLOWER_COLOURS[f.kind];
    else if (meadow) f.color = MEADOW_FLOWERS[f.kind].colour; // the clump's own colour, for the bouquet
    f.sy = f.s * (0.75 + 0.6 * variantAt(f.x, f.z, 100, 7) / 100);
  });
  const stemMat = bothSides(addWind(new THREE.MeshLambertMaterial({ color: '#4f7a36', vertexColors: true }), 0.6, FLOWER_FADE));
  const headMat = neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), 0.6, FLOWER_FADE), 'lam')));
  const centreMat = addWind(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.6, FLOWER_FADE);
  const centres = flowers.map((f) => Object.assign({}, f, { color: FLOWER_CENTRE[FLOWER_KINDS[f.kind]] ? col(FLOWER_CENTRE[FLOWER_KINDS[f.kind]]) : null }));
  world.flowerItems = flowers;
  // the five hand-built kinds show as the meadow pack's flower clumps when it loaded
  const parts = meadow ? [meadowFlowerParts(flowers)] : [
    instancedVariants([flowerStemGeo()], stemMat, flowers.map((f) => Object.assign({}, f, { color: null })), (f) => (f.kind < FLOWER_KINDS.length ? 0 : -1), { cell: 50, far: FLOWER_FADE[1] }),
    instancedVariants(flowerHeadGeos(), headMat, flowers, (f) => (f.kind < FLOWER_KINDS.length ? f.kind : -1), { cell: 50, far: FLOWER_FADE[1] }),
    instancedVariants([flowerCentreGeo()], centreMat, centres, (f) => (f.color ? 0 : -1), { cell: 50, far: FLOWER_FADE[1] }),
  ];
  if (kit) parts.push(...kitFlowerParts(flowers));
  /** Every part of flower `i` shows or hides together. */
  world.flowerSet = { setVisibleAt(i, on) { parts.forEach((p) => p.setVisibleAt(i, on)); }, commit() { parts.forEach((p) => p.commit()); } };
}

/** A water lily: two rings of pointed petals opening into a cup round a golden centre. */
function lilyGeo() {
  const parts = [];
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  [[8, 0.13, 0.5, 0], [7, 0.1, 0.95, 0.4]].forEach(([n, len, lift, turn]) => {
    for (let i = 0; i < n; i++) {
      const p = new THREE.SphereGeometry(1, 6, 4).scale(0.032, 0.009, len / 2).translate(0, 0, len / 2);
      p.rotateX(-lift); p.rotateY((i / n) * TAU + turn);
      parts.push(paint(p, [1, 1, 1]));
    }
  });
  parts.push(paint(new THREE.SphereGeometry(0.035, 6, 4).scale(1, 0.7, 1).translate(0, 0.02, 0), [1.6, 1.2, 0.25]));
  return BufferGeometryUtils.mergeBufferGeometries(parts.map((g) => g.toNonIndexed())).scale(1.5, 1.5, 1.5);
}

/**
 * Make the slots every lake's reeds and lilies are drawn from (world/lakelife.js works out what
 * each lake has, and refills these for whichever lakes are near).
 */
export function buildReedsAndPads() {
  const sets = {
    reeds: slotSet([new THREE.ConeGeometry(0.035, 1.5, 3).translate(0, 0.75, 0)], addWind(std('#ffffff'), 0.07), 2400, { colored: true }),
    heads: slotSet([new THREE.CylinderGeometry(0.045, 0.045, 0.24, 5).translate(0, 1.15, 0)], addWind(std('#6e4a2e'), 0.07), 820, { colored: true }),
    pads: slotSet([new THREE.CylinderGeometry(0.55, 0.55, 0.03, 9, 1, false, 0.35, TAU - 0.35)], std('#ffffff'), 440, { colored: true }),
    blooms: slotSet([lilyGeo()], std('#ffffff', { emissive: '#4a2a3e', vertexColors: true, flatShading: false }), 150, { colored: true }),
  };
  world.padMesh = sets.pads;     // (the seasons hide the lilies in winter through these two,
  world.bloomMesh = sets.blooms; //  and the evening makes the flowers glow)
  setLakeLifeSets(sets);
  updateLakeLife(HOME.x, HOME.z);
}
