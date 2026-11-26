// Versioned save in browser storage. The meadow plays fine without it (private windows,
// blocked storage); everything is read defensively and written a few seconds after changes.
//
// The save also decides which world you are in (its seed): the one in the address (`?seed=`), or
// else the one you last played, or else, for someone new, one picked at random. As in Minecraft, a
// seed can be any text: a whole number is used as it is, any other text is turned into a number,
// so the same text always gives the same world. What you carry and
// your bonds go with you from world to world; what belongs to a place in one world (where you
// stood, the landmarks' lake, each place's bouquets and fire) is kept per world, in `worlds`.
import { query } from '../core/env.js';
const KEY = 'stillwater-meadow';
const LEGACY_KEY = 'stillwater-meadow-v1';
export const SAVE_VERSION = 3;

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}

/** Bring any older save up to the current shape. */
function migrate(data) {
  if (!data || typeof data !== 'object') return { version: SAVE_VERSION };
  if (!data.version) data.version = 1;
  if (data.version === 1) {
    // v1 (single-file build) stored the same fields without a version or settings block
    data.settings = data.settings || {};
    data.version = 2;
  }
  if (data.version === 2) {
    // v3: what you carry is in the backpack (systems/pack.js): the rod, the fish from the creel, the pine cones
    const pack = Array.from({ length: 24 }, () => null);
    let uid = 0;
    const put = (it) => { const at = pack.indexOf(null); if (at >= 0) pack[at] = Object.assign({ uid: ++uid, key: null, n: 1 }, it); };
    if (data.rod || (data.journal && Object.keys(data.journal).length)) put({ type: 'rod' }); // (a save with catches had the rod)
    if (Array.isArray(data.creel)) {
      const by = new Map();
      for (const f of data.creel) if (f && f.id) { if (!by.has(f.id)) by.set(f.id, []); by.get(f.id).push(f.cm); }
      for (const [id, cms] of by) put({ type: 'fish', key: id, n: cms.length, list: cms });
    }
    if (data.cones > 0) put({ type: 'cone', n: Math.min(16, data.cones) });
    data.pack = pack; data.packUid = uid;
    delete data.rod; delete data.creel; delete data.cones;
    data.version = 3;
  }
  return data;
}

function load() {
  let data = read(KEY);
  if (!data) {
    const legacy = read(LEGACY_KEY);
    if (legacy) data = legacy;
  }
  data = migrate(data);
  data.settings = Object.assign({ volumes: {}, sensitivity: 1, quality: 'auto' }, data.settings || {});
  data.journal = data.journal || {};
  return data;
}

export const store = load();

/** The highest seed. The land is made with 32-bit arithmetic, so every seed up to here is a world of its own. */
export const MAX_SEED = 4294967295;
/** How long a seed's text may be. */
export const SEED_TEXT_MAX = 64;
/**
 * A seed as given (in the address, typed in, saved): `{ seed, text }`, or null if there is no text.
 * A whole number from 1 to MAX_SEED is that seed (written without leading zeros); any other text
 * is turned into one (FNV-1a over its characters), the same text always to the same seed.
 */
export function seedOf(v) {
  if (v === null || v === undefined) return null;
  const text = String(v).trim().slice(0, SEED_TEXT_MAX);
  if (!text) return null;
  if (/^\d+$/.test(text)) { const n = Number(text); if (n >= 1 && n <= MAX_SEED) return { seed: n, text: String(n) }; }
  let h = 0x811C9DC5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { seed: (h >>> 0) || 1, text };
}
/** A new world's seed, at random (never 1, the first world). */
export const randomSeed = () => 2 + Math.floor(Math.random() * (MAX_SEED - 1));
/** What belongs to one world rather than to you. */
const WORLD_KEYS = ['gen', 'where', 'places', 'anchor', 'benchBouquet', 'boatBouquet', 'camp', 'lanterns', 'found', 'explored', 'waypoints', 'track'];
/**
 * The world this visit is in. The address wins; then the world last played; a save from before
 * worlds had numbers was world 1; someone new gets a world of their own, at random (never 1).
 */
function chooseWorld() {
  const asked = seedOf(query.get('seed')), saved = typeof store.seed === 'number' && store.seed >= 1 ? { seed: store.seed, text: store.seedText || String(store.seed) } : null;
  const chosen = asked || saved || (store.lastVisit ? { seed: 1, text: '1' } : (() => { const n = randomSeed(); return { seed: n, text: String(n) }; })());
  const seed = chosen.seed, was = saved ? saved.seed : store.lastVisit ? 1 : null;
  if (was !== seed) {
    // put the old world's places away, and bring out this one's (if you have been here before)
    const worlds = store.worlds || (store.worlds = {});
    if (was) { const keep = {}; for (const k of WORLD_KEYS) if (store[k] !== undefined) keep[k] = store[k]; worlds[was] = keep; }
    for (const k of WORLD_KEYS) delete store[k];
    Object.assign(store, worlds[seed] || {});
    delete worlds[seed];
  }
  store.seed = seed;
  store.seedText = chosen.text;
  worldSeedText = chosen.text;
  return seed;
}
/**
 * How the land is made, numbered: it goes up when the same seed would give different land (2: the
 * climate by latitude). A world last visited under an older number has changed beyond the ground
 * round home, so what pointed at its land is cleared once: where you stood, the places found, the
 * explored map, the waystones woken, what was tracked, the camp and the lanterns (which go back in
 * the backpack: features/camp.js). What you carry, your journals, pets and settings are kept.
 */
export const WORLD_GEN = 2;
/** Was this world's land changed under you since your last visit? (For a line to say so.) */
export let landChanged = false;
function checkLand() {
  if (store.gen === WORLD_GEN) return;
  const had = (store.found && store.found.length > 1) || (store.waypoints && store.waypoints.length) || store.camp || (store.lanterns && store.lanterns.length) || (store.explored && Object.keys(store.explored).length > 1);
  if (store.lanterns && store.lanterns.length) store.lanternsBack = (store.lanternsBack || 0) + store.lanterns.length;
  for (const k of ['where', 'found', 'explored', 'waypoints', 'track', 'camp', 'lanterns']) delete store[k];
  landChanged = !!had;
  store.gen = WORLD_GEN;
}
/** The world's seed as it was given (what is shown and shared). */
export let worldSeedText = '';
/** The world's seed for this visit (core/shape.js builds the land from it). */
export const worldSeed = chooseWorld();
checkLand();
const returning = !!store.lastVisit;
export const isReturning = () => returning;

let dirty = false, resetting = false;
const collectors = [];
export const saveSoon = () => { dirty = true; };
/** Register a function that copies live state into `store` just before writing. */
export const onSave = (fn) => collectors.push(fn);

export function flush() {
  if (resetting) return;
  collectors.forEach((fn) => { try { fn(store); } catch (e) { /* keep saving the rest */ } });
  store.version = SAVE_VERSION;
  store.lastVisit = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) { /* storage unavailable */ }
  dirty = false;
}
setInterval(() => { if (dirty) flush(); }, 5000);
setInterval(flush, 30000); // collectors pick up gradual changes like bonds
window.addEventListener('pagehide', flush);

/** Forget everything (settings menu), and begin again in a new world. */
export function resetSave() {
  resetting = true;
  try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
  location.replace(worldAddress(null));
}
/** This page's address with another world's seed in it (or none: `null`), the time of day kept. */
export function worldAddress(seed) {
  const q = new URLSearchParams(location.search);
  if (seed) q.set('seed', String(seed)); else q.delete('seed');
  q.delete('at');
  const s = q.toString();
  return location.pathname + (s ? '?' + s : '') + location.hash;
}
/** Go to another world (saving first): the page loads again in it. */
export function goToWorld(seed) {
  flush();
  location.assign(worldAddress(seed));
}
