// Ways across water, drawn: a wooden footbridge where a trail crosses a river, and stepping stones
// out to each island (core/shape.js works out where they are and lets you walk on them).
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { riversNear, bridgesOf, deckY, lakesNear, stonesOf } from '../core/shape.js';
import { std, mergeGeos } from '../core/materials.js';

const REACH = 700;
const woodMat = std('#8b6a47'), beamMat = std('#6b4f34'), stoneMat = std('#94918a');
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SC = new THREE.Vector3();
/** A box `w` across, `h` high, `d` along, its middle at (x, y, z) in the bridge's own frame, tipped by `pitch` along it. */
const box = (w, h, d, x, y, z, pitch = 0) => new THREE.BoxGeometry(w, h, d).applyMatrix4(M.compose(V.set(x, y, z), Q.setFromEuler(E.set(pitch, 0, 0)), SC.set(1, 1, 1)));

/** A footbridge: planks across, two beams under them, posts and a rail each side; it follows the deck's arch. */
function bridgeMesh(b) {
  const deck = [], frame = [], half = b.half, W = 1.0, step = 0.34, n = Math.ceil((2 * half) / step);
  const y = (a) => deckY(b, a), slope = (a) => Math.atan2(y(a + 0.2) - y(a - 0.2), 0.4);
  for (let i = 0; i < n; i++) {
    const a = -half + (i + 0.5) * (2 * half / n);
    deck.push(box(2 * W + 0.12, 0.07, 2 * half / n - 0.03, 0, y(a) - 0.035, a, -slope(a)));
  }
  // beams under the deck and the rails, in short straight pieces following the arch
  const parts = Math.ceil(half / 0.6) * 2;
  for (let i = 0; i < parts; i++) {
    const a0 = -half + (i / parts) * 2 * half, a1 = a0 + (2 * half) / parts, am = (a0 + a1) / 2, len = Math.hypot(a1 - a0, y(a1) - y(a0)), p = -Math.atan2(y(a1) - y(a0), a1 - a0);
    for (const s of [-1, 1]) {
      frame.push(box(0.12, 0.16, len + 0.02, s * (W - 0.15), y(am) - 0.15, am, p));       // beam
      frame.push(box(0.07, 0.07, len + 0.02, s * (W + 0.02), y(am) + 0.78, am, p));       // rail
    }
  }
  for (let a = -half + 0.15; a <= half - 0.1; a += (2 * half - 0.3) / Math.max(2, Math.round(half / 0.7))) for (const s of [-1, 1]) frame.push(box(0.09, 0.85, 0.09, s * (W + 0.02), y(a) + 0.38, a)); // posts
  // and the ends of the beams sunk into each bank
  for (const s of [-1, 1]) for (const e of [-1, 1]) frame.push(box(0.14, 0.5, 0.5, s * (W - 0.15), y(e * half) - 0.35, e * (half - 0.1)));
  const g = new THREE.Group();
  for (const [geos, mat] of [[deck, woodMat], [frame, beamMat]]) {
    const geo = mergeGeos(geos); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  g.position.set(b.x, 0, b.z);
  g.rotation.y = Math.atan2(b.ux, b.uz); // (its own +z runs along the trail)
  return g;
}

/** An island's stepping stones: flat, rounded, a little apart, just above the water. */
function stonesMesh(S) {
  const geos = S.stones.map((st) => new THREE.IcosahedronGeometry(0.42, 1).applyMatrix4(M.compose(V.set(st.x, 0.08, st.z), Q.setFromEuler(E.set(0, st.ry, 0)), SC.set(st.s, 0.34, st.s * 0.85))));
  const geo = mergeGeos(geos); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, stoneMat); m.castShadow = true; m.receiveShadow = true;
  return m;
}

const shown = new Map(); // key -> object in the scene
let lastX = NaN, lastZ = NaN;
/** Bridges and stepping stones near (x, z) drawn, and those left behind taken away. */
export function updateCrossings(x, z, now = false) {
  if (!now && Math.hypot(x - lastX, z - lastZ) < 50) return;
  lastX = x; lastZ = z;
  const want = new Map();
  for (const r of riversNear(x, z, REACH)) bridgesOf(r).forEach((b, i) => want.set('b:' + r.id + ':' + i, () => bridgeMesh(b)));
  for (const L of lakesNear(x, z, REACH)) { const S = stonesOf(L); if (S) want.set('s:' + L.id, () => stonesMesh(S)); }
  for (const [k, make] of want) if (!shown.has(k)) { const o = make(); o.userData.pooledLandmark = true; scene.add(o); shown.set(k, o); } // (not counted among the scene's things: they come and go with the rivers)
  for (const [k, o] of shown) if (!want.has(k)) { scene.remove(o); o.traverse((c) => { if (c.isMesh) c.geometry.dispose(); }); shown.delete(k); }
}
/** For tests: which bridges and stepping stones are drawn just now. */
export const crossingsShown = () => [...shown.keys()];
