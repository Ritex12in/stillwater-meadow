// The ground, without an edge. It is drawn as square tiles in a quadtree round the camera: fine
// tiles (a vertex every 1.2 m) where you are, and tiles twice as wide at each step outward, so the
// same number of triangles covers the meadow at your feet and a mountain range two kilometres
// off. Every tile is the same grid of vertices, filled in from the land's formula (core/shape.js),
// so any tile can be made at any time and always comes out the same.
//
// Tiles are made a little at a time (a few milliseconds a frame), nearest first; a coarse tile
// stays on show until the finer ones that replace it are all ready, and the other way round, so
// there is never a hole. Finished tiles go back into a pool to be refilled, so walking for hours
// uses no more memory than standing still. Each tile hangs a skirt down from its edges to hide the
// hairline gaps where a fine tile meets a coarse one.
//
// With the assets loaded the ground is textured: hand-painted grass, soil, sand and rock blended
// by per-vertex weights (sand by a lake, soil on the path, rock on steep and high ground), sampled
// in world space at two scales so the tiling doesn't show. Without them it falls back to painted
// vertex colours. Either way broad patches of colour vary across the land.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { smooth, fbm } from '../core/math.js';
import { SEASON_GLSL, seasonU } from '../core/year.js';
import { quality } from '../systems/quality.js';
import { biomesAt } from '../core/biome.js';
import { wxU, neonU } from '../core/materials.js';
import { height, lakeAt, setGroundSampler, trailAt, coldBase, slopeLook, feltHeight, ASPECT, TREELINE, moistAt, snowCold, coldAt, dryOf, lushOf, snowOf } from '../core/shape.js';
import { col, weatherize, camU } from '../core/materials.js';
import { world } from '../core/state.js';
import { kit } from '../core/assets.js';

/**
 * Shared with the seasons and the sky: how much of the meadow is in flower, how far into autumn
 * (0..1), and how much of the ordinary haze the far ground takes (below 1 the distant hills and
 * mountains show through as pale shapes; 1 in fog, when they are lost).
 */
export const groundU = { bloom: { value: 1 }, autumn: { value: 0 }, haze: { value: 0.62 } };

// ── the grid every tile shares ──
export const TILE_N = 48, CELL = 1.2;                 // 48 cells a side; the finest are 1.2 m
const LEVELS = 5;                                      // tile sizes 57.6 m, 115.2, 230.4, 460.8 and 921.6 m
const SPLIT = 1.0;                                     // a tile gives way to four finer ones within this many of its own widths
const V = TILE_N + 1, GRID = V * V, VERTS = GRID + 4 * V, W = TILE_N + 3;
export const tileSize = (lv) => TILE_N * CELL * (1 << lv);
const tileIndex = (() => {
  const idx = [];
  for (let j = 0; j < TILE_N; j++) for (let i = 0; i < TILE_N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; idx.push(a, c, b, c, d, b); }
  // skirts: a strip hanging from each edge (both windings, so it shows from either side)
  const edge = [(k) => k, (k) => TILE_N * V + k, (k) => k * V, (k) => k * V + TILE_N];
  edge.forEach((at, e) => { for (let k = 0; k < TILE_N; k++) { const a = at(k), b = at(k + 1), sa = GRID + e * V + k, sb = sa + 1; idx.push(a, b, sa, b, sb, sa, a, sa, b, b, sa, sb); } });
  return new THREE.BufferAttribute(new Uint16Array(idx), 1);
})();
const EDGE_OF = [(k) => k, (k) => TILE_N * V + k, (k) => k * V, (k) => k * V + TILE_N];

let groundMat = null, textured = false;
const g1 = col('#5c9040'), g2 = col('#86b44e'), g3 = col('#3d7034'), sand = col('#dcc895'), bed = col('#7a7856');
const dirt = col('#c4ab7c'), moss = col('#5c7444'), rock = col('#8d8b7d'), heath = col('#b9a35c'), snowy = col('#eef2f8');
const grad = [0, 0];
const MOSS_TINT = new THREE.Color(0.8, 0.85, 0.7), TUNDRA_TINT = new THREE.Color(1.02, 0.86, 0.66), c = new THREE.Color();
const tundra = col('#8c8458');

/**
 * How rocky the ground is (0 grass .. 1 bare rock): slopes too steep to hold soil (from about 35
 * degrees; loose rock rests at 33 to 37), and high ground, from a little above the treeline (an
 * alpine meadow between), by the height it feels (`felt`: core/shape.js feltHeight).
 */
export const rockAmt = (h, slope, felt) => Math.max(smooth(0.7, 1.15, slope), smooth(TREELINE + 6, TREELINE + 34, felt));

// ── tiles ──
const tiles = new Map(), pool = [], queue = [], fine = new Map();
const hs = new Float32Array(W * W);                    // scratch: a tile's heights, one cell wider all round
const keyOf = (lv, ix, iz) => lv + ':' + ix + ':' + iz;
const fineKey = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);
let frameNo = 0, camX = 0, camZ = 0, job = null, shown = new Set(), madeTotal = 0, partsMade = 0;

function tileAt(lv, ix, iz) {
  const k = keyOf(lv, ix, iz);
  let t = tiles.get(k);
  if (!t) { t = { lv, ix, iz, key: k, part: null, built: false, queued: false, used: frameNo }; tiles.set(k, t); }
  return t;
}
const kidsOf = (t) => [tileAt(t.lv - 1, t.ix * 2, t.iz * 2), tileAt(t.lv - 1, t.ix * 2 + 1, t.iz * 2), tileAt(t.lv - 1, t.ix * 2, t.iz * 2 + 1), tileAt(t.lv - 1, t.ix * 2 + 1, t.iz * 2 + 1)];
const kidsMade = (t) => (t.lv === 0 ? [] : [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => tiles.get(keyOf(t.lv - 1, t.ix * 2 + a, t.iz * 2 + b))).filter(Boolean));
/** Distance from the camera to a tile's square (0 inside it). */
function away(t) {
  const s = tileSize(t.lv), x0 = t.ix * s, z0 = t.iz * s;
  return Math.hypot(Math.max(x0 - camX, 0, camX - x0 - s), Math.max(z0 - camZ, 0, camZ - z0 - s));
}
const wantsSplit = (t) => t.lv > 0 && away(t) < SPLIT * tileSize(t.lv);
/** Is this tile's square fully drawable, by itself or by finer tiles? */
function covered(t) {
  if (t.built) return true;
  const ks = kidsMade(t);
  return ks.length === 4 && ks.every(covered);
}
function request(t) { if (!t.built && !t.queued) { t.queued = true; queue.push(t); } }
/** Ask for the tiles that should end up on show under this one. */
function requestLeaves(t) {
  t.used = frameNo;
  if (wantsSplit(t)) kidsOf(t).forEach(requestLeaves); else request(t);
}
/** Show whatever is ready under a tile that isn't itself. */
function showReady(t) {
  t.used = frameNo;
  if (t.built) { shown.add(t); return; }
  kidsMade(t).forEach(showReady);
}
function select(t) {
  t.used = frameNo;
  if (wantsSplit(t)) {
    const ks = kidsOf(t);
    if (ks.every(covered)) { ks.forEach(select); return; }
    ks.forEach(requestLeaves);
  } else request(t);
  showReady(t);
}

/** A set of buffers and a mesh for one tile, new or from the pool. */
function takePart() {
  const p = pool.pop();
  if (p) return p;
  partsMade++;
  const geo = new THREE.BufferGeometry();
  const part = { geo, pos: new Float32Array(VERTS * 3), nrm: new Float32Array(VERTS * 3), col: new Float32Array(VERTS * 3), spl: textured ? new Float32Array(VERTS * 4) : null, clm: new Float32Array(VERTS * 3), look: new Float32Array(VERTS * 4), h: new Float32Array(GRID) };
  geo.setAttribute('position', new THREE.BufferAttribute(part.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(part.nrm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(part.col, 3));
  geo.setAttribute('clime', new THREE.BufferAttribute(part.clm, 3));
  geo.setAttribute('look', new THREE.BufferAttribute(part.look, 4)); // (the biomes here: desert, swamp, enchanted, volcanic: core/biome.js)
  if (textured) geo.setAttribute('splat', new THREE.BufferAttribute(part.spl, 4));
  geo.setIndex(tileIndex);
  geo.boundingSphere = new THREE.Sphere();
  part.mesh = new THREE.Mesh(geo, groundMat);
  part.mesh.receiveShadow = true;
  part.mesh.visible = false;
  part.mesh.matrixAutoUpdate = false;
  scene.add(part.mesh);
  return part;
}

/** Fill a tile's buffers from the land's formula. A generator: it yields every few rows so the work can be spread over frames. */
function* fill(t) {
  const part = takePart(), s = tileSize(t.lv), cs = s / TILE_N, x0 = t.ix * s, z0 = t.iz * s;
  const { pos, nrm, col: cols, spl, clm, look, h: hOut } = part;
  // heights, one cell beyond the tile on every side: normals then come from the land itself, not
  // from this tile's triangles, so light runs unbroken across the joins
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) hs[j * W + i] = height(x0 + (i - 1) * cs, z0 + (j - 1) * cs);
    if (j % 5 === 4) yield;
  }
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < V; j++) {
    for (let i = 0; i < V; i++) {
      const k = j * V + i, o = (j + 1) * W + i + 1, h = hs[o], x = x0 + i * cs, z = z0 + j * cs;
      const dx = hs[o + 1] - hs[o - 1], dz = hs[o + W] - hs[o - W], slope = Math.hypot(dx, dz) / (2 * cs);
      const nl = 1 / Math.hypot(dx, 2 * cs, dz);
      pos[k * 3] = i * cs; pos[k * 3 + 1] = h; pos[k * 3 + 2] = j * cs;
      nrm[k * 3] = -dx * nl; nrm[k * 3 + 1] = 2 * cs * nl; nrm[k * 3 + 2] = -dz * nl;
      hOut[k] = h;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
      c.copy(g1).lerp(g2, smooth(0.35, 0.7, fbm(x * 0.05 + 11, z * 0.05 - 3)));
      c.lerp(g3, smooth(0.5, 0.75, fbm(x * 0.11 - 5, z * 0.11 + 8)) * 0.6);
      // sand round the nearest lake, as broad as that lake's beach; soil on its path, if it has one
      const lake = lakeAt(x, z), lt = lake.t(x, z);
      const wSand = (1 - smooth(1.02, 1.02 + 0.14 * lake.beach, lt)) * Math.min(1, lake.beach * 2), wBed = smooth(0.05, -0.8, h), wDirt = Math.max(lt < 2.2 ? lake.path(x, z) * 0.9 : 0, trailAt(x, z) * 0.85);
      // (a tile drawn coarse enough already has the slope over about 8 m: its neighbours)
      if (cs >= 3.6) { grad[0] = dx / (2 * cs); grad[1] = dz / (2 * cs); }
      const base = coldBase(x, z), lie = slopeLook(x, z, h, base, cs >= 3.6 ? grad : null), north = lie.north, scree = lie.scree, felt = feltHeight(x, z, h, north, base);
      // (bare rock on cliffs and high ground; grey scree at the foot of a cliff)
      const wRock = Math.max(rockAmt(h, slope, felt) * 0.85, scree * 0.8), wMoss = Math.max(smooth(0.35, 0.8, slope), smooth(14, 40, h)) * 0.6;
      // the climate here: snow lies longer on slopes facing north, and not on cliffs; lush country is a deeper green
      const rain = moistAt(x, z), dry = dryOf(rain), chill = coldAt(x, z, h + ASPECT * north, base), cold = snowCold(chill, rain) * (1 - smooth(0.9, 1.5, slope) * 0.55);
      // cold country where little snow lies (it is too dry) is tundra: low olive-brown moss and sedge
      const wTundra = smooth(0.42, 0.65, chill) * (1 - snowOf(cold));
      // (clime: cold, dry, and whether this is a lake seen from too far off to have its own sheet of water)
      const pond = t.lv > 0 && h < 0.02 ? 1 : 0;
      if (pond) { pos[k * 3 + 1] = 0.02; nrm[k * 3] = 0; nrm[k * 3 + 1] = 1; nrm[k * 3 + 2] = 0; }
      clm[k * 3] = cold; clm[k * 3 + 1] = dry; clm[k * 3 + 2] = pond;
      const bw = biomesAt(x, z, h, base, rain);
      look[k * 4] = bw.desert; look[k * 4 + 1] = bw.swamp; look[k * 4 + 2] = bw.enchanted; look[k * 4 + 3] = bw.volcanic;
      c.multiplyScalar(1 - lushOf(rain) * 0.16);
      if (textured) {
        // the grass patches become a tint around 1 (the texture brings the colour); weights go apart
        // keep only a little of the patch hue, and its brightness relative to the average green
        const L = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        c.setRGB(1 + (c.r / L - 1) * 0.25, 1 + (c.g / L - 1) * 0.25, 1 + (c.b / L - 1) * 0.25).multiplyScalar(L / 0.32 * 0.88).lerp(MOSS_TINT, wMoss).lerp(TUNDRA_TINT, wTundra * 0.7);
        spl[k * 4] = wSand; spl[k * 4 + 1] = wBed; spl[k * 4 + 2] = wDirt; spl[k * 4 + 3] = wRock;
      } else {
        c.lerp(heath, dry * 0.75).lerp(tundra, wTundra * 0.6).lerp(sand, wSand).lerp(bed, wBed).lerp(dirt, wDirt).lerp(moss, wMoss).lerp(rock, wRock).lerp(snowy, snowOf(cold) * 0.9);
      }
      cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
    }
    if (j % 4 === 3) yield;
  }
  // the skirt: each edge vertex again, lower down
  const drop = cs * 2.5;
  for (let e = 0; e < 4; e++) {
    for (let k = 0; k < V; k++) {
      const from = EDGE_OF[e](k), to = GRID + e * V + k;
      for (let q = 0; q < 3; q++) { pos[to * 3 + q] = pos[from * 3 + q]; nrm[to * 3 + q] = nrm[from * 3 + q]; cols[to * 3 + q] = cols[from * 3 + q]; }
      pos[to * 3 + 1] -= drop;
      if (spl) for (let q = 0; q < 4; q++) spl[to * 4 + q] = spl[from * 4 + q];
      for (let q = 0; q < 3; q++) clm[to * 3 + q] = clm[from * 3 + q];
      for (let q = 0; q < 4; q++) look[to * 4 + q] = look[from * 4 + q];
    }
  }
  const { geo, mesh } = part;
  for (const name in geo.attributes) geo.attributes[name].needsUpdate = true;
  geo.boundingSphere.center.set(s / 2, (lo - drop + hi) / 2, s / 2);
  geo.boundingSphere.radius = Math.hypot(s / 2, s / 2, (hi - lo + drop) / 2);
  mesh.position.set(x0, 0, z0);
  mesh.updateMatrix();
  mesh.castShadow = t.lv === 0;   // only the ground near you is inside the shadow square
  t.part = part; t.built = true; t.queued = false;
  if (t.lv === 0) fine.set(fineKey(t.ix, t.iz), t);
  madeTotal++;
}

function release(t) {
  if (t.part) { t.part.mesh.visible = false; pool.push(t.part); t.part = null; }
  if (t.lv === 0) fine.delete(fineKey(t.ix, t.iz));
  t.built = false;
  tiles.delete(t.key);
}

/** How far the land is drawn (the view distance setting, systems/quality.js): 0 near (the second-largest tiles, 3 x 3), 1 (the largest, 3 x 3), 2 far (the largest, 5 x 5). */
/** Once a frame: choose which tiles are on show round (x, z), and queue the ones still to be made. */
export function updateGround(x, z) {
  frameNo++; camX = x; camZ = z;
  const next = new Set(), was = shown;
  shown = next;
  const reach = quality.opts.view === undefined ? 1 : quality.opts.view, top = reach === 0 ? LEVELS - 2 : LEVELS - 1, n = reach === 2 ? 2 : 1, s = tileSize(top), rx = Math.floor(x / s), rz = Math.floor(z / s);
  for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) select(tileAt(top, rx + dx, rz + dz));
  was.forEach((t) => { if (!next.has(t) && t.part) t.part.mesh.visible = false; });
  next.forEach((t) => { t.part.mesh.visible = true; });
  // tiles nobody has asked about for a while go back to the pool (not the one being made)
  if (frameNo % 30 === 0) tiles.forEach((t) => { if (t.used < frameNo - 90 && !t.queued) release(t); });
}

/** Spend up to `ms` milliseconds making queued tiles, nearest first. Returns how many are still to do. */
export function pumpGround(ms) {
  const until = performance.now() + ms;
  for (;;) {
    if (!job) {
      // drop requests nobody wants any more, then take the nearest
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].used < frameNo - 2 || !tiles.has(queue[i].key)) { queue[i].queued = false; queue.splice(i, 1); }
      if (!queue.length) return 0;
      let best = 0, bd = Infinity;
      queue.forEach((t, i) => { const d = away(t) + t.lv * 0.01; if (d < bd) { bd = d; best = i; } });
      job = fill(queue.splice(best, 1)[0]);
    }
    for (;;) {
      if (job.next().done) { job = null; break; }
      if (performance.now() >= until) return queue.length + 1;
    }
    if (performance.now() >= until) return queue.length + (job ? 1 : 0);
  }
}

/** Make everything wanted round (x, z) right now (at load, and after being moved a long way). */
export function settleGround(x, z) {
  for (let i = 0; i < 12; i++) {
    updateGround(x, z);
    if (!pumpGround(Infinity) && i) break;
  }
  updateGround(x, z);
}

/** Height from the fine tile under a spot, read with the tile's own triangle split; NaN where none is loaded. */
let lastFine = null;
function sample(x, z) {
  const s = TILE_N * CELL, ix = Math.floor(x / s), iz = Math.floor(z / s);
  let t = lastFine;
  if (!t || t.ix !== ix || t.iz !== iz || !t.built) { t = fine.get(fineKey(ix, iz)); if (!t) return NaN; lastFine = t; }
  const fx = Math.min((x - ix * s) / CELL, TILE_N - 1e-6), fz = Math.min((z - iz * s) / CELL, TILE_N - 1e-6);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = t.part.h, a = j * V + i;
  const ha = h[a], hb = h[a + 1], hc = h[a + V], hd = h[a + V + 1];
  // each cell is split along the b–c diagonal
  return u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
}

/**
 * For tests and the debug panel: what the ground is holding. `parts` is how many sets of tile
 * buffers exist in all (on show, kept ready, or pooled): the number that must stop growing.
 */
export const groundStats = () => ({ tiles: tiles.size, shown: shown.size, pooled: pool.length, parts: partsMade, queued: queue.length + (job ? 1 : 0), fine: fine.size, made: madeTotal });

/** Lay the first ground, round the starting spot. */
export function buildGround(x, z) {
  textured = !!(kit && kit.tex.grass_lush);
  groundMat = weatherize(groundDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), textured), 'std');
  world.terrain = { material: groundMat };   // (the seasons tint the ground through this)
  setGroundSampler(sample);
  settleGround(x, z);
}

/**
 * The far land's haze, for the ground and whatever stands on it a long way off (the tree cards).
 * Near you such things fade into the haze like everything else, but never all the way, and beyond
 * that it thickens only slowly, so hills, woods and mountains kilometres off still stand as pale
 * shapes against the sky (uHazeCap is 1 in fog, when they are lost). Call from onBeforeCompile.
 */
export function farHaze(sh) {
  sh.uniforms.uHazeCap = groundU.haze;
  sh.fragmentShader = 'uniform float uHazeCap;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
    #ifdef USE_FOG
      float gFar = 1.0 - exp(-length(vFogPos) / 3500.0);
      float gFog = smoothstep(fogNear, fogFar, fogDepth) * uHazeCap + (1.0 - uHazeCap) * gFar;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, meadowHaze(fogColor, fogGlow, vFogPos, fogSunView), gFog);
    #endif
    gl_FragColor.rgb = meadowGrade(gl_FragColor.rgb);`);
}

/**
 * Per-pixel variation on top of the vertex colours: broad patches of lighter and darker grass,
 * metre-scale mottling, and a fine grain that fades out with distance (so it doesn't shimmer).
 */
function groundDetail(mat, textured) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCam = camU;
    sh.uniforms.uSeason = seasonU;
    sh.uniforms.uFreshSnow = wxU.fresh;
    if (textured) {
      Object.assign(sh.uniforms, {
        tLush: { value: kit.tex.grass_lush }, tFlowers: { value: kit.tex.grass_flowers }, tFine: { value: kit.tex.grass_fine },
        tSoil: { value: kit.tex.soil }, tRock: { value: kit.tex.rocks },
        tViolet: { value: kit.tex.bloom_violet }, tOrange: { value: kit.tex.bloom_orange }, uBloom: groundU.bloom,
        tLeaves: { value: kit.tex.leaves_litter }, uAutumn: groundU.autumn,
      });
    }
    sh.uniforms.uNightGlow = neonU;
    sh.vertexShader = 'varying vec3 vGround;\nattribute vec3 clime;\nvarying vec3 vClime;\nattribute vec4 look;\nvarying vec4 vLook;\n' + (textured ? 'attribute vec4 splat;\nvarying vec4 vSplat;\n' : '') + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vGround = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vClime = clime;
      vLook = look;
      ${textured ? 'vSplat = splat;' : ''}`);
    sh.fragmentShader = 'varying vec3 vGround;\nvarying vec3 vClime;\nvarying vec4 vLook;\nuniform vec3 uCam;\nuniform float uFreshSnow;\nuniform float uNightGlow;\n' + SEASON_GLSL + '#define SNOW_AMOUNT gSnowAmt\nfloat gSnowAmt = 0.0;\n' + (textured ? 'varying vec4 vSplat;\nuniform sampler2D tLush, tFlowers, tFine, tSoil, tRock, tViolet, tOrange, tLeaves;\nuniform float uBloom, uAutumn;\n#define SNOW_COLOR gSnow\nvec3 gSnow = vec3(0.93, 0.95, 0.99);\n' : '') + `
      // (wrapped first: far from the middle of the world the numbers get too big for sin() to scatter)
      float gHash(vec2 p) { return fract(sin(dot(mod(p, 1024.0), vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      vec2 gRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
    ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 q = vGround.xz;
        float d = length(vGround - uCam);
        float broad = gNoise(q * 0.045) * 0.6 + gNoise(q * 0.11) * 0.4;
        float mid = gNoise(q * 0.8);
        // the season's snow, by this spot's own chill today (core/year.js), or fresh snow from the sky
        float seasonIn = chillNow(vClime.x) + (broad - 0.5) * 0.3 + (mid - 0.5) * 0.14;
        gSnowAmt = max(uFreshSnow, 0.79 * smoothstep(0.47, 0.6, seasonIn)) * (1.0 - smoothstep(0.2, 0.6, vLook.w)); // (no snow lies on the volcano's warm black rock)
        ${textured ? `
        // grass: two scales and angles of the lush texture (so no tile repeats), patches of the
        // flowery one, and the fine one far off where the others would shimmer
        vec3 lush = mix(texture2D(tLush, q / 4.2).rgb, texture2D(tLush, gRot(q, 0.83) / 9.7).rgb, 0.45);
        vec3 flw = texture2D(tFlowers, gRot(q, 2.1) / 5.3).rgb;
        vec3 grass = mix(lush, flw, smoothstep(0.5, 0.68, gNoise(q * 0.07 + 3.0)) * 0.85);
        // drifts of colour: violet-and-pink and orange meadow flowers in broad patches
        // (as many as the season allows: full in spring and summer, few in autumn, none in winter)
        // (each seasonal layer is skipped entirely when its season isn't showing)
        if (uBloom > 0.01) {
          float bloomP = smoothstep(0.66, 0.8, gNoise(q * 0.045 + 17.0)) * uBloom;
          vec3 bloom = mix(texture2D(tViolet, gRot(q, 1.3) / 4.6).rgb, texture2D(tOrange, gRot(q, 0.4) / 4.6).rgb, step(0.55, gNoise(q * 0.012 - 5.0)));
          grass = mix(grass, bloom * 1.12, bloomP * 0.9);
        }
        grass *= vec3(1.03, 1.0, 0.84); // the painted grasses lean cool; warm them toward the meadow
        grass = mix(grass, texture2D(tFine, q / 7.0).rgb * vec3(1.05, 1.0, 0.95), smoothstep(28.0, 70.0, d));
        // autumn: drifts of fallen leaves over the grass, thickest in hollows of a broad noise
        if (uAutumn > 0.01) {
          vec4 lf = texture2D(tLeaves, gRot(q, 0.6) / 3.4);
          float litter = lf.a * smoothstep(0.25, 0.65, gNoise(q * 0.09 + 41.0) * 0.7 + gNoise(q * 0.4) * 0.3) * uAutumn;
          grass = mix(grass, lf.rgb * 0.95, litter);
        }
        // winter: snow with soft drifts, wind ripples, blue in the hollows and glints of sparkle
        if (gSnowAmt > 0.01) {
          float drift = gNoise(q * 0.08 + 7.0) * 0.6 + gNoise(q * 0.3) * 0.4;
          float ripple = sin(q.x * 1.7 + q.y * 0.6 + gNoise(q * 0.5) * 4.0) * 0.5 + 0.5;
          gSnow = mix(vec3(0.74, 0.82, 0.95), vec3(0.97, 0.98, 1.0), smoothstep(0.2, 0.75, drift)) * (0.95 + 0.05 * ripple);
          vec2 cell = floor(q * 22.0);
          float glint = step(0.993, gHash(cell)) * (1.0 - smoothstep(4.0, 22.0, d));
          gSnow += vec3(0.5) * glint * (0.5 + 0.5 * sin(dot(uCam.xz, vec2(3.1, 2.3)) + gHash(cell + 3.0) * 30.0));
        }
        vec3 soil = texture2D(tSoil, q / 3.2).rgb;
        vec3 alb = grass;
        // the colour textures carry their own colour; sand and lake bed are the soil, paled
        float soilL = dot(soil, vec3(0.299, 0.587, 0.114));
        vec3 pale = mix(vec3(soilL), soil, 0.35);
        // (the vertex tint is for grass; the other grounds divide it back out)
        vec3 untint = 1.0 / max(vColor, vec3(0.2));
        alb = mix(alb, pale * vec3(1.95, 1.8, 1.45) * untint, vSplat.x);               // sand
        alb = mix(alb, pale * vec3(1.1, 1.15, 0.95) * untint, vSplat.y);               // lake bed
        alb = mix(alb, soil * vec3(1.3, 1.2, 1.05) * untint, vSplat.z);                // the path
        alb = mix(alb, texture2D(tRock, q / 6.0).rgb * 1.5 * untint, vSplat.w);       // rock up high
        diffuseColor.rgb *= alb;
        float shade = (broad - 0.5) * 0.14 + (mid - 0.5) * 0.08;` : `
        float grain = gNoise(q * 4.0) * 0.5 + gNoise(q * 9.0) * 0.5;
        float nearK = 1.0 - smoothstep(12.0, 40.0, d);
        float shade = (broad - 0.5) * 0.18 + (mid - 0.5) * 0.24 + (grain - 0.5) * 0.22 * nearK;`}
        diffuseColor.rgb *= 1.0 + shade;
        // sunlit patches lean yellow-green, shaded ones blue-green
        diffuseColor.rgb += vec3(0.025, 0.02, -0.02) * (broad - 0.5) * 2.0 * diffuseColor.g;
        ${textured ? `// the climate: parched heath turns the grass gold (clumps of it paler, patches greener)
        // (in warm country the drought is in summer: gold then, green in the winter rains)
        float dryNow = clamp(vClime.y + (1.0 - smoothstep(-0.5, 0.0, vClime.x)) * 0.5 * (0.5 - uSeason / 0.75), 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(1.3, 1.07, 0.64) * (0.92 + 0.16 * mid), dryNow);` : ''}
        // the biomes' grounds (core/biome.js): desert sand in wind ripples, dark peaty swamp, the
        // enchanted wood's blue-green moss (glowing faintly here and there at night), black volcanic rock
        {
          float ripple = 0.9 + 0.1 * sin(dot(q, vec2(0.83, 0.31)) * 2.3 + gNoise(q * 0.2) * 5.0);
          vec3 sand = vec3(0.93, 0.76, 0.5) * ripple * (0.92 + 0.16 * broad);
          diffuseColor.rgb = mix(diffuseColor.rgb, sand, smoothstep(0.15, 0.7, vLook.x));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.31, 0.18) * (0.85 + 0.3 * broad), smoothstep(0.2, 0.8, vLook.y) * 0.75);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.82, 0.86), smoothstep(0.2, 0.8, vLook.z));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.12, 0.13) * (0.85 + 0.3 * mid), smoothstep(0.2, 0.75, vLook.w));
        }
        // a lake a long way off: no sheet of water is spared for it, so its bed is painted the colour of water
        // (frozen over when the season is cold there, as a near lake's sheet of water would be)
        vec3 farWater = mix(vec3(0.2, 0.42, 0.58), vec3(0.8, 0.86, 0.92), smoothstep(0.5, 0.6, chillNow(vClime.x)));
        diffuseColor.rgb = mix(diffuseColor.rgb, farWater, smoothstep(0.3, 0.7, vClime.z));
        // in the cold, snow lies in ragged drifts that close up into snowfields (and on the high peaks all year)
        float snowIn = vClime.x + (broad - 0.5) * 0.3 + (mid - 0.5) * 0.14 - vLook.w;
        vec3 snowCol = mix(vec3(0.78, 0.85, 0.96), vec3(0.95, 0.97, 1.0), smoothstep(0.3, 0.75, broad));
        diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, smoothstep(0.47, 0.6, snowIn));
      }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float speck = step(0.985, fract(sin(dot(floor(vGround.xz * 1.7), vec2(12.9898, 78.233))) * 43758.5453));
        totalEmissiveRadiance += vec3(0.3, 0.9, 1.0) * speck * smoothstep(0.4, 0.9, vLook.z) * uNightGlow * 1.6;
        // and the lava's glow in the cracks of volcanic rock
        float crack = smoothstep(0.93, 0.985, 1.0 - abs(gNoise(vGround.xz * 0.09) * 2.0 - 1.0)) * smoothstep(0.4, 0.6, gNoise(vGround.xz * 0.013 + 7.0));
        totalEmissiveRadiance += vec3(1.0, 0.35, 0.08) * crack * smoothstep(0.5, 0.9, vLook.w) * (0.5 + uNightGlow);
      }`);
    farHaze(sh);
  };
  mat.customProgramCacheKey = () => 'ground' + (textured ? '-tex' : '');
  return mat;
}
