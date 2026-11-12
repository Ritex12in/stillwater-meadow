// Versioned save in browser storage. The meadow plays fine without it (private windows,
// blocked storage); everything is read defensively and written a few seconds after changes.
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

/** Forget everything (settings menu). */
export function resetSave() {
  resetting = true;
  try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
  location.reload();
}
