// What stands beside the trails: in a blossom grove, stone lanterns, a pair every sixteen metres or
// so, one each side by turns, lit at dusk (after the owner's picture of a cherry blossom valley: a
// worn path with lanterns along it). They are where the trail and the grove are, so the seed fixes
// them; nothing of the land changes for them, and nothing is kept in the save.
//
// Drawn as two instanced meshes (the stone, and the light in its window), filled for the trails near
// the camera and refilled when you have moved a way. You can walk through them: they block nothing.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { trailsNear, trailPoint, groveAt, heightAt, walkable, lakeAt, riverNear, siteAt } from '../core/shape.js';
import { std, mergeGeos } from '../core/materials.js';
import { hash } from '../core/math.js';

const REACH = 260, MAX = 96, GAP = 16, OFF = 2.5;
let stone = null, light = null, lastX = NaN, lastZ = NaN, count = 0;
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();

/** A stone lantern, as the shrine's are: a foot, a post, a table, a lit window under a broad cap, a knob. */
function build() {
  const cyl = (r0, r1, h, y) => new THREE.CylinderGeometry(r1, r0, h, 6).translate(0, y, 0);
  const parts = [cyl(0.34, 0.28, 0.18, 0.09), cyl(0.14, 0.11, 0.8, 0.58), cyl(0.17, 0.29, 0.13, 1.04), new THREE.ConeGeometry(0.44, 0.28, 6).translate(0, 1.58, 0), new THREE.SphereGeometry(0.075, 6, 4).translate(0, 1.76, 0)];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(new THREE.BoxGeometry(0.055, 0.32, 0.055).translate(x * 0.16, 1.27, z * 0.16));
  const sg = mergeGeos(parts.map((g) => (g.index ? g.toNonIndexed() : g))); sg.computeVertexNormals();
  stone = new THREE.InstancedMesh(sg, std('#9a968c'), MAX);
  light = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3).translate(0, 1.27, 0), new THREE.MeshStandardMaterial({ color: '#3a3228', emissive: '#ffb45e', emissiveIntensity: 0 }), MAX);
  for (const m of [stone, light]) { m.count = 0; m.frustumCulled = false; m.userData.pooledLandmark = true; scene.add(m); }
  stone.castShadow = true; stone.receiveShadow = true;
}

/** The lanterns' places near a spot: along each trail, where it runs through a grove. */
export function lanternSpots(x, z, r = REACH) {
  const out = [];
  for (const s of trailsNear(x, z, r)) {
    const n = Math.floor(s.len / GAP);
    for (let k = 1; k < n; k++) {
      const t = (k * GAP) / s.len, p = trailPoint(s, t), side = k % 2 ? 1 : -1;
      if (Math.hypot(p.x - x, p.z - z) > r) continue;
      // beside the trail, square to the way it runs just there
      const q = trailPoint(s, Math.min(1, t + 2 / s.len)), dx = q.x - p.x, dz = q.z - p.z, dl = Math.hypot(dx, dz) || 1;
      const lx = p.x - (dz / dl) * OFF * side, lz = p.z + (dx / dl) * OFF * side;
      if (groveAt(lx, lz) < 0.5 || !walkable(lx, lz) || lakeAt(lx, lz).t(lx, lz) < 1.5 || riverNear(lx, lz) || siteAt(lx, lz, -1)) continue;
      out.push({ x: lx, z: lz, ry: Math.atan2(dx, dz), s: 0.92 + 0.2 * hash(Math.round(lx * 3), Math.round(lz * 3)) });
    }
  }
  return out;
}

/** Lanterns by the trails near (x, z) set out, the rest put away. */
export function updateTrailside(x, z, now = false) {
  if (!now && Math.hypot(x - lastX, z - lastZ) < 40) return;
  lastX = x; lastZ = z;
  const spots = lanternSpots(x, z).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, MAX);
  if (!spots.length && !stone) return;
  if (!stone) build();
  spots.forEach((p, i) => {
    M.compose(P.set(p.x, heightAt(p.x, p.z) - 0.06, p.z), Q.setFromEuler(E.set(0, p.ry, 0)), S.set(p.s, p.s, p.s));
    stone.setMatrixAt(i, M); light.setMatrixAt(i, M);
  });
  count = spots.length;
  for (const m of [stone, light]) { m.count = count; m.instanceMatrix.needsUpdate = true; }
}
/** The lanterns' windows: lit as the evening comes on (`eve` 0..1). */
export function lightTrailside(eve) { if (light) light.material.emissiveIntensity = eve * 2.2; }
/** For tests: how many lanterns stand just now. */
export const trailsideShown = () => count;
