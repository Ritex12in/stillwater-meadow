// Time of day. Follows the real clock by default. The sky palette is keyed to "solar" hours, so
// sunrise and sunset move with the season (long summer evenings, short winter days), and the
// moon shows its real phase.
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../core/math.js';
import { reduceMotion } from '../core/env.js';
import { seasonState } from '../core/state.js';
import { moonPhaseOn } from '../world/sky.js';

const NIGHT = { top: '#0a1330', horizon: '#1b2747', glow: '#000000', light: '#9fb6ff', lightI: 0.34, hemiSky: '#2b3b6b', hemiGround: '#14181f', hemiI: 0.34, amb: 0.1, deep: '#0a1a2e', shallow: '#1a3350', cloud: '#2b3654', fogNear: 30, fogFar: 170, day: 0, eve: 1, stars: 1 };
// Keyframes on the solar clock, where sunrise is 06:00 and sunset 19:00.
const KEYFRAMES = [
  Object.assign({ h: 0 }, NIGHT),
  Object.assign({ h: 4.8 }, NIGHT),
  { h: 5.9, top: '#2e3f73', horizon: '#d98a8a', glow: '#ff9a7a', light: '#ffb08a', lightI: 0.4, hemiSky: '#6a6a9a', hemiGround: '#3a3a38', hemiI: 0.4, amb: 0.1, deep: '#22305a', shallow: '#7a5a78', cloud: '#d99aa0', fogNear: 30, fogFar: 180, day: 0.3, eve: 0.5, stars: 0.35 },
  { h: 7.2, top: '#86b4e2', horizon: '#f2d0b6', glow: '#ffc68c', light: '#ffd49e', lightI: 1.08, hemiSky: '#c9dcf2', hemiGround: '#857a52', hemiI: 0.52, amb: 0.13, deep: '#2e6276', shallow: '#6aa3a6', cloud: '#ffe7d8', fogNear: 32, fogFar: 210, day: 1, eve: 0, stars: 0 },
  { h: 12.5, top: '#4a8fd8', horizon: '#d6e6ee', glow: '#ffe4b4', light: '#fff0d4', lightI: 0.9, hemiSky: '#cfe0f0', hemiGround: '#7b7b4a', hemiI: 0.4, amb: 0.1, deep: '#1b6a85', shallow: '#4cb0b7', cloud: '#ffffff', fogNear: 40, fogFar: 250, day: 1, eve: 0, stars: 0 },
  { h: 16.3, top: '#5a92d6', horizon: '#e8dcbc', glow: '#ffcc88', light: '#ffdba2', lightI: 1.02, hemiSky: '#d4e2ee', hemiGround: '#7f7a48', hemiI: 0.48, amb: 0.11, deep: '#1d6480', shallow: '#5aa8ac', cloud: '#fff2dc', fogNear: 38, fogFar: 235, day: 1, eve: 0, stars: 0 },
  { h: 18.4, top: '#36427e', horizon: '#f39a6b', glow: '#ff9a5c', light: '#ff9a5c', lightI: 1.05, hemiSky: '#8f7db8', hemiGround: '#4f4436', hemiI: 0.52, amb: 0.15, deep: '#27315c', shallow: '#9a6478', cloud: '#ffb08c', fogNear: 35, fogFar: 190, day: 0.15, eve: 0.85, stars: 0 },
  { h: 19.4, top: '#1c2452', horizon: '#7a5a8a', glow: '#ff7a5a', light: '#8a8ac8', lightI: 0.34, hemiSky: '#4a4a80', hemiGround: '#22222a', hemiI: 0.38, amb: 0.1, deep: '#141c3a', shallow: '#3a3a5a', cloud: '#5a4a70', fogNear: 30, fogFar: 170, day: 0, eve: 1, stars: 0.5 },
  Object.assign({ h: 20.6 }, NIGHT),
  Object.assign({ h: 24 }, NIGHT),
];
const COLOR_KEYS = ['top', 'horizon', 'glow', 'light', 'hemiSky', 'hemiGround', 'deep', 'shallow', 'cloud'];
const NUM_KEYS = ['lightI', 'hemiI', 'amb', 'fogNear', 'fogFar', 'day', 'eve', 'stars'];
KEYFRAMES.forEach((k) => COLOR_KEYS.forEach((c) => { k[c] = new THREE.Color(k[c]); }));

/** The current sky palette and light levels. Weather modifies it after sampling. */
export const cur = {};
COLOR_KEYS.forEach((k) => { cur[k] = new THREE.Color(); });

export const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
export const solar = { sunElev: 30, moonPhase: moonPhaseOn(new Date()), moonLight: 1, sunrise: 6, sunset: 19 };

export const wrap24 = (h) => ((h % 24) + 24) % 24;
const circDiff = (a, b) => { let d = (b - a) % 24; if (d > 12) d -= 24; if (d < -12) d += 24; return d; };
export const realHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
export function formatHour(h) {
  const total = Math.floor(wrap24(h) * 60 + 1e-6) % 1440;
  const hh = Math.floor(total / 60), mm = total % 60;
  return (hh % 12 || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm');
}
export function periodName(h) {
  if (h < solar.sunrise - 1.5) return 'Night';
  if (h < solar.sunrise + 0.6) return 'Dawn';
  if (h < 11) return 'Morning';
  if (h < 14) return 'Midday';
  if (h < Math.min(solar.sunset - 1.5, 18)) return 'Afternoon';
  if (h < solar.sunset + 1.3) return 'Evening';
  return 'Night';
}

// #morning, #noon, #evening, #night or an hour like #21.5 starts at a fixed time
const HASH_HOURS = { morning: 7.5, noon: 12.5, evening: 18.3, night: 22.5 };
const hashVal = location.hash.slice(1);
const hashHour = HASH_HOURS[hashVal] !== undefined ? HASH_HOURS[hashVal] : (hashVal !== '' && isFinite(+hashVal) ? wrap24(+hashVal) : null);
export const timeCtl = { live: hashHour === null, hour: hashHour === null ? realHour() : hashHour, target: 0, fromUrl: hashHour !== null };
timeCtl.target = timeCtl.hour;

const listeners = new Set();
export const onTimeModeChange = (fn) => listeners.add(fn);
export function setManual(h) { timeCtl.live = false; timeCtl.target = wrap24(h); listeners.forEach((fn) => fn()); }
export function goLive() { timeCtl.live = true; timeCtl.target = realHour(); listeners.forEach((fn) => fn()); }

/** Sunrise and sunset for a day of the year, at a mid-northern latitude. */
function dayLength(doy) {
  const len = 12.4 + 3.4 * Math.sin((2 * Math.PI * (doy - 80)) / 365); // ~9h in winter, ~15.8h in summer
  const noon = 12.9;
  return { sunrise: noon - len / 2, sunset: noon + len / 2, maxElev: 45 + 23 * Math.sin((2 * Math.PI * (doy - 80)) / 365) };
}
/** Map a clock hour to the solar hour the keyframes use (sunrise → 6, sunset → 19). */
function solarHour(h, sr, ss) {
  if (h >= sr && h <= ss) return 6 + ((h - sr) / (ss - sr)) * 13;
  const night = 24 - (ss - sr);
  const since = wrap24(h - ss);
  return wrap24(19 + (since / night) * 11);
}
const dayOfYear = () => { const d = new Date(); return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); };

function sampleKeyframes(h) {
  let i = 0;
  while (i < KEYFRAMES.length - 2 && h >= KEYFRAMES[i + 1].h) i++;
  const a = KEYFRAMES[i], b = KEYFRAMES[i + 1];
  let t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  t = t * t * (3 - 2 * t);
  COLOR_KEYS.forEach((k) => { cur[k].copy(a[k]).lerp(b[k], t); });
  NUM_KEYS.forEach((k) => { cur[k] = lerp(a[k], b[k], t); });
}
function dirFrom(out, elevDeg, azDeg) {
  const el = THREE.MathUtils.degToRad(elevDeg), az = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

/** Advance the clock and compute the palette, sun and moon. */
export function advanceTime(dt) {
  if (timeCtl.live) timeCtl.target = realHour();
  const k = reduceMotion ? 20 : 2.5;
  if (dt > 0) timeCtl.hour = wrap24(timeCtl.hour + circDiff(timeCtl.hour, timeCtl.target) * (1 - Math.exp(-dt * k)));
  const { sunrise, sunset, maxElev } = dayLength(seasonState.dayOfYear || dayOfYear());
  solar.sunrise = sunrise; solar.sunset = sunset;
  const sh = solarHour(timeCtl.hour, sunrise, sunset);
  sampleKeyframes(sh);

  const f = (sh - 6) / 13;
  const sunElev = maxElev * Math.sin(Math.PI * f);
  solar.sunElev = sunElev;
  dirFrom(sunDir, sunElev, 65 + f * 230);
  const m = clamp(wrap24(sh - 18.5) / 12, 0, 1);
  dirFrom(moonDir, 6 + 22 * Math.sin(Math.PI * m), 290 + m * 140);
  lightDir.copy(moonDir).lerp(sunDir, smooth(-4, 4, sunElev));
  if (lightDir.y < 0.06) lightDir.y = 0.06;
  lightDir.normalize();
  // a new moon gives darker nights than a full one
  solar.moonLight = 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(solar.moonPhase * Math.PI * 2));
  const night = 1 - smooth(-6, 2, sunElev);
  cur.lightI *= lerp(1, solar.moonLight, night);
}
