// The audio mixer. Everything plays through one of four buses so each can have its own volume:
//   ambience (wind, water, rain, birds, footsteps)   animals (voices, purring)   music   ui
// The context is created on the first user gesture, suspended while the tab is hidden, and
// faded in and out when sound is switched on or off.
import { clamp, rnd } from '../core/math.js';

export const audio = {
  ctx: null,
  enabled: false,
  master: null,
  buses: {},
  volumes: { master: 0.9, ambience: 1, animals: 1, music: 0.6, ui: 0.8 },
  whiteBuf: null,
  brownBuf: null,
  listener: { x: 0, z: 0, yaw: 0 },   // updated from the camera each frame
};
const listeners = new Set();
/** Called with `enabled` whenever sound is switched on or off. */
export const onSoundChange = (fn) => listeners.add(fn);

function noiseBuffer(ctx, brown) {
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}

function createContext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  const ctx = new AC();
  audio.ctx = ctx;
  audio.master = ctx.createGain();
  audio.master.gain.value = 0;
  audio.master.connect(ctx.destination);
  for (const name of ['ambience', 'animals', 'music', 'ui']) {
    const g = ctx.createGain();
    g.gain.value = audio.volumes[name];
    g.connect(audio.master);
    audio.buses[name] = g;
  }
  audio.whiteBuf = noiseBuffer(ctx, false);
  audio.brownBuf = noiseBuffer(ctx, true);
  buildBeds();
  return true;
}

/** Turn all sound on or off. Must first be called from a click or key press. */
export function setSoundEnabled(on) {
  if (on && !audio.ctx && !createContext()) return false;
  if (!audio.ctx) return false;
  audio.enabled = on;
  if (on) audio.ctx.resume();
  const now = audio.ctx.currentTime, g = audio.master.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(on ? audio.volumes.master : 0, now + 1.2);
  listeners.forEach((fn) => fn(on));
  return true;
}

export function setVolume(name, v) {
  audio.volumes[name] = clamp(v, 0, 1);
  if (!audio.ctx) return;
  if (name === 'master') { if (audio.enabled) audio.master.gain.setTargetAtTime(audio.volumes.master, audio.ctx.currentTime, 0.05); }
  else if (audio.buses[name]) audio.buses[name].gain.setTargetAtTime(audio.volumes[name], audio.ctx.currentTime, 0.05);
}

// Pause audio with the tab; resume only if sound was on.
document.addEventListener('visibilitychange', () => {
  if (!audio.ctx) return;
  if (document.hidden) audio.ctx.suspend();
  else if (audio.enabled) audio.ctx.resume();
});

export const playing = () => !!(audio.ctx && audio.enabled);
export const noise = (ctx) => { const s = ctx.createBufferSource(); s.buffer = audio.whiteBuf; return s; };

/**
 * A gain node panned and faded for a sound at (x, z), heard from the listener.
 * Returns null when sound is off or the source is out of range.
 */
export function voice(x, z, range = 40, vol = 1, bus = 'animals') {
  if (!playing()) return null;
  const L = audio.listener;
  const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
  const near = clamp(1 - d / range, 0, 1);
  if (near <= 0.01) return null;
  const pan = d > 0.01 ? clamp((dx * Math.cos(L.yaw) - dz * Math.sin(L.yaw)) / d, -1, 1) * 0.85 : 0;
  const ctx = audio.ctx, g = ctx.createGain();
  g.gain.value = near * near * vol;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(audio.buses[bus]); }
  else g.connect(audio.buses[bus]);
  return { ctx, out: g, t: ctx.currentTime + 0.02 };
}

/** Short filtered noise burst: splashes, footsteps, crackles. */
export function burst(x, z, { range = 25, vol = 0.12, type = 'bandpass', freq = 900, q = 0.9, attack = 0.02, release = 0.33, bus = 'ambience' } = {}) {
  const v = voice(x, z, range, vol, bus);
  if (!v) return;
  const { ctx, out, t } = v;
  const src = noise(ctx), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(1, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  src.connect(f).connect(g).connect(out);
  src.start(t, rnd(0, 3)); src.stop(t + attack + release + 0.05);
}

// ── Ambient beds: wind, lapping water, crickets, rain, storm wind, birdsong ──
const beds = {};
function buildBeds() {
  const ctx = audio.ctx, out = audio.buses.ambience;
  const loop = (buf, rate = 1) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };
  const filter = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const lfo = (f, depth, param, type = 'sine') => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = gain(depth); o.connect(g).connect(param); o.start(); };

  beds.wind = gain(0.22);
  loop(audio.brownBuf).connect(filter('lowpass', 420)).connect(beds.wind).connect(out);
  lfo(0.07, 0.1, beds.wind.gain);

  beds.water = gain(0);
  const waterF = filter('bandpass', 700, 0.8);
  loop(audio.whiteBuf).connect(waterF).connect(beds.water).connect(out);
  lfo(0.35, 250, waterF.frequency);

  beds.crickets = gain(0);
  const cr = ctx.createOscillator(); cr.frequency.value = 4400; cr.start();
  const crAm = gain(0.5);
  lfo(26, 0.5, crAm.gain, 'square');
  cr.connect(crAm).connect(beds.crickets).connect(out);

  beds.rain = gain(0);
  loop(audio.whiteBuf, 0.93).connect(filter('bandpass', 2400, 0.45)).connect(beds.rain).connect(out);
  beds.gale = gain(0);
  loop(audio.brownBuf, 0.7).connect(filter('lowpass', 650)).connect(beds.gale).connect(out);
}

let nextChirp = 2;
function chirp(day) {
  const ctx = audio.ctx, now = ctx.currentTime;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if (pan.pan) pan.pan.value = rnd(-0.8, 0.8);
  pan.connect(audio.buses.ambience);
  const notes = 2 + Math.floor(rnd() * 4), base = 2600 + rnd() * 1600, vol = 0.045 * day;
  for (let k = 0; k < notes; k++) {
    const t0 = now + k * (0.11 + rnd() * 0.05);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(base * (1 + rnd() * 0.1), t0);
    o.frequency.exponentialRampToValueAtTime(base * (rnd() < 0.5 ? 1.45 : 0.75), t0 + 0.08);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    o.connect(g).connect(pan);
    o.start(t0); o.stop(t0 + 0.12);
  }
}

/** Steer the ambient beds from the world state. `s` = { nearWater, day, eve, rain, storm, snow, wind, bugs }. */
export function updateBeds(dt, s) {
  if (!playing()) return;
  const k = 1 - Math.exp(-2 * dt);
  const to = (node, v) => { node.gain.value += (v - node.gain.value) * k; };
  to(beds.water, (0.03 + s.nearWater * 0.12) * (1 - s.snow * 0.5));
  to(beds.crickets, s.eve * 0.012 * (1 - s.rain) * (1 - s.snow) * s.bugs);
  to(beds.rain, s.rain * 0.2 + s.storm * 0.08);
  to(beds.gale, s.storm * 0.28 + s.wind * 0.04);
  beds.wind.gain.value = 0.22 * (1 - s.snow * 0.6) + s.wind * 0.08;
  nextChirp -= dt;
  if (nextChirp <= 0) {
    if (s.day > 0.3 && s.rain < 0.2 && s.snow < 0.4 && s.storm < 0.1) chirp(s.day);
    nextChirp = 1.5 + (rnd() * 5) / Math.max(s.day, 0.2);
  }
}
