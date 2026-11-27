// Places you have found, and postcards of them. Coming within reach of a named place (a lake, a
// shrine, a building, a stone circle, a cairn, a hot spring, your own camp) finds it: it goes in the
// places journal (per world: the journal shows the world you are in), and you can go back to it from
// there. A photo taken in photo mode near a place you have found also becomes a postcard of it in
// the album (a small picture, kept with your save, the most recent POSTCARDS of them).
import { HOME, lakesNear, shrineSitesNear, sitesNear } from '../core/shape.js';
import { hooks } from '../core/state.js';
import { player } from '../characters/player.js';
import { store, saveSoon } from '../systems/save.js';
import { onPhoto } from './photo.js';
import { placeName } from '../world/landmarks.js';
import { toast, onPanel, togglePanel } from '../ui/hud.js';
import { phaseName } from '../core/year.js';
import { seasonState } from '../core/state.js';
import { freeTravel } from '../core/env.js';
import { pointFor, travelToPoint } from './waypoints.js';

const POSTCARDS = 30;
export const KIND_LABEL = { heart: 'Blossom terrace', lake: 'Lake', shrine: 'Shrine', pagoda: 'Pagoda', castle: 'Castle', ruin: 'Ruins', hut: 'Stilt hut', windmill: 'Windmill', circle: 'Stone circle', cairn: 'Summit cairn', spring: 'Hot spring', icecastle: 'Ice castle', grotto: 'Crystal grotto', volcano: 'Volcano', beachhut: 'Beach hut', ship: 'Ship', skyisle: 'Floating islands', camp: 'Camp' };

/** The places near a spot that can be found: { id, kind, name, x, z, reach }. */
function placesNear(x, z) {
  const out = [];
  for (const L of lakesNear(x, z, 300)) out.push({ id: 'lake:' + L.id, kind: 'lake', name: L.name, x: L.x, z: L.z, reach: L.rmax * 1.6 });
  for (const s of shrineSitesNear(x, z, 120)) out.push({ id: 'shrine:' + s.id, kind: 'shrine', name: s.name, x: s.x, z: s.z, reach: 35 });
  for (const s of sitesNear(x, z, 200)) if (s.kind !== 'waystone') out.push({ id: 'site:' + s.id, kind: s.kind, name: placeName(s), x: s.x, z: s.z, reach: s.kind === 'castle' ? 60 : 30 });
  if (store.camp) out.push({ id: 'camp', kind: 'camp', name: 'Your camp', x: store.camp.x, z: store.camp.z, reach: 25 });
  return out;
}
const found = () => store.found || (store.found = []);
/** For tests: the places found in this world. */
export const foundView = () => found().slice();

export function initFoundPlaces(goTo) {
  let lookIn = 0;
  hooks.frame.push((dt) => {
    lookIn -= dt;
    if (lookIn > 0) return;
    lookIn = 1;
    for (const p of placesNear(player.x, player.z)) {
      if (Math.hypot(p.x - player.x, p.z - player.z) > p.reach || found().some((f) => f.id === p.id)) continue;
      found().push({ id: p.id, kind: p.kind, name: p.name, x: Math.round(p.x), z: Math.round(p.z), season: seasonState.nameHere || phaseName(seasonState.phaseHere ?? 0.5) });
      saveSoon();
      if (p.kind !== 'lake' || p.name !== HOME.name) toast(`Found: ${p.name}. It is in your journal (J).`, 3.5);
    }
  });
  // a photo near a place you have found is a postcard of it
  onPhoto((canvas) => {
    let best = null, bd = 150;
    for (const f of found()) { const d = Math.hypot(f.x - player.x, f.z - player.z); if (d < bd) { bd = d; best = f; } }
    if (!best) return;
    const w = 240, h = Math.round(w * canvas.height / canvas.width), c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(canvas, 0, 0, w, h);
    const cards = store.postcards || (store.postcards = []);
    cards.push({ name: best.name, kind: best.kind, img: c.toDataURL('image/jpeg', 0.72), season: seasonState.nameHere || phaseName(seasonState.phaseHere ?? 0.5), world: store.seedText || String(store.seed || '') });
    while (cards.length > POSTCARDS) cards.shift();
    saveSoon();
    toast(`A postcard of ${best.name} for your album.`, 3);
  });
  // the journal's places and postcards
  const placesEl = document.getElementById('placeList'), cardsEl = document.getElementById('postcards');
  if (!placesEl) return;
  onPanel('journal', (open) => {
    if (!open) return;
    const list = found();
    placesEl.replaceChildren(...(list.length ? list.slice().reverse().map((f) => {
      const li = document.createElement('li'); li.className = 'got';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = f.name;
      const st = document.createElement('span'); st.className = 'st'; st.textContent = KIND_LABEL[f.kind] || f.kind;
      li.append(nm, st);
      // (you travel only to home, your camp and woken waystones: features/waypoints.js; anywhere, when testing)
      const point = pointFor(f.id);
      if (point || freeTravel) {
        const go = document.createElement('button'); go.type = 'button'; go.className = 'btn'; go.textContent = 'Go';
        go.addEventListener('click', () => { if (point && !freeTravel) { togglePanel('journal', false); travelToPoint(point); } else goTo(f.x, f.z); });
        li.append(go);
      }
      return li;
    }) : [Object.assign(document.createElement('li'), { textContent: 'Nothing found yet: lakes, shrines, castles and other places go here as you come to them.' })]));
    const cards = store.postcards || [];
    cardsEl.replaceChildren(...cards.slice().reverse().map((c) => {
      const fig = document.createElement('figure'), img = document.createElement('img'), cap = document.createElement('figcaption');
      img.src = c.img; img.alt = c.name; cap.textContent = `${c.name} · ${c.season}`;
      fig.append(img, cap);
      return fig;
    }));
  });
}
