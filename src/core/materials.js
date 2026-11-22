// Shared materials, shader tweaks and instancing helpers.
import * as THREE from 'three';
import { scene } from './render.js';

export const timeU = { value: 0 };                            // drives grass and reed sway
export const windU = { value: 1 };                            // sway strength
export const wxU = { snow: { value: 0 }, wet: { value: 0 }, fresh: { value: 0 } };  // snow cover and wetness on surfaces; `fresh`: snow fallen from the sky (the ground keeps the season's own)
export const camU = { value: new THREE.Vector3() };            // camera position, for distance fades

export const col = (hex) => new THREE.Color(hex);
export const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, flatShading: true, roughness: 0.95, metalness: 0 }, extra || {}));

/**
 * Wind sway in the vertex shader; taller vertices move more. With `fade` ([near, far] metres),
 * each instance shrinks into the ground between those distances from the camera, so small
 * plants can stop being drawn far away without popping; `fadeIn` does the reverse, growing
 * them in with distance (a cheap far version taking over from a detailed near one). (Lambert materials don't get three's
 * own cameraPosition in r128, hence camU.)
 */
export function addWind(mat, k, fade = null, fadeIn = null, sheen = 0.2) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.uniforms.uWind = windU;
    sh.uniforms.uCam = camU;
    sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\nuniform vec3 uCam;\nvarying float vGust;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xz;
      #else
        vec2 ip = vec2(0.0);
      #endif
      float wv = sin(uTime * 1.7 + ip.x * 0.31 + ip.y * 0.23) * 0.6 + sin(uTime * 3.1 + ip.x * 0.8 - ip.y * 0.5) * 0.25;
      // gusts: broad soft bands that roll across the meadow with the wind, pressing plants over
      float gb = dot(ip, vec2(0.894, 0.447)) * 0.075 - uTime * 0.9 + sin(ip.x * 0.043 - ip.y * 0.061 + uTime * 0.13) * 2.2;
      float gust = pow(0.5 + 0.5 * sin(gb), 4.0) * (0.55 + 0.45 * sin(ip.y * 0.021 + ip.x * 0.013 + uTime * 0.07));
      vGust = gust * min(uWind, 1.6);
      float hh = max(position.y, 0.0);
      transformed.x += (wv + gust * 1.8) * hh * hh * ${k.toFixed(4)} * uWind;
      transformed.z += (wv + gust * 1.8) * hh * hh * ${(k * 0.5).toFixed(4)} * uWind;
      ${fade || fadeIn ? `
        float pd = distance(ip, uCam.xz);
        float ph = fract(sin(dot(ip, vec2(12.9898, 78.233))) * 43758.5453);` : ''}
      ${fade ? `
        // thinning with distance: each plant has its own cut-off between the two distances
        // (more of them reach the far end), shrinking away over the last few metres before it;
        // the ones still standing grow a little wider so the ground stays covered
        float pCut = mix(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, sqrt(ph));
        float pFar = smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, pd);
        transformed *= 1.0 - smoothstep(pCut - 5.0, pCut, pd);
        transformed.xz *= 1.0 + pFar * 0.6;` : ''}
      ${fadeIn ? `
        // filling in with distance, the reverse: each plant appears at its own distance
        float pIn = mix(${fadeIn[0].toFixed(1)}, ${fadeIn[1].toFixed(1)}, ph);
        transformed *= smoothstep(pIn - 3.0, pIn, pd);` : ''}`);
    // bent-over blades show their paler side: the gust reads as a light wave moving through
    sh.fragmentShader = 'varying float vGust;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 1.0 + vGust * ${sheen.toFixed(3)};`);
  };
  mat.customProgramCacheKey = () => 'wind' + k + '-' + sheen + (fade ? '-fade' + fade.join('-') : '') + (fadeIn ? '-in' + fadeIn.join('-') : '');
  return mat;
}

/** Surfaces turn darker and glossier when wet, and white on upward faces as snow settles. */
export function weatherize(mat, mode) {
  const prev = mat.onBeforeCompile;
  const baseKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uSnow = wxU.snow;
    sh.uniforms.uWet = wxU.wet;
    // a material can paint its own snow by defining SNOW_COLOR (the ground does); otherwise plain white
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', '#ifndef SNOW_COLOR\n#define SNOW_COLOR vec3(0.93, 0.95, 0.99)\n#endif\n#ifndef SNOW_AMOUNT\n#define SNOW_AMOUNT uSnow\n#endif\nvoid main() {');
    sh.fragmentShader = 'uniform float uSnow;\nuniform float uWet;\n' + (mode === 'std'
      ? sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 wN = inverseTransformDirection(normal, viewMatrix);
          float sAmt = SNOW_AMOUNT * smoothstep(0.3, 0.75, wN.y);
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - uWet * 0.38), SNOW_COLOR, sAmt);
          roughnessFactor = mix(roughnessFactor, 0.42, uWet * (1.0 - sAmt));
        }`)
      : sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - uWet * 0.3), vec3(0.93, 0.95, 0.99), SNOW_AMOUNT * 0.85);`));
  };
  mat.customProgramCacheKey = () => baseKey + '|wx-' + mode;
  return mat;
}

/**
 * Thin things (grass, petals, leaves) drawn from both sides with the same light on each face.
 * Plain double-sided Lambert lights the back with a flipped normal, which turns it black.
 */
export function bothSides(mat) {
  const prev = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey();
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader.split(': vLightBack').join(': vLightFront').split(': vIndirectBack').join(': vIndirectFront');
  };
  mat.customProgramCacheKey = () => baseKey + '|both';
  return mat;
}

export function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  parts.forEach((g) => { n += g.attributes.position.array.length; });
  const pos = new Float32Array(n);
  let o = 0;
  parts.forEach((g) => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

export function enableShadows(obj) { obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }

export const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
function composeItem(it, cx = 0, cz = 0) {
  E.set(it.rx || 0, it.ry || 0, it.rz || 0);
  Q.setFromEuler(E);
  V.set(it.x - cx, it.y, it.z - cz);
  S.set(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
  return M4.compose(V, Q, S);
}

/** One InstancedMesh for a small set of things that stay close together (or always on screen). */
export function instanced(geo, mat, items, opts = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    mesh.setMatrixAt(i, composeItem(it));
    if (it.color) mesh.setColorAt(i, it.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = !!opts.cast;
  mesh.receiveShadow = opts.receive !== false;
  mesh.frustumCulled = false; // three r128 culls instanced meshes by the base geometry only
  scene.add(mesh);
  return mesh;
}

/**
 * Instances split into a grid of cells, each its own mesh with correct bounds, so the renderer
 * skips cells behind the camera and outside the shadow frustum. Returns a handle that edits
 * instances by their original index.
 */
export function instancedChunks(geo, mat, items, opts = {}) {
  const cell = opts.cell || 40;
  geo.computeBoundingBox();
  const gb = geo.boundingBox;
  const groups = new Map();
  items.forEach((it, i) => {
    const key = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const where = new Array(items.length);
  const meshes = [];
  for (const idxs of groups.values()) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity, maxS = 0;
    for (const i of idxs) {
      const it = items[i], s = Math.max(it.sx || it.s || 1, it.sy || it.s || 1, it.sz || it.s || 1);
      minX = Math.min(minX, it.x); maxX = Math.max(maxX, it.x);
      minZ = Math.min(minZ, it.z); maxZ = Math.max(maxZ, it.z);
      minY = Math.min(minY, it.y); maxY = Math.max(maxY, it.y);
      maxS = Math.max(maxS, s);
    }
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    // a geometry that shares the GPU buffers but carries this cell's bounds
    const g = new THREE.BufferGeometry();
    for (const name in geo.attributes) g.setAttribute(name, geo.attributes[name]);
    if (geo.index) g.setIndex(geo.index);
    const ext = Math.max(Math.abs(gb.min.x), Math.abs(gb.max.x), Math.abs(gb.min.z), Math.abs(gb.max.z)) * maxS;
    const halfY = ((maxY - minY) + gb.max.y * maxS - Math.min(0, gb.min.y * maxS)) / 2;
    const cy = (minY + Math.min(0, gb.min.y * maxS) + maxY + gb.max.y * maxS) / 2;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, cy, 0), Math.hypot((maxX - minX) / 2 + ext, (maxZ - minZ) / 2 + ext, halfY) + 0.5);
    const mesh = new THREE.InstancedMesh(g, mat, idxs.length);
    mesh.position.set(cx, 0, cz);
    idxs.forEach((i, k) => {
      mesh.setMatrixAt(k, composeItem(items[i], cx, cz));
      if (items[i].color) mesh.setColorAt(k, items[i].color);
      where[i] = [meshes.length, k];
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !!opts.cast;
    mesh.receiveShadow = opts.receive !== false;
    if (opts.depthMat) mesh.customDepthMaterial = opts.depthMat;
    if (!opts.cast) mesh.layers.set(1); // small plants live on layer 1
    scene.add(mesh);
    meshes.push(mesh);
  }
  if (opts.far || (opts.cast && opts.shadowRange)) ranged.push({ meshes, far: opts.far || 0, shadow: opts.cast ? opts.shadowRange || 0 : 0 });
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const dirtyM = new Set(), dirtyC = new Set();
  return {
    meshes,
    material: mat,
    count: items.length,
    setColorAt(i, color) { const [m, k] = where[i]; meshes[m].setColorAt(k, color); dirtyC.add(m); },
    /** Show or hide one instance without rebuilding anything. */
    setVisibleAt(i, on) { const [m, k] = where[i]; meshes[m].setMatrixAt(k, on ? composeItem(items[i], meshes[m].position.x, meshes[m].position.z) : zero); dirtyM.add(m); },
    commit() {
      dirtyM.forEach((m) => { meshes[m].instanceMatrix.needsUpdate = true; });
      dirtyC.forEach((m) => { if (meshes[m].instanceColor) meshes[m].instanceColor.needsUpdate = true; });
      dirtyM.clear(); dirtyC.clear();
    },
    set visible(v) { meshes.forEach((m) => { m.userData.off = !v; m.visible = v && !m.userData.far; }); },
  };
}

/**
 * Several shapes drawn as one set: `variantOf(item, i)` picks the geometry for each item (or -1
 * for none). The handle edits instances by their index in `items`, like instancedChunks.
 */
export function instancedVariants(geos, mat, items, variantOf, opts = {}) {
  const lists = geos.map(() => []), where = [];
  items.forEach((it, i) => { const v = variantOf(it, i); where[i] = v < 0 ? null : [v, lists[v].length]; if (v >= 0) lists[v].push(it); });
  const hs = lists.map((l, v) => (l.length ? instancedChunks(geos[v], mat, l, opts) : null));
  return {
    material: mat,
    count: items.length,
    setColorAt(i, color) { const w = where[i]; if (w) hs[w[0]].setColorAt(w[1], color); },
    setVisibleAt(i, on) { const w = where[i]; if (w) hs[w[0]].setVisibleAt(w[1], on); },
    commit() { hs.forEach((h) => h && h.commit()); },
    set visible(v) { hs.forEach((h) => { if (h) h.visible = v; }); },
  };
}

/**
 * Things that come and go as you walk (the wilds' rocks, bushes and flowers): one InstancedMesh
 * per shape with a fixed number of slots, refilled with `setItems(items, variantOf)`. Nothing is
 * allocated or thrown away after it is made; items past the last slot are counted in `dropped`.
 * Meant for things that only exist near the camera, so the meshes are never culled as a whole.
 */
export function slotSet(geos, mat, capacity, opts = {}) {
  const meshes = geos.map((geo) => {
    const m = new THREE.InstancedMesh(geo, mat, capacity);
    if (opts.colored) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    m.count = 0; m.visible = false;
    m.frustumCulled = false;
    m.castShadow = !!opts.cast;
    m.receiveShadow = opts.receive !== false;
    if (opts.depthMat) m.customDepthMaterial = opts.depthMat;
    if (!opts.cast) m.layers.set(1); // small plants live on layer 1
    scene.add(m);
    return m;
  });
  const fill = new Int32Array(geos.length);
  let dropped = 0, on = true;
  return {
    meshes,
    material: mat,
    get dropped() { return dropped; },
    setItems(items, variantOf) {
      fill.fill(0); dropped = 0;
      for (const it of items) {
        const v = variantOf(it);
        if (v < 0) continue;
        const m = meshes[v], k = fill[v];
        if (k >= capacity) { dropped++; continue; }
        fill[v]++;
        if (!it.m16) it.m16 = composeItem(it).toArray(new Float32Array(16)); // (kept on the item: refills only copy it)
        m.instanceMatrix.array.set(it.m16, k * 16);
        if (m.instanceColor && it.color) it.color.toArray(m.instanceColor.array, k * 3);
      }
      meshes.forEach((m, v) => {
        m.count = fill[v];
        m.visible = on && m.count > 0;
        if (!m.count) return;
        m.instanceMatrix.updateRange.offset = 0; m.instanceMatrix.updateRange.count = m.count * 16;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) { m.instanceColor.updateRange.offset = 0; m.instanceColor.updateRange.count = m.count * 3; m.instanceColor.needsUpdate = true; }
      });
    },
    set visible(v) { on = v; meshes.forEach((m) => { m.visible = v && m.count > 0; }); },
  };
}

// ───────────── distance: what gets drawn, and what casts shadows ─────────────
const ranged = [], lodSets = [];
const faded = new WeakMap(); // materials already given a cross-fade (several sets share one)
const FR = new THREE.Frustum(), FM = new THREE.Matrix4(), SPH = new THREE.Sphere();

/**
 * Cross-fade between a detailed shape and a cheaper one across a distance band, as a fine
 * dither: the near shape thins out while the far one fills in, so nothing switches in one frame.
 * Far geometries carry a `lodSide` attribute of 1; near ones have none (it reads as 0). Wraps any
 * shader changes the material already has, and works on depth materials too, so shadows fade.
 */
export function lodFade(mat, band) {
  const prev = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uLodCam = camU;
    sh.vertexShader = 'uniform vec3 uLodCam;\nattribute float lodSide;\nvarying float vLodT;\nvarying float vLodSide;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 lodIp = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xz;
      #else
        vec2 lodIp = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
      #endif
      vLodT = smoothstep(${band[0].toFixed(1)}, ${band[1].toFixed(1)}, distance(lodIp, uLodCam.xz));
      vLodSide = lodSide;`);
    sh.fragmentShader = 'varying float vLodT;\nvarying float vLodSide;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      {
        float lodD = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (vLodSide > 0.5 ? lodD >= vLodT : lodD < vLodT) discard;
      }`);
  };
  mat.customProgramCacheKey = () => baseKey + '|lod' + band.join('-');
  return mat;
}

/**
 * Trees and other big things with two shapes: the detailed one near the camera (casting
 * shadows), a cheaper one further away (no shadow, and skipped when off screen). Across
 * `opts.band` both are drawn and cross-fade (see lodFade). Instances are re-sorted only when
 * something crosses a boundary. The handle edits by index in `items`; `variantOf` may return -1
 * for items this set doesn't draw.
 *
 * The items can be swapped for another list at any time (`setItems`): trees come and go as you
 * walk. For that, give `opts.capacity` (slots per shape; nothing is ever reallocated, and items
 * past it are counted in `dropped`) and say whether the items carry colours (`opts.colored`).
 * `opts.maxDist` stops drawing the far shape beyond that distance (something cheaper takes over);
 * give it as `{ value }` to change it while running.
 */
export function lodSet(nearGeos, farGeos, mat, items, variantOf, opts = {}) {
  const band = opts.band || [(opts.near || 55) - 10, (opts.near || 55) + 5];
  const in2 = band[0] ** 2, out2 = band[1] ** 2, lift = opts.lift || 3, radius = opts.radius || 3.5;
  const reach = typeof opts.maxDist === 'object' ? opts.maxDist : { value: opts.maxDist || Infinity };
  let n = 0, kind = [], mats = new Float32Array(0), colors = [], state = new Uint8Array(0), dirty = true, dropped = 0;
  const load = (list) => {
    items = list; n = list.length; kind = list.map(variantOf);
    if (mats.length < n * 16) mats = new Float32Array(Math.ceil(n * 1.4) * 16);
    // (a tree's matrix is kept on the tree: several sets draw the same one, and a refill then copies 16 numbers instead of composing them)
    list.forEach((it, i) => { if (it.m16) mats.set(it.m16, i * 16); else { composeItem(it).toArray(mats, i * 16); if (opts.capacity) it.m16 = mats.slice(i * 16, i * 16 + 16); } });
    colors = list.map((it) => { const c = it.shown || it.color; return c ? c.clone() : null; }); // (`shown`: the colour the season gives it)
    state = new Uint8Array(n).fill(255);
    dirty = true;
  };
  load(items);
  const counts = nearGeos.map((_, v) => opts.capacity || kind.filter((k) => k === v).length);
  const colored = opts.colored !== undefined ? opts.colored : !!colors[0];
  const fade = (m) => {
    const was = faded.get(m);
    if (!was) { lodFade(m, band); faded.set(m, band.join()); } else if (was !== band.join()) console.warn('lodSet: one material, two fade bands');
    return m;
  };
  const depth = fade(opts.depthMat || new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  fade(mat);
  if (opts.farMat) fade(opts.farMat);
  farGeos.forEach((g) => { if (!g.attributes.lodSide) g.setAttribute('lodSide', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1)); });
  const mk = (geo, cap, cast, material = mat) => {
    const m = new THREE.InstancedMesh(geo, material, Math.max(cap, 1));
    if (cast) m.customDepthMaterial = depth;
    if (colored) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(cap, 1) * 3), 3);
    m.userData.cap = Math.max(cap, 1);
    m.count = 0; m.visible = false;
    m.frustumCulled = false; // placement is handled here
    m.castShadow = cast; m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const nearM = nearGeos.map((g, v) => mk(g, counts[v], !!opts.cast));
  const farM = farGeos.map((g, v) => mk(g, counts[v], false, opts.farMat || mat));
  // state per item: bit 1 = near shape drawn, bit 2 = far shape drawn (both inside the band)
  const fill = new Int32Array(nearGeos.length * 2);
  let on = true;
  const set = {
    get count() { return n; },
    /** How many items found no free slot at the last re-sort (0 unless `capacity` is too small). */
    get dropped() { return dropped; },
    /** Draw another list of items instead. */
    setItems: load,
    material: mat,
    update(cam) {
      let changed = dirty;
      const max2 = reach.value ** 2;
      for (let i = 0; i < n; i++) {
        const it = items[i], dx = it.x - cam.x, dz = it.z - cam.z, d2 = dx * dx + dz * dz, sc = it.s || 1;
        let st = 0;
        if (on && kind[i] >= 0) {
          if (d2 < out2) st |= 1;
          if (d2 > in2 && d2 < max2) { SPH.center.set(it.x, it.y + lift * sc, it.z); SPH.radius = radius * sc; if (FR.intersectsSphere(SPH)) st |= 2; }
        }
        if (st !== state[i]) { state[i] = st; changed = true; }
      }
      if (!changed) return;
      dirty = false;
      dropped = 0;
      fill.fill(0);
      for (let i = 0; i < n; i++) {
        for (let f = 0; f < 2; f++) {
          if (!(state[i] & (f + 1))) continue;
          const m = f === 0 ? nearM[kind[i]] : farM[kind[i]], k = fill[kind[i] * 2 + f];
          if (k >= m.userData.cap) { dropped++; continue; }
          fill[kind[i] * 2 + f]++;
          m.instanceMatrix.array.set(mats.subarray(i * 16, i * 16 + 16), k * 16);
          if (colors[i] && m.instanceColor) colors[i].toArray(m.instanceColor.array, k * 3);
        }
      }
      [nearM, farM].forEach((list, f) => list.forEach((m, v) => {
        m.count = fill[v * 2 + f];
        m.visible = m.count > 0;
        if (!m.count) return;
        // (send the graphics card only the slots in use, not the whole of a buffer sized for a forest)
        m.instanceMatrix.updateRange.offset = 0; m.instanceMatrix.updateRange.count = m.count * 16;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) { m.instanceColor.updateRange.offset = 0; m.instanceColor.updateRange.count = m.count * 3; m.instanceColor.needsUpdate = true; }
      }));
    },
    setColorAt(i, c) { if (colors[i]) { colors[i].copy(c); dirty = true; } },
    commit() {},
    set visible(v) { on = v; dirty = true; },
  };
  lodSets.push(set);
  return set;
}

/**
 * Once a frame, after the camera has moved: hide plant chunks beyond their fade distance,
 * let only chunks near `focus` (the shadow box follows it) cast shadows, and re-sort trees.
 */
export function updateDetail(camera, focus) {
  camU.value.copy(camera.position);
  const cx = camera.position.x, cz = camera.position.z;
  for (const r of ranged) {
    for (const m of r.meshes) {
      const s = m.geometry.boundingSphere, x = m.position.x + s.center.x, z = m.position.z + s.center.z;
      if (r.far) { m.userData.far = Math.hypot(x - cx, z - cz) - s.radius > r.far; m.visible = !m.userData.off && !m.userData.far; }
      if (r.shadow) m.castShadow = Math.hypot(x - focus.x, z - focus.z) - s.radius < r.shadow;
    }
  }
  camera.updateMatrixWorld();
  FR.setFromProjectionMatrix(FM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const l of lodSets) l.update(camera.position);
}

/** Shadow material for leaf and grass cards: three r128 ignores alphaTest when drawing shadows. */
/**
 * Every tree its own shape, though they share a handful of models: each one leans, twists and
 * stretches by noise read at its own spot. A smooth noise field gives neighbouring trees a shared,
 * wind-sculpted lean; a hash of the spot adds each tree's own lean, a twist that turns its crown
 * further round the higher it goes (so limbs reach new ways), and a taller or squatter crown.
 * Apply it to a tree's bark, its leaves and both their shadow materials, so all four agree.
 */
const TREE_WARP_HEAD = `
  float twHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float twNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(twHash(i), twHash(i + vec2(1.0, 0.0)), f.x), mix(twHash(i + vec2(0.0, 1.0)), twHash(i + vec2(1.0, 1.0)), f.x), f.y); }
  float twTwist(vec2 ip, float y) { return (twHash(ip + 7.7) - 0.5) * 1.5 * smoothstep(1.0, 5.0, y); }`;
export function treeWarp(mat) {
  const prev = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.vertexShader = TREE_WARP_HEAD + '\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      #ifdef USE_INSTANCING
      { float twA = twTwist((modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xz, position.y), twC = cos(twA), twS = sin(twA);
        objectNormal.xz = mat2(twC, -twS, twS, twC) * objectNormal.xz; }
      #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      {
        vec2 twIp = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xz;
        float twH = clamp(transformed.y / 6.5, 0.0, 1.4);
        float twA = twTwist(twIp, transformed.y), twC = cos(twA), twS = sin(twA);
        transformed.xz = mat2(twC, -twS, twS, twC) * transformed.xz;
        transformed.y *= 1.0 + (twHash(twIp + 11.3) - 0.5) * 0.2 * smoothstep(0.3, 0.75, twH);
        // lean, in metres at the top: the meadow's slow field plus this tree's own, turned into the model's frame
        vec2 twLean = (vec2(twNoise(twIp * 0.018), twNoise(twIp * 0.018 + 17.3)) - 0.5) * 1.6 + (vec2(twHash(twIp), twHash(twIp + 3.1)) - 0.5) * 1.1;
        vec3 twL = transpose(mat3(instanceMatrix)) * vec3(twLean.x, 0.0, twLean.y) / max(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), 1e-4);
        transformed.xz += twL.xz * twH * twH;
      }
      #endif`);
  };
  mat.customProgramCacheKey = () => baseKey + '|treewarp';
  return mat;
}

export function cutoutDepth(map, alphaTest = 0.5) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
}

/**
 * Soft leaf edges: cut-out leaves, petals and grass cards get antialiased edges through
 * alpha-to-coverage instead of a hard alpha test. The texture's alpha is first sharpened to a
 * one-pixel ramp around the cut-off (so leaves keep their shape and thickness), then the
 * multisampled buffer turns that ramp into partial coverage. Without multisampling the
 * sharpened alpha behaves just like the old alpha test. Apply it last (after addWind, which
 * replaces onBeforeCompile).
 */
export function softEdges(mat) {
  const prev = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey();
  mat.alphaToCoverage = true;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', `#ifdef ALPHATEST
      #if __VERSION__ >= 300
        diffuseColor.a = clamp((diffuseColor.a - ALPHATEST) / max(fwidth(diffuseColor.a), 1e-4) + 0.5, 0.0, 1.0);
        if (diffuseColor.a < 0.01) discard;
      #else
        if (diffuseColor.a < ALPHATEST) discard;
      #endif
      #endif`);
  };
  mat.customProgramCacheKey = () => baseKey + '|soft';
  return mat;
}

/** How strongly the flowers glow (0 by day, 1 deep in the night); set each frame from the time of day. */
export const neonU = { value: 0 };
/**
 * Neon flowers: at night petals light up in their own colour, pushed to full saturation and
 * bright enough for the glow (bloom) to catch them. Green parts of a texture (stems, sepals) stay dark.
 * Added before the haze, so far-off flowers still melt into the night. Apply after addWind.
 */
export function neonAtNight(mat, k = 1) {
  const prev = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uNeon = neonU;
    sh.fragmentShader = 'uniform float uNeon;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `if (uNeon > 0.001) {
        vec3 nc = diffuseColor.rgb;
        float nm = max(max(nc.r, nc.g), nc.b), nl = min(min(nc.r, nc.g), nc.b);
        vec3 vivid = nc / max(nm, 1e-3);
        vivid = mix(vec3(0.75, 0.85, 1.0), (vivid - nl / max(nm, 1e-3) * 0.6) / (1.0 - nl / max(nm, 1e-3) * 0.6 + 1e-3), smoothstep(0.04, 0.25, (nm - nl) / max(nm, 1e-3)));
        float petal = 1.0 - smoothstep(0.0, 0.06, nc.g - max(nc.r, nc.b));
        // a white-hot core under the colour, like a neon tube, so the glow (bloom) haloes even deep violets
        gl_FragColor.rgb = max(gl_FragColor.rgb, (vivid * 1.5 + 0.3) * petal * uNeon * ${(1.0 * k).toFixed(3)}); // (max, not add: petals still lit by the dusk do not blow out)
      }
      #include <fog_fragment>`);
  };
  mat.customProgramCacheKey = () => baseKey + '|neon' + k;
  return mat;
}

/**
 * Fewer draws: the meshes hanging straight under `group` that never move on their own are merged, one
 * mesh per material (and per shadow setting), in the group's own frame. Each draw costs a fixed amount of
 * the frame on integrated graphics, whatever its size, so a jetty of 27 planks and posts drawn as 4 meshes
 * is much cheaper. Only plain meshes (not instanced, not skinned) with the same set of attributes merge.
 */
export function mergeStatic(group) {
  const sets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || m.children.length || m.userData.keep) continue;
    const key = m.material.uuid + (m.castShadow ? 'c' : '') + (m.receiveShadow ? 'r' : '');
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(m);
  }
  for (const list of sets.values()) {
    if (list.length < 2) continue;
    const names = Object.keys(list[0].geometry.attributes).filter((n) => list.every((m) => m.geometry.attributes[n]));
    const geos = list.map((m) => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
      return g;
    });
    let n = 0; for (const g of geos) n += g.attributes.position.count;
    const out = new THREE.BufferGeometry();
    for (const name of names) {
      const size = geos[0].attributes[name].itemSize, arr = new Float32Array(n * size);
      let o = 0; for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    const mesh = new THREE.Mesh(out, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    for (const m of list) { group.remove(m); m.geometry.dispose(); }
    group.add(mesh);
  }
  return group;
}
