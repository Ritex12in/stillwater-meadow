// Loads the nature models (Quaternius' Stylized Nature MegaKit, CC0; see public/assets/nature)
// before the world is built. Each model is reduced to plain geometry, one piece per material,
// standing on its base and scaled to a known height, so the instancing, wind and fade code can
// treat it like the hand-built shapes. If anything fails (or ?assets=0), the meadow falls back
// to the hand-built shapes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { query } from './env.js';
import { procTrees } from '../world/proctrees.js';

const ROOT = (import.meta.env && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : '/') + 'assets/';
const BASE = ROOT + 'nature/', PROPS_BASE = ROOT + 'props/';
const MODELS = [
  'CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5',
  'Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5',
  'Grass_Common_Short', 'Grass_Common_Tall', 'Flower_3_Single', 'Flower_4_Single',
  'Bush_Common', 'Bush_Common_Flowers', 'Fern_1', 'Clover_1', 'Mushroom_Common',
  'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3',
  'TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3', 'TwistedTree_4', 'TwistedTree_5',
  'Flower_3_Group', 'Flower_4_Group', 'Plant_7', 'Grass_Wispy_Tall',
  'RockPath_Round_Small_1', 'RockPath_Round_Small_2', 'RockPath_Round_Small_3', 'Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3',
];
const TEXTURES = ['leaves_round', 'leaves_pine', 'leaves_bush', 'bark', 'flowers', 'leaves', 'rocks', 'mushrooms', 'bark_twisted', 'pathrocks'];
// built things (bench, fence, vines), from two more Quaternius kits; see public/assets/props
const PROPS = ['Bench', 'Prop_WoodenFence_Single', 'Prop_WoodenFence_Extension1', 'Prop_Vine1', 'Prop_Vine4'];
const PROP_TEXTURES = ['furniture', 'woodtrim', 'vine'];
// hand-painted ground (CC0, Cethiel on OpenGameArt; see public/assets/ground), tiled in world space
const GROUND = ['grass_lush', 'grass_flowers', 'grass_fine', 'soil', 'bloom_violet', 'bloom_orange'];
// grass and flower clumps from Quaternius' Ultimate Stylized Nature Pack (CC0; public/assets/meadow)
// (birches, maples and the "normal" trees are grown from code instead: world/proctrees.js)
const MEADOW = ['Grass_Small', 'Grass_Large', 'Flower_1_Clump', 'Flower_2_Clump', 'Flower_3_Clump', 'Flower_4_Clump', 'Flower_5_Clump',
  'PineTree_1', 'PineTree_2', 'PineTree_3', 'PineTree_4', 'PineTree_5',
  'Rock_1', 'Rock_2', 'Rock_3', 'Rock_4', 'Rock_5'];
const MEADOW_TEXTURES = ['meadow_grass', 'meadow_flowers', 'slimpine_bark', 'slimpine_leaves', 'crag'];

/** The loaded kit, or null when the meadow uses its hand-built shapes. */
export let kit = null;

/** One BufferGeometry per material name, in model space, with RGB vertex colours. */
function piecesOf(scene) {
  scene.updateMatrixWorld(true);
  const parts = {};
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const c = g.attributes.color;
    if (c) {
      // RGBA → RGB, and integer colours (r128 doesn't scale normalised ones when read) → 0..1
      const k = !c.normalized ? 1 : c.array instanceof Uint16Array ? 1 / 65535 : c.array instanceof Uint8Array ? 1 / 255 : 1;
      const rgb = new Float32Array(c.count * 3);
      for (let i = 0; i < c.count; i++) { rgb[i * 3] = c.getX(i) * k; rgb[i * 3 + 1] = c.getY(i) * k; rgb[i * 3 + 2] = c.getZ(i) * k; }
      g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    }
    if (!g.attributes.color) {
      const ones = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(ones, 3));
    }
    const name = (Array.isArray(o.material) ? o.material[0] : o.material).name || 'part';
    parts[name] = parts[name] ? mergeTwo(parts[name], g) : g;
  });
  return parts;
}

function mergeTwo(a, b) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const x = a.attributes[name], y = b.attributes[name];
    if (!x || !y) continue;
    const arr = new Float32Array(x.array.length + y.array.length);
    arr.set(x.array, 0); arr.set(y.array, x.array.length);
    out.setAttribute(name, new THREE.BufferAttribute(arr, x.itemSize));
  }
  const ia = a.index ? Array.from(a.index.array) : [...Array(a.attributes.position.count).keys()];
  const ib = b.index ? Array.from(b.index.array) : [...Array(b.attributes.position.count).keys()];
  const off = a.attributes.position.count;
  out.setIndex(ia.concat(ib.map((i) => i + off)));
  return out;
}

/**
 * Scale a model (all its pieces together) so it is `height` tall, with its base at y = 0
 * (`sink` lets roots go a little below) and centred on its own trunk or stem.
 */
export function fit(parts, height, sink = 0) {
  const box = new THREE.Box3();
  Object.values(parts).forEach((g) => { g.computeBoundingBox(); box.union(g.boundingBox); });
  const k = height / (box.max.y - Math.max(box.min.y, 0));
  Object.values(parts).forEach((g) => {
    g.translate(0, -Math.max(box.min.y, 0), 0);
    g.scale(k, k, k);
    g.translate(0, -sink, 0);
    g.computeBoundingBox();
    g.computeBoundingSphere();
  });
  return parts;
}

export async function loadKit() {
  if (query.get('assets') === '0') return null;
  const loader = new GLTFLoader();
  const tex = new THREE.TextureLoader();
  try {
    const models = await Promise.all(MODELS.map((m) => loader.loadAsync(BASE + m + '.gltf').then((g) => [m, piecesOf(g.scene)])));
    const props = await Promise.all(PROPS.map((m) => loader.loadAsync(PROPS_BASE + m + '.gltf').then((g) => [m, piecesOf(g.scene)])));
    const meadow = await Promise.all(MEADOW.map((m) => loader.loadAsync(ROOT + 'meadow/' + m + '.gltf').then((g) => [m, piecesOf(g.scene)])));
    const textures = await Promise.all([
      ...TEXTURES.map((t) => tex.loadAsync(BASE + t + '.png').then((x) => [t, x])),
      ...PROP_TEXTURES.map((t) => tex.loadAsync(PROPS_BASE + t + '.png').then((x) => [t, x])),
      ...MEADOW_TEXTURES.map((t) => tex.loadAsync(ROOT + 'meadow/' + t + '.png').then((x) => [t, x])),
    ]);
    const out = { models: Object.assign(Object.fromEntries(models), Object.fromEntries(props), Object.fromEntries(meadow)), tex: Object.fromEntries(textures) };
    Object.values(out.tex).forEach((t) => { t.flipY = false; t.anisotropy = 4; }); // glTF texture coordinates
    const ground = await Promise.all(GROUND.map((t) => tex.loadAsync(ROOT + 'ground/' + t + '.jpg').then((x) => [t, x])));
    ground.push(['leaves_litter', await tex.loadAsync(ROOT + 'ground/leaves.png')]); // painted by tools/paint_leaves.py
    ground.forEach(([name, t]) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; out.tex[name] = t; });
    // trees grown from code (world/proctrees.js), under the same names the loaded ones had
    const gen = procTrees();
    Object.assign(out.models, gen.models); Object.assign(out.tex, gen.tex);
    kit = out;
  } catch (e) {
    console.warn('Nature models could not be loaded; using the hand-built shapes.', e);
    kit = null;
  }
  return kit;
}
