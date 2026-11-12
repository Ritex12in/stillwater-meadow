// Third-person camera that orbits you and pulls in instead of clipping into hills, tree
// canopies or the boat roof. Photo mode and stargazing take over through `hooks.camera`.
import * as THREE from 'three';
import { camera } from '../core/render.js';
import { damp } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { camState } from './input.js';
import { treeSpots } from '../world/vegetation.js';
import { boat } from '../characters/boat.js';

export const camTarget = new THREE.Vector3();
const want = new THREE.Vector3();
let init = false, dist = camState.dist;

// Rough solid shapes the camera should stay out of: tree crowns as vertical capsules.
function blocked(x, y, z, near) {
  if (y < Math.max(heightAt(x, z), 0.05) + 0.35) return true;
  for (const t of near) {
    const r = t.type === 'pine' ? 1.3 * t.s : 1.5 * t.s;
    const bottom = t.y + (t.type === 'pine' ? 1.2 : 1.8) * t.s, top = t.y + 5.2 * t.s;
    if (y > bottom && y < top && (x - t.x) ** 2 + (z - t.z) ** 2 < r * r) return true;
  }
  // the boat canopy (a box around the roof)
  const bx = x - boat.position.x, bz = z - boat.position.z;
  if (Math.abs(y - (boat.position.y + 1.6)) < 0.45 && bx * bx + bz * bz < 1.6 * 1.6) return true;
  return false;
}

export function updateCamera(dt, focus) {
  let handled = false;
  for (const h of hooks.camera) if (h(dt, camTarget)) { handled = true; break; }
  if (handled) return;
  camTarget.set(focus.x, focus.y + 1.55, focus.z);
  const cp = Math.cos(camState.pitch), sx = Math.sin(camState.yaw) * cp, sy = Math.sin(camState.pitch), sz = Math.cos(camState.yaw) * cp;
  // walk out from the target toward the wanted distance and stop just before anything solid
  const near = treeSpots.filter((t) => Math.abs(t.x - focus.x) < camState.dist + 3 && Math.abs(t.z - focus.z) < camState.dist + 3);
  let free = camState.dist;
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const d = (camState.dist * i) / steps;
    if (blocked(camTarget.x + sx * d, camTarget.y + sy * d, camTarget.z + sz * d, near)) { free = Math.max(1.2, d - 0.5); break; }
  }
  // snap in quickly when something is in the way, ease back out slowly
  dist = free < dist ? damp(dist, free, 18, dt) : damp(dist, free, 2.5, dt);
  want.set(camTarget.x + sx * dist, camTarget.y + sy * dist, camTarget.z + sz * dist);
  const floor = Math.max(heightAt(want.x, want.z), 0.05) + 0.4;
  if (want.y < floor) want.y = floor;
  if (!init) { camera.position.copy(want); init = true; dist = free; }
  else camera.position.lerp(want, 1 - Math.exp(-dt * 9));
  camera.lookAt(camTarget);
}
