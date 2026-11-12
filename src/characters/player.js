// You: walking, sitting, the umbrella, the pose blend, and getting safely off thawing ice.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { lerp, damp, turnTo } from '../core/math.js';
import { SPAWN, LAKE, height, groundAt, walkable, onIce, nearestShore, ICE_Y } from '../core/shape.js';
import { std, enableShadows, timeU } from '../core/materials.js';
import { seats, pushOut, hooks } from '../core/state.js';
import { makePerson } from './rigs.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { camState, moveInput } from '../systems/input.js';
import { wx } from '../systems/weather.js';
import { toast } from '../ui/hud.js';

export const player = {
  x: SPAWN.x, z: SPAWN.z, y: height(SPAWN.x, SPAWN.z),
  rot: Math.atan2(LAKE.x - SPAWN.x, LAKE.z - SPAWN.z),
  phase: 0, move: 0, seat: null, sitAmt: 0, seatTop: 0.44, slide: null,
  petting: null, petTimer: 0, petAmt: 0, heartT: 0, umbAmt: 0,
};
export let hero = null;
let umbrella = null;
const stepListeners = new Set();
/** Called with (foot 0|1, x, z) each time a foot lands. */
export const onStep = (fn) => stepListeners.add(fn);

export function buildPlayer() {
  hero = makePerson();
  scene.add(hero.root);
  umbrella = new THREE.Group();
  const cloth = std('#2f6f73', { side: THREE.DoubleSide }), trim = std('#e9e2d0'), dark = std('#2b2622');
  umbrella.add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.2, 5).translate(0, 0.6, 0), dark),
    new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.34, 8, 1, true).translate(0, 1.36, 0), cloth),
    new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5).translate(0, 1.58, 0), trim),
    new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 4, 8, Math.PI).rotateZ(Math.PI).translate(0.05, 0, 0), dark)
  );
  umbrella.position.set(0, -0.64, 0);
  umbrella.rotation.order = 'ZYX'; // set to the inverse of the arm's rotation so the shaft stays upright
  umbrella.visible = false;
  enableShadows(umbrella);
  hero.arms[0].add(umbrella);
  registerSeatActions();
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
  player.phase += dt * (player.move * 2.6);
  // a foot lands each half cycle
  if (stride > 0.3 && Math.floor(player.phase / Math.PI) !== Math.floor(prevPhase / Math.PI)) {
    const foot = Math.floor(player.phase / Math.PI) % 2;
    stepListeners.forEach((fn) => fn(foot, player.x, player.z));
  }
  const s = Math.sin(player.phase);
  const legAmp = 0.55 * stride + (player.move > 3 ? 0.15 : 0) * (1 - sa);
  hero.legs[0].rotation.x = lerp(s * legAmp, -1.52, sa);
  hero.legs[1].rotation.x = lerp(-s * legAmp, -1.44, sa);
  hero.knees[0].rotation.x = lerp(Math.max(0, s) * 0.6 * stride, 1.5, sa);
  hero.knees[1].rotation.x = lerp(Math.max(0, -s) * 0.6 * stride, 1.38, sa);
  hero.arms[0].rotation.x = lerp(-s * legAmp * 0.8, -0.6, sa);
  hero.arms[1].rotation.x = lerp(s * legAmp * 0.8, -0.55, sa);
  hero.arms[0].rotation.z = lerp(-0.06, 0.12, sa); hero.arms[1].rotation.z = lerp(0.06, -0.12, sa);
  const breathe = Math.sin(timeU.value * 1.6) * 0.012 * (1 - stride);
  const walkY = Math.abs(Math.cos(player.phase)) * 0.05 * stride + breathe;
  hero.body.position.y = lerp(walkY, player.seatTop + 0.07 - 0.86 + breathe, sa);
  hero.body.rotation.x = lerp((player.move > 3 ? 0.12 : 0.03) * stride, -0.07, sa);
  hero.body.rotation.z = Math.sin(player.phase) * 0.025 * stride; // a little sway in the walk
  const pa = player.petAmt; // kneel on the left knee and stroke with one hand
  if (pa > 0.001) {
    const st = Math.sin(timeU.value * 4.2);
    hero.legs[1].rotation.x = lerp(hero.legs[1].rotation.x, -1.45, pa);
    hero.knees[1].rotation.x = lerp(hero.knees[1].rotation.x, 1.5, pa);
    hero.legs[0].rotation.x = lerp(hero.legs[0].rotation.x, 0.12, pa);
    hero.knees[0].rotation.x = lerp(hero.knees[0].rotation.x, 1.48, pa);
    hero.body.position.y = lerp(hero.body.position.y, 0.47 - 0.86, pa);
    hero.body.rotation.x = lerp(hero.body.rotation.x, 0.26, pa);
    hero.arms[1].rotation.x = lerp(hero.arms[1].rotation.x, -1.0 + st * 0.22, pa);
    hero.arms[1].rotation.z = lerp(hero.arms[1].rotation.z, -0.12, pa);
    hero.arms[0].rotation.x = lerp(hero.arms[0].rotation.x, -0.5, pa);
  }
  hero.head.rotation.x = 0.35 * pa;
  const covered = player.seat && player.seat.covered;
  player.umbAmt = damp(player.umbAmt, (wx.rain > 0.25 || wx.snow > 0.35 || wx.storm > 0.3) && !covered ? 1 : 0, 3, dt);
  const ua = player.umbAmt;
  umbrella.visible = ua > 0.02;
  if (umbrella.visible) {
    hero.arms[0].rotation.x = lerp(hero.arms[0].rotation.x, -0.8, ua);
    hero.arms[0].rotation.z = lerp(hero.arms[0].rotation.z, 0.32, ua);
    umbrella.rotation.set(-(hero.arms[0].rotation.x + hero.body.rotation.x), 0, -hero.arms[0].rotation.z);
    umbrella.scale.set(Math.max(ua, 0.05), 1, Math.max(ua, 0.05));
  }
  for (const h of hooks.pose) h(dt);
  hero.root.position.set(player.x, player.y, player.z);
  hero.root.rotation.y = player.rot;
}

