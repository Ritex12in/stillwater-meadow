// The characters: VRoid's sample avatars (pixiv's VRoid project; each file's own licence lets anyone
// use, change and share them, commercially too, without credit: public/assets/characters/vroid/
// LICENSE.txt). They stand in for the code-built children, who still run underneath, hidden, so
// everything that reads their pose keeps working. You choose who you and your friend are in
// Settings; only the two chosen are loaded. The files come with no animations, so they are posed
// here, bone by bone, from what the figure is doing: standing (breathing, blinking), walking and
// running, skating, sitting on a seat or on the grass, lying down, crouching to pet or pick up,
// fishing, and cheering or waving. The textures were shrunk (tools/shrink-vrm.mjs).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../core/render.js';
import { query } from '../core/env.js';
import { damp } from '../core/math.js';

/** Who can be chosen: id (the file), the name shown. */
export const CHARACTERS = [
  { id: 'fumiriya', name: 'Fumiriya' },
  { id: 'e', name: 'Bibi' },
  { id: 'shino', name: 'Shino' },
  { id: 'd', name: 'Shibu' },
  { id: 'd-dark', name: 'Shibu (dark)' },
  { id: 'f', name: 'Vita' },
  { id: 'g', name: 'Victoria' },
];
/** The defaults: you, and your friend. `classic` is the code-built figure. */
export const DEFAULT_YOU = 'fumiriya', DEFAULT_FRIEND = 'e';
/** `?hero=classic` shows the code-built figures whatever is chosen. */
export const CLASSIC_ONLY = query.get('hero') === 'classic';
/** They are grown-ups beside the old children: drawn at this share of their own height. */
const SCALE = 0.82;

// soft anime shading: three tones of light
const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();
function toon(m) {
  const alpha = m.transparent || m.alphaTest > 0 || (m.map && m.map.format === THREE.RGBAFormat && m.name && /Hair|Eye|Face|Brow|Lash|Line/i.test(m.name));
  const t = new THREE.MeshToonMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, gradientMap: gradient, side: m.side, alphaTest: alpha ? 0.45 : 0, transparent: false });
  t.skinning = !!m.skinning; t.morphTargets = !!m.morphTargets; t.morphNormals = !!m.morphNormals; // (three r128: a skinned or morphed mesh's material must say so)
  if (m.emissiveMap && m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) { t.emissiveMap = m.emissiveMap; t.emissive = m.emissive.clone(); } // (only as much glow as the file gives it)
  if (t.map) t.map.encoding = THREE.sRGBEncoding;
  t.name = m.name;
  return t;
}

const BONES = { hips: 'J_Bip_C_Hips', spine: 'J_Bip_C_Spine', chest: 'J_Bip_C_Chest', neck: 'J_Bip_C_Neck', head: 'J_Bip_C_Head',
  lArm: 'J_Bip_L_UpperArm', lFore: 'J_Bip_L_LowerArm', rArm: 'J_Bip_R_UpperArm', rFore: 'J_Bip_R_LowerArm',
  lLeg: 'J_Bip_L_UpperLeg', lKnee: 'J_Bip_L_LowerLeg', rLeg: 'J_Bip_R_UpperLeg', rKnee: 'J_Bip_R_LowerLeg', lFoot: 'J_Bip_L_Foot', rFoot: 'J_Bip_R_Foot', lHand: 'J_Bip_L_Hand', rHand: 'J_Bip_R_Hand' };
const FINGER = /^J_Bip_([LR])_(Index|Middle|Ring|Little|Thumb)([123])$/;

/** Load a character by id: { id, root, set, ... }, or null if it cannot be loaded. */
export async function loadCharacter(id) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/characters/vroid/${id}.vrm`).catch((e) => { console.error('character', id, e); return null; });
  if (!gltf) return null;
  const model = gltf.scene;
  const bones = {}, fingers = {}, blink = [], toons = new Map();
  const toonOf = (m) => { if (!toons.has(m)) toons.set(m, toon(m)); return toons.get(m); };
  model.traverse((o) => {
    for (const k in BONES) if (o.name === BONES[k]) bones[k] = o;
    const f = FINGER.exec(o.name); if (f) fingers[f[1] + f[2] + (+f[3] - 1)] = o;
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = Array.isArray(o.material) ? o.material.map(toonOf) : toonOf(o.material);
      const d = o.morphTargetDictionary;
      if (d) for (const name in d) if (/EYE_Close$|Blink$/i.test(name) && !/_[LR]$/.test(name)) blink.push([o, d[name]]);
    }
  });
  if (!bones.hips || !bones.lLeg) { console.error('character', id, 'has no humanoid bones'); return null; }
  // blinking by the file's own "blink" expression (VRM), if the morphs had no names to find it by
  const vrm = gltf.parser.json.extensions && gltf.parser.json.extensions.VRM;
  const group = vrm && vrm.blendShapeMaster && (vrm.blendShapeMaster.blendShapeGroups || []).find((q) => q.presetName === 'blink');
  if (!blink.length && group) for (const bind of group.binds || []) {
    const dep = await gltf.parser.getDependency('mesh', bind.mesh);
    dep.traverse((o) => { if (o.isMesh && o.morphTargetInfluences && bind.index < o.morphTargetInfluences.length) blink.push([o, bind.index]); });
  }
  // the files come in many small pieces (the hair alone in 60 to 80, of two or three materials):
  // the pieces of one mesh that share a material are merged, so each is drawn once, not dozens of times
  const merged = mergePieces(model);
  for (const e of blink) if (merged.has(e[0])) e[0] = merged.get(e[0]);
  for (let i = blink.length - 1; i >= 0; i--) if (blink.findIndex((q) => q[0] === blink[i][0] && q[1] === blink[i][1]) !== i) blink.splice(i, 1);
  // the model faces -z (VRM 0.x): turned to face +z like everything else in the meadow
  const inner = new THREE.Group(); inner.add(model); model.rotation.y = Math.PI;
  const root = new THREE.Group(); root.add(inner); root.scale.setScalar(SCALE);
  scene.add(root);
  root.updateMatrixWorld(true);
  const hipY = bones.hips.getWorldPosition(new THREE.Vector3()).y / SCALE; // (standing, in the model's own metres)
  const thigh = bones.lLeg.getWorldPosition(new THREE.Vector3()).distanceTo(bones.lKnee.getWorldPosition(new THREE.Vector3())) / SCALE;
  const hips0 = bones.hips.position.clone(), legLen = hipY;
  const rest = {}; for (const k in bones) rest[k] = bones[k].rotation.clone();
  return { id, root, inner, model, bones, fingers, rest, hips0, hipY, thigh, legLen, blink, phase: 0, t: 0, nextBlink: 2, blinkT: 0, w: {} };
}
/** Merge the skinned pieces under one parent that share a material and a skin. Returns old piece -> merged mesh. */
function mergePieces(model) {
  const groups = new Map(), out = new Map();
  model.traverse((o) => {
    if (!o.isSkinnedMesh || Array.isArray(o.material)) return;
    const key = o.parent.uuid + '|' + o.material.uuid + '|' + o.skeleton.bones.length + '|' + Object.keys(o.geometry.attributes).sort().join() + '|' + Object.keys(o.geometry.morphAttributes).join() + ':' + ((o.geometry.morphAttributes.position || []).length);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const first = list[0], indexed = list.every((q) => q.geometry.index), plain = list.every((q) => !q.geometry.index);
    if (!indexed && !plain) continue;
    const geo = BufferGeometryUtils.mergeBufferGeometries(list.map((q) => q.geometry), false);
    if (!geo) continue;
    geo.morphTargetsRelative = first.geometry.morphTargetsRelative;
    const m = new THREE.SkinnedMesh(geo, first.material);
    m.name = first.name; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.position.copy(first.position); m.quaternion.copy(first.quaternion); m.scale.copy(first.scale);
    first.parent.add(m);
    m.bind(first.skeleton, first.bindMatrix);
    if (first.morphTargetDictionary) m.morphTargetDictionary = Object.assign({}, first.morphTargetDictionary);
    for (const q of list) { q.parent.remove(q); q.geometry.dispose(); out.set(q, m); }
  }
  return out;
}
/** Take a character out of the world. */
export function dropCharacter(c) {
  if (!c) return;
  scene.remove(c.root);
  c.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
}

// The pose: target angles per bone (x, y, z, in the model's own frame: it faces -z, its left is -x),
// a shift of the hips, how far the hands are closed, eased toward each frame. Angles: +x on a leg or
// an arm swings it forward; on a shin, -x bends the knee; +x on a foot lifts the toes.
const T = () => ({ hipsY: 0, hipsZ: 0, hipsX: 0, hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  lArm: [0, 0, 1.42], rArm: [0, 0, -1.42], lFore: [0, -0.25, 0], rFore: [0, 0.25, 0], lHand: [0, 0, 0.04], rHand: [0, 0, -0.04],
  lLeg: [0, 0, 0], rLeg: [0, 0, 0], lKnee: [0, 0, 0], rKnee: [0, 0, 0], lFoot: [0, 0, 0], rFoot: [0, 0, 0], grip: 0.15, lie: 0 });
const POSED = ['hips', 'spine', 'chest', 'neck', 'head', 'lArm', 'rArm', 'lFore', 'rFore', 'lHand', 'rHand', 'lLeg', 'rLeg', 'lKnee', 'rKnee', 'lFoot', 'rFoot'];
// a finger's three joints curl by these shares of the grip (index to little: the little finger curls most)
const CURL = { Index: [0.55, 0.75, 0.5], Middle: [0.65, 0.85, 0.55], Ring: [0.7, 0.9, 0.6], Little: [0.75, 0.95, 0.65] };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bump = (a, w) => Math.exp(-(wrap(a) ** 2) / w); // (a soft peak where the phase reaches a point)

/**
 * One leg through the walking cycle, at phase `ph` (0: passing under the body going forward; PI/2:
 * the heel strikes, as far forward as it goes; PI: passing under going back; -PI/2: the toes push off).
 * Returns [thigh, knee bend, foot] in radians.
 */
function leg(ph, run, A) {
  const s = Math.sin(ph), c = Math.cos(ph);
  const thigh = A * s + (run ? 0.18 : 0.04);
  // the knee bends most early in the swing (to clear the ground), a little as the heel takes the
  // weight, and is nearly straight at the strike and under the body in the stance
  const swing = Math.max(0, Math.cos(ph + (run ? 0.45 : 0.2))) ** 1.6;
  const bend = (run ? 0.25 : 0.06) + (run ? 1.75 : 0.72) * swing + 0.22 * Math.max(0, s) * Math.max(0, -c) * 2;
  // the foot stays level with the ground in the stance; the toes lift for the heel strike and point
  // as they push off
  const foot = -(thigh - bend) + 0.22 * bump(ph - Math.PI / 2, 0.12) - (run ? 0.7 : 0.5) * bump(ph + Math.PI / 2 - 0.15, 0.1);
  return [thigh, bend, foot];
}

/**
 * Follow a figure each frame and pose to what it is doing. `p`: { x, y, z, rot, move (m/s),
 * seat (with its `top`, the seat's height), sitAmt, lieAmt, pickT, petAmt, skating }; `c`: { act,
 * ground (how far into sitting on the grass), emote ('wave', 'cheer', 'dance' or null) }.
 */
export function followFigure(ch, p, dt, c) {
  ch.t += dt;
  ch.root.position.set(p.x, p.y, p.z);
  ch.root.rotation.y = p.rot;
  const g = T(), s = Math.sin, t = ch.t;
  const speed = p.move || 0, run = speed > 3.2, sitting = p.seat && p.sitAmt > 0.5, ground = c.ground > 0.5;
  let walking = false;
  if (p.lieAmt > 0.5) {
    // lying on the back, looking up, hands on the chest
    g.lie = 1; g.lArm = [0.5, 0, 1.0]; g.rArm = [0.5, 0, -1.0]; g.lFore = [0, -1.6, 0]; g.rFore = [0, 1.6, 0];
  } else if (sitting) {
    // on a seat: thighs level at the seat's height, shins down, hands resting on the knees
    const top = (p.seat && p.seat.top) || 0.46;
    g.hipsY = -(ch.hipY - top / SCALE - 0.04);
    g.lLeg = [1.5, 0, 0.06]; g.rLeg = [1.5, 0, -0.06]; g.lKnee = [-1.45, 0, 0]; g.rKnee = [-1.45, 0, 0]; g.lFoot = [-0.05, 0, 0]; g.rFoot = [-0.05, 0, 0];
    g.lArm = [0.55, 0, 1.22]; g.rArm = [0.55, 0, -1.22]; g.lFore = [0, -0.75, 0]; g.rFore = [0, 0.75, 0];
    g.lHand = [0, 0, 0.35]; g.rHand = [0, 0, -0.35];
    g.chest = [0.03 * s(t * 1.4), 0, 0]; g.head = [0.06, 0.2 * s(t * 0.21), 0];
  } else if (ground) {
    // on the grass, legs out in front with a knee up, leaning back on the hands
    g.hipsY = -(ch.hipY - 0.1 / SCALE); g.hipsZ = 0.25;
    g.lLeg = [1.4, 0, 0.12]; g.rLeg = [1.75, 0, -0.08]; g.lKnee = [-0.3, 0, 0]; g.rKnee = [-1.4, 0, 0];
    g.spine = [0.2, 0, 0]; g.lArm = [-0.55, 0, 1.05]; g.rArm = [-0.55, 0, -1.05]; g.lFore = [0, -0.1, 0]; g.rFore = [0, 0.1, 0];
    g.lHand = [0, 0, -0.9]; g.rHand = [0, 0, 0.9]; g.grip = 0.1;
  } else if (p.petAmt > 0.3 || p.pickT > 0) {
    // crouching to pet an animal or pick something up, reaching out with the right hand
    const k = ch.thigh * 0.55;
    g.hipsY = -k; g.lLeg = [1.3, 0, 0.12]; g.rLeg = [1.0, 0, -0.12]; g.lKnee = [-2.1, 0, 0]; g.rKnee = [-1.8, 0, 0]; g.lFoot = [0.75, 0, 0]; g.rFoot = [0.75, 0, 0];
    g.spine = [-0.35, 0, 0]; g.rArm = [1.1 + 0.15 * s(t * 5), 0, -1.0]; g.rFore = [0, 0.3, 0]; g.rHand = [0.2 * s(t * 5), 0, 0]; g.grip = 0.1;
    g.lArm = [0.5, 0, 1.2]; g.lFore = [0, -0.9, 0];
  } else if (c.act === 'fish') {
    // holding the rod out in front with both hands
    g.lArm = [1.0, 0, 0.6]; g.rArm = [1.0, 0, -0.6]; g.lFore = [0, -0.9, 0]; g.rFore = [0, 0.9, 0]; g.grip = 1;
    g.spine = [-0.05, 0, 0];
  } else if (c.emote === 'cheer' || c.emote === 'dance') {
    const b = Math.abs(s(t * 7));
    g.lArm = [0, 0, -1.1 + 0.2 * b]; g.rArm = [0, 0, 1.1 - 0.2 * b]; g.lFore = [0, 0, 0]; g.rFore = [0, 0, 0]; g.hipsY = 0.04 * b; g.head = [0.15, 0, 0]; g.grip = 0.9;
  } else if (c.emote === 'wave') {
    g.rArm = [0.2, 0, 1.25]; g.rFore = [0, 0.2, 0.55 + 0.45 * s(t * 9)]; g.rHand = [0, 0, 0]; g.grip = 0.05;
  } else if (speed > 0.3) {
    walking = true;
    // the cycle goes by distance, a step at a time, so the feet keep pace with the ground
    // (a step as long as the legs allow, and then a quicker pace: the meadow's walk is brisk)
    const legW = ch.legLen * SCALE, step = Math.min(speed / (run ? 3.2 : 2.4), (run ? 1.5 : 1.15) * legW);
    const A = run ? 0.78 : Math.min(0.6, Math.max(0.2, Math.asin(Math.min(0.95, step / (2 * legW))) * 0.95));
    ch.phase += (speed * dt) / step * Math.PI;
    const ph = ch.phase, L = leg(ph, run, A), R = leg(ph + Math.PI, run, A);
    g.lLeg = [L[0], 0, 0.02]; g.lKnee = [-L[1], 0, 0]; g.lFoot = [L[2], 0, 0];
    g.rLeg = [R[0], 0, -0.02]; g.rKnee = [-R[1], 0, 0]; g.rFoot = [R[2], 0, 0];
    // the hips rise over the standing leg and dip as the weight passes from foot to foot, sway over
    // the standing leg, turn with the leg going forward, and drop a little on the swinging side;
    // the shoulders turn the other way, and the head keeps looking ahead
    const yaw = (run ? 0.16 : 0.12) * s(ph);
    const dip = ch.legLen * (1 - Math.cos(A)) * (run ? 0.7 : 0.9);
    g.hipsY = -dip * (1 - Math.cos(2 * ph)) / 2 - (run ? 0.06 : 0.01);
    g.hipsX = (run ? 0.012 : 0.022) * Math.cos(ph);
    g.hips = [run ? -0.12 : -0.02, -yaw, 0.045 * Math.cos(ph)];
    g.spine = [run ? -0.1 : 0.0, 0.55 * yaw, -0.03 * Math.cos(ph)];
    g.chest = [0, 0.75 * yaw, 0];
    g.neck = [run ? 0.12 : 0.03, -0.6 * yaw, 0]; g.head = [0.02, -0.5 * yaw, 0.02 * Math.cos(ph)];
    // the arms swing with the other leg, a moment behind it, from the shoulder, the elbow bending
    // more as the arm comes forward; when running they pump, bent at the elbow, hands loosely closed
    const a = ph - 0.3, C = run ? 0.85 : 0.34, fwdL = Math.max(0, -s(a)), fwdR = Math.max(0, s(a));
    g.lArm = [-C * s(a) + (run ? 0.15 : 0.02), 0.06 * s(a), run ? 1.25 : 1.4];
    g.rArm = [C * s(a) + (run ? 0.15 : 0.02), 0.06 * s(a), run ? -1.25 : -1.4];
    g.lFore = [0, -((run ? 1.45 : 0.22) + (run ? 0.25 : 0.42) * fwdL), 0];
    g.rFore = [0, (run ? 1.45 : 0.22) + (run ? 0.25 : 0.42) * fwdR, 0];
    g.lHand = [0, 0.08 * s(a), 0.06]; g.rHand = [0, 0.08 * s(a), -0.06];
    g.grip = run ? 0.6 : 0.18;
    if (p.skating) {
      // gliding: a long push to one side, arms out for balance
      g.lArm = [0.25, 0, 0.75 + 0.15 * s(ph)]; g.rArm = [0.25, 0, -0.75 + 0.15 * s(ph)]; g.spine = [-0.3, 0.2 * s(ph), 0]; g.hips = [-0.15, 0, 0];
      g.lLeg = [0.25 + 0.3 * Math.max(0, s(ph)), 0, 0.15 * Math.max(0, -s(ph))]; g.rLeg = [0.25 + 0.3 * Math.max(0, -s(ph)), 0, -0.15 * Math.max(0, s(ph))];
      g.lKnee = [-0.5, 0, 0]; g.rKnee = [-0.5, 0, 0]; g.lFoot = [0.25, 0, 0]; g.rFoot = [0.25, 0, 0]; g.hipsY = -0.06;
    }
  } else {
    // standing: breathing, the weight shifting slowly from foot to foot, now and then a look about
    const shift = s(t * 0.45);
    g.hipsX = 0.012 * shift; g.hips = [0, 0, 0.02 * shift]; g.spine = [0, 0, -0.02 * shift];
    g.lKnee = [-0.04 - 0.05 * Math.max(0, shift), 0, 0]; g.rKnee = [-0.04 - 0.05 * Math.max(0, -shift), 0, 0];
    g.chest = [0.025 * s(t * 1.6), 0, 0];
    g.head = [0.03, 0.25 * s(t * 0.23) * Math.max(0, s(t * 0.11)), 0];
    g.lArm = [0.03, 0, 1.42 + 0.02 * s(t * 1.6)]; g.rArm = [0.03, 0, -1.42 - 0.02 * s(t * 1.6)];
  }
  // ease toward the pose (quickly while walking, so the stride keeps its shape)
  const k = Math.min(1, dt * (walking ? 22 : 9));
  for (const name of POSED) {
    const b = ch.bones[name]; if (!b) continue;
    const r0 = ch.rest[name], v = g[name];
    b.rotation.set(b.rotation.x + (r0.x + v[0] - b.rotation.x) * k, b.rotation.y + (r0.y + v[1] - b.rotation.y) * k, b.rotation.z + (r0.z + v[2] - b.rotation.z) * k);
  }
  const hp = ch.bones.hips.position;
  hp.x += (ch.hips0.x + g.hipsX - hp.x) * k;
  hp.y += (ch.hips0.y + g.hipsY - hp.y) * k;
  hp.z += (ch.hips0.z + g.hipsZ - hp.z) * k;
  // the hands: fingers curled by the grip (relaxed, a loose fist, or closed on the rod), the thumb in toward them
  ch.w.grip = (ch.w.grip === undefined ? g.grip : ch.w.grip) + (g.grip - (ch.w.grip === undefined ? g.grip : ch.w.grip)) * k;
  const gr = 0.1 + 1.35 * ch.w.grip; // (relaxed: about 0.3 rad a joint; a fist: about 1.4)
  for (const [side, sg] of [['L', 1], ['R', -1]]) {
    for (const f in CURL) for (let i = 0; i < 3; i++) { const b = ch.fingers[side + f + i]; if (b) b.rotation.z = sg * CURL[f][i] * gr; }
    const t1 = ch.fingers[side + 'Thumb0'], t2 = ch.fingers[side + 'Thumb1'];
    if (t1) { t1.rotation.x = -0.25 * gr; t1.rotation.y = sg * -0.3 * gr; }
    if (t2) t2.rotation.x = -0.25 * gr;
  }
  // lying: the whole figure laid down on its back, feet where it stood
  ch.w.lie = damp(ch.w.lie || 0, g.lie, 5, dt);
  ch.inner.rotation.x = -ch.w.lie * Math.PI / 2;
  ch.inner.position.y = ch.w.lie * 0.12 / SCALE;
  // blinking
  ch.nextBlink -= dt;
  if (ch.nextBlink <= 0) { ch.blinkT = 0.16; ch.nextBlink = 2 + Math.random() * 4; }
  const shut = ch.blinkT > 0 ? Math.sin((1 - ch.blinkT / 0.16) * Math.PI) : 0;
  ch.blinkT = Math.max(0, ch.blinkT - dt);
  for (const [o, i] of ch.blink) o.morphTargetInfluences[i] = shut;
}
