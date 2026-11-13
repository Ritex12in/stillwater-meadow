// The meadow's grass, made on the GPU. Two draw calls cover everything: a dense field of tufts
// near you and a coarser one further out. Each is one tuft shape drawn many times; the vertex
// shader puts every copy on a grid that moves with the camera, at a spot jittered by a hash of
// its *world* grid cell (so blades stay put as you walk), reads the ground height and whether
// grass grows there from a small baked map, and sways it in the wind. Nothing per blade lives on
// the CPU, and the blades are plain solid shapes (no cut-out textures), so they are cheap to draw.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../core/render.js';
import { smooth } from '../core/math.js';
import { heightAt, lakeT, pathAmt, nearReserved, onDock, TERRAIN, BENCH_SPOT } from '../core/shape.js';
import { weatherize, bothSides, timeU, windU, camU } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';

// ── the ground map: height and how grassy each spot is, on the terrain's own grid ──
function groundMap() {
  const n = TERRAIN.seg + 1, half = TERRAIN.size / 2, step = TERRAIN.size / TERRAIN.seg;
  const data = new Float32Array(n * n * 4);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = -half + ix * step, z = -half + iz * step, h = heightAt(x, z), i = (iz * n + ix) * 4;
      let g = smooth(1.12, 1.22, lakeT(x, z)) * (1 - smooth(0.15, 0.5, pathAmt(x, z))) * (1 - smooth(11, 16, h));
      if (onDock(x, z) || nearReserved(x, z, 1.2) || Math.hypot(x - BENCH_SPOT.x, z - BENCH_SPOT.z) < 1.3) g = 0;
      data[i] = h; data[i + 1] = g;
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = t.minFilter = THREE.NearestFilter; // filtered by hand in the shader (float filtering isn't everywhere)
  t.needsUpdate = true;
  return t;
}

/** One tuft: three tapered, slightly curved blades fanned round the centre. y runs 0..1. */
function tuftGeo(blades, segs) {
  const parts = [];
  for (let b = 0; b < blades; b++) {
    const pos = [], col = [], idx = [];
    const a = (b / blades) * Math.PI * 2 + 0.4, ca = Math.cos(a), sa = Math.sin(a), lean = 0.18 + 0.1 * b;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, w = 0.045 * (1 - t) ** 0.8, y = t, off = lean * t * t;
      const cx = ca * off, cz = sa * off;
      if (s < segs) { pos.push(cx - sa * w, y, cz + ca * w, cx + sa * w, y, cz - ca * w); col.push(t, t, t, t, t, t); } else { pos.push(cx, y, cz); col.push(1, 1, 1); }
    }
    for (let s = 0; s < segs - 1; s++) { const i = s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    const last = (segs - 1) * 2;
    idx.push(last, last + 1, last + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); // 0 at the root, 1 at the tip
    g.setIndex(idx);
    parts.push(g);
  }
  return BufferGeometryUtils.mergeBufferGeometries(parts);
}

/** The material both fields share: a Lambert material whose vertex shader places the tufts. */
function grassMaterial(map, tex) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: tex || null });
  const n = TERRAIN.seg + 1;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGround: { value: map }, uTime: timeU, uWind: windU, uCamG: camU });
    sh.vertexShader = `
      uniform sampler2D tGround; uniform float uTime; uniform float uWind; uniform vec3 uCamG;
      uniform float uSpacing; uniform float uInner; uniform vec2 uFade; uniform float uScale;
      attribute vec2 aCell;
      varying float vGust;
      float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec4 groundAt(vec2 p) {
        vec2 f = (p + ${(TERRAIN.size / 2).toFixed(1)}) / ${(TERRAIN.size / TERRAIN.seg).toFixed(4)};
        vec2 i = floor(f), u = f - i;
        float px = 1.0 / ${n.toFixed(1)};
        vec4 a = texture2D(tGround, (i + vec2(0.5, 0.5)) * px), b = texture2D(tGround, (i + vec2(1.5, 0.5)) * px);
        vec4 c = texture2D(tGround, (i + vec2(0.5, 1.5)) * px), d = texture2D(tGround, (i + vec2(1.5, 1.5)) * px);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
    ` + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // which world cell this copy stands in, and where in it
          vec2 cell = floor(uCamG.xz / uSpacing) + aCell;
          float h1 = gh(cell), h2 = gh(cell + 17.13), h3 = gh(cell + 31.71);
          vec2 base = (cell + vec2(h1, h2)) * uSpacing;
          float d = distance(base, uCamG.xz);
          vec4 g = groundAt(base);
          // thin out with distance (each tuft at its own distance), keep off paths, sand and rock,
          // and leave the middle to the dense field
          float cut = mix(uFade.x, uFade.y, sqrt(h3));
          float k = (1.0 - smoothstep(cut - 5.0, cut, d)) * smoothstep(0.25, 0.6, g.y) * smoothstep(uInner - 3.0, uInner, d);
          // meadow patches: taller, lusher grass in drifts, shorter turf between
          float drift = gh(floor(base / 7.0)) * 0.5 + gh(floor(base / 3.1) + 5.0) * 0.5;
          float tall = mix(0.15, 0.42, h3 * 0.5 + drift * 0.5) * uScale * k;
          float ang = h1 * 6.2832;
          vec3 p = position;
          p.xz *= mix(0.8, 1.3, h2) * uScale * (1.0 + smoothstep(uFade.x, uFade.y, d) * 0.8);
          p.y *= tall;
          p.xz = vec2(cos(ang) * p.x - sin(ang) * p.z, sin(ang) * p.x + cos(ang) * p.z);
          // wind: the same sway and rolling gusts as the other plants
          float wv = sin(uTime * 1.7 + base.x * 0.31 + base.y * 0.23) * 0.6 + sin(uTime * 3.1 + base.x * 0.8 - base.y * 0.5) * 0.25;
          float gb = dot(base, vec2(0.894, 0.447)) * 0.075 - uTime * 0.9 + sin(base.x * 0.043 - base.y * 0.061 + uTime * 0.13) * 2.2;
          float gust = pow(0.5 + 0.5 * sin(gb), 4.0) * (0.55 + 0.45 * sin(base.y * 0.021 + base.x * 0.013 + uTime * 0.07));
          vGust = gust * min(uWind, 1.6);
          float bend = (wv + gust * 1.8) * uWind * position.y * position.y * tall * 0.55;
          p.x += bend; p.z += bend * 0.5;
          transformed = vec3(base.x + p.x, g.x - 0.04 + p.y, base.y + p.z);
          // dark roots, sunlit tips, and a little colour drift from tuft to tuft
          vec3 tuftTint = mix(vec3(0.85, 0.97, 0.85), vec3(1.1, 1.02, 0.82), h2) * (0.85 + 0.25 * drift);
          ${tex ? '// the painted texture shades root to tip\n          vColor.rgb = tuftTint * 1.15;' : 'vColor.rgb = mix(vec3(0.24, 0.36, 0.15), vec3(0.62, 0.74, 0.34), color.r) * tuftTint;'}
        }`);
    sh.fragmentShader = 'varying float vGust;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 1.0 + vGust * 0.2;`);
    sh.uniforms.uSpacing = { value: mat.userData.spacing };
    sh.uniforms.uInner = { value: mat.userData.inner };
    sh.uniforms.uFade = { value: new THREE.Vector2(...mat.userData.fade) };
    sh.uniforms.uScale = { value: mat.userData.scale };
  };
  return mat;
}

function field(geo, map, color, { grid, spacing, inner, fade, scale, tex }) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = geo.index;
  Object.entries(geo.attributes).forEach(([k, v]) => g.setAttribute(k, v));
  const cells = new Float32Array(grid * grid * 2);
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) { cells[(i * grid + j) * 2] = i - grid / 2; cells[(i * grid + j) * 2 + 1] = j - grid / 2; }
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  g.instanceCount = grid * grid;
  const mat = bothSides(weatherize(grassMaterial(map, tex), 'lam'));
  mat.userData = { spacing, inner, fade, scale };
  mat.color = color; // shared, so the seasons tint both fields at once
  mat.customProgramCacheKey = () => 'grassfield-' + spacing + (tex ? '-tex' : '');
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; // placed in the shader round the camera
  m.layers.set(1);         // small plants: the lake's reflection leaves them out
  m.receiveShadow = true;
  scene.add(m);
  return mat;
}

/** A grass clump from the meadow pack (CC0), stood 1 tall and about 0.45 m across, lit from above. */
function clumpGeo(name) {
  const parts = fit(Object.fromEntries(Object.entries(kit.models[name]).map(([k, g]) => [k, g.clone()])), 1);
  const g = Object.values(parts)[0];
  g.computeBoundingBox();
  const b = g.boundingBox, w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1;
  g.translate(-(b.min.x + b.max.x) / 2, 0, -(b.min.z + b.max.z) / 2);
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * 0.45 / w); p.setZ(i, p.getZ(i) * 0.45 / w); n.setXYZ(i, 0, 1, 0); }
  // the shader reads y as 0 (root) .. 1 (tip)
  return g;
}

/** Build both fields; returns the material whose colour the seasons tint. */
export function buildGrassField() {
  const map = groundMap(), color = new THREE.Color(1, 1, 1);
  const clumps = kit && kit.models.Grass_Small;
  // near: textured grass clumps every ~0.45 m out to ~26 m, thinning from 10 m (or simple tufts,
  // closer together, without the assets); far: simple tufts every 0.95 m out to ~70 m
  const near = clumps
    ? field(clumpGeo('Grass_Small'), map, color, { grid: 116, spacing: 0.45, inner: -10, fade: [10, 26], scale: 1.15, tex: kit.tex.meadow_grass })
    : field(tuftGeo(3, 3), map, color, { grid: 170, spacing: 0.3, inner: -10, fade: [10, 26], scale: 1 });
  field(tuftGeo(3, 2), map, color, { grid: 150, spacing: 0.95, inner: 18, fade: [30, 70], scale: 1.5 });
  return near;
}
