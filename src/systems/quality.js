// Graphics quality. A preset (Low … Ultra) is a set of separate options: resolution, shadows,
// glow and sunbeams, grass density, wildflowers and the distant forest; any of
// them can also be set on its own ("Custom"). "Auto" aims for a steady 60 fps: every second it
// nudges the render resolution up or down a little (smoothly, between the preset's own and about
// half of it), and only when that is not enough does it step to the next preset down (or, with
// room to spare at full resolution, back up). It starts on a level suited to the device (phones
// lower), remembers where it settled for the next visit, and after a load that crashed the tab or
// lost the graphics card it starts a level lower. (Same approach as Abyssal Garden, MIT.)
import { setShadowSize, sun } from '../world/lights.js';

/** Every option, its choices (worst to best) and what each choice means. */
export const OPTIONS = {
  resolution: { label: 'Resolution', choices: { low: ['Low', 1], medium: ['Medium', 1.5], high: ['High', 2], ultra: ['Full', 3] } },           // cap on device pixels per CSS pixel
  shadows: { label: 'Shadows', choices: { off: ['Off', null], low: ['Low', [1024, 4]], medium: ['Medium', [1536, 3]], high: ['High', [2048, 2]], ultra: ['Ultra', [4096, 1]] } }, // [map size, refresh every n frames]
  effects: { label: 'Glow and sunbeams', choices: { off: ['Off', false], on: ['On', true] } },
  grass: { label: 'Grass', choices: { low: ['Sparse', 0.35], medium: ['Medium', 0.65], high: ['Dense', 1] } },
  flowers: { label: 'Wildflowers', choices: { off: ['Off', false], on: ['On', true] } },
  forest: { label: 'Distant forest', choices: { off: ['Off', false], on: ['On', true] } },
};
export const PRESETS = {
  low: { label: 'Low', resolution: 'low', shadows: 'low', effects: 'off', grass: 'low', flowers: 'off', forest: 'on' },
  medium: { label: 'Medium', resolution: 'medium', shadows: 'medium', effects: 'off', grass: 'medium', flowers: 'on', forest: 'on' },
  high: { label: 'High', resolution: 'high', shadows: 'high', effects: 'on', grass: 'high', flowers: 'on', forest: 'on' },
  ultra: { label: 'Ultra', resolution: 'ultra', shadows: 'ultra', effects: 'on', grass: 'high', flowers: 'on', forest: 'on' },
};
const AUTO_ORDER = ['low', 'medium', 'high'];
const KEYS = Object.keys(OPTIONS);

/**
 * `setting` is what was asked for (auto, a preset, or custom); `level` the preset in force (or
 * 'custom'); `choice` the choice per option; `opts` their values, for the code that draws.
 */
export const quality = { setting: 'auto', level: 'high', choice: {}, opts: {}, dpr: 1, frame: 0, fps: 60, scale: 1, fast: false };
const MEMO = 'meadow-quality', LOADING = 'meadow-loading', SCALE_MIN = 0.55;
const memo = (() => { try { return JSON.parse(localStorage.getItem(MEMO) || 'null') || {}; } catch (e) { return {}; } })();
const remember = () => { try { localStorage.setItem(MEMO, JSON.stringify({ level: quality.level, scale: +quality.scale.toFixed(3) })); } catch (e) { /* private window */ } };
/** Where Auto starts on a first visit: phones and low-memory computers lower. */
function firstLevel() {
  const mem = navigator.deviceMemory, touch = matchMedia('(pointer: coarse)').matches;
  if (touch) return mem >= 8 ? 'medium' : 'low';
  if (mem && mem <= 4) return 'low';
  return window.devicePixelRatio > 1.5 ? 'medium' : 'high';
}
/** Mark the world as being built; still marked on the next visit means that load crashed the tab. */
export function loadingStarted() { try { localStorage.setItem(LOADING, '1'); } catch (e) { /* private window */ } }
export function loadingFinished() { try { localStorage.removeItem(LOADING); } catch (e) { /* private window */ } }
let crashed = false;
try { crashed = localStorage.getItem(LOADING) === '1'; } catch (e) { /* private window */ }
let renderer = null, onResize = () => {};
let acc = 0, frames = 0, calm = 0, steady = 0, wait = 8, probed = false;
const listeners = [];
/** Called (now and) whenever the options change. */
export function onQualityChange(fn) { listeners.push(fn); if (renderer) fn(quality.opts); }

function apply(level, choice) {
  quality.level = level;
  quality.choice = Object.assign({}, choice);
  KEYS.forEach((k) => { quality.opts[k] = (OPTIONS[k].choices[choice[k]] || Object.values(OPTIONS[k].choices).pop())[1]; });
  const o = quality.opts;
  applyScale(true);
  sun.castShadow = !!o.shadows;
  if (o.shadows) setShadowSize(o.shadows[0]);
  renderer.shadowMap.needsUpdate = true;
  onResize();
  listeners.forEach((fn) => fn(o));
}
/** The pixel ratio actually drawn at: the preset's, times the Auto scale. Only touched when it really changes. */
function applyScale(force) {
  const base = Math.min(window.devicePixelRatio || 1, quality.opts.resolution), dpr = Math.max(0.5, base * (quality.setting === 'auto' ? quality.scale : 1));
  if (!force && Math.abs(dpr - quality.dpr) / quality.dpr < 0.03) return;
  quality.dpr = dpr;
  renderer.setPixelRatio(dpr);
  if (!force) onResize();
}
const pick = (preset) => Object.fromEntries(KEYS.map((k) => [k, PRESETS[preset][k]]));

export function initQuality(r, resize, setting = 'auto', custom = null) {
  renderer = r; onResize = resize;
  setQuality(setting, custom);
}

/** Choose auto, a preset, or 'custom' with a full set of choices. */
export function setQuality(setting, custom = null) {
  if (setting === 'custom' && custom) { quality.setting = 'custom'; apply('custom', Object.assign(pick('high'), custom)); return; }
  if (setting !== 'auto' && !PRESETS[setting]) setting = 'auto';
  quality.setting = setting;
  let level = setting;
  if (setting === 'auto') {
    level = AUTO_ORDER.includes(memo.level) ? memo.level : firstLevel();
    quality.scale = memo.scale >= SCALE_MIN && memo.scale <= 1 ? memo.scale : 1;
    // the last load never finished (the tab crashed, or the graphics card gave up): start a level lower
    if (crashed) { level = AUTO_ORDER[Math.max(0, AUTO_ORDER.indexOf(level) - 1)]; quality.scale = 1; crashed = false; }
  }
  apply(level, pick(level));
  if (setting === 'auto') remember();
}
/** Change one option; the setting becomes 'custom'. Returns the full set of choices to save. */
export function setOption(key, value) {
  const choice = Object.assign({}, quality.choice, { [key]: value });
  quality.setting = 'custom';
  apply('custom', choice);
  return choice;
}

/** Call once per rendered frame with the real frame time (seconds). */
export function tickQuality(frameSeconds) {
  quality.frame++;
  const sh = quality.opts.shadows;
  if (sh && quality.frame % sh[1] === 0) renderer.shadowMap.needsUpdate = true;
  acc += frameSeconds; frames++;
  if (acc < (quality.fast ? 0.5 : 1)) return;      // (every half second while the start screen is up, then every second)
  const avg = acc / frames;
  quality.fps = Math.round(1 / avg);
  acc = 0; frames = 0;
  if (quality.setting !== 'auto' || document.hidden) return;
  const i = AUTO_ORDER.indexOf(quality.level);
  if (avg > 1 / 52) {
    // too slow: fewer pixels first, in proportion to how slow; at the floor, the next preset down at full scale
    calm = 0; steady = 0;
    if (probed) { wait = Math.min(wait * 2, 64); probed = false; } // the last try for more was too much: wait longer before the next
    if (quality.scale > SCALE_MIN + 0.01) quality.scale = Math.max(SCALE_MIN, quality.scale * Math.max(0.75, Math.sqrt(1 / (avg * 60))));
    else if (i > 0) { quality.scale = 1; apply(AUTO_ORDER[i - 1], pick(AUTO_ORDER[i - 1])); remember(); return; }
    applyScale(); remember();
  } else if (avg < 1 / 68) {
    // room to spare, three times running: a few more pixels; at full scale, the next preset up (starting a little lower)
    if (++calm < 3) return;
    calm = 0;
    if (quality.scale < 0.99) { quality.scale = Math.min(1, quality.scale * 1.12); applyScale(); remember(); }
    else if (i < AUTO_ORDER.length - 1) { quality.scale = 0.8; apply(AUTO_ORDER[i + 1], pick(AUTO_ORDER[i + 1])); remember(); }
  } else {
    // on a 60 Hz screen frames never come faster than the target, so there's no telling if there is room:
    // after a while at a steady 60, try a little more; too much, and the next check takes it back
    calm = 0; probed = false;
    if (quality.scale < 0.99 && ++steady > wait) { steady = 0; probed = true; quality.scale = Math.min(1, quality.scale * 1.06); applyScale(); }
  }
}
