// The landmarks follow you. There is one jetty, one boat and skipper, one campfire, one bench in
// the game, and they stand at one lake at a time: the *anchor*. Only settled lakes can be the
// anchor (core/shape.js: they lie half a kilometre apart at the least), and each has its own set
// of landmarks: some lack a jetty, some a fire, some a bench.
//
// When you have left the anchor well behind and another settled lake is clearly the nearer one,
// everything moves there: far enough off, on both sides, to be lost in the haze. It never moves
// while you are sitting, fishing or out on the boat.
//
// Each place keeps what is its own. A bouquet left on a bench or in a boat, and a fire left
// burning, are put away under that lake's name when the landmarks leave, and brought out again
// when they come back (the save's `places`). The save's own `benchBouquet` and `boatBouquet`
// are always those of the place the landmarks stand at now, named by `anchor`.
import { ANCHOR, HOME, anchorTo, lakesNear, kitOf } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { store, saveSoon } from './save.js';
import { activity } from './activity.js';
import { player } from '../characters/player.js';
import { ferry } from '../characters/boat.js';
import { fire } from '../features/campfire.js';

/** Metres: how far round you settled lakes are looked for; how far behind the old one must be; how much nearer the new one. */
export const ANCHORING = { reach: 1500, behind: 280, nearer: 60 };
let current = store.anchor || 'home', since = 0;

/** The settled lakes about a spot, nearest first, each with what is built there. */
export const settledNear = (x, z, r = ANCHORING.reach) => lakesNear(x, z, r).filter((L) => L.settled);
const shore = (L, x, z) => Math.max(0, Math.hypot(L.x - x, L.z - z) - L.R0);

/** Move the landmarks to a lake (if they are not there), putting away the old place's things and bringing out this one's. */
export function moveAnchor(lake) {
  if (lake === ANCHOR && lake.id === current) return false;
  if (lake.id !== current) {
    const places = store.places || (store.places = {});
    places[current] = { benchBouquet: store.benchBouquet || null, boatBouquet: store.boatBouquet || null, fire: fire.on ? Math.max(1, Math.round(fire.left)) : 0 };
    const mine = places[lake.id] || {};
    store.benchBouquet = mine.benchBouquet || null;
    store.boatBouquet = mine.boatBouquet || null;
    fire.on = mine.fire > 0; fire.left = mine.fire || 0;
    current = store.anchor = lake.id;
  }
  if (lake !== ANCHOR) anchorTo(lake);
  // whoever stands on the landmarks moves what they built (the jetty, the boat's tour, the fire, the bouquets, the grass that keeps off them...)
  for (const fn of hooks.anchor) { try { fn(); } catch (e) { console.error('anchor', e); } }
  saveSoon();
  return true;
}

const idle = () => activity.free && !player.seat && ferry.state === 'docked';
/**
 * Now and then (call every tick): if another settled lake has become the place you are at, move
 * the landmarks there. With `now`, do it at once and whatever you are doing (on arriving
 * somewhere by the Places list, and when the game starts).
 */
export function updateAnchor(dt, now = false) {
  since += dt;
  if (!now && since < 0.5) return;
  since = 0;
  const near = settledNear(player.x, player.z);
  if (!near.length) { if (now && current !== 'home') moveAnchor(HOME); return; } // (nowhere settled within reach: the landmarks wait at home)
  const best = near.reduce((a, b) => (shore(b, player.x, player.z) < shore(a, player.x, player.z) ? b : a));
  if (best === ANCHOR && best.id === current) return;
  if (!now) {
    if (!idle()) return;
    const old = Math.hypot(ANCHOR.x - player.x, ANCHOR.z - player.z);
    if (old < ANCHORING.behind || shore(best, player.x, player.z) + ANCHORING.nearer > shore(ANCHOR, player.x, player.z)) return;
  }
  moveAnchor(best);
}

/** For the Places list and the tests: where the landmarks are, and the settled lakes about you with what each has. */
export const anchorId = () => ANCHOR.id;
export const settledAbout = (r) => settledNear(player.x, player.z, r).map((L) => ({ id: L.id, name: L.name, x: L.x, z: L.z, kit: Object.assign({}, kitOf(L)), turn: L.turn || 0, frozen: L.frozen, far: Math.round(shore(L, player.x, player.z)) }));
