// Dense forest where you can't walk: the hills past the meadow's edge and the lower slopes of
// the mountains. Thousands of trees, faked: each is one flat card that turns to face you, showing
// a picture of one of the real tree models (pine, common, maple, birch, blossom) rendered into a
// texture once at startup, so the far forest matches the trees you walk among. All the cards are
// drawn in three draw calls (the hills, and one per mountain range).
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { hash } from '../core/math.js';
import { weatherize, camU, softEdges } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { world } from '../core/state.js';
import { TREE_HEIGHT } from './kitplants.js';
import { groundU, farHaze } from './terrain.js';

/** The card meshes, so the distant-forest setting can hide them. */
export const farForest = [];
/** Cards grow in across this band of distance (metres); nearer than it, the real tree models stand. */
export const CARD_IN = [96, 114];
const CARD_SLOTS = 6000;   // how many cards can be drawn at once

const CELL_W = 256, CELL_H = 512;
// which model each atlas cell shows, its leaf texture and bark texture
const FAMILIES = [
  { name: 'pine', model: 'Pine_2', leaves: 'leaves_pine', bark: 'bark' },
  { name: 'common', model: 'CommonTree_1', leaves: 'leaves_round', bark: 'bark' },
  { name: 'maple', model: 'MapleTree_2', leaves: 'maple_leaves', bark: 'maple_bark' },
  { name: 'birch', model: 'BirchTree_2', leaves: 'birch_leaves', bark: 'birch_bark' },
  { name: 'blossom', model: 'TwistedTree_1', leaves: 'leaves_bush', bark: 'bark_twisted' },
  { name: 'normal', model: 'NormalTree_2', leaves: 'normal_leaves', bark: 'normal_bark' },
  { name: 'slimpine', model: 'PineTree_2', leaves: 'slimpine_leaves', bark: 'slimpine_bark' },
];

/** Render each family's tree, side on, into one texture (grey leaves: the cards tint them). */
function bakeAtlas(renderer) {
  const fams = FAMILIES.filter((f) => kit.models[f.model]);
  const rt = new THREE.WebGLRenderTarget(CELL_W * fams.length, CELL_H, { format: THREE.RGBAFormat });
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const mini = new THREE.Scene();
  mini.add(new THREE.HemisphereLight(0xffffff, 0x6a7050, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(-0.4, 1, 0.8);
  mini.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha(), prevTarget = renderer.getRenderTarget();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  const aspects = [];
  fams.forEach((f, i) => {
    const parts = fit(Object.fromEntries(Object.entries(kit.models[f.model]).map(([k, g]) => [k, g.clone()])), 2);
    const group = new THREE.Group();
    Object.entries(parts).forEach(([name, g]) => {
      const leaf = /Leaves/.test(name);
      const mat = new THREE.MeshLambertMaterial({ map: kit.tex[leaf ? f.leaves : f.bark], alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: false, color: leaf ? '#ffffff' : '#bbbbbb' });
      group.add(new THREE.Mesh(g, mat));
    });
    const box = new THREE.Box3().setFromObject(group), w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    // frame the tree (2 units tall, base at the bottom edge) in a cell twice as tall as it is wide;
    // a wide crown makes the frame taller than the tree, so remember the ratio for the card size
    const half = Math.max(w / 2 * 1.04, 0.5), top = Math.max(2.04, half * 4);
    cam.left = -half; cam.right = half; cam.top = top; cam.bottom = 0; cam.updateProjectionMatrix();
    aspects.push(top / 2);
    cam.position.set(0, 0, 40); cam.lookAt(0, 0, 0);
    rt.viewport.set(i * CELL_W, 0, CELL_W, CELL_H);
    rt.scissor.set(i * CELL_W, 0, CELL_W, CELL_H);
    rt.scissorTest = true;
    renderer.setRenderTarget(rt);
    mini.add(group);
    renderer.render(mini, cam);
    mini.remove(group);
  });
  rt.scissorTest = false;
  rt.viewport.set(0, 0, rt.width, rt.height);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  return { texture: rt.texture, fams, aspects };
}

function cardMaterial(atlas, cells, distant) {
  const mat = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.45, vertexColors: true, side: THREE.DoubleSide, fog: !distant });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCamF = camU;
    sh.uniforms.uAutumn = groundU.autumn;
    sh.vertexShader = `uniform vec3 uCamF; uniform float uAutumn;
      attribute vec3 aPos; attribute vec2 aSize; attribute float aCell; attribute float aRand; attribute float aLeafy;
      ${distant ? 'varying vec3 vMW;' : ''}
    ` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec3 toCam = uCamF - aPos; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
        vec3 objectNormal = normalize(vec3(toCam.x * 0.6, 1.0, toCam.z * 0.6));`)
      .replace('#include <begin_vertex>', `vec3 right = vec3(toCam.z, 0.0, -toCam.x);
        // a card grows out of the ground as you leave its tree behind, and sinks back as you come
        // near, where the real tree stands (each at its own distance, so a wood doesn't change as one)
        float grow = smoothstep(${CARD_IN[0].toFixed(1)}, ${CARD_IN[1].toFixed(1)}, distance(aPos.xz, uCamF.xz) + (aRand - 0.5) * 8.0);
        vec3 transformed = aPos + (right * position.x * aSize.x + vec3(0.0, position.y * aSize.y, 0.0)) * grow;
        ${distant ? 'vMW = transformed;' : ''}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vUv = vec2((aCell + uv.x) / ${cells.toFixed(1)}, uv.y);`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        // autumn: the broadleaf trees (not pines) turn orange, red and gold
        if (aLeafy > 0.5) vColor.rgb = mix(vColor.rgb, mix(vec3(0.85, 0.36, 0.14), vec3(0.95, 0.72, 0.26), aRand), uAutumn * 0.85);`);
    if (distant) {
      sh.fragmentShader = 'uniform vec3 uHaze; uniform vec3 uGlow; uniform vec3 uSun;\nvarying vec3 vMW;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
        vec3 fdir = vMW - cameraPosition;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, meadowHaze(uHaze, uGlow, fdir, uSun), ${(+distant).toFixed(2)});
        #include <fog_fragment>`);
    }
    if (!distant) farHaze(sh); // (the same haze as the ground they stand on, or they would glow pale against it)
  };
  mat.customProgramCacheKey = () => 'farforest' + (distant ? '-d' + distant : '');
  return mat;
}

const SIZES = { aPos: 3, aSize: 2, aCell: 1, aRand: 1, aLeafy: 1, color: 3 };
let set = null;

/** One mesh of CARD_SLOTS cards, all its buffers made once at full size (their contents are rewritten as trees come and go). */
function cards(atlas, cells) {
  const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  ['position', 'normal', 'uv'].forEach((k) => g.setAttribute(k, base.attributes[k]));
  const arr = {};
  for (const k in SIZES) { arr[k] = new Float32Array(CARD_SLOTS * SIZES[k]); g.setAttribute(k, new THREE.InstancedBufferAttribute(arr[k], SIZES[k])); }
  g.instanceCount = 0;
  const m = new THREE.Mesh(g, softEdges(weatherize(cardMaterial(atlas, cells, false), 'lam')));
  m.frustumCulled = false;
  scene.add(m);
  return { mesh: m, geo: g, arr };
}

const GREENS = { pine: ['#3d6b45', '#4a7a4c', '#355f40'], slimpine: ['#3f6e47', '#4b7d4e'], common: ['#6fa04a', '#7fb050', '#5d9142'], normal: ['#7aab4e', '#8ab85a'], maple: ['#76a64c', '#86b356'], birch: ['#9cc061', '#8db857'], blossom: ['#f0b8c8', '#e9a6bc'] };
const tmp = new THREE.Color();
/** The card that stands for a tree: its picture, size and tint (fixed by where the tree stands). */
function cardOf(t) {
  const fam = set.idx[t.family] !== undefined ? t.family : t.type === 'pine' ? 'pine' : t.type === 'blossom' && set.idx.blossom !== undefined ? 'blossom' : 'common';
  const cell = set.idx[fam] !== undefined ? set.idx[fam] : 0, px = Math.round(t.x * 7), pz = Math.round(t.z * 7);
  const r1 = hash(px + 11, pz), r2 = hash(px, pz + 23), r3 = hash(px - 5, pz - 9), greens = GREENS[fam] || GREENS.common;
  tmp.set(greens[Math.floor(r1 * greens.length)]).multiplyScalar(0.9 + r2 * 0.2);
  const h = (TREE_HEIGHT[fam] || 6.2) * t.s * set.aspects[cell]; // the card is taller than the tree when the crown is wide
  return { h, w: h * (CELL_W / CELL_H), cell, r: r3, c: [tmp.r, tmp.g, tmp.b], leafy: /common|normal|maple|birch/.test(fam) ? 1 : 0 }; // (leafy ones turn in autumn; pines and blossom don't)
}

/** Show a card for each of these trees (replacing the last lot). Returns how many found no free slot. */
export function setFarTrees(trees) {
  if (!set) return 0;
  const n = Math.min(trees.length, CARD_SLOTS), a = set.arr;
  for (let i = 0; i < n; i++) {
    const t = trees[i], c = t.card || (t.card = cardOf(t));
    a.aPos[i * 3] = t.x; a.aPos[i * 3 + 1] = t.y - 0.25; a.aPos[i * 3 + 2] = t.z;
    a.aSize[i * 2] = c.w; a.aSize[i * 2 + 1] = c.h;
    a.aCell[i] = c.cell; a.aRand[i] = c.r;
    // broadleaf and blossom trees wear the colour the season gives that very tree (so it does not
    // change as you walk up and its card gives way to the real thing); pines keep their card's green
    if (t.type !== 'pine' && world.tintTree) world.tintTree(t);
    const season = t.type !== 'pine' && t.shown;
    a.aLeafy[i] = season ? 0 : c.leafy;
    a.color[i * 3] = season ? t.shown.r : c.c[0]; a.color[i * 3 + 1] = season ? t.shown.g : c.c[1]; a.color[i * 3 + 2] = season ? t.shown.b : c.c[2];
  }
  set.geo.instanceCount = n;
  if (n) for (const k in SIZES) { const at = set.geo.attributes[k]; at.updateRange.offset = 0; at.updateRange.count = n * SIZES[k]; at.needsUpdate = true; }
  return trees.length - n;
}

/** Paint the tree pictures (this needs the renderer, once) and make the cards. They stay empty until setFarTrees. */
export function buildFarForest(renderer) {
  if (!kit) return;
  const { texture, fams, aspects } = bakeAtlas(renderer);
  set = cards(texture, fams.length);
  set.idx = Object.fromEntries(fams.map((f, i) => [f.name, i]));
  set.aspects = aspects;
  farForest.push(set.mesh);
}
