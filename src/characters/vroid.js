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
  const t = new THREE.MeshToonMaterial({ map: m.map || null, color: m.map ? 0xffffff : m.color, gradientMap: gradient, side: m.side, alphaTest: alpha ? 0.45 : 0, transparent: false });
  t.skinning = !!m.skinning; t.morphTargets = !!m.morphTargets; t.morphNormals = !!m.morphNormals; // (three r128: a skinned or morphed mesh's material must say so)
  if (m.emissiveMap) { t.emissiveMap = m.emissiveMap; t.emissive = new THREE.Color(0xffffff); }
  if (t.map) t.map.encoding = THREE.sRGBEncoding;
  t.name = m.name;
  return t;
}

const BONES = { hips: 'J_Bip_C_Hips', spine: 'J_Bip_C_Spine', chest: 'J_Bip_C_Chest', neck: 'J_Bip_C_Neck', head: 'J_Bip_C_Head',
  lArm: 'J_Bip_L_UpperArm', lFore: 'J_Bip_L_LowerArm', rArm: 'J_Bip_R_UpperArm', rFore: 'J_Bip_R_LowerArm',
  lLeg: 'J_Bip_L_UpperLeg', lKnee: 'J_Bip_L_LowerLeg', rLeg: 'J_Bip_R_UpperLeg', rKnee: 'J_Bip_R_LowerLeg', lFoot: 'J_Bip_L_Foot', rFoot: 'J_Bip_R_Foot' };

/** Load a character by id: { id, root, set, ... }, or null if it cannot be loaded. */
export async function loadCharacter(id) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/characters/vroid/${id}.vrm`).catch((e) => { console.error('character', id, e); return null; });
  if (!gltf) return null;
  const model = gltf.scene;
  const bones = {}, blink = [], toons = new Map();
  const toonOf = (m) => { if (!toons.has(m)) toons.set(m, toon(m)); return toons.get(m); };
  model.traverse((o) => {
    for (const k in BONES) if (o.name === BONES[k]) bones[k] = o;
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
  const hips0 = bones.hips.position.clone();
  const rest = {}; for (const k in bones) rest[k] = bones[k].rotation.clone();
  return { id, root, inner, model, bones, rest, hips0, hipY, thigh, blink, phase: 0, t: 0, nextBlink: 2, blinkT: 0, w: {} };
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

// the pose: target angles per bone (x, y, z, in the model's own frame, facing -z) and a hip drop,
// eased toward each frame
const T = () => ({ hipsY: 0, hipsZ: 0, spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], lArm: [0, 0, 1.2], rArm: [0, 0, -1.2], lFore: [0, -0.25, 0], rFore: [0, 0.25, 0], lLeg: [0, 0, 0], rLeg: [0, 0, 0], lKnee: [0, 0, 0], rKnee: [0, 0, 0], lFoot: [0, 0, 0], rFoot: [0, 0, 0], lie: 0 });

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
  if (p.lieAmt > 0.5) {
    // lying on the back, looking up
    g.lie = 1; g.lArm = [0, 0, 1.35]; g.rArm = [0, 0, -1.35];
  } else if (sitting) {
    // on a seat: thighs level at the seat's height, shins down
    const top = (p.seat && p.seat.top) || 0.46;
    g.hipsY = -(ch.hipY - top / SCALE - 0.04);
    g.lLeg = [1.5, 0, 0.05]; g.rLeg = [1.5, 0, -0.05]; g.lKnee = [-1.5, 0, 0]; g.rKnee = [-1.5, 0, 0];
    g.lArm = [0.45, 0, 1.25]; g.rArm = [0.45, 0, -1.25]; g.lFore = [0, -0.7, 0]; g.rFore = [0, 0.7, 0];
    g.spine = [0.05 * s(t * 1.4), 0, 0];
  } else if (ground) {
    // on the grass, legs out in front, leaning back on the hands
    g.hipsY = -(ch.hipY - 0.1 / SCALE); g.hipsZ = 0.25;
    g.lLeg = [1.45, 0, 0.12]; g.rLeg = [1.45, 0, -0.12]; g.lKnee = [-0.25, 0, 0]; g.rKnee = [-0.25, 0, 0];
    g.spine = [0.2, 0, 0]; g.lArm = [-0.5, 0, 1.05]; g.rArm = [-0.5, 0, -1.05];
  } else if (p.petAmt > 0.3 || p.pickT > 0) {
    // crouching to pet an animal or pick something up
    const k = ch.thigh * 0.55;
    g.hipsY = -k; g.lLeg = [1.3, 0, 0.1]; g.rLeg = [1.0, 0, -0.1]; g.lKnee = [-2.1, 0, 0]; g.rKnee = [-1.8, 0, 0];
    g.spine = [-0.35, 0, 0]; g.rArm = [1.1 + 0.15 * s(t * 5), 0, -1.0]; g.rFore = [0, 0.4, 0];
  } else if (c.act === 'fish') {
    // holding the rod out in front with both hands
    g.lArm = [1.0, 0, 0.6]; g.rArm = [1.0, 0, -0.6]; g.lFore = [0, -0.9, 0]; g.rFore = [0, 0.9, 0];
    g.spine = [-0.05, 0, 0];
  } else if (c.emote === 'cheer' || c.emote === 'dance') {
    const b = Math.abs(s(t * 7));
    g.lArm = [0, 0, -1.1 + 0.2 * b]; g.rArm = [0, 0, 1.1 - 0.2 * b]; g.hipsY = 0.04 * b; g.head = [0.15, 0, 0];
  } else if (c.emote === 'wave') {
    g.rArm = [0, 0, 1.2]; g.rFore = [0, 0, 0.5 * s(t * 9)];
  } else if (speed > 0.3) {
    // walking or running: stride by distance, so the feet keep pace with the ground
    const stride = run ? 1.5 : 0.95;
    ch.phase += (speed * dt) / stride * Math.PI;
    const ph = ch.phase, A = run ? 0.75 : 0.45, sw = s(ph);
    g.lLeg = [A * sw, 0, 0]; g.rLeg = [-A * sw, 0, 0];
    g.lKnee = [-(run ? 1.3 : 0.7) * Math.max(0, -s(ph - 0.6)), 0, 0]; g.rKnee = [-(run ? 1.3 : 0.7) * Math.max(0, s(ph - 0.6)), 0, 0];
    g.lArm = [-(run ? 0.8 : 0.4) * sw, 0, 1.25]; g.rArm = [(run ? 0.8 : 0.4) * sw, 0, -1.25];
    if (run) { g.lFore = [0, -1.2, 0]; g.rFore = [0, 1.2, 0]; }
    g.hipsY = (run ? 0.05 : 0.025) * Math.abs(s(ph)) - (run ? 0.04 : 0);
    g.spine = [run ? -0.18 : -0.04, 0.12 * sw, 0];
    if (p.skating) { g.lArm = [0.2, 0, 0.7]; g.rArm = [0.2, 0, -0.7]; g.spine = [-0.25, 0, 0]; }
  } else {
    // standing: breathing, and now and then a look about
    g.chest = [0.025 * s(t * 1.6), 0, 0];
    g.head = [0, 0.25 * s(t * 0.23) * Math.max(0, s(t * 0.11)), 0];
    g.lArm = [0, 0, 1.22 + 0.02 * s(t * 1.6)]; g.rArm = [0, 0, -1.22 - 0.02 * s(t * 1.6)];
  }
  // ease the pose toward its targets
  const k = Math.min(1, dt * 10);
  for (const name of ['spine', 'chest', 'neck', 'head', 'lArm', 'rArm', 'lFore', 'rFore', 'lLeg', 'rLeg', 'lKnee', 'rKnee', 'lFoot', 'rFoot']) {
    const b = ch.bones[name]; if (!b) continue;
    const r0 = ch.rest[name], v = g[name];
    b.rotation.set(b.rotation.x + (r0.x + v[0] - b.rotation.x) * k, b.rotation.y + (r0.y + v[1] - b.rotation.y) * k, b.rotation.z + (r0.z + v[2] - b.rotation.z) * k);
  }
  const hp = ch.bones.hips.position;
  hp.y += (ch.hips0.y + g.hipsY - hp.y) * k;
  hp.z += (ch.hips0.z + g.hipsZ - hp.z) * k;
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
