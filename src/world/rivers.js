// The rivers' water: a ribbon along each river near you, lying on its water level (core/shape.js
// works out where rivers run and cuts their beds). Calm stretches ripple and drift downstream and
// take the sky as the lakes do; the falls are white water pouring over the lip in streaks, with
// foam churning in the pool below; in cold country a river freezes in winter as its lakes do.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { riversNear, riverIce } from '../core/shape.js';
import { waterU } from './water.js';
import { GRADE_GLSL, HAZE_GLSL } from '../core/atmosphere.js';
import { glowTex } from '../core/materials.js';

const REACH = 1000;            // rivers within this many metres have water drawn
const SIDE = [-1.25, -0.6, 0, 0.6, 1.25]; // across the ribbon, in half-widths (it reaches a little under the banks)

const VERT = `
  attribute vec2 aFlow;   // metres along the river, and across it (-1 .. 1 half-widths)
  attribute vec2 aFall;   // how much this is a fall (0 calm .. 1 pouring), and foam below one
  attribute float aW;     // the river's width here
  varying vec3 vWP; varying vec2 vFlow; varying vec2 vFall; varying float vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWP = wp.xyz; vFlow = aFlow; vFall = aFall; vW = aW;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FRAG = GRADE_GLSL + HAZE_GLSL + `
  uniform float uTime; uniform float uIce; uniform float uIceLight; uniform float uLight; uniform float uRain;
  uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyTop; uniform vec3 skyHorizon;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor; uniform vec3 fogGlow; uniform vec3 fogSun;
  uniform float fogNear; uniform float fogFar;
  varying vec3 vWP; varying vec2 vFlow; varying vec2 vFall; varying float vW;
  float vn(vec2 q) {
    vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  void main() {
    // the river's own frame: across (m) and along (m), the ripples drifting downstream
    float across = vFlow.y * vW * 0.5, speed = 1.1 + 5.0 * vFall.x;
    vec2 q = vec2(across, vFlow.x - uTime * speed);
    float h0 = vn(q * 0.7) * 0.6 + vn(q * vec2(1.6, 0.9) + 3.0) * 0.3 + vn(q * 3.4 - 7.0) * 0.1;
    float hx = vn((q + vec2(0.07, 0.0)) * 0.7) * 0.6 + vn((q + vec2(0.07, 0.0)) * vec2(1.6, 0.9) + 3.0) * 0.3 + vn((q + vec2(0.07, 0.0)) * 3.4 - 7.0) * 0.1;
    float hz = vn((q + vec2(0.0, 0.07)) * 0.7) * 0.6 + vn((q + vec2(0.0, 0.07)) * vec2(1.6, 0.9) + 3.0) * 0.3 + vn((q + vec2(0.0, 0.07)) * 3.4 - 7.0) * 0.1;
    vec2 g = vec2(hx - h0, hz - h0) * (0.7 + 2.0 * vFall.x) * (1.0 - uIce * 0.9);
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 v = normalize(cameraPosition - vWP);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 r = reflect(-v, n);
    vec3 skyc = mix(skyHorizon, skyTop, pow(clamp(r.y, 0.0, 1.0), 0.5));
    // shallower, lighter water toward the banks
    vec3 base = mix(deep, shallow, 0.2 + 0.5 * smoothstep(0.3, 1.0, abs(vFlow.y))) * vec3(0.9, 1.0, 1.0);
    vec3 c = mix(base, skyc, clamp(fres * 0.7 + 0.06, 0.0, 1.0));
    c += sunColor * pow(max(dot(r, normalize(sunDir)), 0.0), 200.0) * 1.6;
    // white water: on a fall, streaks pouring down; below it, foam churning and thinning downstream
    float streak = vn(vec2(across * 4.5, vFlow.x * 0.18 - uTime * 2.2)) * 0.6 + vn(vec2(across * 9.0 + 4.0, vFlow.x * 0.4 - uTime * 3.5)) * 0.4;
    // (a fall's face is steep, not level: it shows the water's own colour, not the sky)
    c = mix(c, deep * 1.35 + shallow * 0.25, vFall.x * 0.75);
    float pour = vFall.x * smoothstep(0.45, 0.72, streak) * 0.9; // (white streaks running down, the darker water showing between them)
    float churn = 1.0 - abs(2.0 * vn(vec2(across * 1.3, vFlow.x * 1.3) + vec2(uTime * 0.6, -uTime * 1.4)) - 1.0);
    float foam = max(pour, vFall.y * smoothstep(0.62, 0.95, churn) * 0.8);
    // and a lace of foam along the banks, where the water laps
    float lace = smoothstep(0.75, 1.0, abs(vFlow.y)) * smoothstep(0.55, 0.9, vn(vec2(across * 2.0, vFlow.x * 0.8 - uTime * 1.2)));
    c = mix(c, vec3(0.94, 0.96, 0.97) * uLight, clamp(foam * 0.9 + lace * 0.35, 0.0, 1.0) * (1.0 - uIce));
    // frozen: pale ice
    vec3 ice = mix(vec3(0.72, 0.82, 0.9), vec3(0.86, 0.92, 0.97), 0.5 + 0.2 * sin(vWP.x * 0.3 + sin(vWP.z * 0.2) * 2.0)) * uIceLight;
    ice = mix(ice, skyc * vec3(0.9, 1.0, 1.15), 0.12 + 0.3 * fres);
    c = mix(c, ice, uIce);
    float dist = length(cameraPosition - vWP);
    c = mix(c, meadowHaze(fogColor, fogGlow, vWP - cameraPosition, fogSun), smoothstep(fogNear, fogFar, dist));
    // a fall's edges thin to nothing, so it ends in spray rather than a hard edge
    float a = 1.0 - vFall.x * smoothstep(0.7, 1.0, abs(vFlow.y)) * 0.85;
    gl_FragColor = vec4(meadowGrade(c), a);
  }`;

/** The ribbon of water along a river. */
function ribbon(r) {
  const rows = [];
  // a row of vertices across the river at each of its points; on a fall, one more just past the lip, so the water pours over it
  for (let i = 0; i < r.n; i++) {
    rows.push({ i, f: 0, lv: r.lv[i] });
    if (r.fall[i] && i < r.n - 1) rows.push({ i, f: 0.22, lv: r.lv[i] });
  }
  const NV = SIDE.length, pos = new Float32Array(rows.length * NV * 3), flow = new Float32Array(rows.length * NV * 2), fall = new Float32Array(rows.length * NV * 2), wid = new Float32Array(rows.length * NV);
  // foam below each fall, thinning over the next 10 m
  const foamAt = new Float32Array(r.n);
  for (let i = 0; i < r.n; i++) if (r.fall[i]) for (let k = i + 1; k < r.n && r.s[k] - r.s[i + 1] < 10; k++) foamAt[k] = Math.max(foamAt[k], 1 - (r.s[k] - r.s[i + 1]) / 10);
  rows.forEach((row, k) => {
    const i = row.i, j = Math.min(r.n - 1, i + 1), a = Math.max(0, i - 1);
    const lerp = (A, t) => A[i] + (A[j] - A[i]) * t;
    const x = lerp(r.x, row.f), z = lerp(r.z, row.f), w = lerp(r.w, row.f), s = lerp(r.s, row.f);
    let tx = r.x[j] - r.x[a], tz = r.z[j] - r.z[a];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const pouring = r.fall[i] && row.f > 0 ? 1 : i > 0 && r.fall[i - 1] && row.f === 0 ? 1 : 0; // (the face of the fall: from just past the lip to its foot)
    for (let c = 0; c < NV; c++) {
      const o = k * NV + c, u = SIDE[c], hw = (w / 2) * u;
      pos[o * 3] = x - tz * hw; pos[o * 3 + 1] = row.lv; pos[o * 3 + 2] = z + tx * hw;
      flow[o * 2] = s; flow[o * 2 + 1] = Math.max(-1, Math.min(1, u));
      fall[o * 2] = pouring; fall[o * 2 + 1] = foamAt[i];
      wid[o] = w;
    }
  });
  const idx = [];
  for (let k = 0; k < rows.length - 1; k++) for (let c = 0; c < NV - 1; c++) { const a = k * NV + c, b = a + 1, d = a + NV, e = d + 1; idx.push(a, d, b, b, d, e); }
  // (positions are kept near the river's own middle, so they stay precise far from the world's centre)
  const ox = r.x[0], oz = r.z[0];
  for (let o = 0; o < pos.length; o += 3) { pos[o] -= ox; pos[o + 2] -= oz; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 2));
  geo.setAttribute('aFall', new THREE.BufferAttribute(fall, 2));
  geo.setAttribute('aW', new THREE.BufferAttribute(wid, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const u = Object.assign({}, waterU, { uIce: { value: 0 } });
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(ox, 0, oz);
  mesh.receiveShadow = false; mesh.castShadow = false;
  // spray at the foot of each fall: soft clouds, all of a river's in one draw, swelling and fading together
  const mp = [];
  for (let i = 0; i < r.n - 1; i++) if (r.fall[i]) for (let k = 0; k < 2; k++) mp.push(r.x[i + 1] - ox + (k - 0.5) * r.w[i] * 0.4, r.lv[i + 1] + 0.6 + k * 0.4, r.z[i + 1] - oz);
  let mist = null;
  if (mp.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mist = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size: 3.6, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    mist.frustumCulled = false;
    mesh.add(mist);
  }
  return { mesh, u, mist, river: r };
}

const shown = new Map(); // river id -> { mesh, u, chill }
let lastX = NaN, lastZ = NaN;
/** Once a frame: water drawn on the rivers near (x, z), and taken away from those left behind. */
export function updateRivers(x, z, now = false) {
  if (now || !(Math.hypot(x - lastX, z - lastZ) < 60)) {
    lastX = x; lastZ = z;
    const want = new Set();
    for (const r of riversNear(x, z, REACH)) {
      want.add(r.id);
      if (!shown.has(r.id)) { const s = ribbon(r); scene.add(s.mesh); shown.set(r.id, s); }
    }
    for (const [id, s] of shown) if (!want.has(id)) { scene.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); if (s.mist) { s.mist.geometry.dispose(); s.mist.material.dispose(); } shown.delete(id); }
  }
  const t = waterU.uTime.value;
  for (const s of shown.values()) {
    const ice = (s.u.uIce.value = riverIce(s.river));
    if (s.mist) { const w = 0.5 + 0.5 * Math.sin(t * 0.9), L = waterU.uLight.value; s.mist.material.size = 3.2 + 0.8 * w; s.mist.material.opacity = (0.26 + 0.12 * w) * (1 - ice); s.mist.material.color.setScalar(Math.min(1, L)); } // (lit as the foam is: grey at night, not glowing)
  }
}
/** For tests: the rivers with water drawn just now. */
export const riversShown = () => [...shown.keys()];
