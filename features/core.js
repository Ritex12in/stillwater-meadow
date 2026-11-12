/* Shared helpers for the feature modules: toasts, key bindings, action prompts,
   saving, the controls panel, pet names and positional sound. Loads after main.js. */
(() => {
  'use strict';
  const SW = window.SW;
  if (!SW) return;
  const { THREE, clamp } = SW;

  // ── Toast messages ────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let toastT = 0;
  SW.toast = (msg, secs = 3.2) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastT = secs;
  };
  SW.hooks.frame.push((dt) => {
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show'); }
  });

  // ── Keys ──────────────────────────────────────────────────────
  const keyHandlers = {};
  const typing = (e) => e.target && ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA');
  SW.onKey = (code, fn, opts = {}) => { keyHandlers[code] = { fn, always: !!opts.always }; };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || typing(e)) return;
    const h = keyHandlers[e.code];
    if (!h || (SW.uiState.blockActions && !h.always)) return;
    h.fn(e);
  });
  SW.moving = () => SW.keys.has('f') || SW.keys.has('b') || SW.keys.has('l') || SW.keys.has('r') || Math.hypot(SW.joy.x, SW.joy.y) > 0.2;
  SW.camForward = () => ({ x: -Math.sin(SW.camState.yaw), z: -Math.cos(SW.camState.yaw) });

  // ── Action prompts (the chips above the time bar) ─────────────
  const actionsEl = document.querySelector('.actions');
  SW.addPrompt = (key, onClick) => {
    const b = document.createElement('button');
    b.className = 'action';
    b.type = 'button';
    b.hidden = true;
    b.addEventListener('click', onClick);
    actionsEl.appendChild(b);
    let last = null;
    return {
      el: b,
      set(text, urgent) {
        const html = text ? (SW.coarsePointer ? text : `<kbd>${key}</kbd> ${text}`) : '';
        if (html === last) return;
        last = html;
        b.hidden = !text;
        b.innerHTML = html;
        b.classList.toggle('urgent', !!urgent);
      },
    };
  };

  // ── Positional sound: returns a gain node panned and faded by distance from the camera
  SW.voice = (x, z, range = 40, vol = 1) => {
    const a = SW.audio;
    if (!a.ctx || !a.on) return null;
    const cam = SW.camera.position;
    const dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz);
    const near = clamp(1 - d / range, 0, 1);
    if (near <= 0.01) return null;
    const yaw = SW.camState.yaw;
    const pan = d > 0.01 ? clamp((dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d, -1, 1) * 0.85 : 0;
    const ctx = a.ctx, g = ctx.createGain();
    g.gain.value = near * near * vol;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(a.master); }
    else g.connect(a.master);
    return { ctx, out: g, t: ctx.currentTime + 0.02 };
  };
  SW.noise = (ctx) => { const s = ctx.createBufferSource(); s.buffer = SW.audio.whiteBuf; return s; };

  // ── Saving (browser storage; the meadow works fine without it) ─
  const KEY = 'stillwater-meadow-v1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  let dirty = false;
  SW.store = store;
  SW.saveSoon = () => { dirty = true; };
  function collectAnimals() {
    const arr = SW.animals.map((a) => ({ name: a.name || '', bond: Math.round(a.bond * 1000) / 1000 }));
    if (JSON.stringify(arr) !== JSON.stringify(store.animals || [])) { store.animals = arr; dirty = true; }
  }
  function flush() {
    collectAnimals();
    if (!dirty) return;
    dirty = false;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage blocked: keep playing */ }
  }
  setInterval(flush, 5000);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  // restore bonds and names
  (store.animals || []).forEach((s, i) => {
    const a = SW.animals[i];
    if (!a || !s) return;
    a.bond = s.bond || 0;
    a.name = s.name || '';
  });

  // welcome back: bonded dogs run over to say hello
  const returning = !!store.lastVisit;
  store.lastVisit = Date.now();
  dirty = true;
  if (returning) {
    const greeters = SW.animals.filter((a) => a.kind === 'dog' && a.bond > 0.3);
    greeters.forEach((a) => { a.state = 'follow'; a.timer = 45 + a.bond * 60; a.greet = true; });
    const named = greeters.map((a) => a.name).filter(Boolean);
    let msg = 'Welcome back to the meadow.';
    if (greeters.length === 1) msg = `Welcome back. ${named[0] || 'A dog'} runs over to greet you.`;
    else if (greeters.length > 1) msg = `Welcome back. ${named.length === greeters.length ? named.slice(0, -1).join(', ') + ' and ' + named[named.length - 1] : 'The dogs'} run over to greet you.`;
    setTimeout(() => SW.toast(msg, 5), 1200);
  }

  // remember the sound setting; browsers only allow audio after a click or key press
  SW.soundBtn.addEventListener('click', () => setTimeout(() => { store.sound = !!SW.audio.on; dirty = true; }, 0));
  if (store.sound) {
    const resume = () => {
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      if (!SW.audio.on) SW.soundBtn.click();
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  // ── Controls panel (H) ────────────────────────────────────────
  const controlsEl = document.getElementById('controls');
  const toggleControls = (force) => { controlsEl.hidden = typeof force === 'boolean' ? !force : !controlsEl.hidden; };
  document.getElementById('controlsClose').addEventListener('click', () => toggleControls(false));
  SW.onKey('KeyH', () => toggleControls());

  // ── Pet names ─────────────────────────────────────────────────
  const NAMES = {
    dog: ['Biscuit', 'Maple', 'Juniper', 'Pepper', 'Mochi', 'Bramble', 'Hazel', 'Pip'],
    cat: ['Miso', 'Clover', 'Pumpkin', 'Willow', 'Nutmeg', 'Pebble', 'Tofu', 'Sage'],
  };
  const dialog = document.getElementById('nameDialog');
  const nameInput = document.getElementById('nameInput');
  const nameTitle = document.getElementById('nameTitle');
  let naming = null;
  function openNaming(a) {
    naming = a;
    a.nameAsked = true;
    const taken = new Set(SW.animals.map((x) => x.name));
    const options = NAMES[a.kind].filter((n) => !taken.has(n));
    nameTitle.textContent = `Name this ${a.kind}`;
    nameInput.value = options[Math.floor(Math.random() * options.length)] || '';
    dialog.hidden = false;
    SW.uiState.blockActions = true;
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 30);
  }
  function closeNaming(save) {
    if (!naming) return;
    const name = nameInput.value.trim().slice(0, 16);
    if (save && name) {
      naming.name = name;
      dirty = true;
      SW.toast(`Say hello to ${name}.`);
    }
    naming = null;
    dialog.hidden = true;
    SW.uiState.blockActions = false;
    nameInput.blur();
  }
  document.getElementById('nameForm').addEventListener('submit', (e) => { e.preventDefault(); closeNaming(true); });
  document.getElementById('nameSkip').addEventListener('click', () => closeNaming(false));
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNaming(false); });

  // floating name tags
  const tagsEl = document.getElementById('tags');
  SW.animals.forEach((a) => {
    const el = document.createElement('div');
    el.className = 'tag';
    el.hidden = true;
    tagsEl.appendChild(el);
    a.tagEl = el;
  });
  const v = new THREE.Vector3();
  SW.hooks.frame.push(() => {
    for (const a of SW.animals) {
      if (a.petted && !a.name && !a.nameAsked && !naming && SW.player.petAmt > 0.6) openNaming(a);
      const el = a.tagEl;
      const d = Math.hypot(a.x - SW.player.x, a.z - SW.player.z);
      if (!a.name || d > 10) { el.hidden = true; continue; }
      a.head.getWorldPosition(v);
      v.y += 0.42;
      v.project(SW.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { el.hidden = true; continue; }
      el.hidden = false;
      const label = a.name + (a.bond > 0.6 ? ' ♥' : '');
      if (el.textContent !== label) el.textContent = label;
      el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
      el.style.opacity = String(clamp((10 - d) / 3, 0, 1));
    }
  });
})();
