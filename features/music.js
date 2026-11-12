/* Gentle generative music (M): a kalimba melody over soft pads, in a reverb.
   Bright major pentatonic by day, slower minor pentatonic at night, sparser in rain, belllike in winter. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { clamp, rand } = SW;

  const btn = document.getElementById('musicBtn');
  const label = document.getElementById('musicLabel');
  let on = false, bus = null, tone = null, nextStep = 0, step = 0, degree = 4, chord = 0;

  function impulse(ctx, secs) {
    const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }
  function build() {
    const ctx = SW.audio.ctx;
    bus = ctx.createGain(); bus.gain.value = 0;
    tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6000;
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 3);
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    tone.connect(bus);
    tone.connect(verb).connect(wet).connect(bus);
    bus.connect(SW.audio.master);
  }
  function setOn(v) {
    if (v && !SW.audio.on) SW.soundBtn.click();
    if (v && !SW.audio.ctx) { label.textContent = 'No audio'; return; }
    on = v;
    if (on && !bus) build();
    if (bus) {
      const t = SW.audio.ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(on ? 0.55 : 0, t + 2);
      if (on) nextStep = Math.max(nextStep, t + 0.2);
    }
    btn.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Music on' : 'Music off';
    SW.store.music = on;
    SW.saveSoon();
  }
  btn.addEventListener('click', () => setOn(!on));
  SW.onKey('KeyM', () => setOn(!on));
  if (SW.store.music) {
    const resume = () => {
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      setTimeout(() => { if (!on) setOn(true); }, 50);
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function pluck(t, note, vel) {
    const ctx = SW.audio.ctx, f = midi(note);
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
    const ctx = SW.audio.ctx;
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
    const c = SW.cur, wx = SW.wx, winter = SW.seasonState.name === 'Winter';
    const day = c.day > 0.5;
    return {
      root: day ? 60 : 57,
      scale: day ? [0, 2, 4, 7, 9, 12, 14, 16, 19] : [0, 3, 5, 7, 10, 12, 15, 17, 19],
      chords: day ? [0, 9, 5, 7] : [0, 5, 3, 7],
      tempo: day ? 74 : 58,
      density: (day ? 0.45 : 0.3) * (1 - wx.rain * 0.35) * (winter ? 0.7 : 1),
      lift: winter ? 12 : 0,
      bright: wx.rain > 0.3 ? 2200 : winter ? 7000 : 5200,
    };
  }

  SW.hooks.frame.push(() => {
    if (!on || !SW.audio.ctx || !SW.audio.on) return;
    const ctx = SW.audio.ctx, m = mood();
    tone.frequency.value += (m.bright - tone.frequency.value) * 0.02;
    const stepLen = 60 / m.tempo / 2;
    if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
    while (nextStep < ctx.currentTime + 0.3) {
      const t = nextStep;
      if (step % 16 === 0) {
        chord = (step / 16) % m.chords.length;
        const r = m.root - 12 + m.chords[chord];
        pad(t, [r, r + (m.scale[2] === 4 ? 4 : 3) + 0, r + 7], stepLen * 16);
      }
      const strong = step % 4 === 0;
      if (Math.random() < (strong ? m.density + 0.2 : m.density)) {
        degree = clamp(degree + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)], 0, m.scale.length - 1);
        const note = m.root + m.lift + m.scale[degree];
        pluck(t + rand(0, 0.015), note, strong ? 0.16 : 0.11);
        if (Math.random() < 0.12) pluck(t + stepLen * 0.5, note + 12, 0.05);
      }
      nextStep += stepLen;
      step++;
    }
  });
})();
