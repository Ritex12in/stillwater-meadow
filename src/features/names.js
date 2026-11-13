// Pet names: when you tame a cat or dog (features/pets.js) you can name it. Names float above them as
// small signs in the 3D scene (so trees and people in front hide them), bonds and names are
// saved, and bonded dogs come running to greet you when you return.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { clamp, rnd } from '../core/math.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { animals } from '../characters/animals.js';
import { activity } from '../systems/activity.js';
import { setActionBlocker } from '../systems/actions.js';
import { store, saveSoon, onSave, isReturning } from '../systems/save.js';
import { toast } from '../ui/hud.js';
import { photoOn } from './photo.js';

const NAMES = {
  dog: ['Biscuit', 'Maple', 'Juniper', 'Pepper', 'Mochi', 'Bramble', 'Hazel', 'Pip'],
  cat: ['Miso', 'Clover', 'Pumpkin', 'Willow', 'Nutmeg', 'Pebble', 'Tofu', 'Sage'],
};

function tagSprite(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = '700 44px Manrope, system-ui, sans-serif';
  const w = Math.ceil(g.measureText(text).width) + 48;
  c.width = w; c.height = 72;
  g.font = '700 44px Manrope, system-ui, sans-serif';
  g.fillStyle = 'rgba(16, 24, 28, 0.72)';
  const r = 36;
  g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, 72, r); g.arcTo(w, 72, 0, 72, r); g.arcTo(0, 72, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
  g.fillStyle = '#f7f4ec'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, w / 2, 38);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((w / 72) * 0.26, 0.26, 1);
  s.renderOrder = 5;
  return s;
}

/** Offer to name a newly tamed animal (as soon as you're free to answer). */
export const askName = (a) => { if (!a.name) a.wantName = true; };

export function initNames() {
  // restore bonds and names
  (store.animals || []).forEach((s, i) => { const a = animals[i]; if (a && s) { a.bond = s.bond || 0; a.name = s.name || ''; } });
  onSave((st) => { st.animals = animals.map((a) => ({ name: a.name || '', bond: Math.round(a.bond * 1000) / 1000, trust: a.trust, favKnown: !!a.favKnown, tamed: !!a.tamed, tamedAt: a.tamedAt || '' })); });

  // welcome back: bonded dogs run over to say hello
  if (isReturning()) {
    const greeters = animals.filter((a) => a.kind === 'dog' && a.tamed && a.bond > 0.3);
    greeters.forEach((a) => { a.state = 'follow'; a.timer = 45 + a.bond * 60; a.greet = true; });
    const named = greeters.map((a) => a.name).filter(Boolean);
    let msg = 'Welcome back to the meadow.';
    if (greeters.length === 1) msg = `Welcome back. ${named[0] || 'A dog'} runs over to greet you.`;
    else if (greeters.length > 1) msg = `Welcome back. ${named.length === greeters.length ? named.slice(0, -1).join(', ') + ' and ' + named[named.length - 1] : 'The dogs'} run over to greet you.`;
    setTimeout(() => toast(msg, 5), 1200);
  }

  const dialog = document.getElementById('nameDialog');
  const input = document.getElementById('nameInput');
  const title = document.getElementById('nameTitle');
  let naming = null;
  setActionBlocker(() => activity.is('dialog') || photoOn());
  const open = (a) => {
    if (naming || a.name || !activity.enter('dialog')) return;
    naming = a;
    a.wantName = false;
    const taken = new Set(animals.map((x) => x.name));
    const options = NAMES[a.kind].filter((n) => !taken.has(n));
    title.textContent = `Name this ${a.kind}`;
    input.value = options[Math.floor(rnd() * options.length)] || '';
    dialog.hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => { input.focus(); input.select(); }, 30);
  };
  const close = (save) => {
    if (!naming) return;
    const name = input.value.trim().slice(0, 16);
    if (save && name) { naming.name = name; saveSoon(); toast(`Say hello to ${name}.`); }
    naming = null;
    dialog.hidden = true;
    activity.leave('dialog');
    input.blur();
  };
  document.getElementById('nameForm').addEventListener('submit', (e) => { e.preventDefault(); close(true); });
  document.getElementById('nameSkip').addEventListener('click', () => close(false));
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });

  const tags = new Map();
  hooks.frame.push(() => {
    for (const a of animals) {
      if (a.wantName && !naming && activity.free) open(a);
      let t = tags.get(a);
      const label = a.name ? a.name + (a.bond > 0.6 ? ' ♥' : '') : '';
      if (!t || t.label !== label) {
        if (t && t.s) { a.head.remove(t.s); t.s.material.map.dispose(); t.s.material.dispose(); }
        t = { label, s: label ? tagSprite(label) : null };
        if (t.s) { t.s.position.set(0, 0.62 / (a.scale || 1), 0); a.head.add(t.s); }
        tags.set(a, t);
      }
      if (!t.s) continue;
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      t.s.visible = d < 10 && !photoOn();
      t.s.material.opacity = clamp((10 - d) / 3, 0, 1);
    }
  });
  return { scene };
}
