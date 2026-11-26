// Gentle generative music (U): a kalimba melody over soft pads in a reverb. Bright major
// pentatonic by day, slower minor pentatonic at night, sparser in rain, bell-like in winter.
import { clamp, rnd } from '../core/math.js';
import { hooks, seasonState } from '../core/state.js';
import { audio, setSoundEnabled, onSoundChange } from '../systems/audio.js';
import { bindKey } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { cur } from '../systems/time.js';
import { wx } from '../systems/weather.js';

let on = false, ducked = false, bus = null, tone = null, nextStep = 0, step = 0, degree = 4;
export const musicOn = () => on;
const level = () => (on && !ducked ? 0.9 : 0);
/** Fade the meadow's music out (true) while something else plays (the dance), and back in (false). */
export function duckMusic(v) {
  if (v === ducked) return;
  ducked = v;
  if (!bus || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(level(), t + (v ? 1.5 : 4));
}

function impulse(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}
function build() {
  const ctx = audio.ctx;
  bus = ctx.createGain(); bus.gain.value = 0;
  tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6000;
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 3);
  const wet = ctx.createGain(); wet.gain.value = 0.45;
  tone.connect(bus);
  tone.connect(verb).connect(wet).connect(bus);
  bus.connect(audio.buses.music);
}
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
function pluck(t, note, vel) {
  const ctx = audio.ctx, f = midi(note);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  g.connect(tone);
  [[1, 1], [2.01, 0.25], [5.4, 0.06]].forEach(([mul, amp]) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
    const og = ctx.createGain();
    og.gain.setValueAtTime(amp, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + (mul > 2 ? 0.25 : 1.8));
    o.connect(og).connect(g);
    o.start(t); o.stop(t + 1.9);
  });
}
function pad(t, notes, len) {
  const ctx = audio.ctx;
  notes.forEach((n) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 1.6);
    g.gain.setValueAtTime(0.035, t + len - 1.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 2);
    o.connect(lp).connect(g).connect(tone);
    o.start(t); o.stop(t + len + 2.1);
  });
}
function mood() {
  const day = cur.day > 0.5, winter = seasonState.winterHere;
  return {
    root: day ? 60 : 57,
    scale: day ? [0, 2, 4, 7, 9, 12, 14, 16, 19] : [0, 3, 5, 7, 10, 12, 15, 17, 19],
    third: day ? 4 : 3,
    chords: day ? [0, 9, 5, 7] : [0, 5, 3, 7],
    tempo: day ? 74 : 58,
    density: (day ? 0.45 : 0.3) * (1 - wx.rain * 0.35) * (winter ? 0.7 : 1),
    lift: winter ? 12 : 0,
    bright: wx.rain > 0.3 ? 2200 : winter ? 7000 : 5200,
  };
}

export function initMusic() {
  const btn = document.getElementById('musicBtn'), label = document.getElementById('musicLabel');
  const sync = () => {
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = !on ? 'Music off' : audio.enabled ? 'Music on' : 'Music paused';
  };
  const setOn = (v) => {
    if (v && !audio.enabled) setSoundEnabled(true); // music needs sound
    if (v && !audio.ctx) { label.textContent = 'No audio'; return; }
    on = v;
    if (on && !bus) build();
    if (bus) {
      const t = audio.ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(level(), t + 2);
      if (on) nextStep = Math.max(nextStep, t + 0.2);
    }
    store.music = on;
    saveSoon();
    sync();
  };
  btn.addEventListener('click', () => setOn(!on));
  bindKey('KeyU', () => setOn(!on)); // (M opens the map)
  onSoundChange(sync);
  if (store.music) {
    // turn music back on with the first gesture, unless that gesture is on the Music or Sound button
    const resume = (e) => {
      if (e.target && e.target.closest && e.target.closest('#sound, #musicBtn')) return;
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      setTimeout(() => { if (!on) setOn(true); }, 50);
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  hooks.frame.push(() => {
    if (!on || ducked || !audio.ctx || !audio.enabled) return;
    const ctx = audio.ctx, m = mood();
    tone.frequency.value += (m.bright - tone.frequency.value) * 0.02;
    const stepLen = 60 / m.tempo / 2;
    if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
    while (nextStep < ctx.currentTime + 0.3) {
      const t = nextStep;
      if (step % 16 === 0) {
        const r = m.root - 12 + m.chords[(step / 16) % m.chords.length];
        pad(t, [r, r + m.third, r + 7], stepLen * 16);
      }
      const strong = step % 4 === 0;
      if (rnd() < (strong ? m.density + 0.2 : m.density)) {
        degree = clamp(degree + [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd() * 7)], 0, m.scale.length - 1);
        const note = m.root + m.lift + m.scale[degree];
        pluck(t + rnd(0, 0.015), note, strong ? 0.16 : 0.11);
        if (rnd() < 0.12) pluck(t + stepLen * 0.5, note + 12, 0.05);
      }
      nextStep += stepLen;
      step++;
    }
  });
}
