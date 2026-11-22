// The lakes' water: sky reflection with Fresnel, layered waves, rain rings, lacy shoreline foam, stars
// glinting in it at night, and winter ice.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { LAKE, lakesNear, lakeIce, seaAt } from '../core/shape.js';
import { skyU } from './sky.js';
import { GRADE_GLSL, HAZE_GLSL } from '../core/atmosphere.js';

export const waterU = {
  uTime: { value: 0 },
  deep: { value: new THREE.Color() },
  shallow: { value: new THREE.Color() },
  skyTop: skyU.topColor,
  skyHorizon: skyU.horizonColor,
  sunDir: { value: new THREE.Vector3(0, 1, 0) },   // sun by day, moon by night
  sunColor: { value: new THREE.Color() },
  fogColor: { value: new THREE.Color() },
  fogGlow: { value: new THREE.Color() },
  fogSun: { value: new THREE.Vector3(0, 1, 0) },
  fogNear: { value: 50 },
  fogFar: { value: 220 },
  lakeC: { value: new THREE.Vector2(LAKE.x, LAKE.z) },
  lakeShape: { value: new THREE.Vector4(LAKE.R0, LAKE.A3, LAKE.A5, LAKE.A7) }, // the lake's outline (see makeLake in core/shape.js)
  lakePhase: { value: new THREE.Vector3(LAKE.P3, LAKE.P5, LAKE.P7) },
  lakeStretch: { value: new THREE.Vector2(LAKE.E, LAKE.TH) },
  lakeTint: { value: new THREE.Vector3(1, 1, 1) },   // the cast of this lake's water (turquoise on the heath, dark green in lush country)
  lakeIsle: { value: new THREE.Vector4(0, 0, 0, 1) }, // the lake's island, if it has one: middle, radius (0: none), and where its shore is in its radii
  lakeIsleP: { value: new THREE.Vector2() },         // (its shore's wobble)
  uRain: { value: 0 },
  uIce: { value: 0 },
  uIceLight: { value: 1 },
  uSnowIce: { value: 0 },
  uLight: { value: 1 },
  lampW: { value: [] },          // lamp lanterns, world space (set in main.js)
  lampAmt: { value: 0 },
  uStars: skyU.stars,            // the night sky's stars, glinting in the ripples
  isSea: { value: 0 },           // (the sea's sheet: drawn only where the mask says there is sea)
  seaMask: { value: null },
  seaBox: { value: new THREE.Vector4(0, 0, 1, 1) },
};
const MASK_N = 128, MASK_SPAN = 8000;
const maskData = new Uint8Array(MASK_N * MASK_N * 4);
const maskTex = new THREE.DataTexture(maskData, MASK_N, MASK_N, THREE.RGBAFormat);
maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter;
waterU.seaMask.value = maskTex;
let maskX = NaN, maskZ = NaN;
/** Redraw the sea mask round a spot (8 km square, 62 m cells). */
function drawMask(x, z) {
  maskX = x; maskZ = z;
  const x0 = x - MASK_SPAN / 2, z0 = z - MASK_SPAN / 2, c = MASK_SPAN / MASK_N;
  for (let j = 0; j < MASK_N; j++) for (let i = 0; i < MASK_N; i++) { const v = seaAt(x0 + (i + 0.5) * c, z0 + (j + 0.5) * c); maskData[(j * MASK_N + i) * 4] = Math.min(255, Math.round(v * 2550)); }
  maskTex.needsUpdate = true;
  waterU.seaBox.value.set(x0, z0, MASK_SPAN, MASK_SPAN);
}

export function buildWater() {
  const geo = new THREE.CircleGeometry(48, 160);
  geo.rotateX(-Math.PI / 2);
  const make = (uniforms) => new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: GRADE_GLSL + HAZE_GLSL + `
      uniform float uTime; uniform float uRain; uniform float uIce; uniform float uIceLight; uniform float uSnowIce; uniform float uLight;
      uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyTop; uniform vec3 skyHorizon;
      uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor; uniform vec3 fogGlow; uniform vec3 fogSun;
      uniform float fogNear; uniform float fogFar; uniform vec2 lakeC; uniform vec4 lakeShape; uniform vec3 lakePhase; uniform vec2 lakeStretch; uniform vec3 lakeTint; uniform vec4 lakeIsle; uniform vec2 lakeIsleP;
      uniform vec3 lampW[12]; uniform float lampAmt; uniform float uStars;
      uniform float isSea; uniform sampler2D seaMask; uniform vec4 seaBox;
      varying vec3 vWP;
      vec2 wave(vec2 p, vec2 d, float f, float s, float a) {
        return d * cos(dot(p, d) * f + uTime * s) * f * a;
      }
      float vn(vec2 q) {
        vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
        float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
        float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float ripH(vec2 q) {
        return vn(q * 0.55 + vec2(uTime * 0.11, uTime * 0.05)) * 0.5
             + vn(q * 1.3 - vec2(uTime * 0.09, -uTime * 0.13)) * 0.3
             + vn(q * 3.1 + vec2(-uTime * 0.21, uTime * 0.17)) * 0.14
             + vn(q * 7.0 + vec2(uTime * 0.3, uTime * 0.26)) * 0.06;
      }
      vec2 rippleGrad(vec2 q) {
        float e = 0.06, h0 = ripH(q);
        return vec2(ripH(q + vec2(e, 0.0)) - h0, ripH(q + vec2(0.0, e)) - h0) / e * 0.09;
      }
      float hash21(vec2 q) { q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
      vec2 ripples(vec2 p) {
        vec2 g = vec2(0.0);
        for (int k = 0; k < 3; k++) {
          float fk = float(k);
          vec2 q = p * 1.1 + fk * 17.3;
          vec2 id = floor(q);
          vec2 f = fract(q) - 0.5;
          float ph = fract(uTime * 0.8 + hash21(id + fk * 3.1));
          vec2 c = (vec2(hash21(id + 1.7), hash21(id + 5.3)) - 0.5) * 0.5;
          vec2 dv = f - c;
          float d = length(dv) + 1e-4;
          float r = ph * 0.45;
          g += dv / d * sin((d - r) * 45.0) * smoothstep(0.07, 0.0, abs(d - r)) * (1.0 - ph);
        }
        return g * 0.5;
      }
      float lakeT(vec2 p) {
        vec2 d = p - lakeC;
        float a = atan(d.y, d.x);
        float R = (lakeShape.x + lakeShape.y * sin(3.0 * a + lakePhase.x) + lakeShape.z * cos(5.0 * a + lakePhase.y) + lakeShape.w * sin(7.0 * a + lakePhase.z)) * (1.0 + lakeStretch.x * cos(2.0 * (a - lakeStretch.y)));
        return length(d) / R;
      }
      void main() {
        vec2 p = vWP.xz;
        if (isSea > 0.5 && texture2D(seaMask, (p - seaBox.xy) / seaBox.zw).r < 0.004) discard; // (only over the sea)
        // soft, irregular ripples: a few octaves of drifting noise, plus a long gentle swell
        vec2 g = rippleGrad(p) + wave(p, normalize(vec2(1.0, 0.3)), 0.35, 0.6, 0.03);
        g += ripples(p) * uRain * (1.0 - uIce);
        g *= 1.0 - uIce * 0.9;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vWP);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        vec3 skyc = mix(skyHorizon, skyTop, pow(clamp(r.y, 0.0, 1.0), 0.5));
        float t = lakeT(p);
        vec3 base = mix(deep, shallow, smoothstep(0.5, 0.95, t)) * lakeTint;
        vec3 c = mix(base, skyc, clamp(fres * 0.85 + 0.12, 0.0, 1.0));
        float sp = pow(max(dot(r, normalize(sunDir)), 0.0), 220.0);
        c += sunColor * sp * 1.8;
        // the sun's or moon's glitter path: a long, broken streak of light running toward you
        {
          vec3 sd = normalize(sunDir);
          vec3 rq = normalize(vec3(r.x, r.y * 0.3, r.z)), sq = normalize(vec3(sd.x, sd.y * 0.3, sd.z));
          float path = pow(max(dot(rq, sq), 0.0), 700.0);
          float sparkle = 0.55 + 0.45 * sin(dot(p, vec2(7.3, 5.1)) + uTime * 2.3 + g.x * 40.0);
          c += sunColor * path * sparkle * 1.1 * (1.0 - uIce * 0.6);
        }
        vec3 lampGlint = vec3(0.0);
        // the lamps' reflections: long wavering streaks of warm light across the water
        if (lampAmt > 0.01) {
          vec3 rs = normalize(vec3(r.x, r.y * 0.35, r.z)); // squashed: the streaks run toward you
          for (int i = 0; i < 12; i++) {
            vec3 L = lampW[i] - vWP;
            vec3 Ls = normalize(vec3(L.x, L.y * 0.35, L.z));
            float k = pow(max(dot(rs, Ls), 0.0), 3000.0);
            lampGlint += vec3(1.0, 0.66, 0.32) * k * 1.3 * lampAmt;
          }
        }
        c += lampGlint * (1.0 - uIce);
        // stars in the water: the reflected sky broken into cells, a few holding a star that the
        // ripples make wink on and off
        if (uStars > 0.01 && r.y > 0.0) {
          vec2 sp = r.xz / (r.y + 0.15) * 48.0, sid = floor(sp);
          float sh = hash21(sid);
          vec2 sf = fract(sp) - 0.5 - (vec2(hash21(sid + 3.1), hash21(sid + 7.7)) - 0.5) * 0.6;
          float glint = pow(sh, 11.0) * exp(-dot(sf, sf) * 55.0) * (0.55 + 0.45 * sin(uTime * 2.6 + sh * 90.0));
          c += vec3(0.8, 0.88, 1.0) * glint * 2.2 * uStars * (0.4 + fres) * (1.0 - uIce);
        }
        // gentle foam where the water laps the shore
        float band = smoothstep(0.86, 0.95, t) * (1.0 - smoothstep(0.985, 1.03, t));
        float lap = 0.55 + 0.45 * sin(t * 140.0 - uTime * 1.3 + sin(p.x * 0.7 + p.y * 0.5) * 2.0);
        // lacy foam: thin ridges of drifting noise, so the edge breaks into threads and holes
        float l1 = 1.0 - abs(2.0 * vn(p * 1.6 + vec2(uTime * 0.12, -uTime * 0.09)) - 1.0);
        float l2 = 1.0 - abs(2.0 * vn(p * 3.7 - vec2(uTime * 0.2, uTime * 0.15) + 4.0) - 1.0);
        float lace = clamp(pow(l1, 7.0) + pow(l2, 9.0) * 0.7 + pow(l1 * l2, 2.5) * 0.5, 0.0, 1.0);
        // and round an island's shore
        if (lakeIsle.z > 0.0) {
          vec2 di = p - lakeIsle.xy; float ai = atan(di.y, di.x);
          float qi = length(di) / (lakeIsle.z * (1.0 + 0.16 * sin(3.0 * ai + lakeIsleP.x) + 0.09 * sin(5.0 * ai + lakeIsleP.y))) / lakeIsle.w;
          band = max(band, smoothstep(1.32, 1.06, qi) * (1.0 - smoothstep(1.0, 0.94, qi)));
        }
        c = mix(c, vec3(0.93, 0.95, 0.96) * uLight, band * clamp(lap * 0.45 + lace * 0.8, 0.0, 1.0) * 0.4 * (1.0 - uIce));
        // winter: pale ice, dusted with snow
        vec3 ice = mix(vec3(0.7, 0.8, 0.88), vec3(0.84, 0.9, 0.96), 0.45 + 0.18 * sin(p.x * 0.21 + sin(p.y * 0.13) * 2.0) + 0.12 * sin(p.y * 0.37 + p.x * 0.11)) * uIceLight;
        ice = mix(ice, vec3(0.94, 0.96, 1.0) * uIceLight, uSnowIce * (0.2 + 0.6 * smoothstep(0.3, 0.7, hash21(floor(p * 0.9)))));
        ice += sunColor * pow(max(dot(r, normalize(sunDir)), 0.0), 60.0) * 0.5;
        // ice is a dull mirror: it takes on the sky and far shore, and the lamps glow on it
        ice = mix(ice * vec3(0.82, 0.93, 1.18), skyc * vec3(0.9, 1.0, 1.2), 0.12 + 0.3 * fres) + lampGlint * 0.7;
        c = mix(c, ice, uIce);
        float dist = length(cameraPosition - vWP);
        c = mix(c, meadowHaze(fogColor, fogGlow, vWP - cameraPosition, fogSun), smoothstep(fogNear, fogFar, dist));
        gl_FragColor = vec4(meadowGrade(c), 1.0);
      }`,
  }));
  // A few sheets of water, lent to whichever lakes are nearest. Each has its own lake outline and
  // ice (a lake in snow country is frozen whatever the season); everything else is shared.
  for (let i = 0; i < SHEETS; i++) {
    const u = Object.assign({}, waterU, { lakeC: { value: new THREE.Vector2() }, lakeShape: { value: new THREE.Vector4() }, lakePhase: { value: new THREE.Vector3() }, lakeStretch: { value: new THREE.Vector2() }, lakeTint: { value: new THREE.Vector3(1, 1, 1) }, lakeIsle: { value: new THREE.Vector4(0, 0, 0, 1) }, lakeIsleP: { value: new THREE.Vector2() }, uIce: { value: 0 } });
    const mesh = make(u);
    mesh.receiveShadow = false;
    mesh.visible = false;
    scene.add(mesh);
    sheets.push({ mesh, u, lake: null });
  }
  // the sea: the same water, without a shore of its own (the land makes its shore), a little bluer
  const su = Object.assign({}, waterU, { lakeC: { value: new THREE.Vector2() }, lakeShape: { value: new THREE.Vector4(1e6, 0, 0, 0) }, lakePhase: { value: new THREE.Vector3() }, lakeStretch: { value: new THREE.Vector2() }, lakeTint: { value: new THREE.Vector3(0.78, 1.02, 1.12) }, uIce: { value: 0 }, isSea: { value: 1 } });
  sea = make(su);
  sea.scale.set(64, 1, 64); // (about 3 km round)
  sea.position.y = -0.04;
  sea.visible = false;
  sea.frustumCulled = false;
  scene.add(sea);
  updateWater(LAKE.x, LAKE.z);
}
let sea = null, seaIn = 0;
/** Whether there is sea within about 3 km of a spot. */
function seaNear(x, z) {
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (seaAt(x + i * 900, z + j * 900) > 0.08) return true;
  return false;
}

const SHEETS = 4, WATER_REACH = 620, sheets = [];
/** Once a frame: the sheets of water go to the lakes nearest (x, z). */
export function updateWater(x, z, now = false) {
  if (sea && (now || --seaIn <= 0)) { seaIn = 60; sea.visible = seaNear(x, z); if (sea.visible && !(Math.abs(x - maskX) < 800 && Math.abs(z - maskZ) < 800)) drawMask(x, z); }
  if (sea && sea.visible) sea.position.set(x, -0.04, z);
  const near = lakesNear(x, z, WATER_REACH).slice(0, SHEETS);
  for (const s of sheets) if (s.lake && !near.includes(s.lake)) s.lake = null;
  for (const L of near) {
    if (sheets.some((s) => s.lake === L)) continue;
    const s = sheets.find((q) => !q.lake);
    s.lake = L;
    s.mesh.position.set(L.x, 0.02, L.z);
    s.mesh.scale.set(L.rmax / 38, 1, L.rmax / 38); // (the sheet is cut for the home lake, whose shore reaches 38 m, with room to spare)
    s.u.lakeC.value.set(L.x, L.z);
    s.u.lakeShape.value.set(L.R0, L.A3, L.A5, L.A7);
    s.u.lakePhase.value.set(L.P3, L.P5, L.P7);
    s.u.lakeStretch.value.set(L.E, L.TH);
    s.u.lakeTint.value.fromArray(L.tint);
    if (L.isle) { s.u.lakeIsle.value.set(L.isle.x, L.isle.z, L.isle.r, L.isle.shore); s.u.lakeIsleP.value.set(L.isle.p1, L.isle.p2); } else s.u.lakeIsle.value.set(0, 0, 0, 1);
  }
  for (const s of sheets) { s.mesh.visible = !!s.lake; if (s.lake) s.u.uIce.value = lakeIce(s.lake); }
}
/** For tests: which lakes have water drawn just now. */
export const seaShown = () => !!(sea && sea.visible);
/** For tests: whether the sea's sheet is drawn at a spot (its mask there; 0 where it is cut away). */
export function seaDrawnAt(x, z) {
  const b = waterU.seaBox.value, i = Math.floor((x - b.x) / b.z * MASK_N), j = Math.floor((z - b.y) / b.w * MASK_N);
  return i >= 0 && j >= 0 && i < MASK_N && j < MASK_N ? maskData[(j * MASK_N + i) * 4] : 0;
}
export const waterLakes = () => sheets.filter((s) => s.lake).map((s) => s.lake.id);
