// The cherry grove: a small Shinto-style shrine among blossoming cherry trees, reached through
// three vermilion torii along a stepping-stone path lined with stone lanterns. Petals drift down
// all year and lie pink on the ground; at dusk the lanterns glow and the blossom catches the light.
//
// Everything lives in one group. Past DETAIL metres it stops casting shadows and the petals stop;
// past HIDE metres it isn't drawn at all, so the grove costs nothing from the rest of the land.
//
// There is one shrine, and many places it may stand: the land's shrine sites (core/shape.js: one
// by the home lake, others in blossom groves, each on ground the land levels for it). It is built
// once, on flat ground at the origin, and set down whole at the site nearest you; it moves on to
// another only while it is out of sight. Nothing is built or thrown away when it moves.
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../core/render.js';
import { TAU, mulberry32 } from '../core/math.js';
import { homeShrineSite, shrineSiteAt, shrineSitesNear } from '../core/shape.js';
import { std, weatherize, addWind, cutoutDepth, glowTex, softEdges, neonAtNight } from '../core/materials.js';
import { kit } from '../core/assets.js';
import { cherryHero } from './proctrees.js';
import { world, obstacles, hooks } from '../core/state.js';
import { cur } from '../systems/time.js';

const HIDE = 115;          // beyond this the whole grove is switched off
const DETAIL = 75;         // beyond this it casts no shadows and no petals fall (neither can be seen from there)
const GROVE_R = 17;        // the ring of cherry trees
const PATH_LEN = 19;       // from the first torii to the shrine steps

/** Where the shrine stands to begin with: the site by the home lake (it is moved to the one nearest you once you are placed). */
export function chooseShrineSite() {
  world.shrine = homeShrineSite();
  return world.shrine;
}
/** Under the hall or on the stone path, in the shrine's own frame (`along` its path, `across` it)? */
const onStone = (along, across) => (Math.abs(along) < 3.6 && Math.abs(across) < 4.2) || (along > 0 && along < PATH_LEN + 1 && Math.abs(across) < 1.1);
/**
 * True where grass shouldn't grow: under the hall and along the stone path of any shrine site
 * (whether or not the shrine stands there just now: the ground is the land's, not the shrine's).
 */
export function onShrineGround(x, z) {
  const s = shrineSiteAt(x, z, PATH_LEN + 3);
  if (!s) return false;
  const dx = x - s.x, dz = z - s.z;
  return onStone(dx * s.fx + dz * s.fz, -dx * s.fz + dz * s.fx);
}

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
function add(group, geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = true;
  group.add(m);
  return m;
}
/** A square roof with slopes that sweep up at the eaves (a lathe profile turned in four steps). */
function sweptRoof(reach, rise, sx, sz) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(reach * t, rise * (1 - t) ** 2.1 + 0.16 * t ** 6)); }
  return new THREE.LatheGeometry(pts, 4).rotateY(Math.PI / 4).scale(sx, 1, sz);
}

function buildHall(g, mats) {
  const { red, wood, white, roof, stone, gold } = mats;
  // stone base, wooden deck on posts, steps at the front (+z is the front in the group's frame)
  add(g, box(7.0, 0.35, 5.6, 0, 0.175, 0), stone);
  add(g, box(6.2, 0.16, 4.8, 0, 0.83, 0), wood);
  for (const x of [-2.8, 0, 2.8]) for (const z of [-2.1, 2.1]) add(g, box(0.28, 0.5, 0.28, x, 0.55, z), wood);
  for (let i = 0; i < 3; i++) add(g, box(2.4, 0.2, 0.42, 0, 0.1 + i * 0.26, 3.5 - i * 0.42), stone);
  // the hall: white walls between vermilion posts and beams, open at the front
  add(g, box(4.2, 2.3, 0.1, 0, 2.06, -1.5), white);
  for (const x of [-2.1, 2.1]) add(g, box(0.1, 2.3, 3.0, x, 2.06, 0), white);
  for (const x of [-2.1, -0.7, 0.7, 2.1]) for (const z of [-1.5, 1.5]) add(g, new THREE.CylinderGeometry(0.13, 0.13, 2.5, 8).translate(x, 2.16, z), red);
  for (const z of [-1.5, 1.5]) add(g, box(4.7, 0.2, 0.22, 0, 3.3, z), red);
  add(g, box(4.5, 0.12, 0.16, 0, 1.2, -1.5), red);
  for (const x of [-2.1, 2.1]) add(g, box(0.22, 0.2, 3.4, x, 3.3, 0), red);
  // railing round the deck
  for (const [w, d, x, z] of [[6.2, 0.07, 0, -2.36], [0.07, 4.8, -3.06, 0], [0.07, 4.8, 3.06, 0], [1.8, 0.07, -2.2, 2.36], [1.8, 0.07, 2.2, 2.36]]) add(g, box(w, 0.07, d, x, 1.42, z), red);
  for (let x = -3; x <= 3.01; x += 1) for (const z of [-2.36, 2.36]) if (z < 0 || Math.abs(x) > 1.2) add(g, box(0.09, 0.56, 0.09, x, 1.19, z), red);
  // roofs: a broad swept one, a smaller one above, a ridge with gold ends
  add(g, sweptRoof(4.3, 1.5, 1.12, 0.9).translate(0, 3.4, 0), roof);
  add(g, box(3.0, 0.5, 2.0, 0, 4.75, 0), white);
  add(g, sweptRoof(2.7, 1.25, 1.1, 0.85).translate(0, 5.0, 0), roof);
  add(g, box(2.3, 0.16, 0.2, 0, 6.28, 0), roof);
  for (const x of [-1.2, 1.2]) add(g, new THREE.ConeGeometry(0.12, 0.45, 5).translate(x, 6.55, 0), gold);
  // offering box, the bell and its rope, the sacred rope with paper streamers
  add(g, box(1.1, 0.5, 0.6, 0, 1.16, 1.75), wood);
  add(g, new THREE.SphereGeometry(0.16, 8, 6).translate(0, 3.0, 1.62), gold);
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5).translate(0, 2.25, 1.62), white, false);
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 3.0, 6).rotateZ(Math.PI / 2).translate(0, 3.08, 1.66), mats.rope, false);
  for (const x of [-1, -0.33, 0.33, 1]) add(g, box(0.14, 0.34, 0.02, x, 2.85, 1.7), white, false);
}

function torii(mats, s = 1) {
  const g = new THREE.Group(), { red, dark } = mats;
  for (const x of [-1.9, 1.9]) {
    add(g, new THREE.CylinderGeometry(0.17, 0.2, 4.3, 10).translate(x, 2.15, 0).rotateZ(x > 0 ? 0.03 : -0.03), red);
    add(g, new THREE.CylinderGeometry(0.26, 0.28, 0.3, 10).translate(x * 1.03, 0.15, 0), dark);
  }
  add(g, box(4.5, 0.22, 0.2, 0, 3.35, 0), red);                 // tie beam
  add(g, box(0.2, 0.5, 0.18, 0, 3.72, 0), red);                 // the plaque strut
  // the top lintel curves up at its ends: a row of short blocks along an arc
  for (let i = -14; i <= 14; i++) {
    const x = i * 0.2, lift = (i / 14) ** 2 * 0.32, tilt = (i / 14) * 0.16;
    add(g, new THREE.BoxGeometry(0.24, 0.26, 0.34).rotateZ(tilt).translate(x, 4.2 + lift, 0), red);
    add(g, new THREE.BoxGeometry(0.25, 0.1, 0.44).rotateZ(tilt).translate(x, 4.39 + lift, 0), dark);
  }
  g.scale.setScalar(s);
  return g;
}

function lantern(mats) {
  const g = new THREE.Group(), { stone } = mats;
  add(g, new THREE.CylinderGeometry(0.26, 0.32, 0.16, 6).translate(0, 0.08, 0), stone);
  add(g, new THREE.CylinderGeometry(0.1, 0.13, 0.75, 6).translate(0, 0.53, 0), stone);
  add(g, new THREE.CylinderGeometry(0.27, 0.16, 0.12, 6).translate(0, 0.96, 0), stone);
  add(g, box(0.3, 0.3, 0.3, 0, 1.17, 0), mats.light, false);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(g, box(0.05, 0.3, 0.05, x * 0.15, 1.17, z * 0.15), stone, false);
  add(g, new THREE.ConeGeometry(0.4, 0.26, 6).translate(0, 1.45, 0), stone);
  add(g, new THREE.SphereGeometry(0.07, 6, 4).translate(0, 1.62, 0), stone, false);
  return g;
}

/** Fuse every plain mesh under `root` into one mesh per material (and shadow flag): a few draw calls instead of hundreds. */
function fuse(root) {
  root.updateMatrixWorld(true);
  const sets = new Map(), gone = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.material.transparent) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : 'n');
    if (!sets.has(key)) sets.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    Object.keys(g.attributes).forEach((k) => { if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); });
    sets.get(key).geos.push(g);
    gone.push(o);
  });
  gone.forEach((o) => o.parent.remove(o));
  for (const { mat, cast, geos } of sets.values()) {
    const m = new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(geos), mat);
    m.castShadow = cast; m.receiveShadow = true;
    root.add(m);
  }
}

/** The cherry trees: the kit's twisted trees in blossom, or simple pink crowns without the kit. */
/**
 * The flower carpet: clumps of pink and pale blossom crowding the ground under the trees, from
 * the meadow pack. Small plants (layer 1, no shadows), shown only while you are in or near the grove.
 */
function flowerCarpet(R) {
  const g = new THREE.Group();
  if (!kit || !kit.models.Flower_4_Clump) return g;
  const mat = softEdges(neonAtNight(new THREE.MeshLambertMaterial({ map: kit.tex.meadow_flowers, alphaTest: 0.5, side: THREE.DoubleSide }), 0.8));
  const spots = [[], []];
  for (let i = 0; i < 6000 && spots[0].length + spots[1].length < 1500; i++) {
    const a = R() * TAU, d = Math.sqrt(R()) * (GROVE_R + 5), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (onStone(z, x) || d > GROVE_R + 5 - R() * 5) continue;
    spots[R() < 0.72 ? 0 : 1].push({ x, z, s: 0.75 + R() * 0.7, ry: R() * TAU });
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  [['Flower_4_Clump', [1.25, 0.85, 1.0]], ['Flower_2_Clump', [1.5, 1.5, 1.7]]].forEach(([name, tint], k) => {
    const geo = Object.values(kit.models[name])[0].clone();
    geo.computeBoundingBox();
    const b = geo.boundingBox, sc = 0.36 / (b.max.y - Math.max(b.min.y, 0));
    geo.translate(0, -Math.max(b.min.y, 0), 0).scale(sc, sc, sc);
    const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // lit evenly from above
    const m = new THREE.InstancedMesh(geo, mat, spots[k].length);
    spots[k].forEach((t, i) => {
      m.setMatrixAt(i, M.compose(new THREE.Vector3(t.x, -0.02, t.z), Q.setFromAxisAngle(Y, t.ry), new THREE.Vector3(t.s * 1.5, t.s, t.s * 1.5)));
      m.setColorAt(i, c.setRGB(tint[0], tint[1] * (0.85 + 0.3 * ((i * 7) % 10) / 10), tint[2]));
    });
    m.frustumCulled = false; m.receiveShadow = true; m.layers.set(1);
    g.add(m);
  });
  return g;
}

/** Petals lying on the ground: a sheet of pink specks, thickest under the trees. */
function petalCarpet(group) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d'), r = mulberry32(88);
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = ['#ffd0e0', '#ffb8d0', '#ffe6ee', '#f7a6c4'][i % 4];
    ctx.globalAlpha = 0.55 + r() * 0.45;
    ctx.beginPath(); ctx.ellipse(r() * 256, r() * 256, 1.2 + r() * 1.6, 0.8 + r(), r() * 3.14, 0, TAU); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(9, 9);
  const size = (GROVE_R + 6) * 2, seg = 40, geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z) / (GROVE_R + 6);
    p.setY(i, 0.05);
    col.set([1, 1, 1, Math.max(0, 1 - d ** 2.2)], i * 4);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, vertexColors: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true; m.renderOrder = 1;
  group.add(m);
}

/**
 * Petals in the air: points that fall, sway and loop inside a box (set over its place when the
 * shrine is set down), all on the GPU. Each is
 * a cherry petal (rounded, notched at the tip, deeper pink at its base) tumbling as it drifts.
 */
function petalFall(o) {
  const N = o.n, W = o.spread, r = mulberry32(o.seed), pos = new Float32Array(N * 3), seed = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { pos.set([(r() - 0.5) * W, o.low + r() * (o.top - o.low), (r() - 0.5) * W], i * 3); seed.set([r(), r()], i * 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
  const u = { uTime: { value: 0 }, uLight: { value: 1 }, uGround: { value: 0 }, uSize: { value: 1 } };
  const H = (o.top - o.low).toFixed(1), LOW = o.low.toFixed(1), HW = (W / 2).toFixed(1), WW = W.toFixed(1), SLOW = o.slow.toFixed(2);
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; uniform float uGround; uniform float uSize; attribute vec2 aSeed; varying float vSpin; varying float vTone; varying float vFlat;
      void main() {
        vec3 p = position;
        float t = uTime * ${SLOW}, fall = 0.45 + aSeed.x * 0.45;
        p.y = uGround + ${LOW} + mod(position.y - ${LOW} - t * fall, ${H}) + 0.1;
        // a lazy spiral as it falls, and the breeze carrying it along
        float sw = t * (0.5 + aSeed.y * 0.6) + aSeed.x * 40.0;
        p.x += sin(sw) * (0.6 + aSeed.y * 0.8) + t * 0.3;
        p.z += cos(sw * 0.9) * (0.6 + aSeed.x * 0.8) + sin(t * 0.2 + aSeed.y * 9.0) * 0.6;
        p.x = mod(p.x + ${HW}, ${WW}) - ${HW};
        vSpin = t * (0.8 + aSeed.y * 1.6) + aSeed.x * 6.28; vTone = aSeed.y; vFlat = abs(sin(t * (0.7 + aSeed.x) + aSeed.y * 5.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(uSize * (0.1 + aSeed.x * 0.06) / -mv.z, 22.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uLight; varying float vSpin; varying float vTone; varying float vFlat;
      void main() {
        vec2 q = gl_PointCoord - 0.5; float c = cos(vSpin), s = sin(vSpin);
        q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        // narrower as it tumbles edge-on
        q.x /= 0.35 + 0.65 * vFlat;
        float e = length(q * vec2(1.25, 0.95) - vec2(0.0, 0.02));
        if (e > 0.42) discard;
        if (q.y < -0.3 && abs(q.x) < (q.y + 0.42) * 0.55) discard;                     // the notch at its tip
        vec3 base = mix(vec3(1.0, 0.55, 0.72), vec3(1.0, 0.68, 0.8), vTone), tip = vec3(1.0, 0.9, 0.94);
        gl_FragColor = vec4(mix(base, tip, smoothstep(0.25, -0.35, q.y)) * uLight * (0.85 + 0.15 * vFlat), 0.95);
      }`,
  }));
  m.frustumCulled = false;
  scene.add(m);
  return { mesh: m, u };
}

/**
 * The great cherry behind the hall: one old tree grown from code (world/proctrees.js), far bigger
 * than the rest, its blossom painted flower by flower. It glows faintly after dark like the others.
 */
function greatCherry(group, p, mats) {
  const t = cherryHero(), S = 1.55, y = -0.3;
  const blossom = weatherize(addWind(std('#ffffff', { map: t.blossomTex, alphaTest: 0.5, side: THREE.DoubleSide, flatShading: false, vertexColors: true, emissive: '#ff5c93', emissiveIntensity: 0 }), 0.0007, null, null, 0.12), 'std');
  blossom.color.set('#ff6ea0').multiply(new THREE.Color(1.5, 1.24, 1.34)); // the same lifted hot pink as the grove's other cherries
  mats.blossoms.push(blossom);
  const bark = weatherize(std('#ffffff', { map: t.barkTex, flatShading: false, vertexColors: true }), 'std');
  [[t.blossom, blossom], [t.bark, bark]].forEach(([geo, mat]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, y, p.z); m.scale.setScalar(S); m.rotation.y = 0.6;
    m.castShadow = m.receiveShadow = true;
    if (mat === blossom) m.customDepthMaterial = cutoutDepth(t.blossomTex);
    group.add(m);
  });
}

/** The shrine's parts and the site it stands at; `setDown` puts it at another. */
let setDown = null, here = null;
/**
 * Have the shrine stand at the site nearest (x, z). While walking it only moves once the place it
 * stands is well out of sight; with `now`, at once (on arriving somewhere by the Places list, and at load).
 */
export function shrineNear(x, z, now = false) {
  if (!setDown) return;
  const best = shrineSitesNear(x, z, 900)[0];
  if (!best || best === here) return;
  if (!now && Math.hypot(x - here.x, z - here.z) < HIDE + 30) return;
  setDown(best);
}

/** Build the shrine (once) and set it down by the home lake. `lampSpots` gains the shrine's lantern light if there is room. */
export function buildShrine(lampSpots) {
  if (!world.shrine) return;
  const R = mulberry32(60923), rr = (a, b) => a + (b - a) * R();
  const mats = {
    red: weatherize(std('#c93a2c', { flatShading: false, roughness: 0.6 }), 'std'), dark: std('#22201f', { flatShading: false }),
    wood: weatherize(std('#7a5236', { roughness: 0.8 }), 'std'), white: std('#f1ece0'), stone: weatherize(std('#8f918c'), 'std'),
    roof: weatherize(std('#3a4f55', { flatShading: false, roughness: 0.7, side: THREE.DoubleSide }), 'std'), gold: std('#d9b24a', { metalness: 0.5, roughness: 0.4 }), rope: std('#cdb98a'),
    light: new THREE.MeshStandardMaterial({ color: '#fff1cf', emissive: '#ffb45e', emissiveIntensity: 0 }),
  };
  // Built in its own frame, on flat ground at height 0: +z runs down the path (`along`), +x is `across`.
  const group = new THREE.Group();
  const at = (along, across) => ({ x: across, z: along });
  const blocks = []; // what is in the way, in the shrine's frame; each has its blocker in `obstacles`, moved with it
  const block = (along, across, r) => { const o = { x: 0, z: 0, r }; obstacles.push(o); blocks.push({ along, across, o }); };

  const hall = new THREE.Group();
  buildHall(hall, mats);
  hall.position.set(0, -0.1, 0);
  group.add(hall);
  // the hall and its steps are solid: a close grid of blockers over the whole footprint
  for (let a = -2.3; a <= 3.5; a += 0.95) for (let c = -3.1; c <= 3.11; c += 1.03) { if (a > 2.6 && Math.abs(c) > 1.3) continue; block(a, c, 0.8); }

  // the path: stepping stones, three torii growing toward the entrance, lanterns in pairs
  const stoneGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.1, 7), stones = [];
  for (let a = 4.2; a < PATH_LEN + 1; a += 0.95) { const p = at(a, rr(-0.18, 0.18)); stones.push([p, rr(0.85, 1.2), rr(0, TAU)]); }
  const sm = new THREE.InstancedMesh(stoneGeo, mats.stone, stones.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  stones.forEach(([p, sc, ry], i) => sm.setMatrixAt(i, M.compose(new THREE.Vector3(p.x, 0.03, p.z), Q.setFromAxisAngle(Y, ry), new THREE.Vector3(sc * 1.25, 1, sc))));
  sm.receiveShadow = true; sm.frustumCulled = false; group.add(sm);
  [[7, 0.92], [12.5, 1.0], [PATH_LEN, 1.14]].forEach(([a, sc]) => {
    const t = torii(mats, sc), p = at(a, 0);
    t.position.set(p.x, -0.05, p.z); group.add(t);
    for (const c of [-1.9 * sc, 1.9 * sc]) block(a, c, 0.32);
  });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffc27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  [4.6, 9.8, 15.6].forEach((a) => [-1.7, 1.7].forEach((c) => {
    const l = lantern(mats), p = at(a, c);
    l.position.set(p.x, -0.03, p.z); group.add(l);
    const glow = new THREE.Sprite(glowMat); glow.position.set(p.x, 1.17, p.z); glow.scale.set(1.7, 1.7, 1); group.add(glow);
    block(a, c, 0.3);
  }));
  // one of the meadow's light pools, if a slot is free, falls in front of the hall
  const lamp = lampSpots && lampSpots.length < 12 ? new THREE.Vector3() : null;
  if (lamp) lampSpots.push(lamp);

  fuse(group); // hall, gates and lanterns become one mesh per material
  // one great cherry stands alone behind the hall (the grove's ring of small ones is gone)
  const HERO = [-13, 1.2], hero = at(...HERO);
  mats.blossoms = [];
  greatCherry(group, hero, mats);
  block(HERO[0], HERO[1], 1.3);
  petalCarpet(group);
  const flowers = flowerCarpet(R);
  group.add(flowers);
  scene.add(group);
  // a few petals carried over the whole grove, and a thick fall drifting out of the great cherry's crown
  const petalSets = [petalFall({ n: 260, spread: 44, low: 0, top: 11, seed: 4107, slow: 1 }), petalFall({ n: 1900, spread: 30, low: 0, top: 19, seed: 4111, slow: 0.75 })];

  /** Set the whole shrine down at a site: its group, what blocks the way, its light and its falling petals. */
  setDown = (site) => {
    here = world.shrine = site;
    const to = (along, across) => ({ x: site.x + site.fx * along + site.fz * across, z: site.z + site.fz * along - site.fx * across });
    group.position.set(site.x, site.y, site.z);
    group.rotation.y = Math.atan2(site.fx, site.fz); // the group's +z points down the path
    group.updateMatrixWorld(true);
    world.shrineStands = { x: group.position.x, y: group.position.y, z: group.position.z }; // (for tests: where the thing itself is)
    for (const b of blocks) { const p = to(b.along, b.across); b.o.x = p.x; b.o.z = p.z; }
    if (lamp) { const p = to(6, 0); lamp.set(p.x, site.y + 1.6, p.z); }
    const h = to(...HERO);
    petalSets[0].mesh.position.set(site.x, 0, site.z);
    petalSets[1].mesh.position.set(h.x, 0, h.z);
    petalSets.forEach((p) => { p.u.uGround.value = site.y; });
  };
  setDown(world.shrine);

  const casters = []; group.traverse((o) => { if (o.isMesh && o.castShadow) casters.push(o); });
  let wasDetail = true, lookIn = 0;
  // far away, none of it is drawn or animated
  hooks.frame.push((dt, t, camera) => {
    lookIn -= dt;
    if (lookIn <= 0) { lookIn = 1; shrineNear(camera.position.x, camera.position.z); } // (now and then: is another site nearer, with this one out of sight?)
    const s = here, d = Math.hypot(camera.position.x - s.x, camera.position.z - s.z), near = d < HIDE, detail = d < DETAIL;
    group.visible = near; flowers.visible = detail;
    petalSets.forEach((p) => { p.mesh.visible = detail; });
    if (!near) return;
    if (detail !== wasDetail) { wasDetail = detail; casters.forEach((m) => { m.castShadow = detail; }); }
    if (!detail) return;
    petalSets.forEach((p) => { p.u.uTime.value = t; p.u.uLight.value = 0.4 + 0.6 * cur.day; p.u.uSize.value = window.innerHeight * 1.2; });
    mats.light.emissiveIntensity = cur.eve * 2.2;
    glowMat.opacity = cur.eve * 0.8;
    mats.blossoms.forEach((b) => { b.emissiveIntensity = cur.eve * 0.14; }); // the blossom holds a faint glow after dark
  });
}
