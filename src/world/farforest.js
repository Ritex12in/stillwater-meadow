// Dense forest where you can't walk: the hills past the meadow's edge and the lower slopes of
// the mountains. Thousands of trees, faked: each is one flat card that turns to face you, showing
// a picture of one of the real tree models (pine, common, maple, birch, blossom) rendered into a
// texture once at startup, so the far forest matches the trees you walk among. All the cards are
// drawn in three draw calls (the hills, and one per mountain range).
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, mulberry32, fbm, smooth } from '../core/math.js';
import { heightAt, lakeT, TERRAIN, WORLD_LIMIT } from '../core/shape.js';
import { weatherize, camU } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { RANGES, rangeHeight, mountainU } from './mountains.js';
import { groundU } from './terrain.js';

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
    if (distant) Object.assign(sh.uniforms, mountainU);
    sh.vertexShader = `uniform vec3 uCamF; uniform float uAutumn;
      attribute vec3 aPos; attribute vec2 aSize; attribute float aCell; attribute float aRand; attribute float aLeafy;
      ${distant ? 'varying vec3 vMW;' : ''}
    ` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec3 toCam = uCamF - aPos; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
        vec3 objectNormal = normalize(vec3(toCam.x * 0.6, 1.0, toCam.z * 0.6));`)
      .replace('#include <begin_vertex>', `vec3 right = vec3(toCam.z, 0.0, -toCam.x);
        vec3 transformed = aPos + right * position.x * aSize.x + vec3(0.0, position.y * aSize.y, 0.0);
        ${distant ? 'vMW = transformed;' : ''}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vUv = vec2((aCell + uv.x) / ${cells.toFixed(1)}, uv.y);`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        // autumn: the broadleaf trees (not pines) turn orange, red and gold
        if (aLeafy > 0.5) vColor.rgb = mix(vColor.rgb, mix(vec3(0.85, 0.36, 0.14), vec3(0.95, 0.72, 0.26), aRand), uAutumn * 0.85);`);
    if (distant) {
      sh.fragmentShader = 'uniform vec3 uHaze; uniform vec3 uGlow; uniform vec3 uSun;\nvarying vec3 vMW;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
        vec3 fdir = vMW - cameraPosition;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, meadowHaze(uHaze, uGlow, fdir, uSun), 0.36);
        #include <fog_fragment>`);
    }
  };
  mat.customProgramCacheKey = () => 'farforest' + (distant ? '-d' : '');
  return mat;
}

function cards(list, atlas, cells, distant) {
  const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  ['position', 'normal', 'uv'].forEach((k) => g.setAttribute(k, base.attributes[k]));
  const n = list.length, pos = new Float32Array(n * 3), size = new Float32Array(n * 2), cell = new Float32Array(n), rand = new Float32Array(n), leafy = new Float32Array(n), col = new Float32Array(n * 3);
  list.forEach((t, i) => {
    pos.set([t.x, t.y, t.z], i * 3); size.set([t.w, t.h], i * 2); cell[i] = t.cell; rand[i] = t.r; col.set([t.c.r, t.c.g, t.c.b], i * 3);
    leafy[i] = /common|normal|maple|birch/.test(t.fam) ? 1 : 0; // these turn in autumn; pines and blossom don't
  });
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 2));
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
  g.setAttribute('aLeafy', new THREE.InstancedBufferAttribute(leafy, 1));
  g.setAttribute('color', new THREE.InstancedBufferAttribute(col, 3));
  g.instanceCount = n;
  const m = new THREE.Mesh(g, weatherize(cardMaterial(atlas, cells, distant), 'lam'));
  m.frustumCulled = false;
  scene.add(m);
  return m;
}

/** Plant the far forest. Needs the renderer once, to paint the tree pictures. */
export function buildFarForest(renderer) {
  if (!kit) return;
  const { texture, fams, aspects } = bakeAtlas(renderer);
  const idx = Object.fromEntries(fams.map((f, i) => [f.name, i]));
  const r = mulberry32(80021), c = new THREE.Color();
  const greens = { pine: ['#3d6b45', '#4a7a4c', '#355f40'], slimpine: ['#3f6e47', '#4b7d4e'], common: ['#6fa04a', '#7fb050', '#5d9142'], normal: ['#7aab4e', '#8ab85a'], maple: ['#76a64c', '#86b356'], birch: ['#9cc061', '#8db857'], blossom: ['#f0b8c8', '#e9a6bc'] };
  const pickFam = (mix) => { const x = r(); let acc = 0; for (const [k, p] of mix) { acc += p; if (x < acc && idx[k] !== undefined) return k; } return 'pine'; };
  const tree = (x, y, z, h, mix) => {
    const fam = pickFam(mix), cell = idx[fam];
    c.set(greens[fam][Math.floor(r() * greens[fam].length)]).multiplyScalar(0.9 + r() * 0.2);
    const ch = h * aspects[cell]; // the card is taller than the tree when the crown is wide
    return { x, y, z, h: ch, w: ch * (CELL_W / CELL_H), cell, r: r(), c: c.clone(), fam };
  };

  // 1. the hills round the meadow, past where you can walk: woods in clumps, clearings between
  const hills = [], half = TERRAIN.size / 2 - 3;
  for (let i = 0; i < 30000 && hills.length < 4600; i++) {
    const x = (r() * 2 - 1) * half, z = (r() * 2 - 1) * half, d = Math.hypot(x, z);
    if (d < WORLD_LIMIT + 3 || lakeT(x, z) < 1.3) continue;
    const y = heightAt(x, z);
    // woods in clumps with clearings between, thinning toward the outer rim so the skyline stays
    // open and the mountains behind still show over it
    const rim = smooth(140, 176, Math.max(Math.abs(x), Math.abs(z)));
    if (fbm(x * 0.035 + 9, z * 0.035 - 4) < 0.42 + 0.08 * Math.sin(x * 0.01) + rim * 0.3) continue;
    const h = 5 + r() * 5;
    hills.push(tree(x, y - 0.4, z, h, [['pine', 0.25], ['slimpine', 0.22], ['common', 0.14], ['normal', 0.12], ['maple', 0.11], ['birch', 0.09], ['blossom', 0.07]]));
  }
  cards(hills, texture, fams.length, false);

  // 2. the mountains' lower slopes, below the rock and snow: denser, bigger, hazier
  RANGES.forEach((R, k) => {
    const list = [];
    const count = k === 0 ? 5000 : 7000;
    for (let i = 0; i < count * 3 && list.length < count; i++) {
      const a = r() * TAU, t = 0.04 + r() * 0.36, y = rangeHeight(R, a, t);
      if (y > R.height * (k === 0 ? 0.32 : 0.5) || y < -2) continue;
      if (fbm(Math.cos(a) * 14 + k, Math.sin(a) * 14 + t * 6) < 0.38) continue;
      const rr = R.radius + t * R.depth, h = (k === 0 ? 22 : 15) * (0.75 + r() * 0.5);
      const fade = 1 - smooth(R.height * 0.2, R.height * 0.45, y); // fewer, and more pines, up the slope
      if (r() > 0.35 + 0.65 * fade) continue;
      list.push(tree(Math.cos(a) * rr, y - 1.5, Math.sin(a) * rr, h, fade < 0.5 ? [['slimpine', 0.55], ['pine', 0.35], ['birch', 0.1]] : [['slimpine', 0.3], ['pine', 0.25], ['common', 0.15], ['normal', 0.1], ['maple', 0.12], ['birch', 0.08]]));
    }
    cards(list, texture, fams.length, true);
  });
}
