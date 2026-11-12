// Synthesised animal voices, placed in space, and when the cats and dogs use them.
import { rnd } from '../core/math.js';
import { clock } from '../core/clock.js';
import { hooks } from '../core/state.js';
import { voice, noise, playing } from '../systems/audio.js';
import { animals } from '../characters/animals.js';
import { player } from '../characters/player.js';

function env(g, t, peak, attack, release) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

export function bark(x, z, size = 1, times = 2) {
  const v = voice(x, z, 45, 0.9);
  if (!v) return;
  const { ctx, out } = v;
  for (let i = 0; i < times; i++) {
    const t = v.t + i * rnd(0.2, 0.28);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = rnd(340, 400) / size;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.12);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 820 / Math.sqrt(size); bp.Q.value = 1.2;
    const g = ctx.createGain(); env(g, t, 0.55, 0.012, 0.15);
    o.connect(bp).connect(g).connect(out);
    o.start(t); o.stop(t + 0.2);
    const n = noise(ctx), nb = ctx.createBiquadFilter(), ng = ctx.createGain();
    nb.type = 'bandpass'; nb.frequency.value = 1400; nb.Q.value = 0.8;
    env(ng, t, 0.18, 0.005, 0.07);
    n.connect(nb).connect(ng).connect(out);
    n.start(t, rnd(0, 3)); n.stop(t + 0.1);
  }
}
export function meow(x, z, pitch = 1) {
  const v = voice(x, z, 32, 0.9);
  if (!v) return;
  const { ctx, out, t } = v;
  const dur = rnd(0.5, 0.8), f = 560 * pitch * rnd(0.9, 1.1);
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f * 0.85, t);
  o.frequency.linearRampToValueAtTime(f * 1.25, t + dur * 0.35);
  o.frequency.linearRampToValueAtTime(f * 0.8, t + dur);
  const fm = ctx.createBiquadFilter(); fm.type = 'bandpass'; fm.Q.value = 3.5;
  fm.frequency.setValueAtTime(900, t);
  fm.frequency.linearRampToValueAtTime(1900, t + dur * 0.4);
  fm.frequency.linearRampToValueAtTime(1100, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(1.1, t + 0.06);
  g.gain.setValueAtTime(1.1, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(fm).connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}
export function quack(x, z, n = 2) {
  const v = voice(x, z, 40, 0.8);
  if (!v) return;
  const { ctx, out } = v;
  for (let i = 0; i < n; i++) {
    const t = v.t + i * rnd(0.17, 0.24);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(rnd(280, 310), t);
    o.frequency.exponentialRampToValueAtTime(235, t + 0.14);
    const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = 1150; b1.Q.value = 5;
    const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = 2300; b2.Q.value = 6;
    const g = ctx.createGain(); env(g, t, 1.4, 0.015, 0.15);
    o.connect(b1).connect(g); o.connect(b2).connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.2);
  }
}
export function hoot(x, z) {
  const v = voice(x, z, 80, 0.55);
  if (!v) return;
  const { ctx, out } = v;
  [[0, 0.34], [0.58, 0.16], [0.8, 0.5]].forEach(([dt, len]) => {
    const t = v.t + dt;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(375, t); o.frequency.linearRampToValueAtTime(345, t + len);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
    const vg = ctx.createGain(); vg.gain.value = 5;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.07);
    g.gain.setValueAtTime(0.5, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1);
    o.connect(g).connect(out);
    o.start(t); vib.start(t); o.stop(t + len + 0.15); vib.stop(t + len + 0.15);
  });
}
export function croak(x, z) {
  const v = voice(x, z, 32, 0.8);
  if (!v) return;
  const { ctx, out } = v;
  [0, 0.2].forEach((dt, i) => {
    const t = v.t + dt;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 105 + i * 35;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 2.5;
    const am = ctx.createGain(); am.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28;
    const lg = ctx.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    const g = ctx.createGain(); env(g, t, 0.7, 0.02, 0.16);
    o.connect(bp).connect(am).connect(g).connect(out);
    o.start(t); lfo.start(t); o.stop(t + 0.22); lfo.stop(t + 0.22);
  });
}
export function kraak(x, z) {
  const v = voice(x, z, 60, 0.7);
  if (!v) return;
  const { ctx, out, t } = v;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(360, t); o.frequency.exponentialRampToValueAtTime(230, t + 0.35);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 1.2;
  const g = ctx.createGain(); env(g, t, 0.6, 0.02, 0.35);
  o.connect(bp).connect(g).connect(out);
  o.start(t); o.stop(t + 0.42);
}
export function snort(x, z) {
  const v = voice(x, z, 45, 0.8);
  if (!v) return;
  const { ctx, out, t } = v;
  const n = noise(ctx), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1;
  env(g, t, 0.8, 0.02, 0.28);
  n.connect(bp).connect(g).connect(out);
  n.start(t, rnd(0, 3)); n.stop(t + 0.35);
}
export function plop(x, z, vol = 1) {
  const v = voice(x, z, 35, 0.5 * vol, 'ambience');
  if (!v) return;
  const { ctx, out, t } = v;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(rnd(700, 950), t); o.frequency.exponentialRampToValueAtTime(260, t + 0.09);
  const g = ctx.createGain(); env(g, t, 0.6, 0.005, 0.1);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 0.14);
  const n = noise(ctx), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.9;
  env(ng, t, 0.25, 0.005, 0.18);
  n.connect(bp).connect(ng).connect(out);
  n.start(t, rnd(0, 3)); n.stop(t + 0.22);
}

/** When cats and dogs speak up. */
export function initPetVoices() {
  const mem = new Map();
  hooks.frame.push((dt) => {
    for (const a of animals) {
      let m = mem.get(a);
      if (!m) { m = { near: false, idle: rnd(30, 90), prevState: a.state, prevPetted: false }; mem.set(a, m); }
      const dp = Math.hypot(a.x - player.x, a.z - player.z);
      if (a.kind === 'dog') {
        const size = a.scale || 1;
        if (a.state === 'follow' && m.prevState !== 'follow' && rnd() < 0.6) bark(a.x, a.z, size, 2);
        if (a.greet) { if (playing()) { bark(a.x, a.z, size, 3); a.greet = false; } else if (clock.elapsed > 25) a.greet = false; }
        m.idle -= dt;
        if (m.idle <= 0) { if (dp < 30 && !a.petted && a.state !== 'goal') bark(a.x, a.z, size, rnd() < 0.5 ? 1 : 2); m.idle = rnd(40, 100); }
      } else {
        if (dp < 4 && !m.near) { m.near = true; if (rnd() < 0.65) meow(a.x, a.z); }
        if (dp > 7) m.near = false;
        if (m.prevPetted && !a.petted && rnd() < 0.5) meow(a.x, a.z, 1.1);
        m.idle -= dt;
        if (m.idle <= 0) { if (dp < 18 && a.state !== 'shelter') meow(a.x, a.z); m.idle = rnd(50, 120); }
      }
      m.prevState = a.state;
      m.prevPetted = a.petted;
    }
  });
}
