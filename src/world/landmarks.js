// The biomes' buildings, set down at their sites (core/shape.js: pagodas in blossom groves, a castle
// on a hilltop, ruins in the plains and the desert, huts on stilts in the swamp, windmills on open
// rises). Each kind is built in a few variants (world/buildings.js), and each variant is copied (its
// geometry shared) as often as sites near you need it, up to a few: nothing is built or thrown away
// as you walk once those are made. Far ones are hidden; a castle shows from further than a hut.
// Each standing building blocks the way with a few circles round its footprint.
import { TAU } from '../core/math.js';
import { scene } from '../core/render.js';
import { sitesNear } from '../core/shape.js';
import { hooks, obstacles } from '../core/state.js';
import { cur } from '../systems/time.js';
import { pagoda, castle, ruinArch, colonnade, stiltHut, windmill, buildingMats } from './buildings.js';
import { biomesAt } from '../core/biome.js';

/** Per kind: how far off it shows, how many can stand at once, its variants, and its footprint (blockers: [x, z, r] round its middle). */
const KINDS = {
  pagoda: { view: 520, pool: 3, make: [0, 1, 2].map((v) => () => pagoda(v)) },
  castle: { view: 1100, pool: 2, make: [0, 1].map((v) => () => castle(v)) },
  ruin: { view: 420, pool: 4, make: [() => ruinArch(0), () => ruinArch(1), () => colonnade(0), () => colonnade(1), () => ruinArch(2, true), () => colonnade(2, true)] },
  hut: { view: 380, pool: 4, make: [0, 1, 2].map((v) => () => stiltHut(v)) },
  windmill: { view: 700, pool: 2, make: [0, 1].map((v) => () => windmill(v)) },
};
/** Blockers round a building (local coordinates): a ring at its radius, and its middle. */
function footprint(kind, made) {
  const r = made.radius, out = [[0, 0, Math.min(r * 0.6, 4)]];
  if (kind === 'castle') { const S = r - 3; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; out.push([Math.cos(a) * S, Math.sin(a) * S, 2]); } out.push([0, -2, 6]); return out; }
  if (kind === 'hut') return [[0, 0, 2.5]];
  const n = kind === 'pagoda' ? 8 : 6;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; out.push([Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.35]); }
  return out;
}

const made = {}; // kind -> variant -> { proto, copies: [{ group, site, blocks }] }
function copyFor(kind, v) {
  const K = KINDS[kind], byV = made[kind] || (made[kind] = []);
  const slot = byV[v] || (byV[v] = { proto: K.make[v](), copies: [] });
  let c = slot.copies.find((q) => !q.site);
  if (!c && slot.copies.length < K.pool) {
    const group = slot.copies.length ? slot.proto.group.clone() : slot.proto.group;
    const sails = slot.proto.sails ? (slot.copies.length ? group.children[group.children.length - 1] : slot.proto.sails) : null;
    c = { group, sails, site: null, blocks: footprint(kind, slot.proto).map(([x, z, r]) => ({ lx: x, lz: z, o: { x: 4e5, z: 4e5, r } })) };
    group.visible = false;
    scene.add(group);
    slot.copies.push(c);
  }
  return c;
}
function place(c, s) {
  c.site = s;
  c.group.position.set(s.x, s.y - 0.05, s.z);
  c.group.rotation.y = s.turn;
  c.group.visible = true;
  const cs = Math.cos(s.turn), sn = Math.sin(s.turn);
  for (const b of c.blocks) { b.o.x = s.x + b.lx * cs + b.lz * sn; b.o.z = s.z - b.lx * sn + b.lz * cs; if (!obstacles.includes(b.o)) obstacles.push(b.o); }
}
function release(c) {
  c.site = null;
  c.group.visible = false;
  for (const b of c.blocks) { const i = obstacles.indexOf(b.o); if (i >= 0) obstacles.splice(i, 1); }
}
/** For tests: the buildings standing just now. */
export const landmarksView = () => Object.entries(made).flatMap(([kind, vs]) => vs.filter(Boolean).flatMap((v) => v.copies.filter((c) => c.site).map((c) => ({ kind, id: c.site.id, x: c.site.x, z: c.site.z }))));

/** Now and then: the buildings near (x, z) stand at their sites; those left behind are put away. */
export function updateLandmarks(x, z) {
  for (const kind in KINDS) {
    const K = KINDS[kind], want = sitesNear(x, z, K.view, kind).slice(0, K.pool);
    const ids = new Set(want.map((s) => s.id));
    for (const vs of made[kind] || []) if (vs) for (const c of vs.copies) if (c.site && !ids.has(c.site.id)) release(c);
    for (const s of want) {
      const standing = (made[kind] || []).some((vs) => vs && vs.copies.some((c) => c.site === s));
      if (standing) continue;
      // ruins in the desert are of sandstone (the last two variants)
      let v = s.variant % K.make.length;
      if (kind === 'ruin') { const sandy = biomesAt(s.x, s.z, s.y).desert > 0.5; v = sandy ? 4 + (s.variant % 2) : s.variant % 4; }
      const c = copyFor(kind, v);
      if (c) place(c, s);
    }
  }
}

export function initLandmarks() {
  let lookIn = 0;
  const mats = buildingMats();
  hooks.frame.push((dt, t, camera) => {
    lookIn -= dt;
    if (lookIn <= 0) { lookIn = 1; updateLandmarks(camera.position.x, camera.position.z); }
    mats.glass.emissiveIntensity = cur.eve * 1.6; // (windows lit at dusk)
    for (const vs of made.windmill || []) if (vs) for (const c of vs.copies) if (c.site && c.sails) c.sails.rotation.z += dt * 0.5;
  });
}
