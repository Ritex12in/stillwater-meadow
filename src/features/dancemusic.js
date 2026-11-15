// "Snowfall": the music for the skating dance. An original 60-second piece, written out note by note
// (no randomness): D major, 60 beats a minute, fifteen bars of four beats, so each part of the dance
// starts on a bar line. A music-box melody over soft piano arpeggios, a warm pad and a low bass, with
// a sparkle of bells as she twirls. It is played from the dance's own clock, so it stays in time
// (and pauses with the dance in photo mode). The meadow's own music fades out while it plays.
// It plays whenever sound is on, through the music volume, even with the meadow's music switched off.
//
//   bar    time   chord          the dance
//   1      0-4    D add9         they glide in            (music box alone)
//   2-3    4-12   D, A/C#        meeting, skating         the melody enters
//   4-5    12-20  G, A           first twirl              bells rising
//   6-7    20-28  Bm, G          close, swaying           quieter, lower
//   8-9    28-36  Em7, Asus4-A   the dip                  held breath on the suspension
//   10-11  36-44  D, F#m         skating together         the melody again
//   12-13  44-52  G, A           second twirl             fullest, highest
//   14-15  52-60  Bm-G, D        the last embrace         settles and rings out
import { audio } from '../systems/audio.js';
import { hooks } from '../core/state.js';
import { danceNow } from './icedance.js';
import { duckMusic } from './music.js';

const BAR = 4, EIGHTH = 0.5;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// per bar: the pad chord (or two chords, half a bar each) and the bass note(s)
const CHORDS = [
  [[[62, 66, 69, 76]], [38]], [[[62, 66, 69]], [38]], [[[61, 64, 69]], [37]],
  [[[59, 62, 67]], [43]], [[[61, 64, 69]], [45]],
  [[[59, 62, 66]], [47]], [[[59, 62, 67]], [43]],
  [[[59, 62, 64, 67]], [40]], [[[62, 64, 69], [61, 64, 69]], [45]],
  [[[62, 66, 69]], [38]], [[[61, 66, 69]], [42]],
  [[[62, 67, 71]], [43]], [[[61, 64, 69, 73]], [45]],
  [[[62, 66, 71], [62, 67, 71]], [47, 43]], [[[62, 66, 69, 74]], [38]],
];
// the melody, eight eighth-notes a bar (0: a rest, or the note before still sounding)
const MELODY = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [78, 0, 76, 74, 69, 0, 0, 0],
  [73, 0, 74, 76, 76, 0, 0, 0],
  [71, 0, 74, 0, 78, 0, 76, 0],
  [76, 0, 0, 73, 69, 0, 0, 0],
  [74, 0, 73, 71, 73, 0, 0, 0],
  [71, 0, 69, 67, 69, 0, 0, 0],
  [67, 0, 71, 74, 76, 0, 0, 0],
  [74, 0, 0, 0, 73, 0, 0, 0],
  [78, 0, 76, 74, 76, 0, 78, 0],
  [81, 0, 78, 0, 76, 0, 73, 0],
  [79, 0, 78, 0, 79, 0, 83, 0],
  [81, 0, 0, 0, 0, 0, 76, 78],
  [78, 0, 76, 0, 74, 0, 71, 0],
  [74, 0, 0, 0, 0, 0, 0, 0],
];
const TWIRL = [3, 4, 11, 12], CLOSE = [5, 6, 7, 8];
// how loud each bar is: soft to start, hushed while close, fullest in the second twirl, settling at the end
const DYN = [0.5, 0.75, 0.8, 0.95, 1, 0.7, 0.7, 0.75, 0.65, 0.9, 0.95, 1.15, 1.2, 0.85, 0.6];

/** Every note of the piece in time order: { t, kind: 'bell' | 'keys' | 'pad' | 'bass', notes, vel, len }. */
export const SCORE = (() => {
  const ev = [], add = (t, kind, notes, vel, len) => ev.push({ t, kind, notes, vel: vel * DYN[Math.min(DYN.length - 1, Math.max(0, Math.floor(t / BAR)))], len });
  // a touch of human looseness, the same every time
  const loose = (i) => (((i * 37) % 7) - 3) * 0.004;
  CHORDS.forEach(([chords, bass], b) => {
    const t0 = b * BAR, last = b === CHORDS.length - 1;
    // pad and bass: a whole bar each, or half a bar for a change mid-bar; the last chord rings on
    chords.forEach((ch, i) => add(t0 + i * BAR / chords.length, 'pad', ch, last ? 0.03 : 0.026, last ? 7 : BAR / chords.length));
    bass.forEach((n, i) => add(t0 + i * BAR / bass.length, 'bass', [n], last ? 0.13 : 0.11, last ? 6 : BAR / bass.length));
    // arpeggios: steady eighths; sparse while they are close; quick rising sixteenths in the twirls
    const tones = chords[0].map((n) => n + 12).concat([chords[0][0] + 24]);
    if (last) { tones.forEach((n, i) => add(t0 + i * 0.09, 'keys', [n], 0.06, 4)); return; }
    if (TWIRL.includes(b)) {
      for (let s = 0; s < 16; s++) {
        const up = tones.concat(tones.map((n) => n + 12));
        add(t0 + s * EIGHTH / 2 + loose(s), 'bell', [up[s % up.length]], 0.035 + 0.025 * (s / 16), 1.2);
      }
    }
    const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
    for (let s = 0; s < 8; s++) {
      if (CLOSE.includes(b) && s % 3 !== 0) continue;
      const ch = chords[s < 4 ? 0 : chords.length - 1].map((n) => n + 12).concat([chords[0][0] + 24]);
      add(t0 + s * EIGHTH + loose(b * 8 + s), 'keys', [ch[pattern[s] % ch.length]], b === 0 ? 0.03 : 0.045, 1.4);
    }
    // the melody, a little louder as it climbs to the second twirl
    MELODY[b].forEach((n, s) => {
      if (!n) return;
      let len = EIGHTH; while (s + len / EIGHTH < 8 && !MELODY[b][s + len / EIGHTH]) len += EIGHTH;
      add(t0 + s * EIGHTH + loose(b * 8 + s + 3), 'bell', [n], b >= 11 && b <= 12 ? 0.17 : CLOSE.includes(b) ? 0.12 : 0.14, Math.max(1.6, len + 1));
    });
  });
  // the intro: a few music-box glints over the first chord
  [[0.2, 86], [1.4, 81], [2.4, 85], [3.3, 78]].forEach(([t, n]) => add(t, 'bell', [n], 0.06, 2.4));
  // and a last high bell as they settle
  add(58.5, 'bell', [86], 0.07, 4);
  ev.forEach((e) => { e.t = Math.max(0, e.t); });
  return ev.sort((a, b) => a.t - b.t);
})();
export const SCORE_LENGTH = 66; // (with the ring-out)

// ───────────── the instruments ─────────────
function impulse(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let s = 9301 + c * 49297;
    for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = ((s / 4294967296) * 2 - 1) * Math.pow(1 - i / len, 2.4); }
  }
  return buf;
}
/** The room the music plays in: a soft low-pass and a long reverb, into `dest`. Returns its input. */
export function makeChain(ctx, dest) {
  const input = ctx.createGain(), tone = ctx.createBiquadFilter(), verb = ctx.createConvolver(), wet = ctx.createGain();
  tone.type = 'lowpass'; tone.frequency.value = 7500;
  verb.buffer = impulse(ctx, 3.6); wet.gain.value = 0.5;
  input.connect(tone); tone.connect(dest); tone.connect(verb).connect(wet).connect(dest);
  return input;
}
function env(ctx, g, when, peak, attack, len) {
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + len);
}
/** Play one note (or chord) of the score at audio time `when`. */
export function playEvent(ctx, dest, when, e) {
  for (const n of e.notes) {
    const f = midi(n), g = ctx.createGain(), end = when + e.len + 0.1;
    g.connect(dest);
    if (e.kind === 'bell') {
      // music box: a pure tone with faint bright partials that die away first
      env(ctx, g, when, e.vel, 0.004, e.len);
      [[1, 1, 1], [2, 0.28, 0.5], [3.01, 0.1, 0.25], [4.2, 0.05, 0.12]].forEach(([mul, amp, life]) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = f * mul; og.gain.setValueAtTime(amp, when); og.gain.exponentialRampToValueAtTime(0.0001, when + e.len * life);
        o.connect(og).connect(g); o.start(when); o.stop(end);
      });
    } else if (e.kind === 'keys') {
      // soft piano: a rounded triangle with its octave, mellowed
      env(ctx, g, when, e.vel, 0.008, e.len);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g);
      [['triangle', 1, 1], ['sine', 2, 0.3]].forEach(([type, mul, amp]) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = amp;
        o.connect(og).connect(lp); o.start(when); o.stop(end);
      });
    } else if (e.kind === 'pad') {
      // warm pad: two slightly detuned triangles, swelling in and out
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(g);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(e.vel, when + Math.min(1.2, e.len * 0.4));
      g.gain.setValueAtTime(e.vel, when + e.len * 0.75);
      g.gain.linearRampToValueAtTime(0.0001, when + e.len + 0.6);
      [-4, 4].forEach((cents) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = cents;
        o.connect(lp); o.start(when); o.stop(when + e.len + 0.7);
      });
    } else {
      // bass: a round low sine with a little body
      env(ctx, g, when, e.vel, 0.04, e.len + 0.4);
      [['sine', 1, 1], ['triangle', 2, 0.15]].forEach(([type, mul, amp]) => {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = amp;
        o.connect(og).connect(g); o.start(when); o.stop(when + e.len + 0.5);
      });
    }
  }
}

// ───────────── playing it with the dance ─────────────
export function initDanceMusic() {
  let playingFor = null, bus = null, input = null, cursor = 0, anchor = 0; // anchor: the audio clock's time at dance time 0
  const stop = () => {
    if (bus && audio.ctx) {
      const b = bus, t = audio.ctx.currentTime;
      b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(() => b.disconnect(), 2500);
    }
    bus = input = null; playingFor = null;
  };
  hooks.frame.push(() => {
    const D = danceNow();
    duckMusic(!!D);
    if (!D) { if (playingFor) stop(); return; }
    if (!audio.ctx || !audio.enabled) return;
    const ctx = audio.ctx;
    if (playingFor !== D) {
      // a new dance (or sound just switched on mid-dance): start from where the dance is
      stop();
      playingFor = D;
      bus = ctx.createGain(); bus.gain.value = 1; bus.connect(audio.buses.music);
      input = makeChain(ctx, bus);
      cursor = SCORE.findIndex((e) => e.t >= D.t - 0.02); if (cursor < 0) cursor = SCORE.length;
      anchor = ctx.currentTime - D.t;
    }
    // notes keep to one steady clock; it is only reset if the dance and the audio drift apart (a pause, a slow frame)
    if (Math.abs(ctx.currentTime - D.t - anchor) > 0.12) anchor = ctx.currentTime - D.t;
    // schedule what falls in the next moment of the dance
    while (cursor < SCORE.length && SCORE[cursor].t < D.t + 0.25) {
      const e = SCORE[cursor++];
      playEvent(ctx, input, Math.max(ctx.currentTime, anchor + e.t), e);
    }
  });
}
