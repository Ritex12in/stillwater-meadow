// Travelling: you go at once only to points you have earned. A waystone (a standing stone, one to
// about every kilometre and a half of country: core/shape.js SITE_KINDS.waystone, world/buildings.js)
// is asleep until you walk up to it and wake it (E); from then on you can travel to it from the
// map, from anywhere. The home lake and your own camp are points from the start. Which stones are
// awake is kept per world (`store.waypoints`). Travelling fades the view out and in, with a chime.
//
// Tracking: any stone (or other place) chosen on the map can be tracked, awake or not. A marker then
// hangs over it in the world, with its name and how far it is; when it is out of view the marker
// sits at the edge of the screen pointing the way to turn; the compass marks it too. One thing is
// tracked at a time (`store.track`, per world); it ends when you reach it (a sleeping stone: when
// you wake it) or when you stop it on the map.
import * as THREE from 'three';
import { reduceMotion } from '../core/env.js';
import { HOME, SPAWN, sitesNear, height } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { audio, playing } from '../systems/audio.js';
import { toast, togglePanel } from '../ui/hud.js';
import { placeName, setWaystoneAwake } from '../world/landmarks.js';

const WAKE_REACH = 4.5, FADE_MS = 380;
const woken = () => (Array.isArray(store.waypoints) ? store.waypoints : (store.waypoints = []));
/** Is the waystone at this site awake? */
export const isAwake = (siteId) => woken().some((w) => w.id === siteId);

/**
 * The points you can travel to: `{ id, kind ('home' | 'camp' | 'waystone'), name, x, z, ax, az }`
 * (`ax`, `az`: where you arrive, beside it and facing it).
 */
export function travelPoints() {
  const out = [{ id: 'home', kind: 'home', name: HOME.name, x: HOME.x, z: HOME.z, ax: SPAWN.x, az: SPAWN.z }];
  if (store.camp) out.push({ id: 'camp', kind: 'camp', name: 'Your camp', x: store.camp.x, z: store.camp.z, ax: store.camp.x + 2.5, az: store.camp.z + 1.5 });
  for (const w of woken()) out.push({ id: w.id, kind: 'waystone', name: w.name, x: w.x, z: w.z, ax: w.x, az: w.z + 2.6 });
  return out;
}
/** The point a place found (features/places.js) or a mark on the map stands for, if you can travel to it. */
export const pointFor = (id) => travelPoints().find((p) => p.id === id || (p.kind === 'home' && id === 'lake:home')) || null;
/** The waystones still asleep within `r` metres of a spot, nearest first: `{ id, name, x, z }`. */
export const asleepNear = (x, z, r) => sitesNear(x, z, r, 'waystone').filter((s) => !isAwake(s.id)).map((s) => ({ id: s.id, name: placeName(s), x: s.x, z: s.z }));

/** What you are tracking: `{ id, name, x, z }`, or null. */
export const tracked = () => (store.track && Number.isFinite(store.track.x) && Number.isFinite(store.track.z) ? store.track : null);
/** Track a place (`{ id, name, x, z }`), or stop tracking (null). */
export function track(p) {
  if (p) store.track = { id: p.id, name: p.name, x: p.x, z: p.z }; else delete store.track;
  saveSoon();
}
const farText = (m) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km');

/** A soft rising chime: three bell notes. */
function chime(base = 392) {
  if (!playing()) return;
  const ctx = audio.ctx, t = ctx.currentTime + 0.02;
  [1, 1.5, 2].forEach((k, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), at = t + i * 0.13;
    o.type = 'sine'; o.frequency.value = base * k;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.09, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    o.connect(g).connect(audio.buses.ambience); o.start(at); o.stop(at + 1.5);
  });
}

let goTo = null, busy = false;
/** Travel to a point (from `travelPoints`): the view fades out, you are there, it fades in. */
export function travelToPoint(p) {
  if (!p || busy || !goTo) return false;
  if (!activity.free) { toast('Finish what you are doing first.', 2.5); return false; }
  busy = true;
  const fade = document.getElementById('fade');
  const arrive = () => {
    try {
      togglePanel('mapPanel', false);
      goTo(p.ax, p.az, p.x, p.z);
      chime(523);
      toast(p.kind === 'home' ? `${p.name} · home` : p.name, 3);
    } finally { // (whatever happens, the view comes back)
      if (fade) fade.classList.remove('on');
      busy = false;
    }
  };
  if (reduceMotion || !fade) { arrive(); return true; }
  fade.classList.add('on');
  setTimeout(arrive, FADE_MS);
  return true;
}

/** For tests: the stones awake, and those asleep about you. */
export const waypointsView = () => ({ track: tracked() && Object.assign({}, tracked()), awake: woken().map((w) => Object.assign({}, w)), points: travelPoints(), asleep: asleepNear(player.x, player.z, 2500), busy });

/** `go(x, z, faceX, faceZ)` takes you to a spot, facing another. */
export function initWaypoints(go) {
  goTo = go;
  setWaystoneAwake(isAwake);
  const near = () => sitesNear(player.x, player.z, 40, 'waystone').find((s) => Math.hypot(s.x - player.x, s.z - player.z) < WAKE_REACH) || null;
  let here = null, hx = NaN, hz = NaN; // (looked for again only once you have moved a little)
  const stone = () => { if (!(Math.hypot(player.x - hx, player.z - hz) < 0.3)) { hx = player.x; hz = player.z; here = near(); } return here; };
  registerAction({
    id: 'waystone-wake', key: 'KeyE', keyLabel: 'E', score: () => 25,
    available: () => activity.free && !!stone() && !isAwake(stone().id),
    label: () => 'Wake the waystone',
    run: () => {
      const s = near();
      if (!s || isAwake(s.id)) return;
      woken().push({ id: s.id, name: placeName(s), x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 });
      if (tracked() && tracked().id === s.id) track(null); // (you have come to what you were tracking)
      saveSoon();
      setWaystoneAwake(isAwake); // (its runes light)
      chime();
      toast(`${placeName(s)} is awake. You can travel to it from the map (M).`, 5);
    },
  });
  // the marker over what you are tracking: on it while it is in view, else at the screen's edge, pointing the way
  const el = document.getElementById('trackMark');
  if (el) {
    const arrow = el.querySelector('i'), nameEl = el.querySelector('b'), farEl = el.querySelector('span'), v = new THREE.Vector3();
    let id = null, y = 0, shown = '';
    hooks.frame.push((dt, t, camera) => {
      const T = tracked();
      if (!T) { if (!el.hidden) el.hidden = true; id = null; return; }
      const far = Math.hypot(T.x - player.x, T.z - player.z), sleeping = /^waystone:/.test(T.id) && !isAwake(T.id);
      if (far < 9 && !sleeping) { toast(`You have reached ${T.name}.`, 3); track(null); return; }
      if (id !== T.id) { id = T.id; y = Math.max(0, height(T.x, T.z)) + 4.2; nameEl.textContent = T.name; }
      v.set(T.x, y, T.z).project(camera);
      let sx = v.x, sy = v.y;
      const behind = v.z > 1;
      if (behind) { sx = -sx; sy = -sy; }
      const off = behind || Math.abs(sx) > 0.9 || Math.abs(sy) > 0.8;
      if (off) { const k = Math.max(Math.abs(sx) / 0.9, Math.abs(sy) / 0.8, 1e-6); sx /= k; sy /= k; } // (out to the edge, the way it lies)
      el.hidden = false;
      el.style.transform = `translate(${((sx * 0.5 + 0.5) * window.innerWidth).toFixed(1)}px, ${((-sy * 0.5 + 0.5) * window.innerHeight).toFixed(1)}px)`;
      arrow.style.rotate = `${off ? (Math.atan2(-sy, sx) * 180 / Math.PI - 45).toFixed(0) : 45}deg`; // (the chevron points down at it, or the way to turn)
      const text = farText(far);
      if (text !== shown) { shown = text; farEl.textContent = text; }
    });
  }
  registerAction({
    id: 'waystone-map', key: 'KeyE', keyLabel: 'E', score: () => 4,
    available: () => activity.free && !!stone() && isAwake(stone().id),
    label: () => 'Travel from the waystone',
    run: () => togglePanel('mapPanel', true),
  });
}
