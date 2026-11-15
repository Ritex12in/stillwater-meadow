// You: walking, sitting, the pose blend, and getting safely off thawing ice.
import { scene } from '../core/render.js';
import { damp, turnTo } from '../core/math.js';
import { SPAWN, LAKE, height, groundAt, walkable, onIce, nearestShore, ICE_Y } from '../core/shape.js';
import { timeU, windU } from '../core/materials.js';
import { seats, pushOut, hooks } from '../core/state.js';
import { makeKid, KIDS, moveAttachments } from './kid.js';
import { poseKid, STRIDE_RATE } from './kidpose.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { camState, moveInput } from '../systems/input.js';
import { toast } from '../ui/hud.js';

export const player = {
  x: SPAWN.x, z: SPAWN.z, y: height(SPAWN.x, SPAWN.z),
  rot: Math.atan2(LAKE.x - SPAWN.x, LAKE.z - SPAWN.z),
  phase: 0, move: 0, seat: null, sitAmt: 0, seatTop: 0.44, slide: null,
  petting: null, petTimer: 0, petAmt: 0, heartT: 0,
  idleT: 0, turn: 0, lastRot: 0, t: 0,
};
export let hero = null;
const stepListeners = new Set();
/** Called with (foot 0|1, x, z) each time a foot lands. */
export const onStep = (fn) => stepListeners.add(fn);

export function buildPlayer() {
  hero = makeKid(KIDS.boy);
  scene.add(hero.root);
  registerSeatActions();
}
/** Change your clothes: another rig takes over, carrying anything held or worn. */
export function setHeroRig(k) {
  if (!hero || k === hero) return;
  moveAttachments(hero, k);
  k.root.position.copy(hero.root.position); k.root.rotation.copy(hero.root.rotation); k.root.visible = hero.root.visible;
  scene.remove(hero.root); scene.add(k.root);
  hero = k;
  poseHero(0); // (posed at once, so it is never drawn standing stiff for a frame)
}

// ── Sitting ────────────────────────────────────────────────────
const SIT_RANGE = 1.9;
export function sitDown(seat) {
  if (!activity.enter('sit')) return false;
  player.seat = seat;
  player.seatTop = seat.top;
  player.slide = null;
  return true;
}
export function standUp() {
  const seat = player.seat;
  if (!seat || (seat.locked && seat.locked())) return;
  player.seat = null;
  activity.leave('sit');
  const tx = seat.standTo ? seat.standTo.x : seat.x + Math.sin(seat.rot) * seat.standOff;
  const tz = seat.standTo ? seat.standTo.z : seat.z + Math.cos(seat.rot) * seat.standOff;
  if (walkable(tx, tz)) player.slide = { x: tx, z: tz, minY: seat.slideMinY !== undefined ? seat.slideMinY : -99 };
}
const nearestSeat = () => {
  let best = null, bd = SIT_RANGE;
  for (const s of seats) {
    const d = Math.hypot(s.x - player.x, s.z - player.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best && { seat: best, d: bd };
};
function registerSeatActions() {
  registerAction({
    id: 'stand', key: 'KeyE', keyLabel: 'E',
    available: () => activity.is('sit') && player.seat && !player.seat.boat,
    label: () => 'Stand up', score: () => 1000, run: standUp,
  });
  registerAction({
    id: 'sit', key: 'KeyE', keyLabel: 'E',
    available: () => activity.free && nearestSeat(),
    label: () => `Sit on the ${nearestSeat().seat.name}`,
    score: () => -nearestSeat().d,
    run: () => { const n = nearestSeat(); if (n) sitDown(n.seat); },
  });
}

// ── Each frame ─────────────────────────────────────────────────
let wasOnIce = false;
let rescued = false;
export function updatePlayer(dt, petting) {
  if (activity.within('dance')) return; // the dance moves and poses you
  const input = moveInput();
  const locked = activity.locksMovement();
  const mag = locked ? 0 : input.mag;
  const speed = (input.running ? 5.4 : 2.7) * mag;
  const yaw = camState.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = fx * input.iz + rx * input.ix, dz = fz * input.iz + rz * input.ix;

  if (player.seat && mag > 0.3 && player.sitAmt > 0.6) standUp();

  if (player.seat) {
    const seat = player.seat;
    const hx = seat.x - Math.sin(seat.rot) * 0.1, hz = seat.z - Math.cos(seat.rot) * 0.1;
    const follow = seat.boat && player.sitAmt > 0.7 ? 30 : 8; // ride along snugly once seated on the boat
    player.x = damp(player.x, hx, follow, dt);
    player.z = damp(player.z, hz, follow, dt);
    player.y = damp(player.y, seat.baseY, 12, dt);
    player.rot = turnTo(player.rot, seat.rot, dt * 6);
    player.move = damp(player.move, 0, 8, dt);
    player.sitAmt = damp(player.sitAmt, 1, 5, dt);
    poseHero(dt);
    return;
  }
  player.sitAmt = damp(player.sitAmt, 0, 7, dt);
  if (player.petting && petting(dt, input.mag)) { poseHero(dt); return; }
  player.petAmt = damp(player.petAmt, 0, 6, dt);

  // Standing somewhere you can't (the ice just thawed under you): head for the nearest shore.
  const canStand = walkable(player.x, player.z);
  if (canStand) wasOnIce = onIce(player.x, player.z);
  if (!canStand && !player.slide) {
    const p = nearestShore(player.x, player.z);
    player.slide = { x: p.x, z: p.z, minY: ICE_Y, rescue: true };
    if (!rescued && wasOnIce) { toast('The ice is thawing. You hurry back to the shore.'); rescued = true; }
  }
  if (player.slide) {
    const k = player.slide.rescue ? 2.2 : 10;
    player.x = damp(player.x, player.slide.x, k, dt);
    player.z = damp(player.z, player.slide.z, k, dt);
    if (player.slide.rescue) { player.move = 2.7; player.rot = turnTo(player.rot, Math.atan2(player.slide.x - player.x, player.slide.z - player.z), dt * 9); }
    const left = Math.hypot(player.slide.x - player.x, player.slide.z - player.z);
    if ((!player.slide.rescue && mag > 0.05) || left < 0.05) { player.slide = null; rescued = false; }
  }

  if (mag > 0.05 && !(player.slide && player.slide.rescue)) {
    const nx = player.x + dx * speed * dt, nz = player.z + dz * speed * dt;
    if (walkable(nx, player.z)) player.x = nx;
    if (walkable(player.x, nz)) player.z = nz;
    const p = { x: player.x, z: player.z };
    pushOut(p, 0.3);
    if (walkable(p.x, p.z)) { player.x = p.x; player.z = p.z; }
    player.rot = turnTo(player.rot, Math.atan2(dx, dz), dt * 9);
  }
  if (!(player.slide && player.slide.rescue)) player.move = damp(player.move, mag > 0.05 ? speed : 0, 8, dt);
  const floor = player.slide ? player.slide.minY : -99;
  player.y = damp(player.y, Math.max(groundAt(player.x, player.z), onIce(player.x, player.z) ? ICE_Y : -99, floor), 14, dt);
  poseHero(dt);
}

export function poseHero(dt) {
  const sa = player.sitAmt;
  const stride = Math.min(1, player.move / 2.7) * (1 - sa);
  const prevPhase = player.phase;
  player.phase += dt * player.move * STRIDE_RATE;
  // a foot lands each half cycle
  if (stride > 0.3 && Math.floor(player.phase / Math.PI) !== Math.floor(prevPhase / Math.PI)) {
    const foot = Math.floor(player.phase / Math.PI) % 2;
    stepListeners.forEach((fn) => fn(foot, player.x, player.z));
  }
  // how fast you are turning (for leaning into it), and how long you have stood still
  let dr = player.rot - player.lastRot; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  player.turn = damp(player.turn, dt > 0 ? dr / dt : 0, 8, dt); player.lastRot = player.rot;
  player.idleT = player.move < 0.15 && activity.free ? player.idleT + dt : 0;
  player.t = timeU.value;
  poseKid(hero, player, dt);
  // the face: content by default, beaming while petting
  hero.face.set(player.petAmt > 0.5 ? 'happy' : player.lieAmt > 0.5 ? 'sleepy' : 'calm');
  for (const h of hooks.pose) h(dt);
  hero.root.position.set(player.x, player.y, player.z);
  hero.root.rotation.y = player.rot;
  hero.root.updateMatrixWorld(true);
  hero.face.update(dt, timeU.value);
  hero.sway(dt, timeU.value, Math.min(1.5, windU.value));
}
