// Fishing (R), a game of timing rather than luck. Hold R to charge the cast (the further out, the
// bigger the fish that live there) and let go to throw. The float twitches with a nibble or two
// before the real bite pulls it under: strike on a nibble and you scare the fish off, wait too long
// after the bite and it's gone. Then the fight: hold R to reel, ease off while the fish pulls, and
// keep the line's tension out of the red without letting it go slack. Every species fights in its
// own fixed pattern, so you can learn them; the journal (J) notes how each one fights.
// Catches go into your backpack (8 fish at most) to feed the cats and dogs; with 8 you let them go.
// Different fish bite at different times, weathers and seasons. In winter you fish through the ice.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, clamp, lerp, damp, rnd } from '../core/math.js';
import { lakeT, lakeAt, lakeIce, lakeChill, groveAt, biomesAt, onIce, waterAhead, animalWalkable, onDock } from '../core/shape.js';
import { std } from '../core/materials.js';
import { clock } from '../core/clock.js';
import { hooks, seasonState, world } from '../core/state.js';
import { player, hero } from '../characters/player.js';
import { animals } from '../characters/animals.js';
import { boatSeat, ferry } from '../characters/boat.js';
import { activity } from '../systems/activity.js';
import { registerAction, bindKey, moving } from '../systems/actions.js';
import { camForward } from '../systems/input.js';
import { store } from '../systems/save.js';
import { timeCtl } from '../systems/time.js';
import { wx } from '../systems/weather.js';
import { spawnRipple, spawnHeart } from '../world/effects.js';
import { toast, togglePanel, onPanel } from '../ui/hud.js';
import { itemKind, units, count, add, take, roomFor } from '../systems/pack.js';
import { ICONS } from '../ui/icons.js';
import { plop, meow } from './voices.js';
import { hasRod } from './rod.js';

const hour = () => timeCtl.hour;
const isDawn = () => hour() > 4.8 && hour() < 8.5;
const isDusk = () => hour() > 17 && hour() < 20.5;
const isNight = () => hour() >= 20.5 || hour() < 4.8;
const isDay = () => hour() >= 8.5 && hour() < 17;
const rainy = () => wx.rain > 0.3;
const icy = () => lakeIce(lakeAt(player.x, player.z)) > 0.85; // (the lake you are fishing)

// tier: 1 small, 2 medium, 3 large (deeper water, harder fight, worth more to an animal).
// fight: the fixed rhythm of pulls (seconds pulling, seconds resting), repeated in order.
export const SPECIES = [
  { id: 'bluegill', name: 'Bluegill', color: '#5f8fa8', len: [12, 22], tier: 1, hint: 'Sunny days', w: () => (isDay() ? 3 : 0.4), fight: [[0.7, 1.4]], note: 'quick little tugs' },
  { id: 'perch', name: 'Yellow Perch', color: '#a9b04a', len: [15, 32], tier: 2, hint: 'Mornings, a little way out', w: () => (isDawn() || hour() < 12 ? 3 : 1), fight: [[1.0, 1.3]], note: 'steady, even pulls' },
  { id: 'carp', name: 'Common Carp', color: '#a8874a', len: [30, 72], tier: 3, hint: 'Warm afternoons, deep water', w: () => (hour() > 13 && hour() < 19 ? 2.5 : 0.6), fight: [[2.2, 1.2], [1.0, 0.8], [2.6, 1.4]], note: 'long, heavy runs' },
  { id: 'trout', name: 'Rainbow Trout', color: '#7d9a8a', len: [25, 52], tier: 2, hint: 'Dawn and rainy days', w: () => (isDawn() ? 2.5 : 0) + (rainy() ? 2.5 : 0) + 0.3, fight: [[0.6, 0.7], [1.2, 1.0]], note: 'darting bursts, then a longer one' },
  { id: 'catfish', name: 'Catfish', color: '#4f4c42', len: [30, 85], tier: 3, hint: 'Night, deep water', w: () => (isNight() ? 3.5 : 0.2), fight: [[1.8, 1.6], [1.8, 1.6], [3.0, 1.2]], note: 'slow, stubborn pulls, then a big one' },
  { id: 'pike', name: 'Northern Pike', color: '#5d7a3a', len: [40, 95], tier: 3, hint: 'Storms and autumn, deep water', w: () => (wx.storm > 0.3 ? 3 : 0) + (seasonState.name === 'Autumn' ? 1.2 : 0.2), fight: [[0.5, 0.6], [0.5, 0.6], [2.4, 1.0], [0.8, 1.2]], note: 'snapping jerks and a sudden long run' },
  { id: 'minnow', name: 'Silver Minnow', color: '#c8d0d6', len: [5, 10], tier: 1, hint: 'Any time, near the shore', w: () => 1.5, fight: [[0.5, 1.6]], note: 'barely a flutter' },
  { id: 'koi', name: 'Golden Koi', color: '#f2a03a', len: [30, 62], tier: 3, hint: 'Rare, at dusk, deep water', w: () => (isDusk() ? 0.35 : 0.04), fight: [[1.4, 0.9], [0.7, 0.5], [1.4, 0.9], [2.0, 1.5]], note: 'graceful sweeps that quicken' },
  { id: 'burbot', name: 'Burbot', color: '#6a5a3a', len: [30, 60], tier: 2, hint: 'Through the winter ice', w: () => (icy() ? 4 : 0), fight: [[1.3, 1.1], [0.6, 0.9]], note: 'sluggish rolls' },
  // fish of their own country (see countryOf)
  { id: 'char', name: 'Arctic Char', color: '#c8604a', len: [25, 55], tier: 2, hint: 'Cold lakes of the north and the heights', w: () => 1.6, fight: [[0.8, 0.8], [1.4, 1.0]], note: 'cold, quick runs' },
  { id: 'pupfish', name: 'Desert Pupfish', color: '#4f86d8', len: [4, 8], tier: 1, hint: 'Pools in the desert', w: () => 2.4, fight: [[0.4, 1.4]], note: 'a bright little flicker' },
  { id: 'bowfin', name: 'Bowfin', color: '#55603e', len: [40, 80], tier: 3, hint: 'Dark swamp water', w: () => 1.8 + (isNight() ? 1 : 0), fight: [[2.0, 1.2], [0.6, 0.6], [2.4, 1.3]], note: 'thrashing, then heavy pulls' },
  { id: 'glowfin', name: 'Moonlit Glowfin', color: '#7fe8ff', len: [18, 36], tier: 2, hint: 'Enchanted lakes, by night', w: () => (isNight() ? 3 : 0.1), fight: [[0.9, 0.7], [0.9, 0.7], [1.6, 1.2]], note: 'shimmering dashes' },
  { id: 'ember', name: 'Ember Carp', color: '#e8502a', len: [35, 70], tier: 3, hint: 'Warm water by the volcano', w: () => 1.4, fight: [[2.4, 1.2], [1.2, 0.6]], note: 'hot-tempered runs' },
];
/**
 * How much a fish belongs to the lake you are fishing (its country): trout, pike and char in cold
 * water; carp, catfish and bluegill in warm; bowfin and catfish in the swamp; koi by the blossom
 * groves; the pupfish in desert pools; the glowfin and the ember carp only in their wonders.
 */
function countryOf(s, L) {
  const c = Math.max(-0.6, Math.min(1, lakeChill(L))), cold = Math.max(0, c), warm = Math.max(0, -c) / 0.6, B = L.biomes || (L.biomes = biomesAt(L.x, L.z, 1)), grove = L.grove !== undefined ? L.grove : (L.grove = groveAt(L.x, L.z));
  switch (s.id) {
    case 'bluegill': return (1 - cold * 0.8) * (1 + warm * 0.5);
    case 'perch': return 1 - cold * 0.4;
    case 'carp': return (0.4 + warm * 1.2 + (L.clime ? L.clime.lush : 0)) * (1 - cold * 0.8);
    case 'trout': return 0.5 + cold * 1.6 - warm * 0.4;
    case 'catfish': return (1 + warm * 0.6 + B.swamp * 2) * (1 - cold * 0.8);
    case 'pike': return 0.6 + cold * 1.2;
    case 'koi': return 1 + grove * 6;
    case 'char': return Math.max(0, cold - 0.25) * 3;
    case 'pupfish': return B.desert > 0.3 ? 2 : 0;
    case 'bowfin': return B.swamp > 0.3 ? 1.5 : 0;
    case 'glowfin': return B.enchanted > 0.3 ? 2 : 0;
    case 'ember': return B.volcanic > 0.3 ? 2 : 0;
    default: return 1;
  }
}
export const VALUE = { 1: 1, 2: 2, 3: 3 };           // trust a fish is worth to a cat or dog
const BITE_WINDOW = { 1: 1.2, 2: 0.8, 3: 0.55 };    // seconds to strike once the float goes under
const FIGHT_LEN = { 1: 5, 2: 10, 3: 18 };           // rough seconds to land, played well
const PULL_TENSION = { 1: 0.55, 2: 0.75, 3: 0.95 }; // tension added per second reeling into a pull
const TAKE = { 1: 0.035, 2: 0.055, 3: 0.075 };      // line a pulling fish takes back per second
// depth: how far out the float must land for each tier (lakeT: 1 at the shore, 0 at the middle)
const DEPTH = { 1: 1.2, 2: 0.86, 3: 0.72 };
export const CREEL_MAX = 8;
itemKind('fish', {
  name: (it) => speciesName(it.key), max: CREEL_MAX,
  icon: (it) => ICONS.fish((SPECIES.find((q) => q.id === it.key) || {}).color),
  detail: (it) => `${it.n} caught · ${it.list.map((cm) => cm + ' cm').join(', ')}. Cats and dogs love them.`,
});

/**
 * How fast reeling wins line from this fish: set so that reeling through every rest and easing off
 * through every pull lands it in about FIGHT_LEN seconds, whatever its rhythm.
 */
function reelRateOf(sp) {
  const n = sp.fight.length, pull = sp.fight.reduce((a, p) => a + p[0], 0) / n, rest = sp.fight.reduce((a, p) => a + p[1], 0) / n;
  const cycles = FIGHT_LEN[sp.tier] / (pull + rest);
  return (1 / cycles + TAKE[sp.tier] * pull) / rest;
}
function pickSpecies(depthT) {
  const L = lakeAt(player.x, player.z);
  const ws = SPECIES.map((s) => (depthT > DEPTH[s.tier] ? 0 : Math.max(0, s.w()) * Math.max(0, countryOf(s, L)) * (icy() && s.id !== 'burbot' ? 0.4 : 1)));
  let r = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < SPECIES.length; i++) { r -= ws[i]; if (r <= 0) return SPECIES[i]; }
  return SPECIES[6];
}
const relaxed = () => !!(store.settings && store.settings.relaxedFishing);

// ── fish you carry (in the backpack) to feed the animals ──
/** The fish you're carrying: [{ id, cm }]. */
export const creel = () => units('fish').map((u) => ({ id: u.key, cm: u.unit }));
const spOf = (id) => SPECIES.find((s) => s.id === id);
export const fishValue = (f) => VALUE[(spOf(f.id) || SPECIES[6]).tier];
export const speciesName = (id) => (spOf(id) || { name: 'fish' }).name;
/** Take a fish out of the creel: `prefer` (a species id) if you have one, else the most valuable. */
export function takeFish(prefer) {
  const c = creel();
  if (!c.length) return null;
  let i = prefer ? c.findIndex((f) => f.id === prefer) : -1;
  if (i < 0) { i = 0; c.forEach((f, k) => { if (fishValue(f) > fishValue(c[i])) i = k; }); }
  const t = take('fish', c[i].id, (cms) => cms.indexOf(c[i].cm));
  renderCreel();
  return t ? { id: t.key, cm: t.unit } : null;
}
let creelEl = null;
function renderCreel() {
  if (!creelEl) return;
  creelEl.hidden = !hasRod();
  creelEl.textContent = `Fish ${count('fish')}/${CREEL_MAX}`;
}

function makeFish(sp, cm) {
  const L = cm / 100;
  const g = new THREE.Group();
  const mat = std(sp.color, sp.id === 'koi' ? { emissive: '#7a3c00', emissiveIntensity: 0.4 } : { metalness: 0.2, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat);
  body.scale.set(L * 0.09, L * 0.17, L * 0.5);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(L * 0.14, L * 0.22, 4).rotateX(Math.PI / 2), mat);
  tail.position.z = -L * 0.55;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(L * 0.06, L * 0.18, 3), mat);
  fin.position.set(0, L * 0.17, -L * 0.05); fin.rotation.x = -0.6;
  g.add(body, tail, fin);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const F = {
  state: 'idle', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), biteIn: 0, fish: null, sp: null, cm: 0, buddy: null, iceHole: false, quietT: 0,
  power: 0, depth: 1, nibbles: 0, nibbleIn: 0, nibOn: 0, tens: 0, prog: 0, pull: false, pattern: 0, patternT: 0, redT: 0, slackT: 0, kept: false, tapped: false,
};
export const fishingState = () => F.state;
/** For tests: the fight's numbers. */
export const fishingInfo = () => ({ state: F.state, tension: F.tens, progress: F.prog, pulling: F.pull, power: F.power, species: F.sp && F.sp.id });

// R held (keyboard) or the on-screen Reel button held (touch)
let rHeld = false, touchHeld = false;
const typing = (e) => e.target && ((e.target.tagName === 'INPUT' && e.target.type !== 'range') || e.target.tagName === 'TEXTAREA');
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || typing(e) || e.repeat) return;
  rHeld = true;
  if (F.state === 'charge' && F.t === 0) F.tapped = false; // this same press started the charge: it's a hold, not a tap
});
window.addEventListener('keyup', (e) => { if (e.code === 'KeyR') { rHeld = false; releaseCharge(); } });
window.addEventListener('blur', () => { rHeld = false; touchHeld = false; });
let releaseCharge = () => {};

export function initFishing() {
  const journal = store.journal;

  // ── on-screen pieces: the creel count, and the cast/fight gauge ──
  creelEl = document.createElement('p');
  creelEl.className = 'creel auto-hide';
  document.querySelector('.brand').appendChild(creelEl);
  renderCreel();
  const gauge = document.createElement('div');
  gauge.className = 'gauge glass';
  gauge.hidden = true;
  gauge.innerHTML = '<p class="g-label"></p><div class="g-bar"><i class="g-red"></i><b class="g-fill"></b></div><div class="g-prog"><b></b></div><button type="button" class="g-reel">Hold to reel</button>';
  document.body.appendChild(gauge);
  const gLabel = gauge.querySelector('.g-label'), gFill = gauge.querySelector('.g-fill'), gProgFill = gauge.querySelector('.g-prog b'), gReel = gauge.querySelector('.g-reel');
  const hold = (on) => (e) => { e.preventDefault(); touchHeld = on; if (!on) releaseCharge(); };
  gReel.addEventListener('pointerdown', hold(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => gReel.addEventListener(ev, hold(false)));

  const rod = new THREE.Group();
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.02, 1.9, 5).translate(0, 0.95, 0), std('#6b4a2e'));
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.28, 6).translate(0, 0.08, 0), std('#c9a46a'));
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8).rotateZ(Math.PI / 2), std('#3a3a3a'));
    reel.position.set(0, 0.25, 0.05);
    rod.add(pole, grip, reel);
    rod.position.set(0, -hero.dims.arm + 0.03, 0.03); rod.scale.setScalar(0.85);
    rod.visible = false;
    hero.arms[1].add(rod);
  }
  const tip = new THREE.Vector3(), tipLocal = new THREE.Vector3(0, 1.9, 0);
  const bobber = new THREE.Group();
  bobber.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, 0, Math.PI / 2), std('#e04a3a')), new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, TAU, Math.PI / 2, Math.PI / 2), std('#f4f1ea')));
  bobber.visible = false;
  scene.add(bobber);
  const hole = new THREE.Group();
  hole.add(new THREE.Mesh(new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b2c36' })), new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 4, 14).rotateX(Math.PI / 2), std('#e9eef3')));
  hole.visible = false;
  scene.add(hole);
  const LINE_PTS = 14;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_PTS * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.6 }));
  line.frustumCulled = false;
  line.visible = false;
  scene.add(line);

  const bob = new THREE.Vector3();
  const isWater = (x, z) => lakeT(x, z) < 0.97 && !onDock(x, z);
  /** Where a cast of this power lands (null if there's no water ahead). */
  const castSpot = (power = 0) => {
    if (icy()) {
      if (!onIce(player.x, player.z)) return null;
      const f = camForward(), x = player.x + f.x * 1.4, z = player.z + f.z * 1.4;
      return lakeT(x, z) < 0.97 ? { x, z, ice: true } : null;
    }
    const f = camForward(), want = 3 + power * 6;
    for (let d = want; d >= 2.5; d -= 0.5) {
      const x = player.x + f.x * d, z = player.z + f.z * d;
      if (isWater(x, z)) return { x, z, ice: false };
    }
    const p = waterAhead(player, f, [5.5, 4.5, 6.5, 8, 3.5]);
    return p ? { x: p.x, z: p.z, ice: false } : null;
  };
  const canFish = () => activity.free || (activity.is('sit') && player.seat === boatSeat && ferry.state === 'docked');
  const biteDelay = () => {
    let d = rnd(5, 12);
    if (isDawn() || isDusk()) d *= 0.6;
    if (rainy()) d *= 0.75;
    if (wx.storm > 0.3) d *= 1.25;
    return d;
  };
  const callBuddy = () => {
    if (F.buddy && F.buddy.goal) return;
    let best = null, bd = 40;
    for (const a of animals) {
      if (a.kind !== 'cat' || a.goal || a.petted || a.state === 'shelter' || !a.tamed) continue; // only your own cats keep you company
      const d = Math.hypot(a.x - player.x, a.z - player.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) return;
    const f = camForward();
    for (const side of [1, -1]) {
      const x = player.x - f.z * side * 1.1 - f.x * 0.3, z = player.z + f.x * side * 1.1 - f.z * 0.3;
      if (animalWalkable(x, z)) { best.goal = { x, z, faceX: F.to.x, faceZ: F.to.z, src: 'fish' }; F.buddy = best; return; }
    }
  };
  const releaseBuddy = () => {
    if (F.buddy && F.buddy.goal && F.buddy.goal.src === 'fish') F.buddy.goal = null;
    F.buddy = null;
  };

  const stop = (msg) => {
    F.state = 'idle';
    activity.leave('fish');
    rod.visible = false; bobber.visible = false; line.visible = false; hole.visible = false;
    if (F.fish) { scene.remove(F.fish); F.fish = null; }
    if (msg) toast(msg);
    F.quietT = 0; F.tapped = false;
  };
  const throwLine = () => {
    const spot = castSpot(F.power);
    if (!spot) { stop('Face the lake from the jetty or the shore to cast.'); return; }
    F.iceHole = spot.ice;
    F.to.set(spot.x, 0.05, spot.z);
    F.depth = lakeT(spot.x, spot.z) * (player.seat === boatSeat ? 0.8 : 1); // the moored boat sits over deeper water
    F.state = 'cast'; F.t = 0;
    if (spot.ice) { hole.position.set(spot.x, 0.05, spot.z); hole.visible = true; }
    callBuddy();
  };
  const startCharge = () => {
    if (!canFish() || !castSpot()) { toast(icy() ? 'The lake is frozen. Walk out onto the ice to fish through a hole.' : 'Face the lake from the jetty or the shore to cast.'); return; }
    if (!activity.enter('fish')) return;
    if (!player.seat) { const f = camForward(); player.rot = Math.atan2(f.x, f.z); }
    rod.visible = true;
    if (icy()) { F.power = 0; throwLine(); return; } // a hole needs no cast
    F.state = 'charge'; F.t = 0; F.power = 0;
    F.tapped = !rHeld && !touchHeld; // touch or a click on the prompt: a second tap throws
  };
  releaseCharge = () => { if (F.state === 'charge' && !F.tapped) throwLine(); };
  const scheduleBite = () => { F.state = 'wait'; F.biteIn = biteDelay(); F.nibbles = 1 + Math.floor(rnd() * 3); F.nibbleIn = F.biteIn / (F.nibbles + 1); F.nibOn = 0; };
  const strike = () => {
    if (F.state === 'bite') { // hooked: the fight begins (the fish was chosen when it bit)
      const [a, b] = F.sp.len;
      F.cm = Math.round(a + Math.pow(rnd(), 1.6) * (b - a));
      F.state = 'fight'; F.tens = 0.35; F.prog = 0; F.pattern = 0; F.patternT = 0; F.pull = false; F.redT = 0; F.slackT = 0;
      spawnRipple(bob.x, bob.z, 0.9); plop(bob.x, bob.z, 1.2);
      return;
    }
    if (F.state === 'wait' && F.nibOn > 0) { // too early: struck at a nibble
      toast('Too soon! That was only a nibble, and the fish is gone. Wait for the float to go right under.', 4);
      F.biteIn = biteDelay() * 1.3; F.nibbles = 1 + Math.floor(rnd() * 3); F.nibbleIn = F.biteIn / (F.nibbles + 1); F.nibOn = 0;
      return;
    }
    stop('You reel in your line.');
  };

  registerAction({ id: 'fish-hook', key: 'KeyR', keyLabel: 'R', score: () => 1000, urgent: () => true, available: () => F.state === 'bite', label: () => 'Strike!', run: strike });
  registerAction({ id: 'fish-reel', key: 'KeyR', keyLabel: 'R', score: () => 900, available: () => F.state === 'wait', label: () => 'Reel in (wait for the float to go under)', run: strike });
  registerAction({ id: 'fish-throw', key: 'KeyR', keyLabel: 'R', score: () => 950, urgent: () => true, available: () => F.state === 'charge' && F.tapped, label: () => 'Cast!', run: throwLine });
  let spotCache = null;
  registerAction({ // at the water without a rod: say where to get one
    id: 'fish-norod', key: 'KeyR', keyLabel: 'R', score: () => -1,
    available: () => !hasRod() && F.state === 'idle' && canFish() && !moving() && spotCache,
    disabled: () => true,
    label: () => 'No rod yet: the skipper has one',
    run: () => {},
  });
  registerAction({
    id: 'fish-cast', key: 'KeyR', keyLabel: 'R', score: () => 0,
    available: () => hasRod() && F.state === 'idle' && canFish() && !moving() && spotCache,
    label: () => (icy() ? 'Fish through the ice' : 'Hold to cast a line'),
    run: startCharge,
  });

  // journal
  const listEl = document.getElementById('journalList'), sumEl = document.getElementById('journalSummary');
  const renderJournal = () => {
    const caught = SPECIES.filter((s) => journal[s.id]);
    sumEl.textContent = `${caught.length} of ${SPECIES.length} species`;
    listEl.replaceChildren(...SPECIES.map((s) => {
      const j = journal[s.id];
      const li = document.createElement('li');
      li.className = j ? 'got' : '';
      const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = j ? s.color : 'transparent';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = j ? s.name : 'Not yet caught';
      const st = document.createElement('span'); st.className = 'st'; st.textContent = j ? `${j.n} caught · best ${j.best} cm · fights in ${s.note}` : s.hint;
      li.append(sw, nm, st);
      return li;
    }));
  };
  onPanel('journal', (open) => { if (open) renderJournal(); });
  bindKey('KeyJ', () => togglePanel('journal'));

  const landed = () => {
    F.state = 'reel'; F.t = 0;
    F.fish = makeFish(F.sp, F.cm);
    F.fish.position.copy(bob);
    scene.add(F.fish);
  };

  const tmp = new THREE.Vector3();
  let spotIn = 0;
  hooks.frame.push((dt, t) => {
    spotIn -= dt;
    if (spotIn <= 0) { spotCache = F.state === 'idle' && canFish() ? castSpot() : null; spotIn = 0.25; renderCreel(); }
    const busy = F.state !== 'idle' && F.state !== 'show' && F.state !== 'release';
    if (busy && moving() && !player.seat) stop('You reel in your line.');
    if (F.state !== 'idle' && player.seat && player.seat !== boatSeat) stop();
    if (F.state !== 'idle' && player.seat === boatSeat && ferry.state !== 'docked') stop('You reel in as the boat sets off.');
    if (F.state !== 'idle' && F.iceHole && !icy()) stop('The ice is thawing. You pull your line out of the hole.');
    rod.updateMatrixWorld(true);
    tip.copy(tipLocal); rod.localToWorld(tip);
    const held = rHeld || touchHeld;

    if (F.state === 'charge') {
      F.t += dt;
      F.power = 1 - Math.abs(((F.t / 1.4) % 2) - 1); // swings out and back: let go at the right moment
      gauge.classList.add('casting'); gauge.classList.remove('fighting', 'pulling', 'danger');
      gLabel.textContent = F.tapped ? 'Tap Cast! when the bar is where you want it' : 'Let go of R to cast: further out, bigger fish';
      gFill.style.width = `${F.power * 100}%`;
    } else if (F.state === 'cast') {
      F.t += dt / 0.8;
      if (F.t > 0.35) {
        if (!bobber.visible) { bobber.visible = true; line.visible = true; F.from.copy(tip); }
        const k = clamp((F.t - 0.35) / 0.65, 0, 1);
        bob.lerpVectors(F.from, F.to, k);
        bob.y = lerp(F.from.y, F.to.y, k) + Math.sin(k * Math.PI) * 1.5;
        if (k >= 1) { scheduleBite(); spawnRipple(F.to.x, F.to.z, 0.7); plop(F.to.x, F.to.z, 0.9); }
      }
    } else if (F.state === 'wait') {
      F.biteIn -= dt; F.nibbleIn -= dt;
      if (F.nibOn > 0) F.nibOn -= dt;
      if (F.nibbles > 0 && F.nibbleIn <= 0) { F.nibbles--; F.nibOn = 0.4; F.nibbleIn = F.biteIn / (F.nibbles + 1); spawnRipple(F.to.x, F.to.z, 0.35); }
      const dip = F.nibOn > 0 ? Math.abs(Math.sin((0.4 - F.nibOn) * 24)) * 0.035 : 0;
      bob.set(F.to.x, 0.05 + Math.sin(t * 2.2) * 0.012 - dip, F.to.z);
      if (F.biteIn <= 0 && F.nibOn <= 0) {
        // the real bite: the float plunges; the strike window depends on what's down there
        F.sp = pickSpecies(F.depth);
        F.state = 'bite'; F.t = BITE_WINDOW[F.sp.tier] * (relaxed() ? 1.8 : 1);
        hero.face.flash('wow', 1.2);
        spawnRipple(F.to.x, F.to.z, 0.8); plop(F.to.x, F.to.z, 1);
      }
    } else if (F.state === 'bite') {
      F.t -= dt;
      bob.set(F.to.x + Math.sin(t * 30) * 0.03, 0.05 - 0.09 - Math.abs(Math.sin(t * 14)) * 0.05, F.to.z);
      if (F.t <= 0) { toast('Too slow, it got away. Wait for the next bite.'); hero.face.flash('think', 2); scheduleBite(); }
    } else if (F.state === 'fight') {
      // the fish's fixed rhythm: pull, rest, pull…
      const sp = F.sp, tier = sp.tier, pat = sp.fight[F.pattern % sp.fight.length];
      F.patternT += dt;
      if (F.pull ? F.patternT > pat[0] : F.patternT > pat[1]) { F.patternT = 0; if (F.pull) F.pattern++; F.pull = !F.pull; }
      const soft = relaxed() ? 0.6 : 1, reelRate = reelRateOf(sp);
      if (held) {
        F.prog += dt * reelRate * (F.pull ? 0.25 : 1);
        F.tens += dt * (F.pull ? PULL_TENSION[tier] * soft : 0.12);
      } else {
        F.tens -= dt * 0.55;
        if (F.pull) F.prog -= dt * TAKE[tier];
      }
      F.tens = clamp(F.tens, 0, 1); F.prog = clamp(F.prog, 0, 1);
      F.redT = F.tens > 0.82 ? F.redT + dt : Math.max(0, F.redT - dt * 2);
      F.slackT = F.tens < 0.05 ? F.slackT + dt : 0;
      // the float drags about with the fish and comes in as you win line
      const ang = t * (F.pull ? 3.1 : 1.2), k = F.prog * 0.75, wob = F.pull ? 0.35 : 0.12;
      bob.set(lerp(F.to.x, player.x, k) + Math.sin(ang) * wob, 0.02 - (F.pull ? 0.05 : 0), lerp(F.to.z, player.z, k) + Math.cos(ang * 0.8) * wob);
      if (F.pull && rnd() < dt * 6) spawnRipple(bob.x, bob.z, 0.4);
      gauge.classList.add('fighting'); gauge.classList.remove('casting');
      gauge.classList.toggle('pulling', F.pull); gauge.classList.toggle('danger', F.tens > 0.82);
      gLabel.textContent = F.pull ? 'It\'s pulling! Ease off' : held ? 'Reeling…' : 'Hold R to reel';
      gFill.style.width = `${F.tens * 100}%`;
      gProgFill.style.width = `${F.prog * 100}%`;
      if (F.redT > (relaxed() ? 2.5 : 1.5)) { stop('Snap! The line was pulled too tight and the fish is gone.'); hero.face.flash('sad', 3); }
      else if (F.slackT > (relaxed() ? 3.5 : 2)) { stop('The line went slack and the fish slipped the hook.'); hero.face.flash('sad', 3); }
      else if (F.prog >= 1) landed();
    } else if (F.state === 'reel') {
      F.t += dt / 0.9;
      const k = clamp(F.t, 0, 1);
      bob.set(lerp(bob.x, tip.x, k * 0.3), lerp(0.05, tip.y, k) + Math.sin(k * Math.PI) * 0.6, lerp(bob.z, tip.z, k * 0.3));
      F.fish.position.set(bob.x, bob.y - 0.12, bob.z);
      F.fish.rotation.set(Math.PI / 2 - 0.3, Math.atan2(tip.x - bob.x, tip.z - bob.z), Math.sin(t * 25) * 0.5);
      if (k >= 1) {
        F.state = 'show'; F.t = 2.6;
        bobber.visible = false; line.visible = false;
        const j = journal[F.sp.id];
        journal[F.sp.id] = { n: (j ? j.n : 0) + 1, best: Math.max(j ? j.best : 0, F.cm) };
        F.kept = count('fish') < CREEL_MAX && roomFor('fish', F.sp.id) && add('fish', F.sp.id, F.cm);
        renderCreel();
        const record = j && F.cm > j.best;
        const where = F.kept ? ` · into your backpack (${count('fish')}/${CREEL_MAX})` : count('fish') >= CREEL_MAX ? ` · you carry ${CREEL_MAX} fish already, so you let it go` : ' · your backpack is full, so you let it go';
        toast(`${!j ? 'New species! ' : record ? 'New record! ' : ''}You caught a ${F.sp.name} · ${F.cm} cm${where}`, 4.5);
        hero.face.flash(!j || record ? 'love' : 'happy', 3.5);
        world.caughtAt = clock.elapsed; // (a friend watching cheers)
        if (F.buddy) {
          for (let i = 0; i < 3; i++) setTimeout(() => { if (F.buddy) spawnHeart(F.buddy); }, i * 300);
          meow(F.buddy.x, F.buddy.z, 1.1);
        }
        if (!document.getElementById('journal').hidden) renderJournal();
      }
    } else if (F.state === 'show') {
      F.t -= dt;
      hero.arms[1].updateMatrixWorld(true);
      tmp.set(0, -hero.dims.arm - 0.06, 0.1); hero.arms[1].localToWorld(tmp);
      F.fish.position.copy(tmp);
      F.fish.rotation.set(Math.sin(t * 9) * 0.25, player.rot + Math.PI / 2, 0);
      if (F.t <= 0) {
        if (F.kept) stop(); // it goes in the backpack
        else { F.state = 'release'; F.t = 0; F.from.copy(F.fish.position); }
      }
    } else if (F.state === 'release') {
      F.t += dt / 0.8; // no room: the fish leaps back into the lake
      const k = clamp(F.t, 0, 1);
      F.fish.position.lerpVectors(F.from, F.to, k);
      F.fish.position.y = lerp(F.from.y, 0, k) + Math.sin(k * Math.PI) * 0.8;
      F.fish.rotation.x = -Math.cos(k * Math.PI) * 1.2;
      if (k >= 1) { spawnRipple(F.to.x, F.to.z, 0.9); plop(F.to.x, F.to.z, 1); stop(); }
    }
    gauge.hidden = F.state !== 'charge' && F.state !== 'fight';

    if (bobber.visible) bobber.position.copy(bob);
    if (line.visible) {
      const arr = lineGeo.attributes.position.array, sag = F.state === 'wait' ? 0.35 : F.state === 'fight' ? 0.3 * (1 - F.tens) : 0.08;
      for (let i = 0; i < LINE_PTS; i++) {
        const s = i / (LINE_PTS - 1);
        arr[i * 3] = lerp(tip.x, bob.x, s);
        arr[i * 3 + 1] = lerp(tip.y, bob.y + 0.05, s) - Math.sin(s * Math.PI) * sag;
        arr[i * 3 + 2] = lerp(tip.z, bob.z, s);
      }
      lineGeo.attributes.position.needsUpdate = true;
    }
    if (F.state === 'idle' && F.buddy) {
      F.quietT += dt;
      const g = F.buddy.goal;
      if (F.quietT > 15 || (g && Math.hypot(g.x - player.x, g.z - player.z) > 4)) releaseBuddy();
    }
  });

  // arm and rod: rodWorld is the rod's angle from straight up toward the front
  let armX = -0.85, rodWorld = 1.0;
  hooks.pose.push((dt) => {
    if (F.state === 'idle') return;
    let wantArm = -0.85, wantRod = 1.0;
    if (F.state === 'charge') { wantArm = lerp(-1.2, -2.6, F.power); wantRod = lerp(0.6, -0.5, F.power); }
    else if (F.state === 'cast') { const k = clamp(F.t / 0.45, 0, 1), e = k * k * (3 - 2 * k); wantArm = lerp(-2.5, -0.85, e); wantRod = lerp(-0.5, 1.0, e); }
    else if (F.state === 'bite') { wantArm = -0.95; wantRod = 0.8; }
    else if (F.state === 'fight') { wantArm = -1.25 + Math.sin(clock.elapsed * (F.pull ? 22 : 10)) * (F.pull ? 0.1 : 0.04); wantRod = lerp(0.85, 0.35, F.tens); }
    else if (F.state === 'reel') { wantArm = -1.3 + Math.sin(clock.elapsed * 14) * 0.08; wantRod = 0.45; }
    else if (F.state === 'show' || F.state === 'release') { wantArm = -0.7; wantRod = 0.3; }
    else wantArm += Math.sin(clock.elapsed * 1.3) * 0.03;
    armX = F.state === 'cast' ? wantArm : damp(armX, wantArm, 10, dt);
    rodWorld = F.state === 'cast' ? wantRod : damp(rodWorld, wantRod, 8, dt);
    if (F.state === 'fight') hero.face.flash(F.pull ? 'wow' : 'grit', 0.25); // straining at the rod
    hero.arms[1].rotation.x = armX;
    hero.arms[1].rotation.z = 0;
    hero.elbows[0].rotation.x = hero.elbows[1].rotation.x = 0; // both arms straight on the rod
    hero.chest.rotation.y = 0;
    hero.arms[0].rotation.x = armX * 0.75; hero.arms[0].rotation.z = 0.28;
    rod.rotation.x = rodWorld - hero.body.rotation.x - hero.chest.rotation.x - armX;
  });
}
