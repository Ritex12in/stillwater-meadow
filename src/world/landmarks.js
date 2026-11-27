// The biomes' buildings, set down at their sites (core/shape.js: pagodas in blossom groves, a castle
// on a hilltop, ruins in the plains and the desert, huts on stilts in the swamp, windmills on open
// rises). Each kind is built in a few variants (world/buildings.js), and each variant is copied (its
// geometry shared) as often as sites near you need it, up to a few: nothing is built or thrown away
// as you walk once those are made. Far ones are hidden; a castle shows from further than a hut.
// Each standing building blocks the way with a few circles round its footprint.
import { TAU } from '../core/math.js';
import { scene } from '../core/render.js';
import { sitesNear, harboursNear, VOLCANO } from '../core/shape.js';
import { hooks, obstacles } from '../core/state.js';
import { cur } from '../systems/time.js';
import * as THREE from 'three';
import { harbour, waystone, pagoda, castle, ruinArch, colonnade, stiltHut, windmill, stoneCircle, cairn, hotSpring, crystalGrotto, volcanoTop, skyIsles, ship, buildingMats } from './buildings.js';
import { player } from '../characters/player.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { toast } from '../ui/hud.js';
import { seats } from '../core/state.js';
import { glowTex } from '../core/materials.js';
import { biomesAt } from '../core/biome.js';

/** Per kind: how far off it shows, how many can stand at once, its variants, and its footprint (blockers: [x, z, r] round its middle). */
const KINDS = {
  pagoda: { view: 520, pool: 3, make: [0, 1, 2].map((v) => () => pagoda(v)) },
  castle: { view: 1100, pool: 2, make: [0, 1].map((v) => () => castle(v)) },
  ruin: { view: 420, pool: 4, make: [() => ruinArch(0), () => ruinArch(1), () => colonnade(0), () => colonnade(1), () => ruinArch(2, true), () => colonnade(2, true)] },
  hut: { view: 380, pool: 4, make: [0, 1, 2].map((v) => () => stiltHut(v)) },
  windmill: { view: 700, pool: 2, make: [0, 1].map((v) => () => windmill(v)) },
  circle: { view: 600, pool: 2, make: [0, 1, 2].map((v) => () => stoneCircle(v)) },
  cairn: { view: 700, pool: 3, make: [0, 1].map((v) => () => cairn(v)) },
  spring: { view: 360, pool: 3, make: [0, 1].map((v) => () => hotSpring(v)) },
  icecastle: { view: 1100, pool: 1, make: [0, 1].map((v) => () => castle(v, true)) },
  grotto: { view: 500, pool: 2, make: [0, 1].map((v) => () => crystalGrotto(v)) },
  volcano: { view: 2600, pool: 1, make: [() => volcanoTop()] },
  beachhut: { view: 380, pool: 3, make: [0, 1, 2].map((v) => () => stiltHut(v + 3)) },
  ship: { view: 1400, pool: 2, make: [0, 1, 2].map((v) => () => ship(v)) },
  skyisle: { view: 1400, pool: 1, make: [0, 1].map((v) => () => skyIsles(v)) },
  waystone: { view: 520, pool: 2, make: [0, 1, 2].map((v) => () => waystone(v)) },
  harbour: { view: 900, pool: 3, make: [0, 1, 2].map((v) => () => harbour(v)) },
};
/** The names the places are found by (world/landmarks.js placeName). */
const KIND_NAMES = { harbour: 'Harbour', beachhut: 'Beach hut', ship: 'Ship', skyisle: 'Floating islands', pagoda: 'Pagoda', castle: 'Castle', ruin: 'Ruins', hut: 'Stilt hut', windmill: 'Windmill', circle: 'Stone circle', cairn: 'Summit cairn', spring: 'Hot spring', icecastle: 'Ice castle', grotto: 'Crystal grotto', volcano: 'Volcano', waystone: 'Waystone' };
const NAME_A = ['Old', 'Grey', 'Silver', 'High', 'Quiet', 'Misty', 'Golden', 'Hollow', 'Wind', 'Star', 'Moss', 'Dawn', 'Ember', 'Frost', 'Willow', 'Raven'];
const WAY_B = ['fell', 'wick', 'holt', 'combe', 'dale', 'stow', 'rise', 'ford', 'haven', 'moor', 'garth', 'mere'];
/** A place's name, by rule from its site: "the Misty Stone circle"; a waystone has a name of its own ("Ravenmoor waystone"). */
export const placeName = (s) => s.kind === 'harbour' ? s.name : s.kind === 'waystone' ? `${NAME_A[s.variant % NAME_A.length]}${WAY_B[Math.floor(s.variant / NAME_A.length) % WAY_B.length]} waystone` : `${NAME_A[s.variant % NAME_A.length]} ${KIND_NAMES[s.kind] ? KIND_NAMES[s.kind].toLowerCase() : s.kind}`.replace(/^./, (c) => c.toUpperCase());
/** Blockers round a building (local coordinates): a ring at its radius, and its middle. */
function footprint(kind, made) {
  const r = made.radius, out = [[0, 0, Math.min(r * 0.6, 4)]];
  if (kind === 'volcano' || kind === 'skyisle') return [];
  if (kind === 'castle' || kind === 'icecastle') { const S = r - 3; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; out.push([Math.cos(a) * S, Math.sin(a) * S, 2]); } out.push([0, -2, 6]); return out; }
  if (kind === 'hut') return [[0, 0, 2.5]];
  if (kind === 'waystone') return [[0, 0, 0.85]];
  if (kind === 'harbour') return [[1.9, -1.6, 0.8], [2.8, -1.6, 0.5]]; // (the crates and barrels; the jetty stands over the water)
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
    c = { group, sails, site: null, blocks: footprint(kind, slot.proto).map(([x, z, r]) => ({ lx: x, lz: z, o: { x: 4e5, z: 4e5, r } })),
      top: slot.proto.top || null, floor: null,
      seats: (slot.proto.seats || []).map((q) => ({ q, o: { name: kind === 'spring' ? 'spring' : 'bench', x: 4e5, z: 4e5, baseY: 0, top: q.top, rot: 0, standOff: 1.1, warm: !!q.warm } })), steam: null };
    if (slot.proto.steam) {
      // steam rising from the water: a few soft puffs that climb, spread and fade
      const smoke = slot.proto.steam.r > 20, mat = new THREE.SpriteMaterial({ map: glowTex, color: smoke ? '#5d5753' : '#f4f7fa', transparent: true, opacity: smoke ? 0.55 : 0.25, depthWrite: false });
      c.steam = Array.from({ length: 14 }, (_, i) => { const sp = new THREE.Sprite(mat); sp.userData.t = i / 14; sp.userData.a = i * 2.39; group.add(sp); return sp; });
      c.steamR = slot.proto.steam.r;
    }
    group.visible = false;
    group.userData.pooledLandmark = true;
    scene.add(group);
    slot.copies.push(c);
  }
  return c;
}
function place(c, s, kind) {
  c.site = s;
  c.group.position.set(s.x, s.y - 0.05 + (kind === 'volcano' ? VOLCANO.height - VOLCANO.deep : 0), s.z);
  c.group.rotation.y = s.turn;
  c.group.visible = true;
  const cs = Math.cos(s.turn), sn = Math.sin(s.turn);
  for (const b of c.blocks) { b.o.x = s.x + b.lx * cs + b.lz * sn; b.o.z = s.z - b.lx * sn + b.lz * cs; if (!obstacles.includes(b.o)) obstacles.push(b.o); }
  for (const st of c.seats) { st.o.x = s.x + st.q.x * cs + st.q.z * sn; st.o.z = s.z - st.q.x * sn + st.q.z * cs; st.o.baseY = s.y; st.o.rot = s.turn + st.q.rot; if (!seats.includes(st.o)) seats.push(st.o); }
  if (kind === 'waystone') lightWaystone(c);
  // a floating island's top: where the updraft carries you
  if (c.top) c.floor = { x: s.x + c.top.x * cs + c.top.z * sn, z: s.z - c.top.x * sn + c.top.z * cs, y: s.y + c.top.y, r: c.top.r, base: { x: s.x, z: s.z } };
}
/** Is the waystone at a site awake? (features/waypoints.js says.) */
let awake = () => false;
export const setWaystoneAwake = (fn) => { awake = fn; for (const vs of made.waystone || []) if (vs) for (const c of vs.copies) if (c.site) lightWaystone(c); };
function lightWaystone(c) {
  const on = c.group.getObjectByName('wayOn'), lit = awake(c.site.id);
  if (on) on.visible = lit;
  if (!c.glow) c.glow = c.group.getObjectByName('wayGlow');
  if (!c.glow) { c.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#8fe6ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); c.glow.name = 'wayGlow'; c.glow.position.y = 2.2; c.glow.scale.setScalar(5); c.group.add(c.glow); }
  c.glow.visible = lit;
}
function release(c) {
  c.site = null;
  c.group.visible = false;
  for (const b of c.blocks) { const i = obstacles.indexOf(b.o); if (i >= 0) obstacles.splice(i, 1); }
  for (const st of c.seats) { const i = seats.indexOf(st.o); if (i >= 0) seats.splice(i, 1); }
}
/** For tests: how many blockers and seats the standing buildings have put down. */
export const landmarkBlocks = () => Object.values(made).flat().filter(Boolean).flatMap((v) => v.copies).filter((c) => c.site).reduce((a, c) => a + c.blocks.length, 0);
export const landmarkSeats = () => Object.values(made).flat().filter(Boolean).flatMap((v) => v.copies).filter((c) => c.site).reduce((a, c) => a + c.seats.length, 0);
/** For tests: the buildings standing just now. */
export const landmarksView = () => Object.entries(made).flatMap(([kind, vs]) => vs.filter(Boolean).flatMap((v) => v.copies.filter((c) => c.site).map((c) => ({ kind, id: c.site.id, name: placeName(c.site), x: c.site.x, z: c.site.z }))));

/** Now and then: the buildings near (x, z) stand at their sites; those left behind are put away. */
export function updateLandmarks(x, z) {
  for (const kind in KINDS) {
    const K = KINDS[kind], want = (kind === 'harbour' ? harboursNear(x, z, K.view, true) : sitesNear(x, z, K.view, kind)).slice(0, K.pool);
    const ids = new Set(want.map((s) => s.id));
    for (const vs of made[kind] || []) if (vs) for (const c of vs.copies) if (c.site && !ids.has(c.site.id)) release(c);
    for (const s of want) {
      const standing = (made[kind] || []).some((vs) => vs && vs.copies.some((c) => c.site === s));
      if (standing) continue;
      // ruins in the desert are of sandstone (the last two variants)
      let v = s.variant % K.make.length;
      if (kind === 'ruin') { const sandy = biomesAt(s.x, s.z, s.y).desert > 0.5; v = sandy ? 4 + (s.variant % 2) : s.variant % 4; }
      const c = copyFor(kind, v);
      if (c) place(c, s, kind);
    }
  }
}

/** The floating island whose updraft is near (x, z), or the one you stand on: its floor. */
const islandFloor = (near) => { for (const vs of made.skyisle || []) if (vs) for (const c of vs.copies) if (c.site && c.floor && (!near || Math.hypot(c.floor.base.x - near.x, c.floor.base.z - near.z) < 3)) return c.floor; return null; };

export function initLandmarks() {
  let lookIn = 0;
  // the updraft: step into the ring of light and it lifts you onto the island; from the island's middle, glide back down
  registerAction({
    id: 'updraft', key: 'KeyE', keyLabel: 'E', score: () => 30,
    available: () => activity.free && !player.floor && !!islandFloor(player),
    label: () => 'Ride the updraft up',
    run: () => { const f = islandFloor(player); if (!f) return; player.floor = f; player.x = f.x; player.z = f.z; player.y = f.y; toast('The wind lifts you onto the floating island. Come back to its middle to glide down.', 5); },
  });
  registerAction({
    id: 'glide', key: 'KeyE', keyLabel: 'E', score: () => 30,
    available: () => activity.free && !!player.floor && Math.hypot(player.x - player.floor.x, player.z - player.floor.z) < 2.5,
    label: () => 'Glide back down',
    run: () => { const f = player.floor; player.floor = null; player.x = f.base.x + 3; player.z = f.base.z; },
  });
  const mats = buildingMats();
  hooks.frame.push((dt, t, camera) => {
    lookIn -= dt;
    if (lookIn <= 0) { lookIn = 1; updateLandmarks(camera.position.x, camera.position.z); }
    mats.glass.emissiveIntensity = cur.eve * 1.6; // (windows lit at dusk)
    if (mats.rune) mats.rune.emissiveIntensity = cur.eve * 2.4; // (the stones' runes glow at night)
    for (const vs of made.windmill || []) if (vs) for (const c of vs.copies) if (c.site && c.sails) c.sails.rotation.z += dt * 0.5;
    for (const vs of made.ship || []) if (vs) for (const c of vs.copies) if (c.site) { c.group.rotation.z = Math.sin(t * 0.6 + c.site.x) * 0.03; c.group.position.y = -0.05 + Math.sin(t * 0.8 + c.site.z) * 0.08; } // (riding the swell)
    for (const k of ['spring', 'volcano']) for (const vs of made[k] || []) if (vs) for (const c of vs.copies) if (c.site && c.steam) for (const sp of c.steam) {
      sp.userData.t = (sp.userData.t + dt * 0.12) % 1;
      const t = sp.userData.t, r = c.steamR * 0.6 * Math.sqrt(t);
      const big = c.steamR > 20 ? 1 : 0;
      sp.position.set(Math.cos(sp.userData.a) * r, 0.3 + t * (3.5 + big * 120), Math.sin(sp.userData.a) * r);
      sp.scale.setScalar(1.2 + t * (3.5 + big * 60));
    }
  });
}
