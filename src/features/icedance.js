// Dancing on the frozen lake. In winter, out on the ice hand in hand with her, K starts "Snowman": the
// 60-second skating dance (characters/skatedance.js). Skates appear on their boots and the pair
// skates a loop across the ice; you start where you stand and she glides over to face you. Any move,
// or K again, ends it early; so does the ice beginning to thaw. A snowman stands on the shore.
// While dancing, the dance owns both children: updatePlayer and her own behaviour stand aside, and
// your position is kept in step so the camera, pets and the world follow.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { clamp, lerp } from '../core/math.js';
import { SPAWN, DOCK_A, lakePoint, onIce, onDock, groundAt, heightAt, walkable, nearReserved, ICE_Y } from '../core/shape.js';
import { hooks, seasonState, obstacles, seats } from '../core/state.js';
import { timeU, windU } from '../core/materials.js';
import { player, hero } from '../characters/player.js';
import { boat } from '../characters/boat.js';
import { poseSnow, snowSpots, snowRoutine, snowContacts, SNOW_LENGTH, BLADE } from '../characters/skatedance.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { moveInput } from '../systems/input.js';

import { toast } from '../ui/hud.js';
import { friend } from './friend.js';
import { seasonNow } from './seasons.js';
import { wardrobeNow } from './wardrobe.js';

const START_IN = 1.4;   // seconds over which you both move from where you were onto the dance's first spots
const lerpAngle = (a, b, w) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * w;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

let snowmanAt = null;
/** For tests: where the snowman stands and whether it is out. */
export const snowmanView = () => snowmanAt && { x: snowmanAt.position.x, z: snowmanAt.position.z, visible: snowmanAt.visible };
let D = null; // the dance in progress: { t, frame, sb, sg, from: { b, g } }
/** For tests: the dance in progress, if any. */
/** For the camera: the dance in progress ({ t, frame }) or null, and where the snowman stands. */
export const danceNow = () => D;
export const snowmanSpotNow = () => snowmanAt && snowmanAt.visible ? snowmanAt.position : null;
/** End the dance now (as moving away does). */
export const stopDance = () => finish();
export const danceView = () => D && { t: D.t, frame: { ...D.frame }, part: partAt(D.t), contacts: snowContacts(hero, friend.k, Math.min(D.t, SNOW_LENGTH)) };
const partAt = (t) => { const R = snowRoutine(t); return R.dip > 0.5 ? 'dip' : R.hug > 0.5 ? 'embrace' : R.twirl > 0.5 ? 'twirl' : R.closed > 0.5 ? 'close' : R.side > 0.5 ? 'side by side' : 'meet'; };

// ───────────── where there is room to dance ─────────────
/** Solid, level ice here (not the shallows, where the shore rises through it), with room round it, clear of the jetty and the boat. */
const flatIce = (x, z) => onIce(x, z) && !onDock(x, z) && heightAt(x, z) < ICE_Y - 0.01;
function iceOk(x, z) {
  if (!flatIce(x, z)) return false;
  for (const [ox, oz] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) if (!flatIce(x + ox, z + oz)) return false;
  return Math.hypot(x - boat.position.x, z - boat.position.z) > 3.2;
}
/** Does the whole dance, set off this way, stay on good ice? */
function routeOk(frame) {
  for (let t = 0; t <= SNOW_LENGTH; t += 0.5) {
    const s = snowSpots(frame, t);
    if (!iceOk(s.B.x, s.B.z) || !iceOk(s.G.x, s.G.z)) return false;
  }
  return true;
}
/**
 * A way to set off from where you stand, so you begin exactly here: of the headings whose whole
 * route fits on the ice, the one that puts her starting spot nearest to where she is now.
 */
function findFrame() {
  let best = null, bd = Infinity;
  for (let i = 0; i < 16; i++) {
    const h0 = player.rot + (i / 16) * Math.PI * 2, A = h0 + Math.PI / 2;
    const frame = { x: player.x + Math.sin(A) * 1.2, z: player.z + Math.cos(A) * 1.2, heading: h0 }; // (she starts 2.4 m from you)
    const g = snowSpots(frame, 0).G, d = Math.hypot(g.x - friend.st.x, g.z - friend.st.z);
    if (d < bd && routeOk(frame)) { best = frame; bd = d; }
  }
  return best;
}
let roomAt = null, roomFrame = null;
/** findFrame, remembered while you stay put (it is checked for the prompt several times a second). */
function room() {
  if (!roomAt || Math.hypot(roomAt.x - player.x, roomAt.z - player.z) > 0.25 || Math.abs(roomAt.rot - player.rot) > 0.3) {
    roomAt = { x: player.x, z: player.z, rot: player.rot };
    roomFrame = findFrame();
  }
  return roomFrame;
}
const canAsk = () => activity.free && friend && friend.st.together && wardrobeNow() === 'winter' && seasonState.ice > 0.85
  && onIce(player.x, player.z) && onIce(friend.st.x, friend.st.z) && Math.hypot(friend.st.x - player.x, friend.st.z - player.z) < 2.5;

// ───────────── starting and ending ─────────────
function start() {
  const frame = room();
  if (!frame || !activity.enter('dance')) return;
  const k = friend.k;
  D = { t: 0, frame, sb: {}, sg: {}, from: { b: { x: player.x, z: player.z, rot: player.rot }, g: { x: friend.st.x, z: friend.st.z, rot: friend.st.rot } } };
  friend.st.dancing = true;
  for (const kid of [hero, k]) if (kid.skates) kid.skates.forEach((s) => { s.visible = true; });
  // anything in their hands (a bouquet) is put away for the dance
  D.stowed = [];
  for (const kid of [hero, k]) for (const j of [...kid.arms, ...kid.elbows, ...kid.hands]) for (const c of j.children) if (!kid.own.has(c) && c.visible) { c.visible = false; D.stowed.push(c); }
}
/** End the dance (finished, cut short, or the ice going): both stand where they are, hand in hand again. */
function finish(msg) {
  if (!D) return;
  const k = friend.k;
  for (const kid of [hero, k]) if (kid.skates) kid.skates.forEach((s) => { s.visible = false; });
  D.stowed.forEach((c) => { c.visible = true; });
  player.x = hero.root.position.x; player.z = hero.root.position.z; player.rot = player.lastRot = hero.root.rotation.y; player.move = 0;
  const st = friend.st;
  st.x = k.root.position.x; st.z = k.root.position.z; st.rot = k.root.rotation.y; st.move = 0; st.dancing = false; st.together = true; st.onRight = true; // (the dance ends with her on your right: she stays there)
  D = null;
  activity.leave('dance');
  if (msg) toast(msg);
}

// ───────────── the snowman on the shore ─────────────
function buildSnowman() {
  const g = new THREE.Group(), snow = new THREE.MeshStandardMaterial({ color: '#f4f8fb', roughness: 0.95 });
  const coal = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.6 }), wood = new THREE.MeshStandardMaterial({ color: '#5b3f2a', roughness: 0.9 });
  const ball = (r, y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), snow); m.position.y = y; m.scale.y = 0.92; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  ball(0.46, 0.4); ball(0.33, 0.98); ball(0.24, 1.42);
  const bit = (r, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), coal); m.position.set(x, y, z); g.add(m); };
  bit(0.03, -0.085, 1.48, 0.21); bit(0.03, 0.085, 1.48, 0.21);                                    // eyes
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.24; bit(0.018, Math.sin(a) * 0.2, 1.33 + Math.abs(i - 2) * 0.014, Math.cos(a) * 0.2); } // a coal smile
  [1.08, 0.94, 0.8].forEach((y) => bit(0.035, 0, y, 0.32 - (y - 0.94) ** 2));                    // buttons
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 10), new THREE.MeshStandardMaterial({ color: '#e8792b', roughness: 0.7 }));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.42, 0.31); g.add(nose);
  [-1, 1].forEach((s) => {                                                                       // twig arms, one waving up
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.62, 6), wood), tilt = s > 0 ? 0.7 : 1.2;
    arm.position.set(s * (0.28 + 0.31 * Math.sin(tilt)), 1.02 + 0.31 * Math.cos(tilt), 0); arm.rotation.z = -s * tilt; g.add(arm);
  });
  const scarfMat = new THREE.MeshStandardMaterial({ color: '#c4323a', roughness: 0.85 });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 24), scarfMat); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.23; g.add(scarf);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.04), scarfMat); tail.position.set(0.12, 1.08, 0.24); tail.rotation.z = 0.2; g.add(tail);
  return g;
}
/** A clear spot on the shore near where you arrive (fixed, so no world randomness is used). */
function snowmanSpot() {
  for (let i = 0; i < 24; i++) {
    const a = DOCK_A - 0.71 - i * 0.03, p = lakePoint(a, 1.13);
    // (by the water, where no tree or boulder grows: the spot depends on the lake alone, not on what is loaded round you)
    const clear = walkable(p.x, p.z) && heightAt(p.x, p.z) > 0.35 && !onDock(p.x, p.z) && !nearReserved(p.x, p.z, 1.5)
      && !seats.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 2);
    if (clear) return p;
  }
  return null;
}

export function initIceDance() {
  // the snowman: there all winter, a little obstacle you walk round
  const spot = snowmanSpot(), snowman = spot && buildSnowman(), block = spot && { x: spot.x, z: spot.z, r: 0.48 };
  if (snowman) { snowman.position.set(spot.x, heightAt(spot.x, spot.z) - 0.04, spot.z); snowman.rotation.y = Math.atan2(SPAWN.x - spot.x, SPAWN.z - spot.z); snowman.visible = false; scene.add(snowman); snowmanAt = snowman; } // (facing you as you arrive)

  registerAction({
    id: 'dance', key: 'KeyK', keyLabel: 'K', score: () => 5,
    available: canAsk,
    disabled: () => !room(),
    label: () => (room() ? 'Dance on the ice with her' : 'Skate further out to dance'),
    run: start,
  });
  registerAction({
    id: 'dance-stop', key: 'KeyK', keyLabel: 'K', score: () => 1000,
    available: () => activity.is('dance'),
    label: () => 'Stop dancing',
    run: () => finish(),
  });

  hooks.frame.push((dt) => {
    // the snowman comes with the snow
    if (snowman) {
      const on = seasonNow() === 'winter';
      if (on !== snowman.visible) {
        snowman.visible = on;
        const i = obstacles.indexOf(block);
        if (on && i < 0) obstacles.push(block); else if (!on && i >= 0) obstacles.splice(i, 1);
      }
    }
    if (!D) return;
    if (!activity.within('dance')) { finish(); return; }
    if (seasonState.ice < 0.86 || seasonNow() !== 'winter') { finish('The ice is getting thin. Time to get off the lake.'); return; }
    if (activity.is('dance') && moveInput().mag > 0.3) { finish(); return; }
    if (activity.is('dance')) D.t += dt; // (held still while photo mode is open)
    const t = Math.min(D.t, SNOW_LENGTH), k = friend.k;
    poseSnow(hero, k, D.frame, t, D.sb, D.sg, dt, groundAt);
    // the first moments: from wherever you both were onto the dance's first spots
    const w = sstep(0, START_IN, D.t);
    if (w < 1) {
      for (const [kid, f] of [[hero, D.from.b], [k, D.from.g]]) {
        const p = kid.root.position;
        p.x = lerp(f.x, p.x, w); p.z = lerp(f.z, p.z, w); p.y = groundAt(p.x, p.z) + BLADE;
        kid.root.rotation.y = lerpAngle(f.rot, kid.root.rotation.y, w);
        kid.root.updateMatrixWorld(true);
      }
    }
    for (const kid of [hero, k]) { kid.face.update(dt, timeU.value); kid.sway(dt, timeU.value, Math.min(1.5, windU.value)); }
    // keep you (and her) where the dance has you, so the camera and everything else follows
    player.x = hero.root.position.x; player.z = hero.root.position.z; player.y = hero.root.position.y; player.rot = hero.root.rotation.y; player.move = 0;
    const st = friend.st; st.x = k.root.position.x; st.z = k.root.position.z; st.y = k.root.position.y; st.rot = k.root.rotation.y;
    if (D.t >= SNOW_LENGTH + 1.5) finish();
  });
}
