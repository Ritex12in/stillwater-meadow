// Harbours and passages (core/shape.js harboursOf, passagesFrom): each continent has a harbour on its
// coast facing each neighbour across the sea, and a skipper there sails you over to the harbour facing
// it on the other side (the view fades out while you sail; the sailing itself is not shown yet). You
// need not have been to the far harbour before: that is how you reach a continent the first time.
// A harbour you have been to is a point you can travel to from the map, as a woken waystone is
// (`store.harbours`, per world: features/waypoints.js knownHarbours).
import { harboursNear, passagesFrom, harbourById, harbourWork, continentAt } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { saveSoon } from '../systems/save.js';
import { toast, togglePanel, onPanel } from '../ui/hud.js';
import { knownHarbours, harbourKnown, travelToPoint, tracked, track } from './waypoints.js';

const VISIT = 16, SAIL_REACH = 9, SAIL_MS = 1500;
const WAYS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const wayTo = (dx, dz) => WAYS[Math.round(((Math.atan2(dx, -dz) * 180) / Math.PI + 360) / 45) % 8]; // (north is -z)
const km = (m) => (m / 1000).toFixed(1) + ' km';

/** Note a harbour as visited. Returns whether it was new. */
function learn(h) {
  if (harbourKnown(h.id)) return false;
  knownHarbours().push({ id: h.id, name: h.name, x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10, ax: h.ax, az: h.az });
  if (tracked() && tracked().id === h.id) track(null); // (you have come to what you were tracking)
  saveSoon();
  return true;
}
/** The harbour whose jetty you stand at, or null. */
const atHarbour = () => { const h = harboursNear(player.x, player.z, 40, true)[0]; return h && Math.hypot(h.x - player.x, h.z - player.z) < SAIL_REACH ? h : null; };

/** Sail from a harbour to another (one of its passages). */
export function sail(to) {
  if (!to) return false;
  const ok = travelToPoint({ id: to.id, kind: 'harbour', name: to.name, x: to.x, z: to.z, ax: to.ax, az: to.az, say: `You sail across the sea to ${to.name}, on ${to.cont.name}.`, ms: SAIL_MS });
  if (ok) learn(to); // (only if you do set sail)
  return ok;
}

let here = null; // (the harbour the panel was opened at)
function fill() {
  const list = document.getElementById('harbourList'), title = document.getElementById('harbourTitle'), sum = document.getElementById('harbourSummary');
  if (!list || !here) return;
  title.textContent = here.name;
  sum.textContent = here.cont.name;
  list.replaceChildren(...passagesFrom(here).map((t) => {
    const li = document.createElement('li'), b = document.createElement('b'), span = document.createElement('span'), go = document.createElement('button');
    b.textContent = t.name;
    span.textContent = `${t.cont.name} · ${km(Math.hypot(t.x - here.x, t.z - here.z))} across the sea to the ${wayTo(t.x - here.x, t.z - here.z)}${harbourKnown(t.id) ? '' : ' · not yet visited'}`;
    go.type = 'button'; go.className = 'btn primary'; go.textContent = 'Sail'; go.dataset.harbour = t.id;
    go.addEventListener('click', () => { togglePanel('harbourPanel', false); sail(t); });
    li.append(b, span, go);
    return li;
  }));
}

/** For tests: the harbours about you, those you have been to, and where the passages from the nearest go. */
export const harboursView = () => {
  const near = harboursNear(player.x, player.z, 12000).map((h) => ({ id: h.id, name: h.name, x: h.x, z: h.z, ax: h.ax, az: h.az, cont: h.cont.name, known: harbourKnown(h.id) }));
  const h0 = near[0] ? harbourById(near[0].id) : null;
  return { near, known: knownHarbours().map((h) => Object.assign({}, h)), passages: h0 ? passagesFrom(h0).map((t) => ({ id: t.id, name: t.name, cont: t.cont.name, x: t.x, z: t.z })) : [], at: atHarbour() && atHarbour().id };
};

export function initHarbours() {
  onPanel('harbourPanel', (o) => { if (o) { if (document.pointerLockElement) document.exitPointerLock(); fill(); } });
  registerAction({
    id: 'harbour-sail', key: 'KeyE', keyLabel: 'E', score: () => 24,
    available: () => activity.free && !!atHarbour(),
    label: () => 'Take a passage',
    run: () => { here = atHarbour(); if (here) { learn(here); togglePanel('harbourPanel', true); } },
  });
  // coming to a harbour: it is noted, and the skipper says where he sails
  // worked out a little each frame (core/shape.js harbourWork), ahead of need: the harbours of the
  // continent you are on, and, as you near one of them, those of the continents it sails to
  let lookIn = 0;
  const work = [];
  hooks.frame.push((dt) => {
    while (work.length && harbourWork(work[0], 2)) work.shift();
    lookIn -= dt;
    if (lookIn > 0) return;
    lookIn = 0.5;
    const c = continentAt(player.x, player.z);
    if (c && !c.harbours && !work.includes(c)) work.unshift(c);
    const near = harboursNear(player.x, player.z, 400, true)[0];
    if (near) for (const o of near.serves) if (!o.harbours && !work.includes(o)) work.push(o);
    const h = near && Math.hypot(near.x - player.x, near.z - player.z) < VISIT ? near : null;
    if (!h || !learn(h)) return;
    const to = h.serves.every((o) => o.harbours) ? passagesFrom(h).map((t) => t.cont.name) : h.serves.map((o) => o.name);
    toast(`${h.name}. A skipper here sails to ${to.length > 1 ? to.slice(0, -1).join(', ') + ' and ' + to[to.length - 1] : to[0] || 'nowhere just now'}: press E at the jetty. You can travel back here from the map (M).`, 6);
  });
}
