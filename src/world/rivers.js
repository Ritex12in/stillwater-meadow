// The rivers' water: a ribbon along each river near you, lying on its water level (core/shape.js
// works out where rivers run and cuts their beds), with what makes it read as a river and not a
// painted stripe:
//   the calm water  blue-green, clear and pale at its edges (the bed shows through there, so it has
//                   no hard border), ripples drawn out along the current, flecks of foam drifting;
//   a fall          white water pouring down its face, the river's colour in veins between; over
//                   it a second, thinner sheet of falling clumps that moves faster (so the fall has
//                   depth); mist rising from its foot; foam spreading into the pool below;
//   the rocks       grey boulders flanking every fall (great slabs beside a tall one, so it drops
//                   through a rocky chute and not down a lawn), a few about its lip and its pool,
//                   and stones here and there along the banks and in the quick water.
// The rocks are for the eye only: the land's height, where you may walk and the river's own
// levels are untouched (you can walk through one). Everything is lit by the day as the lakes are
// (grey at night, never glowing), hazed with distance and graded like the rest; in cold country a
// river freezes in winter as its lakes do, and its falling sheet and mist stop. All of a river's
// pieces hang from its ribbon and are thrown away with it.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { hash, TAU } from '../core/math.js';
import { riversNear, riverIce, height } from '../core/shape.js';
import { waterU } from './water.js';
import { GRADE_GLSL, HAZE_GLSL } from '../core/atmosphere.js';
import { glowTex, std, weatherize } from '../core/materials.js';

const REACH = 1000;            // rivers within this many metres have water drawn
const SIDE = [-1.25, -0.6, 0, 0.6, 1.25]; // across the ribbon, in half-widths (it reaches a little under the banks)
const TALL = 4;                // a fall dropping more than this (m) is a tall one: slabs of rock beside it, more mist

const NOISE = `
  float vn(vec2 q) {
    vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }`;
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
const UNIFORMS = `
  uniform float uTime; uniform float uIce; uniform float uIceLight; uniform float uLight; uniform float uRain;
  uniform vec4 uHeart;    // a grove's heart: its water's blue-violet, and how much of it (0 on every other river)
  uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyTop; uniform vec3 skyHorizon;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor; uniform vec3 fogGlow; uniform vec3 fogSun;
  uniform float fogNear; uniform float fogFar;
  varying vec3 vWP; varying vec2 vFlow; varying vec2 vFall; varying float vW;`;
const FRAG = GRADE_GLSL + HAZE_GLSL + UNIFORMS + NOISE + `
  // the water's surface: ripples drawn out along the current (finer and livelier on quick water)
  float surf(vec2 q) { return vn(q * vec2(1.5, 0.42)) * 0.55 + vn(q * vec2(3.1, 0.9) + 3.0) * 0.3 + vn(q * vec2(6.0, 2.2) - 7.0) * 0.15; }
  void main() {
    // the river's own frame: across (m) and along (m), everything drifting downstream
    float across = vFlow.y * vW * 0.5, edge = abs(vFlow.y), speed = 1.1 + 5.0 * vFall.x;
    vec2 q = vec2(across, vFlow.x - uTime * speed);
    float h0 = surf(q), hx = surf(q + vec2(0.07, 0.0)), hz = surf(q + vec2(0.0, 0.07));
    vec2 g = vec2(hx - h0, hz - h0) * (1.0 + 2.0 * vFall.x) * (1.0 - uIce * 0.9);
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 v = normalize(cameraPosition - vWP);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 r = reflect(-v, n);
    vec3 skyc = mix(skyHorizon, skyTop, pow(clamp(r.y, 0.0, 1.0), 0.5));
    // the water's body: blue-green and deeper in the middle, pale and clear toward the banks
    vec3 body = mix(deep * vec3(0.72, 1.0, 0.92), shallow * vec3(0.86, 1.04, 0.98), smoothstep(0.15, 0.95, edge));
    body = mix(body, uHeart.rgb * (dot(body, vec3(0.3, 0.59, 0.11)) / 0.56), uHeart.a * 0.75); // (a heart's water: blue-violet, as bright as it was)
    body *= 0.9 + 0.2 * h0; // (light and dark moving with the ripples)
    vec3 c = mix(body, skyc, clamp(fres * 0.6 + 0.04, 0.0, 1.0));
    c += sunColor * pow(max(dot(r, normalize(sunDir)), 0.0), 160.0) * 1.4;
    // flecks of foam drifting on the calm water, more of them below a fall and along the banks
    float fleck = smoothstep(0.74, 0.9, vn(q * vec2(2.6, 1.1) + 11.0)) * smoothstep(0.35, 0.7, vn(q * vec2(0.5, 0.2) - 4.0));
    float lace = smoothstep(0.7, 1.0, edge) * smoothstep(0.5, 0.85, vn(vec2(across * 2.4, vFlow.x * 0.9 - uTime * 1.1)));
    float churn = 1.0 - abs(2.0 * vn(vec2(across * 1.6, vFlow.x * 1.2) + vec2(uTime * 0.5, -uTime * 1.6)) - 1.0);
    float pool = vFall.y * (0.35 + 0.65 * smoothstep(0.5, 0.92, churn)); // (below a fall: churned white, thinning downstream)
    float foamCalm = clamp(fleck * (0.16 + 0.5 * vFall.y) + lace * 0.3 + pool * 0.85, 0.0, 1.0);
    // a fall's face: white water in ropes running down, the river's own colour showing in veins between
    float along = vFlow.x - uTime * 6.5;
    // (the finest ropes only from near by: from further off, or drawn at a low resolution, they are narrower than a pixel and turn to hard stripes)
    float fine = 1.0 - smoothstep(12.0, 32.0, length(cameraPosition - vWP));
    float rope = vn(vec2(across * 3.2, along * 0.22)) * (0.5 + 0.12 * (1.0 - fine)) + vn(vec2(across * 7.5 + 4.0, along * 0.5)) * (0.3 + 0.08 * (1.0 - fine)) + vn(vec2(across * 15.0 - 2.0, along * 1.1)) * 0.2 * fine;
    // (white water by night: it catches the moon, so it is never darker than the rock behind it, and is a little blue)
    float lit = max(uLight, 0.66), night = 1.0 - smoothstep(0.42, 0.8, uLight);
    float white = smoothstep(0.26 + 0.14 * uHeart.a, 0.6 + 0.12 * uHeart.a, rope); // (at a heart more of the water's own colour shows between the ropes)
    vec3 vein = mix(mix(shallow * vec3(0.84, 1.0, 1.0) + deep * 0.2, vec3(0.9, 0.95, 0.97), 0.45), uHeart.rgb, uHeart.a * 0.85);
    vec3 fallC = mix(vein, vec3(0.95, 0.97, 0.98), white) * lit * mix(vec3(1.0), vec3(0.84, 0.92, 1.12), night); // (pale veins, not bright ones)
    c = mix(c, vec3(0.94, 0.96, 0.97) * uLight, foamCalm * (1.0 - vFall.x));
    c = mix(c, fallC, vFall.x);
    // frozen: pale ice
    vec3 ice = mix(vec3(0.72, 0.82, 0.9), vec3(0.86, 0.92, 0.97), 0.5 + 0.2 * sin(vWP.x * 0.3 + sin(vWP.z * 0.2) * 2.0)) * uIceLight;
    ice = mix(ice, skyc * vec3(0.9, 1.0, 1.15), 0.12 + 0.3 * fres);
    c = mix(c, ice, uIce);
    float dist = length(cameraPosition - vWP);
    c = mix(c, meadowHaze(fogColor, fogGlow, vWP - cameraPosition, fogSun), smoothstep(fogNear, fogFar, dist));
    // the calm water thins to nothing at its edges (the bed shows through: no hard border); a fall's edge is ragged spray
    float calmA = (1.0 - smoothstep(0.6, 1.0, edge)) * 0.94 + lace * 0.25;
    float fallA = 1.0 - smoothstep(0.62, 1.0, edge + (vn(vec2(across * 6.0, along * 0.6)) - 0.5) * 0.4);
    float a = mix(mix(calmA, fallA, vFall.x), 1.0 - smoothstep(0.8, 1.0, edge) * 0.7, uIce);
    gl_FragColor = vec4(meadowGrade(c), clamp(a, 0.0, 1.0));
  }`;
// The falling sheet over a fall's face: clumps and ropes of white water standing off the face and moving faster than it.
const SHEET_FRAG = GRADE_GLSL + HAZE_GLSL + UNIFORMS + NOISE + `
  void main() {
    float across = vFlow.y * vW * 0.5, along = vFlow.x - uTime * 9.5;
    float clump = vn(vec2(across * 2.2 + 9.0, along * 0.16)) * 0.6 + vn(vec2(across * 5.5, along * 0.34 + 2.0)) * 0.4;
    float a = smoothstep(0.5, 0.74, clump) * (1.0 - smoothstep(0.45, 1.0, abs(vFlow.y))) * smoothstep(0.0, 0.18, vFall.y) * (1.0 - smoothstep(0.82, 1.0, vFall.y)); // (thin at the lip and at the foot)
    float night = 1.0 - smoothstep(0.42, 0.8, uLight);
    vec3 c = mix(vec3(0.97, 0.98, 0.99), uHeart.rgb * 1.3, uHeart.a * 0.3) * max(uLight, 0.7) * mix(vec3(1.0), vec3(0.84, 0.92, 1.12), night); // (moonlit by night)
    float dist = length(cameraPosition - vWP);
    c = mix(c, meadowHaze(fogColor, fogGlow, vWP - cameraPosition, fogSun), smoothstep(fogNear, fogFar, dist));
    gl_FragColor = vec4(meadowGrade(c), a * (0.85 - 0.3 * uHeart.a) * (1.0 - uIce));
  }`;
// Mist: soft puffs rising from a fall's foot, each swelling and thinning as it climbs.
const MIST_VERT = `
  attribute vec3 aPuff;   // how far it rises (m), how big it grows (m), and where in its rise it starts (0..1)
  uniform float uTime; uniform float uScale;
  varying float vLife; varying vec3 vWP;
  void main() {
    float life = fract(aPuff.z + uTime * 0.11);
    vec3 p = position + vec3(sin(aPuff.z * 40.0 + uTime * 0.3) * 0.5, life * aPuff.x, cos(aPuff.z * 31.0 + uTime * 0.25) * 0.5) * (0.3 + life);
    vec4 wp = modelMatrix * vec4(p, 1.0), mv = viewMatrix * wp;
    vLife = life; vWP = wp.xyz;
    gl_PointSize = aPuff.y * (0.45 + 0.75 * life) * uScale / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const MIST_FRAG = GRADE_GLSL + HAZE_GLSL + `
  uniform sampler2D tPuff; uniform float uLight; uniform float uIce; uniform vec4 uHeart;
  uniform vec3 fogColor; uniform vec3 fogGlow; uniform vec3 fogSun; uniform float fogNear; uniform float fogFar;
  varying float vLife; varying vec3 vWP;
  void main() {
    float a = texture2D(tPuff, gl_PointCoord).a * smoothstep(0.0, 0.15, vLife) * (1.0 - vLife) * (0.7 + 0.5 * uHeart.a) * (1.0 - uIce);
    vec3 c = mix(vec3(0.96, 0.98, 1.0), vec3(0.84, 0.79, 0.93), uHeart.a) * clamp(uLight, 0.62, 1.0); // (lilac at a heart; pale in the moonlight, not dark)
    c = mix(c, meadowHaze(fogColor, fogGlow, vWP - cameraPosition, fogSun), smoothstep(fogNear, fogFar, length(cameraPosition - vWP)));
    gl_FragColor = vec4(meadowGrade(c), a);
  }`;
const mistScale = { value: 600 };

// One rock shape and one material for every river's stones (never thrown away; each river has its own instances).
let rockGeo = null, rockMat = null;
function rockParts() {
  if (!rockGeo) {
    // a boulder: a coarse ball pushed in and out, so no two faces are alike (flat-shaded, as the land's own rocks)
    rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.17 * Math.sin(x * 3.1 + y * 1.7) + 0.13 * Math.sin(y * 4.3 + z * 2.9) + 0.1 * Math.sin(z * 5.2 + x * 2.3);
      p.setXYZ(i, x * k, y * k * (y < 0 ? 0.6 : 1), z * k); // (flatter underneath: it sits)
    }
    rockGeo.computeVertexNormals();
    rockMat = weatherize(std('#ffffff'), 'std');
  }
  return { rockGeo, rockMat };
}
const ROCK_TINTS = ['#a8a498', '#96938a', '#b3ad9f', '#8b8982', '#a39f8f'].map((c) => new THREE.Color(c));

/** Where a river's stones lie: [{ x, y, z, sx, sy, sz, ry, tint }], by rule from the river alone (the same every visit). */
function stonesFor(r) {
  const out = [], key = Math.round(r.x[0] * 3 + r.z[0] * 7);
  let n = 0;
  const roll = () => hash(key + n * 13, 31 + (n++) * 7);
  const put = (x, y, z, s, flat = 0.75) => out.push({ x, y, z, sx: s * (0.85 + roll() * 0.4), sy: s * flat * (0.8 + roll() * 0.4), sz: s * (0.85 + roll() * 0.4), ry: roll() * TAU, tint: Math.floor(roll() * ROCK_TINTS.length) });
  for (let i = 0; i < r.n - 1; i++) {
    const dx = r.x[i + 1] - r.x[i], dz = r.z[i + 1] - r.z[i], len = Math.hypot(dx, dz) || 1, tx = dx / len, tz = dz / len, nx = -tz, nz = tx;
    const hw = r.w[i] / 2, drop = r.lv[i] - r.lv[i + 1];
    if (r.fall[i]) {
      // a fall: rocks down both sides of its face (slabs beside a tall one), a few about the lip, and boulders round the pool at its foot
      const tall = drop > TALL, big = tall ? Math.min(1.7, 0.45 + drop * 0.07) : 0.2 + drop * 0.05, rows = r.heart ? 0 : Math.max(2, Math.ceil(drop / (tall ? 2.6 : 1.2))); // (a heart's fall pours down a bare rock face: rocks at its lip and round its pool, none hung on the face)
      for (let k = 0; k <= rows; k++) for (const side of [-1, 1]) {
        const t = 0.1 + (k / rows) * 0.9, off = hw * 0.95 + big * (0.6 + roll() * 0.4);
        put(r.x[i] + dx * t + nx * side * off, r.lv[i] - drop * Math.max(0, t - 0.12) / 0.88 + big * (tall ? 0.1 : 0), r.z[i] + dz * t + nz * side * off, big * (0.7 + roll() * 0.6), tall ? 1.15 : 0.8);
        if (tall && !r.heart && roll() < 0.5) put(r.x[i] + dx * t + nx * side * (off + big * 1.2), r.lv[i] - drop * t + big * 0.2, r.z[i] + dz * t + nz * side * (off + big * 1.2), big * (0.4 + roll() * 0.35), 1.0);
      }
      if (!(i > 0 && r.fall[i - 1])) for (const side of [-1, 1]) put(r.x[i] - tx * 0.6 + nx * side * (hw + 0.3), r.lv[i] - 0.05, r.z[i] - tz * 0.6 + nz * side * (hw + 0.3), 0.3 + roll() * 0.3); // (the lip: where the fall begins)
      const foot = r.fall[i + 1] ? 0 : r.heart && tall ? 13 : tall ? 5 : 3; // (round the pool: where the fall ends; a ring of them round a heart's broad pool)
      for (let k = 0; k < foot; k++) { const a = (roll() - 0.5) * 2.4, d = (r.heart && tall ? r.w[i + 1] / 2 * (0.75 + roll() * 0.4) : hw * (0.9 + roll() * 0.9)) + (tall ? 0.8 : 0.2); put(r.x[i + 1] + tx * (0.8 + roll() * 2.5) + nx * Math.sin(a) * d * 1.3, r.lv[i + 1] - 0.1, r.z[i + 1] + tz * (0.8 + roll() * 2.5) + nz * Math.sin(a) * d * 1.3, 0.22 + roll() * (tall ? 0.7 : 0.35)); }
    } else {
      // calm and quick water: a stone on the bank now and then; in quick water more of them, some in the stream
      const quick = Math.min(1, Math.max(0, drop / len) * 6);
      if (roll() < 0.3 + quick * 0.5) { const side = roll() < 0.5 ? -1 : 1, t = roll(); put(r.x[i] + dx * t + nx * side * (hw + 0.15 + roll() * 0.5), r.lv[i] - drop * t - 0.12, r.z[i] + dz * t + nz * side * (hw + 0.15 + roll() * 0.5), 0.16 + roll() * 0.3); }
      if (roll() < quick * 0.7 + 0.04) { const t = roll(), u = (roll() - 0.5) * 1.2; put(r.x[i] + dx * t + nx * hw * u, r.lv[i] - drop * t - 0.16, r.z[i] + dz * t + nz * hw * u, 0.14 + roll() * 0.2, 0.6); }
    }
  }
  return out;
}

/** The ribbon of water along a river, with its falling sheets, its mist and its rocks hung from it. */
function ribbon(r) {
  const rows = [];
  // a row of vertices across the river at each of its points; on a fall, one more just past the lip, so the water pours over it
  for (let i = 0; i < r.n; i++) {
    rows.push({ i, f: 0, lv: r.lv[i] });
    if (r.fall[i] && i < r.n - 1) rows.push({ i, f: 0.22, lv: r.lv[i] });
  }
  const NV = SIDE.length, pos = new Float32Array(rows.length * NV * 3), flow = new Float32Array(rows.length * NV * 2), fall = new Float32Array(rows.length * NV * 2), wid = new Float32Array(rows.length * NV);
  // foam below each fall, thinning downstream (further below a tall one)
  const foamAt = new Float32Array(r.n);
  for (let i = 0; i < r.n - 1; i++) if (r.fall[i]) { const reach = 8 + Math.min(14, (r.lv[i] - r.lv[i + 1]) * 1.2); for (let k = i + 1; k < r.n && r.s[k] - r.s[i + 1] < reach; k++) foamAt[k] = Math.max(foamAt[k], 1 - (r.s[k] - r.s[i + 1]) / reach); }
  const ox = r.x[0], oz = r.z[0]; // (positions are kept near the river's own start, so they stay precise far from the world's centre)
  const frame = (i, f) => {
    const j = Math.min(r.n - 1, i + 1), a = Math.max(0, i - 1), lerp = (A) => A[i] + (A[j] - A[i]) * f;
    const tx = r.x[j] - r.x[a], tz = r.z[j] - r.z[a], tl = Math.hypot(tx, tz) || 1;
    return { x: lerp(r.x), z: lerp(r.z), w: lerp(r.w), s: lerp(r.s), tx: tx / tl, tz: tz / tl };
  };
  rows.forEach((row, k) => {
    const i = row.i, F = frame(i, row.f);
    const pouring = r.fall[i] && row.f > 0 ? 1 : i > 0 && r.fall[i - 1] && row.f === 0 ? 1 : 0; // (the face of the fall: from just past the lip to its foot)
    for (let c = 0; c < NV; c++) {
      const o = k * NV + c, u = SIDE[c], hw = (F.w / 2) * u;
      pos[o * 3] = F.x - F.tz * hw - ox; pos[o * 3 + 1] = row.lv; pos[o * 3 + 2] = F.z + F.tx * hw - oz;
      flow[o * 2] = F.s; flow[o * 2 + 1] = Math.max(-1, Math.min(1, u));
      fall[o * 2] = pouring; fall[o * 2 + 1] = foamAt[i];
      wid[o] = F.w;
    }
  });
  const idx = [];
  for (let k = 0; k < rows.length - 1; k++) for (let c = 0; c < NV - 1; c++) { const a = k * NV + c, b = a + 1, d = a + NV, e = d + 1; idx.push(a, d, b, b, d, e); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFlow', new THREE.BufferAttribute(flow, 2));
  geo.setAttribute('aFall', new THREE.BufferAttribute(fall, 2));
  geo.setAttribute('aW', new THREE.BufferAttribute(wid, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const u = Object.assign({}, waterU, { uIce: { value: 0 }, uHeart: { value: new THREE.Vector4(0.48, 0.55, 0.74, r.heart ? 1 : 0) } });
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(ox, 0, oz);
  mesh.receiveShadow = false; mesh.castShadow = false;
  const own = [geo, mat]; // (what is this river's alone, to throw away with it)

  // the falling sheet over each fall's face: a strip standing a little off it, from the lip to the foot
  const falls = [];
  for (let i = 0; i < r.n - 1; i++) if (r.fall[i]) falls.push(i);
  if (falls.length) {
    const SV = 5, STEPS = 4, sp = [], sf = [], sa = [], sw = [], si = [];
    for (const i of falls) {
      const drop = r.lv[i] - r.lv[i + 1], off = Math.min(0.9, 0.22 + drop * 0.045), base = sp.length / 3;
      for (let k = 0; k <= STEPS; k++) {
        const t = k / STEPS, F = frame(i, 0.16 + 0.84 * t), y = r.lv[i] - drop * t, out = off * Math.sin(Math.PI * Math.min(1, t * 1.15)); // (it bellies out from the face, most just below the lip)
        for (let c = 0; c < SV; c++) {
          const uu = (c / (SV - 1)) * 2 - 1, hw = (F.w / 2) * 0.9 * uu;
          sp.push(F.x - F.tz * hw + F.tx * out - ox, y + out * 0.5 + 0.06, F.z + F.tx * hw + F.tz * out - oz);
          sf.push(F.s + i * 3.7, uu); sa.push(1, t); sw.push(F.w);
        }
      }
      for (let k = 0; k < STEPS; k++) for (let c = 0; c < SV - 1; c++) { const a = base + k * SV + c, b = a + 1, d = a + SV, e = d + 1; si.push(a, d, b, b, d, e); }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aFlow', new THREE.Float32BufferAttribute(sf, 2));
    sg.setAttribute('aFall', new THREE.Float32BufferAttribute(sa, 2));
    sg.setAttribute('aW', new THREE.Float32BufferAttribute(sw, 1));
    sg.setIndex(si);
    const sm = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const sheet = new THREE.Mesh(sg, sm);
    sheet.frustumCulled = false; sheet.renderOrder = 2;
    mesh.add(sheet); own.push(sg, sm);
  }

  // a heart's side falls: a rill from the stream on top to the lip, then a veil down the face (widening as it drops) to the pool
  const feet = [];
  if (r.sides && r.sides.length) {
    const NS = 3, vp = [], vf = [], va = [], vw = [], vi = [];
    const row = (x, y, z, px, pz, w, s, pour) => { for (let c = 0; c < NS; c++) { const uu = c - 1; vp.push(x + px * uu * w / 2 - ox, y, z + pz * uu * w / 2 - oz); vf.push(s, uu); va.push(pour, 0); vw.push(w); } };
    const strip = (from, rows) => { for (let k = 0; k < rows - 1; k++) for (let c = 0; c < NS - 1; c++) { const a = from + k * NS + c, b = a + 1, d = a + NS, e = d + 1; vi.push(a, d, b, b, d, e); } };
    r.sides.forEach((q, n) => {
      const px = -q.oz, pz = q.ox, top = height(q.x - q.ox * 0.6, q.z - q.oz * 0.6);
      // the rill: lying on the grass of the top, from the stream to the lip
      let base = vp.length / 3; const RL = 7;
      for (let k = 0; k < RL; k++) { const t = k / (RL - 1), x = q.bx + (q.x - q.bx) * t, z = q.bz + (q.z - q.bz) * t; row(x, Math.max(height(x, z), top - 0.4) + 0.07, z, px, pz, 0.9 + 0.4 * t, t * 12 + n * 31, 0); }
      strip(base, RL);
      // the face as it stands (the pool's bed is cut into its foot): how far out the rock is at each height
      const prof = []; for (let d = 0; d <= 9; d += 0.3) prof.push(height(q.x + q.ox * d, q.z + q.oz * d));
      const drop = top - q.pool, FL = 12; base = vp.length / 3;
      for (let k = 0; k < FL; k++) {
        const t = k / (FL - 1), y = top - drop * t; let d = 0; while (d < prof.length - 1 && prof[d] > y + 0.2) d++;
        const out = k ? d * 0.3 + 0.35 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.2)) : 0; // (it stands off the rock, most a little below the lip)
        row(q.x + q.ox * out, k ? y + 0.05 : top + 0.07, q.z + q.oz * out, px, pz, q.w * (1 + 1.1 * t), 12 + drop * t + n * 31, 1);
        if (k === FL - 1) feet.push({ x: q.x + q.ox * out, z: q.z + q.oz * out, y: q.pool, drop });
      }
      strip(base, FL);
    });
    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    vg.setAttribute('aFlow', new THREE.Float32BufferAttribute(vf, 2));
    vg.setAttribute('aFall', new THREE.Float32BufferAttribute(va, 2));
    vg.setAttribute('aW', new THREE.Float32BufferAttribute(vw, 1));
    vg.setIndex(vi);
    const veil = new THREE.Mesh(vg, mat);
    veil.frustumCulled = false;
    mesh.add(veil); own.push(vg);
  }

  // mist rising from the foot of each fall: more and bigger puffs, climbing higher, below a tall one
  let mist = null;
  if (falls.length) {
    const mp = [], puff = [];
    let n = 0;
    for (const i of falls) {
      const drop = r.lv[i] - r.lv[i + 1], count = Math.max(3, Math.min(9, Math.round(2 + drop * 0.5)));
      for (let k = 0; k < count; k++) {
        const j = hash(i * 17 + k, 5 + n++), F = frame(i + 1, 0);
        mp.push(r.x[i + 1] - ox + F.tx * (j * 1.6 - 0.2) - F.tz * (hash(k, i) - 0.5) * r.w[i] * 0.9, r.lv[i + 1] + 0.25, r.z[i + 1] - oz + F.tz * (j * 1.6 - 0.2) + F.tx * (hash(k, i) - 0.5) * r.w[i] * 0.9);
        puff.push(1.2 + drop * 0.45 * (0.5 + j), 2.6 + Math.min(7, drop * 0.5) * (0.6 + 0.6 * j), hash(i + k * 3, 91));
      }
    }
    for (const f of feet) for (let k = 0; k < 3; k++) { const j = hash(k * 7 + 3, Math.round(f.x * 5) + k); mp.push(f.x - ox + (j - 0.5) * 2, f.y + 0.25, f.z - oz + (hash(k, 77) - 0.5) * 2); puff.push(1.2 + f.drop * 0.3 * (0.5 + j), 2.6 + 5 * (0.6 + 0.6 * j), hash(k * 3 + 1, 91)); } // (and at the side falls' feet)
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mg.setAttribute('aPuff', new THREE.Float32BufferAttribute(puff, 3));
    const mm = new THREE.ShaderMaterial({ uniforms: Object.assign({}, u, { tPuff: { value: glowTex }, uScale: mistScale }), vertexShader: MIST_VERT, fragmentShader: MIST_FRAG, transparent: true, depthWrite: false });
    mist = new THREE.Points(mg, mm);
    mist.frustumCulled = false; mist.renderOrder = 3;
    mesh.add(mist); own.push(mg, mm);
  }

  // the rocks: one instanced mesh for the whole river
  const stones = stonesFor(r);
  if (stones.length) {
    const { rockGeo: g, rockMat: m } = rockParts(), inst = new THREE.InstancedMesh(g, m, stones.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
    stones.forEach((s, k) => {
      E.set(Math.sin(s.ry * 3.1) * 0.25, s.ry, Math.cos(s.ry * 2.3) * 0.25); Q.setFromEuler(E);
      P.set(s.x - ox, s.y, s.z - oz); S.set(s.sx, s.sy, s.sz);
      inst.setMatrixAt(k, M.compose(P, Q, S));
      inst.setColorAt(k, ROCK_TINTS[s.tint]);
    });
    inst.castShadow = true; inst.receiveShadow = true; inst.frustumCulled = false;
    mesh.add(inst); // (its shape and material are shared by every river: not thrown away)
    own.push({ dispose: () => inst.dispose() });
  }
  mesh.userData.pooledLandmark = true; // (rivers' water comes and goes with the rivers about you: left out when the scene's things are counted, as the buildings are)
  return { mesh, u, mist, own, river: r, stones: stones.length, falls: falls.length };
}

const shown = new Map(); // river id -> { mesh, u, own, river }
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
    for (const [id, s] of shown) if (!want.has(id)) { scene.remove(s.mesh); for (const o of s.own) o.dispose(); shown.delete(id); }
  }
  for (const s of shown.values()) s.u.uIce.value = riverIce(s.river); // (the sheet and the mist read it too: they stop when the river is frozen)
}
/** The mist's puffs are sized by the height of the view (called when the canvas is resized). */
export function resizeRivers(h) { mistScale.value = h * 0.9; }
/** For tests: the rivers with water drawn just now. */
export const riversShown = () => [...shown.keys()];
/** For tests and tools: what is drawn of the rivers just now. */
export const riversView = () => [...shown.values()].map((s) => ({ id: s.river.id, falls: s.falls, stones: s.stones }));
