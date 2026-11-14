// Photo mode (P): hides the interface, frees the camera, offers soft filters and a focus blur,
// and saves a PNG. Mouse or right-side drag to look, W A S D or the joystick to move,
// Space / C up and down, scroll to zoom, Shift to move faster.
import { camera, canvas } from '../core/render.js';
import { clamp } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { activity } from '../systems/activity.js';
import { bindKey } from '../systems/actions.js';
import { keys, joy, camState } from '../systems/input.js';
import { post } from '../systems/post.js';
import * as THREE from 'three';

const FILTERS = [
  { name: 'Natural', css: 'none' },
  { name: 'Warm', css: 'sepia(0.28) saturate(1.25) hue-rotate(-8deg) brightness(1.04)' },
  { name: 'Film', css: 'contrast(1.12) saturate(0.85) sepia(0.18) brightness(0.98)', vignette: 0.55, grain: true },
  { name: 'Misty', css: 'brightness(1.08) contrast(0.82) saturate(0.75)', haze: 0.22 },
  { name: 'Mono', css: 'grayscale(1) contrast(1.15) brightness(1.02)', vignette: 0.35 },
];

let on = false, filter = 0, saved = null;
export const photoOn = () => on;

export function initPhoto(renderNow) {
  const bar = document.getElementById('photoBar');
  const nameEl = document.getElementById('photoFilter');
  const focusBtn = document.getElementById('photoFocus');
  const vignette = document.getElementById('photoVignette');
  const flash = document.getElementById('photoFlash');
  const target = new THREE.Vector3();
  const lift = { up: false, down: false };

  const applyFilter = () => {
    const f = FILTERS[filter];
    canvas.style.filter = f.css === 'none' ? '' : f.css;
    vignette.style.opacity = String(f.vignette || (f.haze ? 1 : 0));
    vignette.style.background = f.haze && !f.vignette ? `rgba(235, 238, 240, ${f.haze})` : '';
    nameEl.textContent = f.name + (post.focus ? ' · focus' : '');
    focusBtn.setAttribute('aria-pressed', String(post.focus));
  };
  const enter = () => {
    if (!activity.enter('photo')) return;
    on = true;
    saved = { dist: camState.dist, min: camState.minDist, max: camState.maxDist };
    camState.minDist = 0.8; camState.maxDist = 40;
    target.set(player.x, player.y + 1.3, player.z);
    document.body.classList.add('photo-mode');
    bar.hidden = false;
    applyFilter();
  };
  const exit = () => {
    if (!on) return;
    on = false;
    activity.leave('photo');
    camState.dist = saved.dist; camState.minDist = saved.min; camState.maxDist = saved.max;
    document.body.classList.remove('photo-mode');
    bar.hidden = true;
    canvas.style.filter = '';
    vignette.style.opacity = '0';
    post.focus = false;
  };
  const toggleFocus = () => { post.focus = !post.focus; applyFilter(); };
  const save = () => {
    if (!on) return;
    const f = FILTERS[filter];
    renderNow(); // capture in the same tick as the render
    const w = canvas.width, h = canvas.height;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const g = out.getContext('2d');
    if ('filter' in g && f.css !== 'none') g.filter = f.css;
    g.drawImage(canvas, 0, 0);
    g.filter = 'none';
    if (f.haze) { g.fillStyle = `rgba(235, 238, 240, ${f.haze})`; g.fillRect(0, 0, w, h); }
    if (f.vignette) {
      const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    if (f.grain) {
      const img = g.getImageData(0, 0, w, h), px = img.data;
      for (let i = 0; i < px.length; i += 4) { const n = (Math.random() - 0.5) * 18; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
      g.putImageData(img, 0, 0);
    }
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    const name = `stillwater-meadow-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      nameEl.textContent = `Saved ${name}`;
      setTimeout(() => { if (on) applyFilter(); }, 2500);
    }, 'image/png');
    photoSaves++;
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  };

  bindKey('KeyP', () => (on ? exit() : enter()), { modal: true });
  for (let i = 0; i < FILTERS.length; i++) bindKey('Digit' + (i + 1), () => { if (!on) return false; filter = i; applyFilter(); }, { modal: true });
  bindKey('Enter', () => { if (!on) return false; save(); }, { modal: true });
  bindKey('KeyV', () => { if (!on) return false; toggleFocus(); }, { modal: true });
  document.getElementById('photoSave').addEventListener('click', save);
  document.getElementById('photoNext').addEventListener('click', () => { filter = (filter + 1) % FILTERS.length; applyFilter(); });
  focusBtn.addEventListener('click', toggleFocus);
  document.getElementById('photoExit').addEventListener('click', exit);
  document.getElementById('menuPhoto')?.addEventListener('click', enter);
  window.addEventListener('keydown', (e) => { if (!on) return; if (e.code === 'Space') { lift.up = true; e.preventDefault(); } if (e.code === 'KeyC') lift.down = true; });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') lift.up = false; if (e.code === 'KeyC') lift.down = false; });

  hooks.camera.push((dt, camTarget) => {
    if (!on) return false;
    const yaw = camState.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const sp = (keys.has('run') ? 14 : 5) * dt;
    const mf = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0) + joy.y, mr = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x;
    target.x += (fx * mf + rx * mr) * sp;
    target.z += (fz * mf + rz * mr) * sp;
    target.y += ((lift.up ? 1 : 0) - (lift.down ? 1 : 0)) * sp;
    const r = Math.hypot(target.x, target.z);
    if (r > 140) { target.x *= 140 / r; target.z *= 140 / r; }
    target.y = clamp(target.y, Math.max(heightAt(target.x, target.z), 0) + 0.3, 60);
    const cp = Math.cos(camState.pitch), d = camState.dist, cam = camera.position;
    cam.set(target.x + Math.sin(yaw) * cp * d, target.y + Math.sin(camState.pitch) * d, target.z + Math.cos(yaw) * cp * d);
    cam.y = Math.max(cam.y, Math.max(heightAt(cam.x, cam.z), 0.02) + 0.25);
    camera.lookAt(target);
    camTarget.copy(target);
    post.focusDist = d;
    return true;
  });
}
let photoSaves = 0;
/** For tests: how many photos have been saved. */
export const photoSaveCount = () => photoSaves;
