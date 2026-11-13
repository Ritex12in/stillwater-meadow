// Graphics quality: shadow map size, how often shadows refresh, resolution and bloom.
// "Auto" starts high and steps down when frames take too long, then back up when there's room.
import { setShadowSize } from '../world/lights.js';

export const LEVELS = {
  high: { label: 'High', dprCap: 2, shadow: 2048, shadowEvery: 2, bloom: true },
  medium: { label: 'Medium', dprCap: 1.5, shadow: 1536, shadowEvery: 3, bloom: false },
  low: { label: 'Low', dprCap: 1, shadow: 1024, shadowEvery: 4, bloom: false },
};
const ORDER = ['low', 'medium', 'high'];

export const quality = { setting: 'auto', level: 'high', dpr: 1, frame: 0, fps: 60 };
let renderer = null, onResize = () => {};
let acc = 0, frames = 0, calm = 0;

export function initQuality(r, resize, setting = 'auto') {
  renderer = r; onResize = resize;
  setQuality(setting);
}

function apply(level) {
  quality.level = level;
  const L = LEVELS[level];
  quality.dpr = Math.min(window.devicePixelRatio || 1, L.dprCap);
  renderer.setPixelRatio(quality.dpr);
  setShadowSize(L.shadow);
  renderer.shadowMap.needsUpdate = true;
  onResize();
}

export function setQuality(setting) {
  quality.setting = setting;
  apply(setting === 'auto' ? (window.devicePixelRatio > 1.5 ? 'medium' : 'high') : setting);
}

/** Call once per rendered frame with the real frame time (seconds). */
export function tickQuality(frameSeconds) {
  quality.frame++;
  if (quality.frame % LEVELS[quality.level].shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
  acc += frameSeconds; frames++;
  if (acc < 2) return;
  const avg = acc / frames;
  quality.fps = Math.round(1 / avg);
  acc = 0; frames = 0;
  if (quality.setting !== 'auto' || document.hidden) return;
  const i = ORDER.indexOf(quality.level);
  if (avg > 1 / 40 && i > 0) { apply(ORDER[i - 1]); calm = 0; }
  else if (avg < 1 / 75 && i < ORDER.length - 1) { calm++; if (calm >= 3) { apply(ORDER[i + 1]); calm = 0; } }
  else calm = 0;
}
