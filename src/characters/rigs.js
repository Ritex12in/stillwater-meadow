// Low-poly rigs: people, dogs and cats. Pivots are groups so limbs can rotate. Fixed detail
// (paws, trim, stripes, hair) is merged into one mesh per material per pivot, so it costs few
// draw calls, and tiny pieces don't cast shadows.
import * as THREE from 'three';
import { TAU } from '../core/math.js';
import { std, mergeGeos } from '../core/materials.js';

export function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
export function box(parent, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; }

const turn = (g, rx, ry, rz) => (rx || ry || rz ? g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz))) : g);
/** A box geometry already turned and moved into place, for merging. */
const bx = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => turn(new THREE.BoxGeometry(w, h, d), rx, ry, rz).translate(x, y, z);
const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, detail = 0) => new THREE.IcosahedronGeometry(r, detail).scale(sx, sy, sz).translate(x, y, z);
/** Several shapes of one material as a single mesh. `small` pieces skip the shadow pass. */
function lump(parent, mat, geos, small = false) {
  const m = new THREE.Mesh(mergeGeos(geos), mat);
  m.userData.small = small;
  parent.add(m);
  return m;
}
const tone = (hex, k) => std(new THREE.Color(hex).multiplyScalar(k));
function shadows(root) { root.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.small; o.receiveShadow = true; } }); }

export function makePerson(c = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const C = { skin: c.skin || '#e7b894', knit: c.knit || '#e2b04a', pants: c.pants || '#3c4a5e', shoe: c.shoe || '#2c2a28', hair: c.hair || '#4a3426', scarf: c.scarf || '#3f7f7a' };
  const skin = std(C.skin), knit = std(C.knit), trim = tone(C.knit, 0.8), pants = std(C.pants), shoe = std(C.shoe), sole = std('#d8d2c4'), hair = std(C.hair), scarf = std(C.scarf);
  const legs = [], knees = [];
  [-0.13, 0.13].forEach((x) => {
    const hip = pivot(body, x, 0.86, 0);
    lump(hip, pants, [bx(0.17, 0.42, 0.19, 0, -0.21, 0), bx(0.18, 0.1, 0.2, 0, -0.04, 0)]);
    const knee = pivot(hip, 0, -0.42, 0);
    lump(knee, pants, [bx(0.16, 0.34, 0.18, 0, -0.17, 0), bx(0.175, 0.05, 0.195, 0, -0.325, 0)]); // shin and turned-up cuff
    lump(knee, shoe, [bx(0.18, 0.085, 0.24, 0, -0.385, 0.03), bx(0.17, 0.06, 0.1, 0, -0.395, 0.17), bx(0.12, 0.03, 0.1, 0, -0.335, 0.06)]); // heel, toe, tongue
    lump(knee, sole, [bx(0.19, 0.03, 0.31, 0, -0.435, 0.06)], true);
    legs.push(hip); knees.push(knee);
  });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.72, 8), knit);
  torso.position.y = 1.2; body.add(torso);
  lump(body, knit, [ball(0.115, -0.3, 1.5, 0), ball(0.115, 0.3, 1.5, 0)]);                                             // shoulders
  lump(body, trim, [new THREE.CylinderGeometry(0.31, 0.315, 0.09, 8).translate(0, 0.875, 0), new THREE.CylinderGeometry(0.19, 0.235, 0.06, 8).translate(0, 1.565, 0)]); // hem and collar
  lump(body, skin, [new THREE.CylinderGeometry(0.085, 0.095, 0.14, 6).translate(0, 1.63, 0)], true);                   // neck
  const arms = [-0.34, 0.34].map((x) => {
    const p = pivot(body, x, 1.5, 0);
    lump(p, knit, [bx(0.13, 0.56, 0.15, 0, -0.28, 0)]);
    lump(p, trim, [bx(0.145, 0.07, 0.165, 0, -0.585, 0)], true);                                                       // cuff
    lump(p, skin, [bx(0.1, 0.11, 0.07, 0, -0.67, 0), bx(0.035, 0.06, 0.04, -Math.sign(x) * 0.055, -0.66, 0.03)], true); // palm and thumb
    return p;
  });
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 6, 12), scarf);
  sc.rotation.x = Math.PI / 2; sc.position.y = 1.57; body.add(sc);
  lump(body, scarf, [bx(0.1, 0.09, 0.09, 0.12, 1.55, 0.19), bx(0.09, 0.26, 0.035, 0.13, 1.4, 0.235, 0.08, 0, -0.06), bx(0.09, 0.05, 0.035, 0.137, 1.25, 0.245, 0.08, 0, -0.06)]); // knot and hanging end

  const head = pivot(body, 0, 1.8, 0);
  head.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), skin));
  lump(head, skin, [bx(0.035, 0.075, 0.05, -0.208, -0.02, 0), bx(0.035, 0.075, 0.05, 0.208, -0.02, 0)], true);         // ears
  lump(head, tone(C.skin, 0.9), [bx(0.036, 0.05, 0.045, 0, -0.04, 0.208)], true);                                      // nose
  lump(head, std('#8f4d42'), [bx(0.07, 0.013, 0.02, 0, -0.105, 0.181)], true);                                         // mouth
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.225, 10, 8, 0, TAU, 0, Math.PI * 0.55), hair);
  h.position.set(0, 0.02, -0.02); h.rotation.x = -0.2; head.add(h);
  lump(head, hair, [
    bx(0.3, 0.07, 0.09, 0.02, 0.135, 0.15, 0.35, 0, 0.05),          // fringe
    bx(0.1, 0.06, 0.06, -0.1, 0.105, 0.175, 0.3, 0, 0.25),          // loose lock
    ball(0.17, 0, -0.01, -0.1, 1.1, 0.95, 0.8),                     // back of the head
    bx(0.03, 0.11, 0.09, -0.205, 0.05, 0.0), bx(0.03, 0.11, 0.09, 0.205, 0.05, 0.0), // sides
    bx(0.07, 0.016, 0.02, -0.075, 0.066, 0.197, 0, 0, 0.1), bx(0.07, 0.016, 0.02, 0.075, 0.066, 0.197, 0, 0, -0.1), // eyebrows
  ]);
  const white = std('#f4efe6'), eyeMat = std('#2a2220');
  const eyes = [-0.075, 0.075].map((x) => {
    const e = pivot(head, x, 0.0, 0.192);
    lump(e, white, [bx(0.058, 0.052, 0.02, 0, 0, 0)], true);
    lump(e, eyeMat, [bx(0.032, 0.042, 0.02, 0, -0.002, 0.008)], true);
    return e;
  });
  shadows(root);
  return { root, body, legs, knees, arms, head, eyes };
}

export function makeDog(c) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // heading first, then the slope tilt
  const rig = new THREE.Group(); root.add(rig);
  const coat = std(c.coat), accent = std(c.accent), ear = std(c.ear), dark = std('#1d1b1a');
  lump(rig, coat, [
    bx(0.4, 0.36, 0.9, 0, 0.62, 0),
    bx(0.44, 0.34, 0.3, 0, 0.63, 0.27),                          // shoulders
    bx(0.43, 0.33, 0.3, 0, 0.61, -0.28),                         // haunches
    bx(0.27, 0.34, 0.26, 0, 0.8, 0.4, -0.55),                    // neck
    bx(0.3, 0.05, 0.6, 0, 0.815, -0.05),                         // back ridge
  ]);
  lump(rig, accent, [bx(0.3, 0.26, 0.2, 0, 0.56, 0.38), bx(0.26, 0.2, 0.08, 0, 0.6, 0.47), bx(0.3, 0.05, 0.62, 0, 0.428, 0)]); // bib, chest, belly
  lump(rig, std(c.collar || '#c4473a'), [turn(new THREE.CylinderGeometry(0.2, 0.2, 0.055, 8), -0.55).translate(0, 0.83, 0.42)], true);
  lump(rig, std('#e3b341', { metalness: 0.4, roughness: 0.5 }), [ball(0.04, 0, 0.7, 0.55, 1, 1, 0.5)], true); // tag
  const head = pivot(rig, 0, 0.9, 0.5);
  lump(head, coat, [bx(0.34, 0.32, 0.36, 0, 0, 0), bx(0.3, 0.05, 0.1, 0, 0.13, 0.17, 0.25), bx(0.37, 0.16, 0.2, 0, -0.07, 0.02)]); // skull, brow, cheeks
  lump(head, accent, [bx(0.2, 0.16, 0.22, 0, -0.06, 0.26), bx(0.16, 0.05, 0.16, 0, -0.165, 0.22)]);               // muzzle and jaw
  lump(head, dark, [bx(0.08, 0.06, 0.04, 0, -0.01, 0.38), bx(0.14, 0.012, 0.012, 0, -0.142, 0.345)], true);        // nose and mouth line
  lump(head, std('#e58a94'), [bx(0.06, 0.02, 0.07, 0, -0.15, 0.33)], true);                                        // tongue tip
  const shine = std('#ffffff', { emissive: '#666666' });
  const eyes = [-0.09, 0.09].map((x) => {
    const e = box(head, 0.045, 0.05, 0.02, dark, x, 0.06, 0.18);
    const s = box(e, 0.016, 0.016, 0.012, shine, 0.008, 0.012, 0.008);
    e.userData.small = s.userData.small = true;
    return e;
  });
  [-1, 1].forEach((s) => { const e = lump(head, ear, [bx(0.08, 0.22, 0.15, 0, -0.06, 0), bx(0.07, 0.07, 0.12, 0, -0.19, 0.01)]); e.position.set(s * 0.18, 0.08, -0.03); e.rotation.z = s * 0.28; });
  const legs = [[-0.13, 0.3], [0.13, 0.3], [-0.13, -0.3], [0.13, -0.3]].map(([x, z]) => {
    const p = pivot(rig, x, 0.46, z);
    lump(p, coat, [bx(0.12, 0.42, 0.12, 0, -0.21, 0), bx(0.145, 0.2, 0.17, 0, -0.07, z > 0 ? 0 : -0.01)]);         // leg and thigh
    lump(p, accent, [bx(0.14, 0.07, 0.175, 0, -0.425, 0.022)], true);                                             // paw
    return p;
  });
  const tail = pivot(rig, 0, 0.74, -0.44);
  lump(tail, coat, [bx(0.085, 0.085, 0.2, 0, 0, -0.1), bx(0.07, 0.07, 0.16, 0, 0.01, -0.27, 0.15)]);
  lump(tail, accent, [bx(0.06, 0.06, 0.1, 0, 0.035, -0.39, 0.3)], true);
  tail.rotation.x = -0.6;
  shadows(root);
  return { root, rig, head, legs, tail, eyes, sitDrop: 0.12, scale: c.scale || 1, length: 0.9 };
}

export function makeCat(c) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const rig = new THREE.Group(); root.add(rig);
  const lum = new THREE.Color(c.fur).getHSL({}).l;
  const fur = std(c.fur), belly = std(c.belly), nose = std('#e79aa6'), eye = std(c.eye || '#a6c43b'), dark = std('#151312');
  const stripe = tone(c.fur, lum < 0.25 ? 1.6 : 0.72); // markings: darker, or lighter on a black cat
  lump(rig, fur, [
    bx(0.26, 0.25, 0.6, 0, 0.37, 0),
    bx(0.28, 0.25, 0.22, 0, 0.375, -0.2),                        // haunches
    bx(0.24, 0.22, 0.18, 0, 0.44, 0.27, -0.5),                   // neck and shoulders
  ]);
  lump(rig, belly, [bx(0.2, 0.06, 0.4, 0, 0.25, 0.02), bx(0.17, 0.16, 0.06, 0, 0.36, 0.305)]);                     // belly and chest
  lump(rig, stripe, [-0.2, -0.07, 0.06, 0.18].map((z) => bx(0.266, 0.14, 0.04, 0, 0.428, z)), true);              // stripes over the back
  const head = pivot(rig, 0, 0.55, 0.35);
  lump(head, fur, [bx(0.26, 0.21, 0.23, 0, 0, 0), bx(0.07, 0.09, 0.08, -0.14, -0.055, 0.04, 0, 0, 0.3), bx(0.07, 0.09, 0.08, 0.14, -0.055, 0.04, 0, 0, -0.3)]); // head and cheek tufts
  lump(head, belly, [bx(0.12, 0.08, 0.06, 0, -0.05, 0.12), bx(0.1, 0.03, 0.05, 0, -0.1, 0.1)]);                     // muzzle and chin
  lump(head, nose, [bx(0.035, 0.025, 0.02, 0, -0.02, 0.155),
    turn(new THREE.ConeGeometry(0.032, 0.085, 3), 0, Math.PI, 0).translate(-0.085, 0.14, 0.012), turn(new THREE.ConeGeometry(0.032, 0.085, 3), 0, Math.PI, 0).translate(0.085, 0.14, 0.012)], true); // nose and inner ears
  lump(head, stripe, [bx(0.03, 0.02, 0.1, -0.05, 0.1, 0.03), bx(0.03, 0.02, 0.1, 0, 0.1, 0.04), bx(0.03, 0.02, 0.1, 0.05, 0.1, 0.03)], true); // forehead marks
  lump(head, std('#f2efe8'), [-1, 1].flatMap((s) => [bx(0.15, 0.005, 0.005, s * 0.13, -0.045, 0.13, 0, 0, s * 0.12), bx(0.15, 0.005, 0.005, s * 0.13, -0.065, 0.13, 0, 0, -s * 0.1)]), true); // whiskers
  const eyes = [-0.065, 0.065].map((x) => {
    const e = box(head, 0.05, 0.044, 0.02, eye, x, 0.03, 0.12);
    const p = box(e, 0.014, 0.038, 0.012, dark, 0, 0, 0.006);
    e.userData.small = p.userData.small = true;
    return e;
  });
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 4), fur);
    e.position.set(s * 0.085, 0.15, -0.01); e.rotation.y = Math.PI / 4; head.add(e);
  });
  const legs = [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]].map(([x, z]) => {
    const p = pivot(rig, x, 0.28, z);
    lump(p, fur, [bx(0.075, 0.25, 0.075, 0, -0.125, 0), bx(0.09, 0.12, 0.11, 0, -0.04, 0)]);
    lump(p, belly, [bx(0.085, 0.05, 0.105, 0, -0.255, 0.012)], true);                                             // white socks
    return p;
  });
  const tail = pivot(rig, 0, 0.44, -0.29);
  lump(tail, fur, [bx(0.06, 0.06, 0.3, 0, 0, -0.15), bx(0.052, 0.052, 0.2, 0, 0.045, -0.37, 0.5)]);
  lump(tail, stripe, [bx(0.064, 0.064, 0.04, 0, 0, -0.12), bx(0.064, 0.064, 0.04, 0, 0, -0.24), bx(0.056, 0.056, 0.06, 0, 0.085, -0.445, 0.5)], true);
  tail.rotation.x = -0.95;
  shadows(root);
  return { root, rig, head, legs, tail, eyes, sitDrop: 0.08, scale: 1, length: 0.6 };
}
