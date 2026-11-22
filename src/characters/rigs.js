// Rigs: people (low-poly), dogs and cats (sculpted, after the owner's sheets). Pivots are groups so limbs can rotate. Fixed detail
// (paws, trim, stripes, hair) is merged into one mesh per material per pivot, so it costs few
// draw calls, and tiny pieces don't cast shadows.
import * as THREE from 'three';
import { TAU } from '../core/math.js';
import { std, mergeGeos } from '../core/materials.js';
import { sculpt, sphere, ellipsoid, capsule, rbox, strand, ring, blend, both, mirror, turned, frontOf } from '../core/sculpt.js';

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

// ───────────── pets, after the owner's character sheets ─────────────
// Sculpted as the children are (core/sculpt.js), in their chibi style: a big round head, a small plump
// body, short legs with white paws, soft fur. The dog after the sheet's puppy: floppy ears and a patch over
// one eye in a second colour, a pink tongue out, a red bandana with a paw print. The cat after the
// sheet's: round cheeks, pointed ears with pink insides, patches, a dark collar with a gold bell.

/** Fur: vertex colours, matt, with the children's soft warm rim. */
function furMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    const at = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );';
    if (!sh.fragmentShader.includes(at)) throw new Error('shader: no "' + at + '"');
    sh.fragmentShader = sh.fragmentShader.replace(at, `
      float kRim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
      outgoingLight += diffuseColor.rgb * (kRim * 0.22 + 0.05) * vec3(1.0, 0.94, 0.88);
      ` + at);
  };
  m.customProgramCacheKey = () => 'petfur';
  return m;
}
/** One sculpted piece on a pivot. */
function carved(parent, layers, bx6, n, k = 0.02) {
  const m = new THREE.Mesh(sculpt(layers, bx6, n, k, { ao: 0.3 }), furMat());
  parent.add(m);
  return m;
}
/** A glossy dark eye lying on the face at (x, y) of the head's field `f`, with a highlight; scaling it in y squints it. */
function petEye(head, f, x, y, iris) {
  const z = frontOf(f, x, y) || 0.1, e = new THREE.Group();
  e.position.set(x, y, z + 0.002); e.rotation.y = Math.sign(x) * 0.35; head.add(e);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.userData.small = true; e.add(m); return m; };
  add(new THREE.IcosahedronGeometry(1, 2).scale(0.026, 0.032, 0.008), std(iris || '#2a1a12', { roughness: 0.35 }));
  if (iris) add(new THREE.IcosahedronGeometry(1, 2).scale(0.011, 0.024, 0.006).translate(0, 0, 0.004), std('#1a120e', { roughness: 0.3 })); // a cat's pupil
  add(new THREE.IcosahedronGeometry(1, 1).scale(0.009, 0.01, 0.004).translate(-0.008, 0.012, 0.007), std('#ffffff', { emissive: '#888888' }));
  add(new THREE.IcosahedronGeometry(1, 1).scale(0.004, 0.004, 0.003).translate(0.009, -0.012, 0.007), std('#ffffff', { emissive: '#888888' }));
  return e;
}
const patchy = (base, patch, test) => (x, y, z) => (patch && test(x, y, z) ? patch : base);

export function makeDog(c) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // heading first, then the slope tilt
  const rig = new THREE.Group(); root.add(rig);
  const coat = c.coat, patch = c.patch, white = c.paw || '#fbf7f0', band = c.bandana || '#d9483b';
  // the body: plump, a fluffy chest; a patch over the back
  carved(rig, [
    { f: blend(0.06, ellipsoid(0, 0.3, -0.01, 0.15, 0.14, 0.22), ellipsoid(0, 0.33, 0.13, 0.13, 0.13, 0.11)), color: patchy(coat, patch, (x, y, z) => y > 0.36 && z < 0.06 && z > -0.16 && x > -0.06) },
    { f: ellipsoid(0, 0.29, 0.2, 0.09, 0.09, 0.05), color: white },                                                 // the chest's fluff
    // the bandana: a band round the neck and a point hanging at the front, a white paw print on it
    { f: blend(0.02, turned(ring(0, 0.42, 0.13, 0.115, 0.022), -0.5, 0, 0, 0, 0.42, 0.13), both(turned(turned(rbox(0, 0.35, 0.232, 0.065, 0.065, 0.012, 0.008), 0, 0, Math.PI / 4, 0, 0.35, 0.232), -0.3, 0, 0, 0, 0.35, 0.232), (x, y) => y - 0.38)),
      color: (x, y, z) => { const d = Math.hypot(x, (y - 0.322) * 1.1); return z > 0.2 && (d < 0.016 || [-0.019, 0, 0.019].some((px) => Math.hypot(x - px, y - 0.346 + (px ? 0.004 : 0)) < 0.0075)) ? '#ffffff' : band; } },
  ], [-0.2, 0.12, -0.27, 0.2, 0.5, 0.28], 40, 0.015);
  const head = pivot(rig, 0, 0.44, 0.2);
  const skull = blend(0.05, ellipsoid(0, 0.1, 0, 0.17, 0.15, 0.15), mirror(ellipsoid(0.09, 0.03, 0.05, 0.09, 0.08, 0.08)), ellipsoid(0, 0.025, 0.12, 0.075, 0.06, 0.07));
  carved(head, [
    { f: skull, color: (x, y, z) => (patch && x > 0.02 && y > 0.06 && z > 0.02 && Math.hypot(x - 0.075, y - 0.105) < 0.065 ? patch : z > 0.08 && y < 0.06 && Math.abs(x) < 0.08 ? white : coat) }, // a patch over one eye; the muzzle white
    { f: ellipsoid(0, 0.06, 0.188, 0.03, 0.021, 0.018), color: '#2a201c' },                                        // the nose
    { f: turned(ellipsoid(0, -0.03, 0.155, 0.028, 0.012, 0.034), 0.5, 0, 0, 0, -0.03, 0.155), color: '#ef8f98' },  // the tongue, out
    { f: mirror(turned(ellipsoid(0.165, 0.07, -0.01, 0.035, 0.09, 0.065), 0, 0, 0.38, 0.165, 0.07, -0.01)), color: patch || c.ear || coat }, // floppy ears
  ], [-0.25, -0.08, -0.18, 0.25, 0.28, 0.22], 48, 0.012);
  const eyes = [-1, 1].map((sd) => petEye(head, skull, sd * 0.068, 0.1));
  const legs = [[-0.08, 0.12], [0.08, 0.12], [-0.08, -0.14], [0.08, -0.14]].map(([x, z]) => {
    const p = pivot(rig, x, 0.25, z);
    carved(p, [
      { f: capsule([0, 0, 0], [0, -0.19, 0.01], 0.056, 0.05), color: patchy(coat, patch, () => false) },
      { f: ellipsoid(0, -0.215, 0.025, 0.058, 0.035, 0.068), color: white },
    ], [-0.08, -0.26, -0.08, 0.08, 0.06, 0.12], 22, 0.02);
    return p;
  });
  const tail = pivot(rig, 0, 0.36, -0.2);
  carved(tail, [{ f: strand([0, 0, 0], [0, 0.1, -0.08], [0, 0.18, -0.03], 0.035, 0.05), color: (x, y) => (y > 0.14 ? white : coat) }], [-0.07, -0.05, -0.15, 0.07, 0.25, 0.05], 22, 0.02);
  shadows(root);
  return { root, rig, head, legs, tail, eyes, sitDrop: 0.06, scale: c.scale || 1, length: 0.55, radius: 0.3 };
}

export function makeCat(c) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const rig = new THREE.Group(); root.add(rig);
  const fur = c.fur, patch = c.patch, white = c.belly || '#fbf6ee';
  carved(rig, [
    { f: ellipsoid(0, 0.17, -0.01, 0.12, 0.11, 0.17), color: (x, y, z) => (y < 0.11 || (z > 0.08 && y < 0.24) ? white : patch && x < 0.02 && z < 0.06 && z > -0.12 ? patch : fur) },
    // the collar, dark, with a gold bell
    { f: turned(ring(0, 0.26, 0.1, 0.078, 0.014), -0.6, 0, 0, 0, 0.26, 0.1), color: c.collar || '#5a3a2a' },
    { f: sphere(0, 0.215, 0.165, 0.022), color: '#e3b341' },
  ], [-0.15, 0.04, -0.2, 0.15, 0.31, 0.2], 36, 0.012);
  const head = pivot(rig, 0, 0.28, 0.12);
  const skull = blend(0.04, ellipsoid(0, 0.08, 0, 0.13, 0.115, 0.115), mirror(ellipsoid(0.075, 0.03, 0.04, 0.07, 0.06, 0.07)));
  carved(head, [
    { f: skull, color: (x, y, z) => (z > 0.06 && y < 0.06 && Math.abs(x) < 0.07 ? white : patch && x < -0.01 && y > 0.08 ? patch : fur) }, // the muzzle white; a patch over one side
    { f: ellipsoid(0, 0.06, 0.122, 0.016, 0.011, 0.01), color: '#e88a99' },                                        // the nose
    { f: mirror(capsule([0.075, 0.15, -0.01], [0.105, 0.245, -0.02], 0.045, 0.008)), color: (x) => (patch && x < 0 ? patch : fur) }, // pointed ears
    { f: mirror(capsule([0.075, 0.16, 0.014], [0.1, 0.225, 0.004], 0.026, 0.004)), color: '#f2a7b1' },                // their pink insides
  ], [-0.2, -0.05, -0.15, 0.2, 0.28, 0.16], 48, 0.008);
  const eyes = [-1, 1].map((sd) => petEye(head, skull, sd * 0.055, 0.075, c.eye || '#7a9a3a'));
  const legs = [[-0.06, 0.08], [0.06, 0.08], [-0.06, -0.1], [0.06, -0.1]].map(([x, z]) => { // (short and stubby, as the sheet's)
    const p = pivot(rig, x, 0.11, z);
    carved(p, [
      { f: capsule([0, 0, 0], [0, -0.08, 0.005], 0.045, 0.042), color: fur },
      { f: ellipsoid(0, -0.095, 0.015, 0.045, 0.024, 0.052), color: white },
    ], [-0.07, -0.13, -0.07, 0.07, 0.06, 0.09], 20, 0.015);
    return p;
  });
  const tail = pivot(rig, 0, 0.2, -0.16);
  carved(tail, [{ f: strand([0, 0, 0], [0, 0.15, -0.12], [0, 0.27, -0.05], 0.03, 0.036), color: (x, y) => (patch && Math.sin(y * 70) > 0.3 ? patch : fur) }], [-0.06, -0.05, -0.2, 0.06, 0.33, 0.05], 26, 0.015);
  shadows(root);
  return { root, rig, head, legs, tail, eyes, sitDrop: 0.04, scale: c.scale || 1, length: 0.4, radius: 0.22 };
}
