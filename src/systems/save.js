// Versioned save in browser storage. The meadow plays fine without it (private windows,
// blocked storage); everything is read defensively and written a few seconds after changes.
//
// The save also decides which world you are in (its seed): the one in the address (`?seed=`), or
// else the one you last played, or else, for someone new, one picked at random. What you carry and
// your bonds go with you from world to world; what belongs to a place in one world (where you
// stood, the landmarks' lake, each place's bouquets and fire) is kept per world, in `worlds`.
import { query } from '../core/env.js';
const KEY = 'stillwater-meadow';
const LEGACY_KEY = 'stillwater-meadow-v1';
export const SAVE_VERSION = 2;

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

/** The highest seed: world numbers are kept to five digits, easy to read out and type. */
export const MAX_SEED = 99999;
/** A seed as given (address, typed in, saved), as a whole number from 1 to MAX_SEED, or null if it is not one. */
export function seedOf(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.floor(Math.abs(Number(v)));
  return Number.isFinite(n) && n >= 1 && n <= MAX_SEED ? n : null;
}
/** What belongs to one world rather than to you. */
const WORLD_KEYS = ['where', 'places', 'anchor', 'benchBouquet', 'boatBouquet'];
/**
 * The world this visit is in. The address wins; then the world last played; a save from before
 * worlds had numbers was world 1; someone new gets a world of their own, at random (never 1).
 */
function chooseWorld() {
  const asked = seedOf(query.get('seed')), saved = seedOf(store.seed);
  const seed = asked || saved || (store.lastVisit ? 1 : 2 + Math.floor(Math.random() * (MAX_SEED - 1)));
  const was = saved || (store.lastVisit ? 1 : null);
  if (was !== seed) {
    // put the old world's places away, and bring out this one's (if you have been here before)
    const worlds = store.worlds || (store.worlds = {});
    if (was) { const keep = {}; for (const k of WORLD_KEYS) if (store[k] !== undefined) keep[k] = store[k]; worlds[was] = keep; }
    for (const k of WORLD_KEYS) delete store[k];
    Object.assign(store, worlds[seed] || {});
    delete worlds[seed];
  }
  store.seed = seed;
  return seed;
}
/** The world's seed for this visit (core/shape.js builds the land from it). */
export const worldSeed = chooseWorld();
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
