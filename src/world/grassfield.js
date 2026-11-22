// The meadow's grass, made on the GPU. Two draw calls cover everything: a dense field of tufts
// near you and a coarser one further out. Each is one tuft shape drawn many times; the vertex
// shader puts every copy on a grid that moves with the camera, at a spot jittered by a hash of
// its *world* grid cell (so blades stay put as you walk), reads the ground height and whether
// grass grows there from a small map of the ground round the camera, and sways it in the wind. Nothing per blade lives on
// the CPU, and the blades are plain solid shapes (no cut-out textures), so they are cheap to draw.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../core/render.js';
import { smooth } from '../core/math.js';
import { SEASON_GLSL, seasonU } from '../core/year.js';
import { biomesAt } from '../core/biome.js';
import { heightAt, slopeAt, lakeAt, trailAt, riverBank, nearReserved, onDock, BENCH_SPOT, SPAWN, coldBase, coldAt, dryOf, slopeLook, feltHeight, ASPECT, moistAt, snowCold, snowOf } from '../core/shape.js';
import { weatherize, bothSides, timeU, windU, camU } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { onShrineGround } from './shrine.js';
import { rockAmt } from './terrain.js';

/** Share of the tufts drawn (the grass-density setting). */
export const grassU = { density: { value: 1 } };

// ── the ground map: height, how grassy each spot is, and its climate (cold, dry), on the ground's own 1.2 m grid ──
// A window onto the endless ground, MAP_N texels square, that keeps itself round the camera: once
// the camera has moved a few texels the window shifts, keeping what it already knows and working
// out only the strip that has come into it.
const MAP_N = 144, MAP_STEP = 1.2, MAP_SHIFT = 6;
const mapU = { origin: { value: new THREE.Vector2() } };
let mapTex = null, mapData = new Float32Array(MAP_N * MAP_N * 4), mapNext = new Float32Array(MAP_N * MAP_N * 4), mapIx = null, mapIz = 0;
/** How well grass grows at a spot (0..1): not in the water, on the path, on rock, or where something stands. */
function grassy(x, z, h, north, base) {
  if (onDock(x, z) || nearReserved(x, z, 1.2) || Math.hypot(x - BENCH_SPOT.x, z - BENCH_SPOT.z) < 1.3 || onShrineGround(x, z)) return 0;
  const lake = lakeAt(x, z), b = Math.min(lake.beach, 1); // (grass begins where that lake's sand ends)
  return smooth(1.02 + 0.1 * b, 1.1 + 0.12 * b, lake.t(x, z)) * (1 - smooth(0.15, 0.5, lake.path(x, z))) * (1 - trailAt(x, z) * 0.85) * (1 - riverBank(x, z, 1.5)) * (1 - rockAmt(h, slopeAt(x, z), feltHeight(x, z, h, north, base)));
}
/** How much grass a biome lets grow: none on the desert's sand, sparse in the swamp's peat (its pools show). */
const biomeGrass = (b) => (1 - 0.9 * Math.max(b.desert, b.beach)) * (1 - 0.65 * b.swamp);
/** Work the whole map out again at the next update (the jetty, the fire or the bench has moved, and it remembers where they were). */
export function resetGrassMap() { mapIx = null; }
/** Keep the map round (cx, cz). Call once a frame; it only does work when the camera has moved on. */
export function updateGrassMap(cx, cz) {
  if (!mapTex) return;
  const ix = Math.round(cx / MAP_STEP) - MAP_N / 2, iz = Math.round(cz / MAP_STEP) - MAP_N / 2;
  const first = mapIx === null;
  if (!first && Math.abs(ix - mapIx) < MAP_SHIFT && Math.abs(iz - mapIz) < MAP_SHIFT) return;
  const dx = first ? MAP_N : ix - mapIx, dz = first ? MAP_N : iz - mapIz;
  for (let j = 0; j < MAP_N; j++) {
    for (let i = 0; i < MAP_N; i++) {
      const o = (j * MAP_N + i) * 4, oi = i + dx, oj = j + dz;
      if (oi >= 0 && oi < MAP_N && oj >= 0 && oj < MAP_N) { const q = (oj * MAP_N + oi) * 4; mapNext[o] = mapData[q]; mapNext[o + 1] = mapData[q + 1]; mapNext[o + 2] = mapData[q + 2]; mapNext[o + 3] = mapData[q + 3]; }
      else { const x = (ix + i) * MAP_STEP, z = (iz + j) * MAP_STEP, h = heightAt(x, z), base = coldBase(x, z), lie = slopeLook(x, z, h, base), north = lie.north, scree = lie.scree, wet = moistAt(x, z), chill = coldAt(x, z, h + ASPECT * north, base), cold = snowCold(chill, wet);
        // (on the tundra, cold country too dry for snow, the grass is sparse, low and tawny)
        const tundra = smooth(0.42, 0.65, chill) * (1 - snowOf(cold));
        // (and little grass on scree)
        mapNext[o] = h; mapNext[o + 1] = grassy(x, z, h, north, base) * (1 - 0.55 * tundra) * (1 - 0.85 * scree) * biomeGrass(biomesAt(x, z, h, base, wet)); mapNext[o + 2] = cold; mapNext[o + 3] = Math.max(dryOf(wet), tundra * 0.85);
      }
    }
  }
  [mapData, mapNext] = [mapNext, mapData];
  mapIx = ix; mapIz = iz;
  mapU.origin.value.set(ix * MAP_STEP, iz * MAP_STEP);
  mapTex.image.data = mapData;
  mapTex.needsUpdate = true;
}
function groundMap() {
  mapTex = new THREE.DataTexture(mapData, MAP_N, MAP_N, THREE.RGBAFormat, THREE.FloatType);
  mapTex.magFilter = mapTex.minFilter = THREE.NearestFilter; // filtered by hand in the shader (float filtering isn't everywhere)
  updateGrassMap(SPAWN.x, SPAWN.z);
  return mapTex;
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
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tGround: { value: map }, uMapOrigin: mapU.origin, uTime: timeU, uWind: windU, uCamG: camU, uSeason: seasonU });
    sh.vertexShader = SEASON_GLSL + `
      uniform sampler2D tGround; uniform vec2 uMapOrigin; uniform float uTime; uniform float uWind; uniform vec3 uCamG;
      uniform float uSpacing; uniform float uInner; uniform vec2 uFade; uniform float uScale; uniform float uDensity;
      attribute vec2 aCell;
      varying float vGust;
      // (the cell is wrapped first: far from the middle of the world the numbers get too big for sin() to scatter)
      float gh(vec2 p) { return fract(sin(dot(mod(p, 512.0), vec2(127.1, 311.7))) * 43758.5453); }
      vec4 groundAt(vec2 p) {
        vec2 f = (p - uMapOrigin) / ${MAP_STEP.toFixed(4)};
        vec2 i = floor(f), u = f - i;
        float px = 1.0 / ${MAP_N.toFixed(1)};
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
          k *= step(gh(cell + 53.7), uDensity); // the grass-density setting keeps this share of the tufts
          // the climate (g.z cold, g.w dry): grass thins out where snow lies, tuft by tuft, and is gone under a snowfield
          k *= 1.0 - smoothstep(0.4, 0.62, chillNow(g.z) + (h1 - 0.5) * 0.16);
          // meadow patches: taller, lusher grass in drifts, shorter turf between
          float drift = gh(floor(base / 7.0)) * 0.5 + gh(floor(base / 3.1) + 5.0) * 0.5;
          float tall = mix(0.15, 0.42, h3 * 0.5 + drift * 0.5) * uScale * k * (1.0 + g.w * 0.45); // (taller on the heath)
          float ang = h1 * 6.2832;
          vec3 p = position;
          // (thinned-away tufts shrink to nothing sideways too: flat, they would stick out of a slope)
          p.xz *= mix(0.8, 1.3, h2) * uScale * (1.0 + smoothstep(uFade.x, uFade.y, d) * 0.8) * smoothstep(0.0, 0.2, k);
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
          tuftTint *= mix(vec3(1.0), vec3(1.34, 1.1, 0.6), clamp(g.w + (1.0 - smoothstep(-0.5, 0.0, g.z)) * 0.5 * (0.5 - uSeason / 0.75), 0.0, 1.0)); // gold on the heath (and in a warm country's summer)
          tuftTint = mix(tuftTint, vec3(1.05, 1.1, 1.0), smoothstep(0.25, 0.5, chillNow(g.z)) * 0.5); // frosted pale toward the snow
          ${tex ? '// the painted texture shades root to tip\n          vColor.rgb = tuftTint * 1.15;' : 'vColor.rgb = mix(vec3(0.24, 0.36, 0.15), vec3(0.62, 0.74, 0.34), color.r) * tuftTint;'}
        }`);
    sh.fragmentShader = 'varying float vGust;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 1.0 + vGust * 0.2;`);
    sh.uniforms.uSpacing = { value: mat.userData.spacing };
    sh.uniforms.uDensity = grassU.density;
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
  m.layers.set(1);         // small plants live on layer 1
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
