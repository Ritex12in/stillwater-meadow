// Shared materials, shader tweaks and instancing helpers.
import * as THREE from 'three';
import { scene } from './render.js';

export const timeU = { value: 0 };                            // drives grass and reed sway
export const windU = { value: 1 };                            // sway strength
export const wxU = { snow: { value: 0 }, wet: { value: 0 } };  // snow cover and wetness on surfaces
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
export function addWind(mat, k, fade = null, fadeIn = null) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.uniforms.uWind = windU;
    sh.uniforms.uCam = camU;
    sh.vertexShader = 'uniform float uTime;\nuniform float uWind;\nuniform vec3 uCam;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xz;
      #else
        vec2 ip = vec2(0.0);
      #endif
      float wv = sin(uTime * 1.7 + ip.x * 0.31 + ip.y * 0.23) * 0.6 + sin(uTime * 3.1 + ip.x * 0.8 - ip.y * 0.5) * 0.25;
      float hh = max(position.y, 0.0);
      transformed.x += wv * hh * hh * ${k.toFixed(3)} * uWind;
      transformed.z += wv * hh * hh * ${(k * 0.5).toFixed(3)} * uWind;
      ${fade ? `transformed *= 1.0 - smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, distance(ip, uCam.xz));` : ''}
      ${fadeIn ? `transformed *= smoothstep(${fadeIn[0].toFixed(1)}, ${fadeIn[1].toFixed(1)}, distance(ip, uCam.xz));` : ''}`);
  };
  mat.customProgramCacheKey = () => 'wind' + k + (fade ? '-fade' + fade.join('-') : '') + (fadeIn ? '-in' + fadeIn.join('-') : '');
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
    sh.fragmentShader = 'uniform float uSnow;\nuniform float uWet;\n' + (mode === 'std'
      ? sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 wN = inverseTransformDirection(normal, viewMatrix);
          float sAmt = uSnow * smoothstep(0.3, 0.75, wN.y);
          diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - uWet * 0.38), vec3(0.93, 0.95, 0.99), sAmt);
          roughnessFactor = mix(roughnessFactor, 0.42, uWet * (1.0 - sAmt));
        }`)
      : sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - uWet * 0.3), vec3(0.93, 0.95, 0.99), uSnow * 0.85);`));
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

// ───────────── distance: what gets drawn, and what casts shadows ─────────────
const ranged = [], lodSets = [];
const FR = new THREE.Frustum(), FM = new THREE.Matrix4(), SPH = new THREE.Sphere();

/**
 * Trees and other big things with two shapes: the detailed one near the camera (casting
 * shadows), a simple one further away (no shadow, and skipped when off screen). Instances are
 * re-sorted only when something crosses a boundary. The handle edits by index in `items`.
 */
export function lodSet(nearGeos, farGeos, mat, items, variantOf, opts = {}) {
  const near2 = (opts.near || 55) ** 2, lift = opts.lift || 3, radius = opts.radius || 3.5;
  const n = items.length, kind = items.map(variantOf);
  const mats = new Float32Array(n * 16);
  items.forEach((it, i) => composeItem(it).toArray(mats, i * 16));
  const colors = items.map((it) => (it.color ? it.color.clone() : null));
  const counts = nearGeos.map((_, v) => kind.filter((k) => k === v).length);
  const mk = (geo, cap, cast, material = mat) => {
    const m = new THREE.InstancedMesh(geo, material, Math.max(cap, 1));
    if (cast && opts.depthMat) m.customDepthMaterial = opts.depthMat;
    if (colors[0]) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(cap, 1) * 3), 3);
    m.count = 0; m.visible = false;
    m.frustumCulled = false; // placement is handled here
    m.castShadow = cast; m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const nearM = nearGeos.map((g, v) => mk(g, counts[v], !!opts.cast));
  const farM = farGeos.map((g, v) => mk(g, counts[v], false, opts.farMat || mat));
  const state = new Uint8Array(n).fill(255), fill = new Int32Array(nearGeos.length * 2);
  let dirty = true, on = true;
  const set = {
    count: n,
    material: mat,
    update(cam) {
      let changed = dirty;
      for (let i = 0; i < n; i++) {
        const it = items[i], dx = it.x - cam.x, dz = it.z - cam.z, sc = it.s || 1;
        let st = 0;
        if (on) {
          if (dx * dx + dz * dz < near2) st = 1;
          else { SPH.center.set(it.x, it.y + lift * sc, it.z); SPH.radius = radius * sc; st = FR.intersectsSphere(SPH) ? 2 : 0; }
        }
        if (st !== state[i]) { state[i] = st; changed = true; }
      }
      if (!changed) return;
      dirty = false;
      fill.fill(0);
      for (let i = 0; i < n; i++) {
        if (!state[i]) continue;
        const slot = kind[i] * 2 + state[i] - 1, m = state[i] === 1 ? nearM[kind[i]] : farM[kind[i]], k = fill[slot]++;
        m.instanceMatrix.array.set(mats.subarray(i * 16, i * 16 + 16), k * 16);
        if (colors[i]) colors[i].toArray(m.instanceColor.array, k * 3);
      }
      [nearM, farM].forEach((list, f) => list.forEach((m, v) => {
        m.count = fill[v * 2 + f];
        m.visible = m.count > 0;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }));
    },
    setColorAt(i, c) { colors[i].copy(c); dirty = true; },
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
export function cutoutDepth(map, alphaTest = 0.5) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest });
}
