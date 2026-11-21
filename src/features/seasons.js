// Seasons, place by place. The time of year (core/year.js) is the same everywhere; what it does
// depends on where you are: a cold upland is white while the valley below is in autumn colour, and
// a warm coast stays green all winter. This module keeps the year moving (or held at a picked
// season), reads how the season is where you stand (for the things that are only near you: the
// colour of the grass, falling leaves, insects, what you wear) and recolours each tree by its own
// place.
import * as THREE from 'three';
import { clamp, damp, rnd, mulberry32, hash } from '../core/math.js';
import { query } from '../core/env.js';
import { glowTex } from '../core/materials.js';
import { hooks, seasonState as st, world } from '../core/state.js';
import { coldAt, coldBase, northness, ASPECT, HOME, lakeChill, height } from '../core/shape.js';
import { yearPhase, seasonValue, isCooling, phaseName, dayOfPhase, chillNow, snowFrom, iceFrom, flowersOut, leavesAt, SEASON_PHASE, ICE_LAG, seasonU } from '../core/year.js';
import { bindKey } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { wx, setWeather } from '../systems/weather.js';
import { cur } from '../systems/time.js';
import { makeFalling } from '../world/particles.js';
import { ferry } from '../characters/boat.js';
import { player } from '../characters/player.js';
import { toast } from '../ui/hud.js';

const ORDER = ['auto', 'spring', 'summer', 'autumn', 'winter'];
// how the grass and the ground are tinted, and how many insects are about, by what the season is doing where you stand
const P = {
  spring: { bugs: 0.6, grass: [0.95, 1.12, 0.9], ground: [1, 1.05, 0.96] },
  summer: { bugs: 1, grass: [1, 1, 1], ground: [1, 1, 1] },
  autumn: { bugs: 0.3, grass: [1.3, 1.05, 0.62], ground: [1.12, 1.0, 0.78] },
  winter: { bugs: 0, grass: [1.05, 0.95, 0.75], ground: [1, 0.96, 0.88] },
};
/** How much snow cover (on trees, rocks and things) a full snow where you stand gives. */
const COVER = 0.72;

let mode = 'auto', held = null, particleAmt = 0, ready = false, falling = null, fallingKind = '';

// Every round tree has a crown colour for each state of its leaves (`pal`) and the colour it is
// showing now (`shown`, which drifts toward its state's colour when that changes). A tree takes its
// colours from a hash of where it stands, so it is the same colour every time you pass; its state
// from its own place (`chill`: core/shape.js), so the high woods turn first.
const SPRING_BLOSSOM = ['#f4c1d0', '#f7d6e0', '#ffffff', '#eeb0c4'], SPRING_GREEN = ['#86c25a', '#9ccd62', '#7ab84e'];
const AUTUMN = { maple: ['#c4422a', '#d9582b', '#b8352c', '#e0722e'], birch: ['#e8c547', '#f0d35a', '#e3b03b'], other: ['#d9822b', '#e3a33b', '#c4542d', '#e8c547', '#b0452a', '#cf6a2c', '#9aa040'] };
const WINTER = ['#7d7264', '#6f665a', '#857a6a'];
const pickWith = (roll) => (arr) => new THREE.Color(arr[Math.floor(roll() * arr.length)]);
const springOf = (it, roll) => (it.type === 'blossom' || roll() < 0.3 ? pickWith(roll)(SPRING_BLOSSOM) : pickWith(roll)(SPRING_GREEN));
// maples blaze red and orange, birches turn gold, the rest a mix
const autumnOf = (it, roll) => pickWith(roll)(AUTUMN[it.family] || AUTUMN.other);
function palOf(it) {
  if (!it.pal) {
    const roll = mulberry32(Math.floor(hash(Math.round(it.x * 9) + 5, Math.round(it.z * 9) - 3) * 4294967296));
    it.pal = { spring: springOf(it, roll), summer: it.color.clone(), autumn: autumnOf(it, roll), winter: pickWith(roll)(WINTER) };
  }
  return it.pal;
}
/** A tree's chill (its place's cold in summer), kept on it. */
const chillOf = (it) => (it.chill !== undefined ? it.chill : (it.chill = coldAt(it.x, it.z, it.y !== undefined ? it.y : height(it.x, it.z))));
/** What a tree's leaves are doing today. */
const stateOf = (it) => leavesAt(chillOf(it), st.season, st.cooling);
/** Give a tree the colour it should be showing (called for trees as they come into view). */
function tintTree(it) {
  if (!ready) return;
  if (!it.shown) it.shown = new THREE.Color();
  it.leaves = stateOf(it);
  it.shown.copy(palOf(it)[it.leaves]);
}
const roundTrees = () => world.roundItems || [];
const buttons = () => Array.from(document.querySelectorAll('#season button'));

function writeTrees() {
  const t = world.roundTop;
  if (!t) return;
  roundTrees().forEach((it, i) => { if (!it.shown) tintTree(it); t.setColorAt(i, it.shown); });
  t.commit();
}
function syncUi() {
  const now = phaseName(st.phase).toLowerCase();
  buttons().forEach((b) => {
    const v = b.dataset.season;
    b.setAttribute('aria-pressed', String(v === 'auto' ? mode === 'auto' : mode === v));
    b.classList.toggle('current', mode === 'auto' && v === now);
  });
}

/** Move the year on (or hold it at the picked season), and write it where everything reads it. */
function turnYear() {
  const p = held !== null ? held : mode === 'auto' ? yearPhase() : SEASON_PHASE[mode];
  st.phase = p;
  st.season = seasonValue(p);
  st.lagged = seasonValue(p - ICE_LAG);
  st.cooling = isCooling(p);
  st.name = phaseName(p);
  st.dayOfYear = dayOfPhase(p);
  seasonU.value = st.season;
}

/** How the season is where you stand: snow, flowers, the state of the leaves, winter or not. */
let winterHere = false;
function readHere(x, z) {
  const h = height(x, z), base = coldBase(x, z), c = coldAt(x, z, h + ASPECT * northness(x, z, h, base), base), now = chillNow(c, st.season);
  // (in and out at different chills, so clothes and music do not flicker along a snow line)
  winterHere = winterHere ? now > 0.42 : now > 0.5;
  st.winterHere = winterHere;
  st.coverFloor = COVER * snowFrom(c, st.season);
  st.flowerFrac = flowersOut(c, st.season, st.cooling);
  st.leavesHere = leavesAt(c, st.season, st.cooling);
  // the snowman and the home lake's skating go by the home lake
  st.homeWinter = chillNow(lakeChill(HOME), st.season) > 0.47;
}

function setMode(m) {
  mode = m;
  held = null;
  store.season = m;
  saveSoon();
  turnYear();
  recolourIn = 0; // (straight away)
  toast(m === 'auto' ? `The year turns on its own: ${phaseName(st.phase).toLowerCase()} now.` : `${phaseName(st.phase)} comes to the land.`);
  syncUi();
}

let recolourIn = 0, hereIn = 0, blend = 1;
export function initSeasons() {
  const q = query.get('season');
  mode = ORDER.includes(q) ? q : ORDER.includes(store.season) ? store.season : 'auto';
  turnYear();
  ready = true;
  world.tintTree = tintTree;
  falling = makeFalling({ count: 500, box: [48, 14, 48], speed: [0.5, 1.0], size: 0.16, map: glowTex, sway: 0.8, colors: ['#ffffff'] });

  buttons().forEach((b) => b.addEventListener('click', () => setMode(b.dataset.season)));
  bindKey('KeyN', () => setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]));
  syncUi();

  // as the meadow opens: everything as the season has it here, at once
  const first = () => {
    readHere(player.x, player.z);
    const p = P[st.leavesHere];
    st.ice = iceFrom(lakeChill(HOME), st.lagged);
    st.bugs = p.bugs;
    world.grassMat.color.setRGB(...p.grass);
    if (world.grassKitMat) world.grassKitMat.color.setRGB(...p.grass);
    world.terrain.material.color.setRGB(...p.ground);
    roundTrees().forEach(tintTree);
    writeTrees();
    if (world.refreshFarTrees) world.refreshFarTrees();
  };
  first();

  hooks.frame.push((dt, t, camera) => {
    turnYear();
    hereIn -= dt;
    if (hereIn <= 0) { hereIn = 0.5; readHere(camera.position.x, camera.position.z); }
    // now and then: has any tree's state changed (the year moved on, or you came to other trees)?
    recolourIn -= dt;
    if (recolourIn <= 0) {
      recolourIn = 5;
      let changed = false;
      for (const it of roundTrees()) { if (!it.shown) { changed = true; continue; } if (stateOf(it) !== it.leaves) { it.leaves = stateOf(it); changed = true; } }
      if (changed) { blend = 0; if (world.refreshFarTrees) world.refreshFarTrees(); }
    }
    if (blend < 1) {
      blend = Math.min(1, blend + dt / 4);
      const k = clamp(dt * 1.5, 0, 1);
      roundTrees().forEach((it) => { if (!it.shown) tintTree(it); else if (blend >= 1) it.shown.copy(palOf(it)[it.leaves]); else it.shown.lerp(palOf(it)[it.leaves], k); });
      writeTrees();
    }
    const p = P[st.leavesHere || 'summer'];
    // the home lake freezes and thaws slowly, and only while the boat is safely moored
    const homeIce = iceFrom(lakeChill(HOME), st.lagged), iceTarget = ferry.state === 'docked' ? homeIce : Math.min(homeIce, 0.2);
    st.ice = clamp(st.ice + Math.sign(iceTarget - st.ice) * (dt / 25), Math.min(st.ice, iceTarget), Math.max(st.ice, iceTarget));
    st.bugs = damp(st.bugs, p.bugs, 0.5, dt);
    const g = world.grassMat.color, gr = world.terrain.material.color;
    g.setRGB(damp(g.r, p.grass[0], 1, dt), damp(g.g, p.grass[1], 1, dt), damp(g.b, p.grass[2], 1, dt));
    if (world.grassKitMat) world.grassKitMat.color.copy(g);
    gr.setRGB(damp(gr.r, p.ground[0], 1, dt), damp(gr.g, p.ground[1], 1, dt), damp(gr.b, p.ground[2], 1, dt));

    // falling leaves where the trees have turned, petals where it is spring
    const kind = st.leavesHere === 'autumn' ? 'autumn' : st.leavesHere === 'spring' ? 'spring' : '';
    if (kind && kind !== fallingKind) {
      fallingKind = kind;
      const pal = kind === 'autumn' ? ['#d9822b', '#e3a33b', '#c4542d', '#e8c547', '#b0452a'] : ['#f7c6d6', '#ffffff', '#f3a8c3', '#fde3ea'];
      const colors = falling.obj.geometry.attributes.color, c = new THREE.Color();
      for (let i = 0; i < colors.count; i++) { c.set(pal[i % pal.length]); colors.setXYZ(i, c.r, c.g, c.b); }
      colors.needsUpdate = true;
    }
    const want = kind === 'autumn' ? 1 : kind === 'spring' ? 0.6 : 0;
    particleAmt = damp(particleAmt, want * (1 - wx.rain * 0.7), 0.6, dt);
    falling.update(dt, t, camera.position, particleAmt, 0.75, 0.4 + wx.wind * 2, 0);
    if (falling.obj.visible) falling.u.uOpacity.value = Math.min(1, particleAmt * 1.3) * (0.35 + 0.65 * Math.max(cur.day, 0.2));
  });

  // rain or snow, by how cold it is where you stand
  st.mapWeather = (k) => {
    if (st.winterHere && (k === 'rain' || k === 'storm')) return 'snow';
    if (!st.winterHere && k === 'snow' && (st.season < 0.3 || rnd() < 0.7)) return 'rain';
    return k;
  };
  hooks.frame.push(() => {
    if (!wx.auto) return;
    if (st.winterHere && (wx.type === 'rain' || wx.type === 'storm')) setWeather('snow', false);
    else if (!st.winterHere && st.season < 0.3 && wx.type === 'snow') setWeather('rain', false);
  });
  return { resize: (h) => falling.resize(h) };
}

/** The season by the calendar of the game year ('winter', 'spring', 'summer' or 'autumn'). */
export const seasonNow = () => phaseName(typeof st.phase === 'number' ? st.phase : 0.5).toLowerCase();
/** For tests: hold the year at a phase (0 midwinter .. 0.5 midsummer), or let it run again (null). */
export function holdPhase(p) {
  held = p;
  turnYear();
  readHere(player.x, player.z);
  recolourIn = 0;
}
