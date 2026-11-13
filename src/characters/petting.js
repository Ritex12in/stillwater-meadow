// Petting (F): walk up, kneel, stroke. Hearts, purring or happy panting, and a growing bond.
import { damp, turnTo, rnd } from '../core/math.js';
import { walkable, groundAt } from '../core/shape.js';
import { player } from './player.js';
import { animals } from './animals.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { audio, voice, playing } from '../systems/audio.js';
import { spawnHeart } from '../world/effects.js';

const PET_RANGE = 2.1, PET_SECONDS = 5;

function nearestAnimal(tame = true) {
  let best = null, bd = PET_RANGE;
  for (const a of animals) {
    if (tame && !a.tamed) continue; // an animal that isn't yours never blocks petting one that is
    const d = Math.hypot(a.x - player.x, a.z - player.z);
    if (d < bd) { bd = d; best = a; }
  }
  return best && { a: best, d: bd };
}

// Purr (cats) or a soft "boof" then happy panting (dogs).
function petSound(a) {
  if (!playing()) return null;
  const v = voice(a.x, a.z, 20, 1, 'animals');
  if (!v) return null;
  const { ctx, out } = v, now = ctx.currentTime;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, now);
  env.connect(out);
  const nodes = [];
  if (a.kind === 'cat') {
    const src = ctx.createBufferSource(); src.buffer = audio.brownBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const am = ctx.createGain(); am.gain.value = 0.55;
    const flutter = ctx.createOscillator(); flutter.frequency.value = 24;
    const flutterG = ctx.createGain(); flutterG.gain.value = 0.45;
    flutter.connect(flutterG).connect(am.gain);
    const breath = ctx.createOscillator(); breath.frequency.value = 0.42;
    const breathG = ctx.createGain(); breathG.gain.value = 0.2;
    breath.connect(breathG).connect(am.gain);
    src.connect(lp).connect(am).connect(env);
    env.gain.exponentialRampToValueAtTime(0.4, now + 0.8);
    nodes.push(src, flutter, breath);
  } else {
    if (rnd() < 0.7) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(240, now + 0.05);
      o.frequency.exponentialRampToValueAtTime(130, now + 0.2);
      og.gain.setValueAtTime(0.0001, now + 0.05);
      og.gain.linearRampToValueAtTime(0.18, now + 0.07);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      o.connect(og).connect(out);
      o.start(now + 0.05); o.stop(now + 0.3);
    }
    const src = ctx.createBufferSource(); src.buffer = audio.whiteBuf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.4;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const pant = ctx.createOscillator(); pant.frequency.value = 3.4;
    const pantG = ctx.createGain(); pantG.gain.value = 0.5;
    pant.connect(pantG).connect(am.gain);
    src.connect(bp).connect(am).connect(env);
    env.gain.setValueAtTime(0.0001, now + 0.3);
    env.gain.exponentialRampToValueAtTime(0.09, now + 0.9);
    nodes.push(src, pant);
  }
  nodes.forEach((n) => n.start(now));
  return {
    stop() {
      const t = ctx.currentTime;
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(Math.max(env.gain.value, 0.0001), t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      nodes.forEach((n) => n.stop(t + 0.7));
    },
  };
}

export function startPet(a) {
  if (player.petting === a) { player.petTimer = PET_SECONDS; return; }
  if (!activity.enter('pet')) return;
  player.petting = a;
  player.petTimer = PET_SECONDS;
  player.heartT = 0.35;
  player.slide = null;
  a.petted = true;
  a.state = 'petted';
  a.speed = 0;
  a.purr = petSound(a);
}
export function endPet() {
  const a = player.petting;
  if (!a) return;
  player.petting = null;
  a.petted = false;
  activity.leave('pet');
  if (a.purr) { a.purr.stop(); a.purr = null; }
  if (a.kind === 'dog') { a.state = 'follow'; a.timer = rnd(20, 40) * (1 + a.bond * 2); }
  else { a.state = 'rest'; a.timer = rnd(6, 12) * (1 + a.bond * 2); }
}

/** Runs from the player update while petting; returns false once the session ends. */
export function updatePetting(dt, mag) {
  const a = player.petting;
  const d = Math.hypot(a.x - player.x, a.z - player.z);
  if (activity.is('pet')) player.petTimer -= dt; // the timer pauses while a dialog is open on top
  if ((mag > 0.3 && !activity.locksMovement()) || player.petTimer <= 0 || d > 3.5 || player.seat) { endPet(); return false; }
  a.bond = Math.min(1, a.bond + dt * 0.06);
  const ang = Math.atan2(a.x - player.x, a.z - player.z);
  player.rot = turnTo(player.rot, ang, dt * 6);
  const reach = a.kind === 'dog' ? 0.95 : 0.8;
  if (d > reach + 0.04) {
    const stepLen = Math.min(d - reach, dt * 1.6);
    const nx = player.x + Math.sin(ang) * stepLen, nz = player.z + Math.cos(ang) * stepLen;
    if (walkable(nx, nz)) { player.x = nx; player.z = nz; }
    player.move = damp(player.move, 1.4, 8, dt);
  } else {
    player.move = damp(player.move, 0, 8, dt);
  }
  player.y = damp(player.y, groundAt(player.x, player.z), 14, dt);
  player.petAmt = damp(player.petAmt, d < reach + 0.3 ? 1 : 0, 5, dt);
  player.heartT -= dt;
  if (player.heartT <= 0 && player.petAmt > 0.6) { spawnHeart(a); player.heartT = rnd(0.35, 0.6); }
  return true;
}

export function registerPetting() {
  registerAction({
    id: 'pet-more', key: 'KeyF', keyLabel: 'F',
    available: () => activity.is('pet'),
    label: () => 'Keep petting', score: () => 1000,
    run: () => { player.petTimer = PET_SECONDS; },
  });
  registerAction({
    id: 'pet', key: 'KeyF', keyLabel: 'F',
    available: () => activity.free && nearestAnimal(),
    label: () => { const n = nearestAnimal(); return `Pet ${n.a.name || 'the ' + n.a.kind}`; },
    score: () => -nearestAnimal().d,
    run: () => { const n = nearestAnimal(); if (n) startPet(n.a); },
  });
  registerAction({
    id: 'pet-untamed', key: 'KeyF', keyLabel: 'F', score: () => -50,
    available: () => activity.free && !nearestAnimal() && nearestAnimal(false),
    disabled: () => true,
    label: () => 'Not tame yet: try a fish (T)',
    run: () => {},
  });
}
