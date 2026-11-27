// You, off the ground: jumping, falling, landing, climbing, sliding and gliding.
//
// The land is a surface with no sheer walls or overhangs: a "cliff" is ground too steep to walk
// (core/shape.js MAX_SLOPE, about 51 degrees; an eighth of the land, in faces often 60 m high and
// more). So:
//   jump    Space. A short crouch, then up; a running jump goes flatter and further.
//   fall    In the air you fall, steering a little. How you land goes by how far you fell: a soft
//           landing, a heavy one (a hand to the ground), or a roll. Nothing hurts you.
//   climb   Push into a steep face that rises before you and you take hold of it: W up, S down,
//           A and D sideways, Space to jump off. Walk out at the top or the bottom.
//   slide   Push over the edge of a steep face that drops before you, or land on one, and you slide
//           down it: A and D steer, Space jumps off it, pushing back into the face takes hold of it.
//   glide   With the glider (features/glider.js), Space in the air with room below opens it: A and D
//           turn, W dives, S flares, Space folds it again. An updraft under floating islands lifts you.
// Water: you splash, and are back on the shore.
//
// All of it is the player's alone: `walkable` and the others' rules are as they were. `player.mode`
// is null on the ground, else 'air', 'climb', 'slide', 'glide' or 'top' (heaving over the top of a
// climb); while it is set the activity is 'aloft', so nothing else can be begun. Everything runs
// from `dt`, so the tests' tick drives it. The poses: characters/movepose.js.
import { damp, clamp, turnTo } from '../core/math.js';
import { heightAt, groundAt, walkable, onIce, slopeAt, MAX_SLOPE, landNear, nearestShore } from '../core/shape.js';
import { pushOut } from '../core/state.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { camState } from '../systems/input.js';
import { toast, anyPanelOpen } from '../ui/hud.js';

export const MOVES = {
  G: 18,            // gravity, m/s2 (brisker than the world's: a jump is over in 0.7 s)
  JUMP: 6.2,        // the speed you leave the ground at (1.07 m high)
  CROUCH: 0.09,     // s between the key and leaving the ground
  HEAVY: 2.2, ROLL: 6, // a fall of more than this many metres lands heavily; rolls
  CLIMB: 1.25,      // m/s along the face
  SLIDE: 7.5,       // m/s along the face, at most
  PUSH: 0.22,       // s you must push into a steep face before you take hold of it or go over its edge
  GLIDE: 7, SINK: 1.5, DIVE: 11.5, DIVE_SINK: 4.6, FLARE: 4.6, FLARE_SINK: 1.0, TURN: 1.5, // the glider
  ROOM: 2,          // m of air below before the glider will open
  LIFT: 8,          // m/s an updraft carries you up
};

const fresh = () => ({ ox: 0, oy: 0, oz: 0, crouch: 0, air: 0, vy: 0, run: 0, long: 0, land: 0, heavy: 0, roll: -1, climb: 0, cphase: 0, ctilt: 0.5, clook: 1, cmove: 0, cside: 0, shake: 0, hang: 0, top: -1, slide: 0, glide: 0, bank: 0, pitch: 0, open: 1 });
/** What the poses read (characters/movepose.js). */
export const mv = fresh();
const S = { vy: 0, ax: 0, az: 0, peak: 0, crouchT: 0, pushT: 0, landT: 0, landDur: 0, lock: 0, rollT: -1, rollDir: null, v: 0, topT: -1, top: null, restT: 0, shakeT: -1, fallT: 0, launch: null };
let P = null; // (the player: characters/player.js hands it over, so neither module needs the other to load first)
let hasGlider = () => false, islandTops = () => [], fx = { puff() {}, wing() {}, splash() {} }, onFall = () => {};
/** The glider, the islands and the dust come from outside (features/glider.js, world/landmarks.js). */
export function setMovesWorld(o) { if (o.hasGlider) hasGlider = o.hasGlider; if (o.islandTops) islandTops = o.islandTops; if (o.fx) Object.assign(fx, o.fx); if (o.onFall) onFall = o.onFall; }

const water = (x, z) => heightAt(x, z) <= 0.22 && !onIce(x, z) && groundAt(x, z) <= heightAt(x, z) + 0.01; // (not ice, a jetty, a bridge or a stepping stone)
const steep = (x, z) => heightAt(x, z) > 0.22 && slopeAt(x, z) >= MAX_SLOPE;
const up = { x: 0, z: 1, s: 0 };
/** The way uphill at a spot (`up.x`, `up.z`, a unit) and how steep it is (`up.s`, m per m). */
function uphill(x, z) {
  const e = 0.6, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e), s = Math.hypot(gx, gz);
  up.s = s; up.x = s > 1e-4 ? gx / s : 0; up.z = s > 1e-4 ? gz / s : 1;
  return up;
}

function setMode(m) {
  P.mode = m;
  if (m) { activity.enter('aloft'); P.move = 0; P.slide = null; } else activity.leave('aloft');
}
/** Back to standing where you are (travelling, sitting down, a test's teleport). */
export function resetMoves() {
  if (!P) return;
  if (P.mode) setMode(null);
  Object.assign(mv, fresh());
  Object.assign(S, { vy: 0, ax: 0, az: 0, crouchT: 0, pushT: 0, landT: 0, lock: 0, rollT: -1, topT: -1, top: null, v: 0, fallT: 0, launch: null });
  fx.wing(false);
}

// ── leaving the ground ──
function launch(vy, ax, az) {
  S.vy = vy; S.ax = ax; S.az = az; S.peak = P.y; S.fallT = 0;
  if (P.floor) P.floor = null;
  setMode('air');
}
/** Space: jump, jump off, open or fold the glider. Returns whether it did anything. */
export function pressJump() {
  if (!P || anyPanelOpen()) return false;
  if (P.mode === 'air') {
    if (!hasGlider() || P.y - floorUnder(P.x, P.z) < MOVES.ROOM) return false;
    P.mode = 'glide'; mv.open = 0; S.v = Math.max(3, Math.hypot(S.ax, S.az)); S.vy = Math.max(S.vy, -3.5); // (the wing catches you)
    if (Math.hypot(S.ax, S.az) > 0.5) P.rot = Math.atan2(S.ax, S.az);
    fx.wing(true);
    return true;
  }
  if (P.mode === 'glide') { P.mode = 'air'; S.ax = Math.sin(P.rot) * S.v; S.az = Math.cos(P.rot) * S.v; S.peak = P.y; fx.wing(false); return true; }
  if (P.mode === 'climb') { // off the face, turning to face away from it
    const u = uphill(P.x, P.z);
    P.rot = Math.atan2(-u.x, -u.z);
    launch(3.6, -u.x * 4.4, -u.z * 4.4);
    return true;
  }
  if (P.mode === 'slide') { const u = uphill(P.x, P.z), h = S.v / Math.sqrt(1 + u.s * u.s); launch(5.2 - Math.min(3, h * u.s * 0.35), -u.x * (h + 2.5), -u.z * (h + 2.5)); return true; }
  if (P.mode || !activity.free || P.seat || P.skating || (P.slide && P.slide.rescue) || S.crouchT > 0 || S.lock > 0) return false;
  S.crouchT = MOVES.CROUCH; // (the crouch first: updateMoves lets go of the ground when it is done)
  return true;
}

/** The ground or the floating island's top under a spot. */
function floorUnder(x, z) {
  let g = groundAt(x, z);
  for (const f of islandTops()) if (Math.hypot(x - f.x, z - f.z) < f.r && P.y >= f.y - 0.6) g = Math.max(g, f.y);
  return g;
}
function land(x, z, g) {
  const fell = S.peak - g, f = islandTops().find((q) => Math.hypot(x - q.x, z - q.z) < q.r && Math.abs(g - q.y) < 0.01) || null;
  P.y = g; S.vy = 0;
  fx.wing(false);
  if (!f && water(x, z)) return splash(x, z);
  if (!f && steep(x, z)) { // a steep face: take hold of it if you are pushing into it, else slide down it
    const u = uphill(x, z), into = S.in ? S.in.x * u.x + S.in.z * u.z : 0;
    fx.puff(x, g, z, 3);
    if (into > 0.3) { P.mode = 'climb'; P.rot = Math.atan2(u.x, u.z); mv.cphase = 0; return; }
    P.mode = 'slide'; S.v = clamp(Math.hypot(S.ax, S.az) * 0.6 + Math.max(0, -S.vy) * 0.25, 1.5, MOVES.SLIDE);
    return;
  }
  const speed = Math.hypot(S.ax, S.az), wasGlide = P.mode === 'glide';
  setMode(null);
  if (f) P.floor = f;
  P.move = Math.min(speed, 5.4); // (a running landing runs on)
  if (!wasGlide && fell > MOVES.ROLL && !f) { S.rollT = 0; S.rollDir = speed > 0.5 ? { x: S.ax / speed, z: S.az / speed } : { x: Math.sin(P.rot), z: Math.cos(P.rot) }; S.lock = 0.95; activity.enter('aloft'); fx.puff(x, g, z, 7); }
  else if (!wasGlide && fell > MOVES.HEAVY) { S.landT = 0; S.landDur = 0.62; mv.heavy = 1; S.lock = 0.42; P.move = 0; fx.puff(x, g, z, 5); }
  else { S.landT = 0; S.landDur = wasGlide ? 0.3 : 0.24; mv.heavy = 0; if (fell > 0.5) fx.puff(x, g, z, 2); }
  mv.land = 1;
}
function splash(x, z) {
  fx.splash(x, z);
  setMode(null);
  const near = nearestShore(x, z), p = walkable(near.x, near.z) ? near : landNear(x, z), far = Math.hypot(p.x - x, p.z - z);
  if (far < 14) { P.y = Math.max(P.y, -0.4); P.slide = { x: p.x, z: p.z, minY: -0.4, rescue: true }; } // (a few strokes to the bank)
  else { P.x = p.x; P.z = p.z; P.y = groundAt(p.x, p.z); }
  toast(far < 14 ? 'Splash! You scramble out onto the bank.' : 'Splash! You swim back to the shore.', 3);
}

// ── each frame ──
/**
 * Move you if you are off the ground (or about to be). `c`: { dx, dz (the way you push, in the
 * world), mag, speed, ix, iz }. Returns true when it has moved you (the walking code then stands down).
 */
export function updateMoves(player, dt, c) {
  P = player;
  dt = Math.min(dt, 0.05);
  S.in = c.mag > 0.05 ? { x: c.dx, z: c.dz } : null;
  ease(dt);
  if (!P.mode) return ground(dt, c);
  if (P.mode === 'air') air(dt, c);
  else if (P.mode === 'glide') glide(dt, c);
  else if (P.mode === 'climb') climb(dt, c);
  else if (P.mode === 'slide') slide(dt, c);
  else if (P.mode === 'top') topOut(dt);
  return true;
}
/** The poses' amounts follow what you are doing. */
function ease(dt) {
  const m = P.mode, k = (cur, on, rate) => damp(cur, on ? 1 : 0, rate, dt);
  mv.crouch = damp(mv.crouch, S.crouchT > 0 ? 1 : 0, S.crouchT > 0 ? 30 : 18, dt);
  mv.air = k(mv.air, m === 'air', m === 'air' ? 16 : 20);
  mv.vy = S.vy;
  mv.run = damp(mv.run, m === 'air' ? clamp((Math.hypot(S.ax, S.az) - 2) / 3, 0, 1) : mv.run, 10, dt);
  mv.long = damp(mv.long, m === 'air' && S.fallT > 0.75 ? 1 : 0, 4, dt);
  mv.climb = k(mv.climb, m === 'climb', 12);
  mv.slide = k(mv.slide, m === 'slide', 10);
  mv.glide = k(mv.glide, m === 'glide', 12);
  if (m === 'glide') mv.open = Math.min(1, mv.open + dt / 0.55);
  // a landing: full at once, then eased away over its time
  if (mv.land > 0) { S.landT += dt; mv.land = S.landT >= S.landDur ? 0 : 1 - (S.landT / S.landDur) ** 1.6; if (mv.land === 0) mv.heavy = 0; }
  if (S.lock > 0) S.lock -= dt;
  // how far the figure is drawn from where you are (a climber stands off the face)
  const off = P.mode === 'climb' && S.off ? S.off : null;
  mv.ox = damp(mv.ox, off ? off.x : 0, 10, dt); mv.oy = damp(mv.oy, off ? off.y : 0, 10, dt); mv.oz = damp(mv.oz, off ? off.z : 0, 10, dt);
}

function ground(dt, c) {
  // rolling out of a long fall: carried forward while it lasts
  if (S.rollT >= 0) {
    S.rollT += dt / 0.95; mv.roll = Math.min(1, S.rollT);
    const go = 3.2 * (1 - S.rollT) * dt, nx = P.x + S.rollDir.x * go, nz = P.z + S.rollDir.z * go;
    if (S.rollT < 0.75 && walkable(nx, nz)) { P.x = nx; P.z = nz; }
    P.y = floorNow(); P.move = 0;
    if (S.rollT >= 1) { S.rollT = -1; mv.roll = -1; activity.leave('aloft'); }
    return true;
  }
  if (S.lock > 0 && mv.heavy) { P.move = 0; P.y = floorNow(); return true; } // (a heavy landing: a moment down before you move)
  if (S.crouchT > 0) {
    S.crouchT -= dt;
    if (S.crouchT <= 0) { const run = c.mag > 0.05 ? c.speed : 0; launch(MOVES.JUMP - (run > 4 ? 0.5 : 0), c.dx * run, c.dz * run); return true; }
    return false; // (still on the ground: you may walk through the crouch)
  }
  // pushing into ground too steep to walk: up it, take hold; down it, over the edge and slide
  if (c.mag > 0.05 && activity.free && !P.seat && !P.floor && !P.skating && !(P.slide && P.slide.rescue) && walkable(P.x, P.z)) {
    const nx = P.x + c.dx * 0.45, nz = P.z + c.dz * 0.45;
    if (steep(nx, nz) && !water(P.x + c.dx * 1.5, P.z + c.dz * 1.5)) {
      S.pushT += dt;
      if (S.pushT > MOVES.PUSH) {
        S.pushT = 0;
        const u = uphill(nx, nz), rising = u.x * c.dx + u.z * c.dz;
        if (Math.abs(rising) > 0.25) {
          P.x = nx; P.z = nz; P.y = groundAt(nx, nz);
          setMode(rising > 0 ? 'climb' : 'slide');
          if (rising > 0) { P.rot = Math.atan2(u.x, u.z); mv.cphase = 0; } else { S.v = 1.5; S.peak = P.y; }
          return true;
        }
      }
    } else S.pushT = 0;
  } else S.pushT = 0;
  return false;
}
const floorNow = () => (P.floor ? P.floor.y : groundAt(P.x, P.z));

function air(dt, c) {
  S.vy -= MOVES.G * dt;
  if (S.vy < 0) S.fallT += dt;
  if (S.fallT > 0.9 && !S.told) { S.told = true; onFall(); } else if (S.vy >= 0) S.told = false; // (once a fall)
  // a little steering
  if (c.mag > 0.05) { const sp = Math.max(Math.hypot(S.ax, S.az), 2.7); S.ax = damp(S.ax, c.dx * sp, 1.6, dt); S.az = damp(S.az, c.dz * sp, 1.6, dt); }
  if (Math.hypot(S.ax, S.az) > 0.6) P.rot = turnTo(P.rot, Math.atan2(S.ax, S.az), dt * 7);
  fly(dt, S.ax, S.az);
}
/** Carry you through the air a frame; land if the ground comes up. */
function fly(dt, vx, vz) {
  const p = { x: P.x + vx * dt, z: P.z + vz * dt };
  if (P.y - groundAt(p.x, p.z) < 5) pushOut(p, 0.3); // (round trunks and walls when low; over them when high)
  P.x = p.x; P.z = p.z;
  P.y += S.vy * dt;
  if (P.y > S.peak) S.peak = P.y;
  const g = floorUnder(P.x, P.z);
  if (P.y <= g) land(P.x, P.z, g);
}

function glide(dt, c) {
  mv.bank = damp(mv.bank, c.ix, 4, dt);
  mv.pitch = damp(mv.pitch, c.iz, 4, dt);
  P.rot -= mv.bank * MOVES.TURN * dt;
  const dive = Math.max(0, mv.pitch), flare = Math.max(0, -mv.pitch);
  S.v = damp(S.v, MOVES.GLIDE + (MOVES.DIVE - MOVES.GLIDE) * dive - (MOVES.GLIDE - MOVES.FLARE) * flare, 1.4, dt);
  let sink = -(MOVES.SINK + (MOVES.DIVE_SINK - MOVES.SINK) * dive - (MOVES.SINK - MOVES.FLARE_SINK) * flare);
  // an updraft: the ring of light under floating islands carries you up past their top
  for (const f of islandTops()) if (Math.hypot(P.x - f.base.x, P.z - f.base.z) < 4.5 && P.y < f.y + 5) sink = MOVES.LIFT;
  S.vy = damp(S.vy, sink, sink > 0 ? 2.5 : 3.5, dt);
  S.ax = Math.sin(P.rot) * S.v; S.az = Math.cos(P.rot) * S.v;
  S.peak = P.y; // (a glide is never a fall)
  fly(dt, S.ax, S.az);
}

function climb(dt, c) {
  const u = uphill(P.x, P.z);
  if (u.s < MAX_SLOPE * 0.9 && walkable(P.x, P.z)) { setMode(null); return; } // (the face has eased under you)
  P.rot = turnTo(P.rot, Math.atan2(u.x, u.z), dt * 8);
  mv.ctilt = damp(mv.ctilt, clamp(Math.PI / 2 - Math.atan(u.s), 0.12, 0.7), 8, dt); // (the body lies along the face: upright on a wall, forward on a slope)
  { const n = 0.34 / Math.sqrt(1 + u.s * u.s); S.off = { x: -u.x * u.s * n, y: n - 0.06, z: -u.z * u.s * n }; } // (and stands off it, out along the face's normal: the feet and hands are on it, not the chest in it)
  const moving = c.mag > 0.05, k = 1 / Math.sqrt(1 + u.s * u.s);
  mv.cmove = damp(mv.cmove, moving ? 1 : 0, 9, dt);
  mv.cside = damp(mv.cside, moving ? clamp(c.ix * (Math.abs(c.ix) > Math.abs(c.iz) ? 1 : 0.4), -1, 1) : 0, 8, dt);
  mv.clook = damp(mv.clook, c.iz < -0.3 ? -1 : 1, 6, dt);
  // resting: the body hangs; now and then a hand shakes out
  S.restT = moving ? 0 : S.restT + dt;
  mv.hang = damp(mv.hang, S.restT > 0.6 ? 1 : 0, 3, dt);
  if (S.shakeT < 0 && S.restT > 4 && Math.sin(P.t * 0.9) > 0.995) S.shakeT = 0;
  if (S.shakeT >= 0) { S.shakeT += dt / 1.3; mv.shake = S.shakeT; if (S.shakeT >= 1 || moving) { S.shakeT = -1; mv.shake = 0; } }
  if (!moving) return;
  // up and down along the fall line, sideways along the level
  const along = c.iz * MOVES.CLIMB * k * dt, across = c.ix * MOVES.CLIMB * 0.8 * dt;
  const nx = P.x + u.x * along - u.z * across, nz = P.z + u.z * along + u.x * across;
  mv.cphase += (Math.abs(c.iz) * MOVES.CLIMB + Math.abs(c.ix) * MOVES.CLIMB * 0.8) * dt * 4.6;
  if (water(nx, nz)) return;
  if (walkable(nx, nz)) {
    if (c.iz > 0.2 && heightAt(nx, nz) >= P.y - 0.05) { // the top: heave over it, onto the level beyond
      let tx = nx, tz = nz;
      for (const r of [0.9, 0.6, 0.3]) if (walkable(nx + u.x * r, nz + u.z * r)) { tx = nx + u.x * r; tz = nz + u.z * r; break; }
      S.top = { x0: P.x, z0: P.z, y0: P.y, x: tx, z: tz }; S.topT = 0; mv.top = 0; P.mode = 'top';
      return;
    }
    P.x = nx; P.z = nz; P.y = groundAt(nx, nz); setMode(null); // (the foot of it, or a ledge to the side)
    return;
  }
  P.x = nx; P.z = nz; P.y = groundAt(nx, nz);
  if (Math.sin(mv.cphase) > 0.98 && c.iz > 0.2 && !S.peb) { S.peb = true; fx.puff(P.x - u.x * 0.3, P.y + 0.9, P.z - u.z * 0.3, 1); } else if (Math.sin(mv.cphase) < 0) S.peb = false; // (grit from a hold, now and then)
}
function topOut(dt) {
  S.topT += dt / 0.85; const p = Math.min(1, S.topT), q = p * p * (3 - 2 * p), T = S.top;
  mv.top = p;
  P.x = T.x0 + (T.x - T.x0) * q; P.z = T.z0 + (T.z - T.z0) * q;
  P.y = T.y0 + (groundAt(T.x, T.z) - T.y0) * q;
  if (p >= 1) { mv.top = -1; S.topT = -1; P.y = groundAt(P.x, P.z); setMode(null); }
}

function slide(dt, c) {
  const u = uphill(P.x, P.z);
  if (walkable(P.x, P.z)) { // the foot of the face: on your feet, running it off
    const h = S.v / Math.sqrt(1 + u.s * u.s);
    S.ax = -u.x * h; S.az = -u.z * h; S.peak = P.y;
    setMode(null); P.move = Math.min(h, 5.4); S.landT = 0; S.landDur = 0.3; mv.land = 1; mv.heavy = 0;
    return;
  }
  if (water(P.x, P.z)) { splash(P.x, P.z); return; }
  // pushing back into the face: take hold of it
  if (S.in && S.in.x * u.x + S.in.z * u.z > 0.6) { P.mode = 'climb'; mv.cphase = 0; fx.puff(P.x, P.y, P.z, 2); return; }
  S.v = damp(S.v, MOVES.SLIDE * clamp(u.s / 1.6, 0.6, 1), 1.3, dt);
  const k = 1 / Math.sqrt(1 + u.s * u.s), side = c.ix * 2.2;
  mv.bank = damp(mv.bank, c.ix, 5, dt);
  // (steered across the face as the camera sees it: right of the way down)
  const rx = Math.cos(camState.yaw), rz = -Math.sin(camState.yaw), ax = -u.z, az = u.x, sgn = rx * ax + rz * az >= 0 ? 1 : -1;
  const p = { x: P.x - u.x * S.v * k * dt + ax * sgn * side * dt, z: P.z - u.z * S.v * k * dt + az * sgn * side * dt };
  pushOut(p, 0.3);
  P.x = p.x; P.z = p.z; P.y = groundAt(P.x, P.z);
  P.rot = turnTo(P.rot, Math.atan2(-u.x, -u.z), dt * 7);
  S.dust = (S.dust || 0) + dt * S.v;
  if (S.dust > 2.2) { S.dust = 0; fx.puff(P.x + u.x * 0.3, P.y + 0.1, P.z + u.z * 0.3, 1); }
}

/** For tests and tools: lift you `h` metres and let go (moving at `speed` m/s the way you face). */
export function dropFrom(h, speed = 0) { if (!P || P.mode) return; P.y += h; launch(0, Math.sin(P.rot) * speed, Math.cos(P.rot) * speed); S.peak = P.y; }
/** For tests and tools: what you are doing, and how it stands. */
export const movesView = () => ({ mode: P ? P.mode || null : null, vy: S.vy, speed: P && (P.mode === 'air' || P.mode === 'glide') ? Math.hypot(S.ax, S.az) : S.v, peak: S.peak, crouch: S.crouchT > 0, landing: mv.land > 0, heavy: mv.heavy > 0, rolling: S.rollT >= 0, pose: Object.assign({}, mv) });

export function initMoves(player) {
  P = player; P.mode = null;
  const label = () => (P.mode === 'air' ? 'Open the glider' : P.mode === 'glide' ? 'Fold the glider' : P.mode === 'climb' ? 'Jump off' : P.mode === 'slide' ? 'Jump clear' : 'Jump');
  registerAction({
    id: 'jump', key: 'Space', keyLabel: 'Space', score: () => (P.mode ? 40 : -1000), quiet: () => !P.mode,
    available: () => !anyPanelOpen() && (P.mode ? P.mode !== 'top' && (P.mode !== 'air' || (hasGlider() && P.y - floorUnder(P.x, P.z) >= MOVES.ROOM)) : activity.free && !P.seat && !P.skating && S.lock <= 0 && S.rollT < 0),
    label, run: pressJump,
  });
}
