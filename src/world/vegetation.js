// The models, materials and drawing slots for trees, boulders, reeds and lily pads (what grows
// where is decided per square of land in world/wilds.js and per lake in world/lakelife.js), the
// grass, and the flowers you can pick (world/wilds.js says where those grow too).
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, vnoise } from '../core/math.js';
import { HOME } from '../core/shape.js';
import { std, col, weatherize, addWind, bothSides, lodSet, slotSet, softEdges, neonAtNight } from '../core/materials.js';
import { pineFarGeos, crownFarGeos, pineTrunkFarGeos, crownTrunkFarGeos, pineGeos, crownGeos, flowerHeadGeos, flowerCentreGeo, flowerStemGeo, variantAt, FLOWER_KINDS, FLOWER_CENTRE } from './detail.js';
import { world, obstacles } from '../core/state.js';
import { kit, fit } from '../core/assets.js';
import { kitTrees, kitRocks, kitFlowerSlots, KIT_FLOWER_COLOURS } from './kitplants.js';
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
const hasMeadow = () => !!(kit && kit.models.Flower_1_Clump);
function meadowFlowerGeos() {
  return MEADOW_FLOWERS.map(({ model }) => {
    const parts = fit(Object.fromEntries(Object.entries(kit.models[model]).map(([k, g]) => [k, g.clone()])), model === 'Flower_1_Clump' ? 0.62 : 0.52);
    const g = Object.values(parts)[0], n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // petals lit evenly from above, not edge-on dark
    return g;
  });
}

const PETALS = ['#ffffff', '#f6d65a', '#f19cb7', '#b7a3e6', '#ff9f7a', '#fdf0b0'].map(col);
/** How many kinds of flower there are to pick (two more, 5 and 6, come with the nature kit). */
export const flowerKinds = () => (kit ? FLOWER_KINDS.length + 2 : FLOWER_KINDS.length);
/**
 * Give a flower to pick its kind, its colour (what it adds to a bouquet) and its height. Kinds
 * grow in patches with a few strays among them; `drift`, if given, is the kind of the drift the
 * flower stands in. `a`, `b` and `c` are three random numbers of the flower's own.
 */
export function dressFlower(f, drift, a, b, c) {
  const kinds = flowerKinds();
  const patch = Math.floor(vnoise(f.x * 0.12 + 7, f.z * 0.12 + 3) * kinds * 1.6) % kinds;
  f.kind = drift !== undefined ? drift % kinds : a < 0.7 ? patch : Math.floor(b * kinds) % kinds;
  if (KIT_FLOWER_COLOURS[f.kind]) f.color = KIT_FLOWER_COLOURS[f.kind];
  else if (hasMeadow()) f.color = MEADOW_FLOWERS[f.kind].colour; // the clump's own colour, for the bouquet
  else f.color = b < 0.8 ? PETALS[Math.floor(vnoise(f.x * 0.15, f.z * 0.15) * PETALS.length) % PETALS.length] : PETALS[Math.floor(c * PETALS.length) % PETALS.length];
  f.sy = f.s * (0.75 + 0.6 * c);
  return f;
}

/** How many flowers of one kind can be drawn at once. */
const FLOWER_SLOTS = 1000;
/**
 * Make the shapes and the slots the flowers you can pick are drawn from. world/wilds.js decides
 * which grow in each square of land; features/flowers.js leaves out the picked ones and the ones
 * the season has taken, and hands the rest to `world.drawPicks`.
 */
export function buildFlowers() {
  const own = (f) => (f.kind < FLOWER_KINDS.length ? f.kind : -1);
  const draw = []; // [slots, which of their shapes a flower takes (-1: none), (what is drawn for the list)]
  if (hasMeadow()) {
    // the five hand-built kinds show as the meadow pack's flower clumps when it loaded
    const mat = softEdges(neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ map: kit.tex.meadow_flowers, alphaTest: 0.5, vertexColors: true }), 0.6, FLOWER_FADE), 'lam'))));
    draw.push([slotSet(meadowFlowerGeos(), mat, FLOWER_SLOTS), own]);
  } else {
    const stemMat = bothSides(addWind(new THREE.MeshLambertMaterial({ color: '#4f7a36', vertexColors: true }), 0.6, FLOWER_FADE));
    const headMat = neonAtNight(bothSides(weatherize(addWind(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }), 0.6, FLOWER_FADE), 'lam')));
    const centreMat = addWind(new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0.6, FLOWER_FADE);
    const centreOf = (f) => f.centre || (f.centre = Object.assign({}, f, { color: col(FLOWER_CENTRE[FLOWER_KINDS[f.kind]]) }));
    draw.push([slotSet([flowerStemGeo()], stemMat, FLOWER_SLOTS * 3), (f) => (own(f) < 0 ? -1 : 0)]);
    draw.push([slotSet(flowerHeadGeos(), headMat, FLOWER_SLOTS, { colored: true }), own]);
    draw.push([slotSet([flowerCentreGeo()], centreMat, FLOWER_SLOTS * 2, { colored: true }), () => 0, (list) => list.filter((f) => FLOWER_CENTRE[FLOWER_KINDS[f.kind]]).map(centreOf)]);
  }
  if (kit) draw.push(...kitFlowerSlots(FLOWER_SLOTS));
  /** Draw these flowers and no others. Returns how many found no free slot (it should be none). */
  world.drawPicks = (list) => {
    let lost = 0;
    for (const [slots, shape, pick] of draw) { slots.setItems(pick ? pick(list) : list, shape); lost += slots.dropped; }
    return lost;
  };
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
