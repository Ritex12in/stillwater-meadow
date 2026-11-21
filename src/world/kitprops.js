// Built things from Quaternius' Fantasy Props and Medieval Village kits (CC0; public/assets/props):
// the wooden bench, and split-rail fences with climbing vines along stretches of the lake path.
// Placement uses its own random stream, so nothing else in the meadow moves.
import * as THREE from 'three';

import { std, weatherize } from '../core/materials.js';
import { kit } from '../core/assets.js';

const clone = (parts) => Object.fromEntries(Object.entries(parts).map(([k, g]) => [k, g.clone()]));

/** The kit bench, standing where the hand-built one would; returns the group (or null). */
export function kitBench(group) {
  if (!kit) return null;
  const parts = clone(kit.models.Bench);
  // stretch to the old bench's 1.9 m and seat height
  const box = new THREE.Box3();
  Object.values(parts).forEach((g) => { g.computeBoundingBox(); box.union(g.boundingBox); });
  const sx = 1.95 / (box.max.x - box.min.x), sy = 0.5 / (box.max.y - box.min.y), sz = 0.55 / (box.max.z - box.min.z);
  const wood = weatherize(std('#ffffff', { map: kit.tex.furniture, flatShading: false, vertexColors: true }), 'std');
  const iron = std('#3a3f3f', { flatShading: false, vertexColors: true });
  Object.entries(parts).forEach(([name, g]) => {
    g.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2).scale(sx, sy, sz);
    const m = new THREE.Mesh(g, /Metal/.test(name) ? iron : wood);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  });
  return group;
}

