// Built things from Quaternius' Fantasy Props and Medieval Village kits (CC0; public/assets/props):
// the wooden bench, and split-rail fences with climbing vines along stretches of the lake path.
// Placement uses its own random stream, so nothing else in the meadow moves.
import * as THREE from 'three';
import { TAU, mulberry32, angDiff } from '../core/math.js';
import { height, LAKE, lakeR, PATH_T, DOCK_A, chairSpots, FIRE_SPOT, BENCH_SPOT } from '../core/shape.js';
import { std, weatherize, bothSides, instanced } from '../core/materials.js';
import { kit, fit } from '../core/assets.js';
import { obstacles } from '../core/state.js';

const first = (parts, re) => Object.entries(parts).find(([k]) => re.test(k))[1];
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

/** Split-rail fence runs on the outer side of the path, with vines climbing some posts. */
export function buildFences() {
  if (!kit) return;
  const r = mulberry32(60617);
  const single = fit(clone(kit.models.Prop_WoodenFence_Single), 1.0);
  const ext = fit(clone(kit.models.Prop_WoodenFence_Extension1), 1.0);
  // the extension piece is one post with rails reaching to the next; the single piece has both
  // posts and starts each run. Both are centred on their section.
  const geo = first(ext, /Wood/), post = first(single, /Wood/);
  [geo, post].forEach((g) => { g.computeBoundingBox(); g.translate(-(g.boundingBox.min.x + g.boundingBox.max.x) / 2, 0, 0); });
  const len = geo.boundingBox.max.x - geo.boundingBox.min.x; // one rail section
  const mat = weatherize(std('#ffffff', { map: kit.tex.woodtrim, flatShading: false, vertexColors: true }), 'std');
  const sections = [], posts = [], vines = [];
  const clear = (x, z) => chairSpots.every((c) => Math.hypot(x - c.x, z - c.z) > 3) && Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) > 6 && Math.hypot(x - BENCH_SPOT.x, z - BENCH_SPOT.z) > 4;
  for (let run = 0; run < 7; run++) {
    const a0 = (run / 7) * TAU + 0.5 + r() * 0.4, n = 6 + Math.floor(r() * 7);
    let a = a0;
    for (let k = 0; k < n; k++) {
      const R = lakeR(a) * PATH_T + 2.9;
      const x = LAKE.x + Math.cos(a) * R, z = LAKE.z + Math.sin(a) * R;
      if (Math.abs(angDiff(a, DOCK_A)) < 0.3 || !clear(x, z)) break;
      const da = len / R;
      const a1 = a + da, R1 = lakeR(a1) * PATH_T + 2.9;
      const x1 = LAKE.x + Math.cos(a1) * R1, z1 = LAKE.z + Math.sin(a1) * R1;
      const y = Math.min(height(x, z), height(x1, z1)) - 0.05;
      const ry = Math.atan2(-(z1 - z), x1 - x); // the rails run along x in the model
      (k === 0 ? posts : sections).push({ x: (x + x1) / 2, z: (z + z1) / 2, y, ry, s: 1 });
      if (r() < 0.35) vines.push({ x, z, y: height(x, z) - 0.02, ry: r() * TAU, s: 0.7 + r() * 0.5, v: r() < 0.5 ? 0 : 1 });
      for (let t = 0; t <= 1; t += 0.5) obstacles.push({ x: x + (x1 - x) * t, z: z + (z1 - z) * t, r: 0.18 });
      a = a1;
    }
  }
  if (sections.length) instanced(geo, mat, sections, { cast: true });
  if (posts.length) instanced(post, mat, posts, { cast: true });
  const vineMat = bothSides(weatherize(new THREE.MeshLambertMaterial({ color: '#5f8f3c', map: kit.tex.vine, alphaTest: 0.5, vertexColors: true }), 'lam'));
  [kit.models.Prop_Vine1, kit.models.Prop_Vine4].forEach((parts, v) => {
    const list = vines.filter((it) => it.v === v);
    if (list.length) instanced(fit(clone(parts), 0.9)[Object.keys(parts)[0]], vineMat, list, { cast: false });
  });
}
