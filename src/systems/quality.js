// Graphics quality. A preset (Low … Ultra) is a set of separate options: resolution, shadows,
// glow and sunbeams, grass density, wildflowers and the distant forest; any of
// them can also be set on its own ("Custom"). "Auto" moves between Low, Medium and High by the
// frame rate: down when frames take too long, back up when there is room.
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
export const quality = { setting: 'auto', level: 'high', choice: {}, opts: {}, dpr: 1, frame: 0, fps: 60 };
let renderer = null, onResize = () => {};
let acc = 0, frames = 0, calm = 0;
const listeners = [];
/** Called (now and) whenever the options change. */
export function onQualityChange(fn) { listeners.push(fn); if (renderer) fn(quality.opts); }

function apply(level, choice) {
  quality.level = level;
  quality.choice = Object.assign({}, choice);
  KEYS.forEach((k) => { quality.opts[k] = (OPTIONS[k].choices[choice[k]] || Object.values(OPTIONS[k].choices).pop())[1]; });
  const o = quality.opts;
  quality.dpr = Math.min(window.devicePixelRatio || 1, o.resolution);
  renderer.setPixelRatio(quality.dpr);
  sun.castShadow = !!o.shadows;
  if (o.shadows) setShadowSize(o.shadows[0]);
  renderer.shadowMap.needsUpdate = true;
  onResize();
  listeners.forEach((fn) => fn(o));
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
  const level = setting === 'auto' ? (window.devicePixelRatio > 1.5 ? 'medium' : 'high') : setting;
  apply(level, pick(level));
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
  if (acc < 2) return;
  const avg = acc / frames;
  quality.fps = Math.round(1 / avg);
  acc = 0; frames = 0;
  if (quality.setting !== 'auto' || document.hidden) return;
  const i = AUTO_ORDER.indexOf(quality.level);
  if (avg > 1 / 40 && i > 0) { apply(AUTO_ORDER[i - 1], pick(AUTO_ORDER[i - 1])); calm = 0; }
  else if (avg < 1 / 75 && i < AUTO_ORDER.length - 1) { calm++; if (calm >= 3) { apply(AUTO_ORDER[i + 1], pick(AUTO_ORDER[i + 1])); calm = 0; } }
  else calm = 0;
}
