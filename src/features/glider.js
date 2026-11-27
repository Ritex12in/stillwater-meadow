// The glider, and what the moves (characters/moves.js) show in the world: a cloth wing that opens
// over you, dust where you land or slide, a splash.
//
// The glider is found, not given: it lies by a high place on home's continent (the summit cairn
// nearest home; failing that a windmill, a stone circle, a castle, or the nearest waystone). The
// first time you fall a long way you are told where, and it is tracked for you (features/waypoints.js).
// Take it with E; from then on it is yours in every world (`store.glider`), rolled up on your
// backpack. `?glider=1` gives it at once (tests, pictures).
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { query } from '../core/env.js';
import { HOME, sitesNear, continentAt, groundAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { std, glowTex } from '../core/materials.js';
import { player, hero } from '../characters/player.js';
import { setMovesWorld, mv } from '../characters/moves.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { toast } from '../ui/hud.js';
import { placeName, islandTops } from '../world/landmarks.js';
import { track } from './waypoints.js';

const SPAN = 2.9, CHORD = 1.15, NX = 12, NZ = 4;
export const hasGlider = () => !!store.glider || query.has('glider');

// ── the wing: a cloth sail on a wooden frame, two lines down to the hands ──
function makeWing() {
  const g = new THREE.Group(), geo = new THREE.PlaneGeometry(SPAN, CHORD, NX, NZ).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cream = new THREE.Color('#f3ead6'), red = new THREE.Color('#c8553a'), teal = new THREE.Color('#3f7f7a'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { // (panels: a red middle, teal tips, cream between)
    const u = Math.abs(pos.getX(i)) / (SPAN / 2);
    c.copy(u < 0.2 ? red : u > 0.78 ? teal : cream);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sail = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, flatShading: true }));
  sail.castShadow = true; sail.frustumCulled = false;
  const wood = std('#6b4a30');
  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, SPAN, 5).rotateZ(Math.PI / 2).translate(0, 0, CHORD / 2), wood); // (the leading edge)
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, CHORD * 1.15, 5).rotateX(Math.PI / 2), wood);
  const lines = [0, 1].map(() => new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, -0.5, 0), wood));
  const bar = [0, 1].map(() => new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5).rotateZ(Math.PI / 2), wood)); // (the handles)
  g.add(sail, spar, keel, ...lines, ...bar);
  g.visible = false;
  return { g, sail, base: Float32Array.from(pos.array), lines, bar, spar };
}
/** The wing, rolled up across the top of the backpack. */
function makeRoll() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 7).rotateZ(Math.PI / 2), std('#f3ead6')));
  for (const x of [-0.12, 0.12]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.035, 7).rotateZ(Math.PI / 2).translate(x, 0, 0), std('#c8553a')));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).rotateZ(Math.PI / 2), std('#6b4a30')));
  g.position.set(0, 0.46, -0.2);
  return g;
}

// ── dust and spray: a few soft puffs that swell and thin ──
const PUFFS = 14, puffs = [];
function makePuffs() {
  for (let i = 0; i < PUFFS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#d9cdb4', transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; s.userData = { t: 1, vx: 0, vy: 0, vz: 0, big: 1 };
    scene.add(s); puffs.push(s);
  }
}
let nextPuff = 0;
function puff(x, y, z, n, color = '#d9cdb4', up = 0.9) {
  for (let i = 0; i < n; i++) {
    const s = puffs[nextPuff++ % PUFFS], a = (i / n) * Math.PI * 2 + nextPuff, r = n > 1 ? 0.25 : 0;
    s.position.set(x + Math.cos(a) * r, y + 0.15, z + Math.sin(a) * r);
    s.userData = { t: 0, vx: Math.cos(a) * (n > 1 ? 1.3 : 0.2), vy: up, vz: Math.sin(a) * (n > 1 ? 1.3 : 0.2), big: 0.5 + n * 0.09 };
    s.material.color.set(color); s.visible = true;
  }
}

let wing = null, roll = null, open = false, openT = 1, spot = null, prop = null, told = false;
const KINDS = ['cairn', 'windmill', 'circle', 'castle', 'waystone'];
/**
 * Where the glider lies: looked for a little at a time (a look at new country can mean tracing its
 * rivers, tens of milliseconds and more): a kind at a time, at spots 700 m apart out to 3.6 km from
 * home, nearest first; the first place found on home's continent is it.
 */
function* search() {
  const home = continentAt(HOME.x, HOME.z), spots = [];
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const d = Math.hypot(i, j) * 700; if (d < 3600) spots.push([HOME.x + i * 700, HOME.z + j * 700, d]); }
  spots.sort((p, q) => p[2] - q[2]);
  for (const kind of KINDS) for (const [x, z] of spots) {
    const s = sitesNear(x, z, 520, kind).find((q) => Math.hypot(q.x - HOME.x, q.z - HOME.z) > 500 && continentAt(q.x, q.z) === home);
    if (s) { const a = s.turn + 2.2, r = (s.flat || 2) * 0.6 + 2.2; spot = { site: s, name: placeName(s), x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r }; return; }
    yield;
  }
}
let job = null, searched = false;
/** One more look for it. Returns whether the search is over. */
function findSpot() {
  if (spot || searched) return true;
  if (!job) job = search();
  if (job.next().done) { searched = true; job = null; }
  return !!spot || searched;
}
/** The glider as it lies waiting: its wing half furled on a pair of crossed sticks. */
function makeProp() {
  const g = new THREE.Group(), wood = std('#6b4a30');
  for (const sx of [-1, 1]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5).rotateZ(sx * 0.45).translate(0, 0.55, 0), wood));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 8).rotateZ(Math.PI / 2 - 0.12).translate(0, 0.95, 0.03), std('#f3ead6')));
  for (const x of [-0.45, 0.45]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.12, 8).rotateZ(Math.PI / 2 - 0.12).translate(x, 0.95 + x * 0.12, 0.03), std('#c8553a')));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe9b0', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = 1; glow.scale.setScalar(2.6); g.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** For tests: whether you have it, where it lies, whether the wing is open. */
export const gliderView = () => { while (!findSpot()); return { has: hasGlider(), spot: spot && { name: spot.name, x: spot.x, z: spot.z, kind: spot.site.kind }, open, shown: !!(prop && prop.visible) }; };

export function initGlider() {
  wing = makeWing(); roll = makeRoll(); makePuffs();
  setMovesWorld({
    hasGlider, islandTops,
    fx: { puff, wing: (on) => { if (on && !open) openT = 0; open = on; }, splash: (x, z) => puff(x, 0.05, z, 8, '#eef6fb', 2.4) },
    // a long fall without it: where it is said to lie, and the way there
    onFall: () => {
      if (hasGlider() || told || !spot) return; // (not found yet: said the next time)
      told = true;
      track({ id: 'glider', name: 'The glider', x: spot.x, z: spot.z });
      toast(`A long way down! They say a glider lies by the ${spot.name.replace(/^./, (c) => c.toLowerCase())}. It is tracked for you.`, 7);
    },
  });
  registerAction({
    id: 'glider-take', key: 'KeyE', keyLabel: 'E', score: () => 35,
    available: () => activity.free && !hasGlider() && !!spot && Math.hypot(spot.x - player.x, spot.z - player.z) < 2.6,
    label: () => 'Take the glider',
    run: () => { store.glider = true; saveSoon(); if (store.track && store.track.id === 'glider') track(null); toast('The glider is yours. In the air, press Space to open it: A and D turn, W dives, S slows. Space folds it.', 8); },
  });
  let lookIn = 2, findIn = 6;
  hooks.frame.push((dt, t) => {
    // the wing: over your hands while it is open (it snaps open with an overshoot, and ripples)
    if (open) {
      if (wing.g.parent !== hero.root) hero.root.add(wing.g);
      openT = Math.min(1, openT + dt / 0.28);
      const e = openT < 1 ? 1 + 0.18 * Math.sin(openT * Math.PI) * (1 - openT) - (1 - openT) ** 2 : 1, h = [0, 1].map((i) => hero.root.worldToLocal(hero.hands[i].getWorldPosition(new THREE.Vector3())));
      const mid = h[0].clone().add(h[1]).multiplyScalar(0.5);
      wing.g.visible = true;
      wing.g.position.set(0, mid.y + 0.62, mid.z + 0.05);
      wing.g.rotation.set(-0.14 - mv.pitch * 0.2, 0, mv.bank * 0.42);
      wing.sail.scale.x = wing.spar.scale.x = Math.max(0.05, e);
      const p = wing.sail.geometry.attributes.position, b = wing.base;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3], z = b[i * 3 + 2], back = 0.5 - z / CHORD, u = x / (SPAN / 2); p.setY(i, -0.2 * u * u + 0.1 * back * (1 - u * u) + Math.sin(t * 10 + x * 2.6 + z * 5) * 0.035 * back); } // (arched, bellied by the air, rippling toward its trailing edge)
      p.needsUpdate = true; wing.sail.geometry.computeVertexNormals();
      wing.g.updateMatrixWorld(true);
      for (const i of [0, 1]) { // a line from each handle up to the frame
        const from = wing.g.worldToLocal(hero.hands[i].getWorldPosition(new THREE.Vector3())), topX = (i ? 1 : -1) * 0.5;
        wing.bar[i].position.copy(from);
        const L = wing.lines[i], d = new THREE.Vector3(from.x - topX, from.y, from.z - CHORD * 0.25);
        L.position.set(topX, 0, CHORD * 0.25); L.scale.y = d.length(); L.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize());
      }
    } else if (wing.g.visible) wing.g.visible = false;
    // rolled on the backpack while you have it and it is folded
    const has = hasGlider();
    if (has && roll.parent !== hero.chest) hero.chest.add(roll);
    roll.visible = has && !open;
    for (const s of puffs) if (s.visible) { const u = s.userData; u.t += dt / 0.8; if (u.t >= 1) { s.visible = false; continue; } s.position.x += u.vx * dt; s.position.y += u.vy * dt * (1 - u.t); s.position.z += u.vz * dt; u.vx *= 1 - 3 * dt; u.vz *= 1 - 3 * dt; s.scale.setScalar(u.big * (0.5 + u.t * 1.6)); s.material.opacity = 0.5 * (1 - u.t) ** 1.5; }
    // where it lies waiting
    if (!has && !spot && !searched && (findIn -= dt) <= 0) { findIn = 0.3; findSpot(); } // (one look every third of a second, once the game has settled)
    lookIn -= dt;
    if (lookIn <= 0) {
      lookIn = 1;
      const near = !has && spot && Math.hypot(spot.x - player.x, spot.z - player.z) < 400;
      if (near && !prop) { prop = makeProp(); prop.userData.pooledLandmark = true; scene.add(prop); }
      if (prop) { prop.visible = !!near; if (near) prop.position.set(spot.x, groundAt(spot.x, spot.z), spot.z); }
    }
  });
}
