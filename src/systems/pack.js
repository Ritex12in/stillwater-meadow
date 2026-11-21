// The backpack's contents: SLOTS slots, each empty or holding one item. What you carry lives here
// and nowhere else (the rod, pine cones, fish, flowers, bouquets; later tools and other things),
// kept in the save as `store.pack`. It goes with you from world to world.
//
// An item is `{ uid, type, key, n, list }`: its kind (`type`, from the table of kinds below), what
// sets it apart from others of its kind (`key`: a flower's kind, a fish's species), how many
// (`n`), and, for things that differ one from another, one entry each (`list`: a flower's colour,
// a fish's length). Items of one type and key stack up to that type's `max`. A bouquet carries the
// flowers it was tied from in `list` (as "#colour:kind", the form the bench and the skipper read).
//
// Items keep their slot; nothing moves on its own. One item may be held in the hand (`store.hand`,
// its uid). Everything that changes the pack calls the listeners, so the grid, the HUD and the
// figure's hand follow.
import { store, saveSoon } from './save.js';

export const SLOTS = 24;
const kinds = new Map();
/**
 * A kind of thing that can be carried: `{ name, max, holdable, icon }`. `name` and `icon` may be
 * functions of the item (an icon is an SVG string). Features add their own kinds.
 */
export function itemKind(type, def) { kinds.set(type, Object.assign({ name: type, max: 1, holdable: false, icon: null }, def)); }
export const kindOf = (type) => kinds.get(type) || { name: type, max: 1, holdable: false, icon: null };

const slots = () => {
  if (!Array.isArray(store.pack) || store.pack.length !== SLOTS) {
    const old = Array.isArray(store.pack) ? store.pack : [];
    store.pack = Array.from({ length: SLOTS }, (_, i) => old[i] || null);
  }
  return store.pack;
};
const listeners = [];
/** Call `fn` whenever the pack or the hand changes. */
export const onPack = (fn) => listeners.push(fn);
const changed = () => { saveSoon(); for (const fn of listeners) { try { fn(); } catch (e) { console.error('pack', e); } } };
const newUid = () => (store.packUid = (store.packUid || 0) + 1);

/** The slots, as they are (null for an empty one). Read only: change them through the functions here. */
export const packSlots = () => slots();
/** How many of a type (and key, if given) you have. */
export function count(type, key) {
  let n = 0;
  for (const it of slots()) if (it && it.type === type && (key === undefined || it.key === key)) n += it.n;
  return n;
}
export const has = (type, key) => count(type, key) > 0;
/** Every unit of a type, one entry each (a fish's length, a flower's colour), with its key. */
export function units(type) {
  const out = [];
  for (const it of slots()) if (it && it.type === type) for (let i = 0; i < it.n; i++) out.push({ key: it.key, unit: it.list ? it.list[i] : null });
  return out;
}
/** Would one more of this fit (on a stack of its own kind, or in an empty slot)? */
export function roomFor(type, key) {
  const max = kindOf(type).max, s = slots();
  return s.some((it) => !it) || (max > 1 && s.some((it) => it && it.type === type && it.key === key && it.n < max));
}
/** Put one in (with its own entry `unit`, if it has one). Returns false, changing nothing, if there is no room. */
export function add(type, key = null, unit = undefined) {
  const max = kindOf(type).max, s = slots();
  let it = max > 1 ? s.find((q) => q && q.type === type && q.key === key && q.n < max) : null;
  if (!it) {
    const at = s.indexOf(null);
    if (at < 0) return false;
    it = s[at] = { uid: newUid(), type, key, n: 0 };
  }
  it.n++;
  if (unit !== undefined) (it.list || (it.list = [])).push(unit);
  changed();
  return true;
}
/** Put in a whole item that does not stack (a bouquet): `{ type, key, list }`. Returns it, or null if there is no room. */
export function addItem(item) {
  const s = slots(), at = s.indexOf(null);
  if (at < 0) return null;
  const it = s[at] = Object.assign({ uid: newUid(), key: null, n: 1 }, item);
  changed();
  return it;
}
/**
 * Take one out: of this type, and this key if given (else from the last stack of the type). With
 * `pick(units)` choose which entry of that stack (an index). Returns `{ key, unit }`, or null.
 */
export function take(type, key, pick) {
  const s = slots();
  let at = -1;
  for (let i = s.length - 1; i >= 0; i--) if (s[i] && s[i].type === type && (key === undefined || key === null || s[i].key === key)) { at = i; break; }
  if (at < 0) return null;
  const it = s[at], k = it.list ? Math.max(0, Math.min(it.n - 1, pick ? pick(it.list) : it.n - 1)) : 0;
  const unit = it.list ? it.list.splice(k, 1)[0] : null;
  it.n--;
  if (it.n <= 0) { s[at] = null; if (store.hand === it.uid) store.hand = null; }
  changed();
  return { key: it.key, unit };
}
/** Take a whole item out by its uid (a bouquet given away). Returns it, or null. */
export function removeItem(uid) {
  const s = slots(), at = s.findIndex((q) => q && q.uid === uid);
  if (at < 0) return null;
  const it = s[at];
  s[at] = null;
  if (store.hand === uid) store.hand = null;
  changed();
  return it;
}
/** Take every one of a type (and key) out. Returns how many. */
export function takeAll(type, key) {
  const s = slots();
  let n = 0;
  s.forEach((it, i) => { if (it && it.type === type && (key === undefined || it.key === key)) { n += it.n; s[i] = null; if (store.hand === it.uid) store.hand = null; } });
  if (n) changed();
  return n;
}
/** Swap the contents of two slots (the grid lets you rearrange). */
export function swap(a, b) {
  const s = slots();
  if (a === b || a < 0 || b < 0 || a >= SLOTS || b >= SLOTS) return;
  [s[a], s[b]] = [s[b], s[a]];
  changed();
}

/** The item in your hand, or null. */
export function held() {
  if (!store.hand) return null;
  return slots().find((it) => it && it.uid === store.hand) || null;
}
/** Hold an item (by uid), or nothing (null). Only things that can be held. */
export function hold(uid) {
  const it = uid ? slots().find((q) => q && q.uid === uid) : null;
  store.hand = it && kindOf(it.type).holdable ? it.uid : null;
  changed();
}
/** For tests: the slots as plain data. */
export const packView = () => slots().map((it) => (it ? { slot: slots().indexOf(it), uid: it.uid, type: it.type, key: it.key, n: it.n, list: it.list ? it.list.slice() : undefined, held: store.hand === it.uid } : null));
