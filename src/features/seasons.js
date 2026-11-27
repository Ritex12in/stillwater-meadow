// THE YEAR DOES NOT TURN (the owner, 2026-11-28: "remove the season concept, season will be fixed for
// places"). The year is held at midsummer for good, so every place shows what its own land makes it: cold
// country and the high peaks lie under snow with their lakes frozen (winter, always), a blossom grove is
// in blossom (spring, always), everywhere else is in summer leaf. The calendar and the save no longer
// reach it. The engine below is kept, and a season can still be held for a look or a test (`?season=`,
// the `season` command, `holdPhase`): that is a debug tool, it is not saved.
//
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
import { coldAt, coldBase, northness, ASPECT, HOME, lakeChill, height, groveAt, biomesAt, yearAt, yearOf, latitudeAt, beltOf, wetSeasonAt } from '../core/shape.js';
import { yearPhase, seasonValue, isCooling, phaseName, dayOfPhase, chillNow, snowFrom, iceFrom, flowersOut, leavesAt, SEASON_PHASE, ICE_LAG, seasonU, yearHereU, seasonHere, phaseHere } from '../core/year.js';
import { bindKey } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { wx } from '../systems/weather.js';
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

const FIXED_PHASE = 0.5; // (midsummer: a place's own chill, and nothing added)
let mode = 'auto', held = null, particleAmt = 0, ready = false, falling = null, fallingKind = '';

// Every round tree has a crown colour for each state of its leaves (`pal`) and the colour it is
// showing now (`shown`, which drifts toward its state's colour when that changes). A tree takes its
// colours from a hash of where it stands, so it is the same colour every time you pass; its state
// from its own place (`chill`: core/shape.js), so the high woods turn first.
const SPRING_BLOSSOM = ['#f4c1d0', '#f7d6e0', '#ffffff', '#eeb0c4'], SPRING_GREEN = ['#86c25a', '#9ccd62', '#7ab84e'];
const AUTUMN = { maple: ['#c4422a', '#d9582b', '#b8352c', '#e0722e'], birch: ['#e8c547', '#f0d35a', '#e3b03b'], other: ['#d9822b', '#e3a33b', '#c4542d', '#e8c547', '#b0452a', '#cf6a2c', '#9aa040'] };
const WINTER = ['#7d7264', '#6f665a', '#857a6a'];
const pickWith = (roll) => (arr) => new THREE.Color(arr[Math.floor(roll() * arr.length)]);
// (a blossom tree is in blossom from spring to autumn, in its own pink: world/vegetation.js; other trees may flower pale in spring)
const springOf = (it, roll) => (it.type === 'blossom' ? it.color.clone() : roll() < 0.3 ? pickWith(roll)(SPRING_BLOSSOM) : pickWith(roll)(SPRING_GREEN));
// maples blaze red and orange, birches turn gold, the rest a mix
const autumnOf = (it, roll) => (it.type === 'blossom' ? it.color.clone().multiplyScalar(0.9) : pickWith(roll)(AUTUMN[it.family] || AUTUMN.other));
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
const stateOf = (it) => leavesAt(chillOf(it), st.season, st.cooling, yearOf(it));
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
  const p = held !== null ? held : mode === 'auto' ? FIXED_PHASE : SEASON_PHASE[mode];
  st.fixed = held === null && mode === 'auto'; // (as the places have it: nothing held for a look)
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
const hereYear = { A: 1, m: 0 };
function readHere(x, z) {
  const h = height(x, z), base = coldBase(x, z), c = coldAt(x, z, h + ASPECT * northness(x, z, h, base), base), y = Object.assign(hereYear, yearAt(x, z)), now = chillNow(c, st.season, y);
  // the year here: for the grass, and the season's name where you stand (the tropics have a wet and a dry season; the pole has none)
  yearHereU.value[0] = y.A; yearHereU.value[1] = y.m;
  st.seasonHere = seasonHere(st.season, y);
  st.phaseHere = phaseHere(st.phase, y);
  st.beltHere = beltOf(latitudeAt(x, z));
  st.nameHere = st.beltHere === 'polar' ? '' : st.beltHere === 'tropical' ? (wetSeasonAt(x, z, st.season) > 0.5 ? 'Wet season' : 'Dry season') : phaseName(st.phaseHere);
  // (the season a place keeps: winter where the snow lies, spring in a blossom grove, summer elsewhere)
  if (st.fixed && st.beltHere !== 'polar') st.nameHere = now > 0.47 ? 'Winter' : groveAt(x, z) > 0.5 ? 'Spring' : st.beltHere === 'tropical' ? st.nameHere : 'Summer';
  // (in and out at different chills, so clothes and music do not flicker along a snow line)
  winterHere = winterHere ? now > 0.42 : now > 0.5;
  st.winterHere = winterHere;
  st.coverFloor = COVER * snowFrom(c, st.season, y);
  st.flowerFrac = flowersOut(c, st.season, st.cooling, y);
  st.leavesHere = leavesAt(c, st.season, st.cooling, y);
  st.groveHere = groveAt(x, z);
  st.enchantedHere = biomesAt(x, z, h, base).enchanted;
  // the northern lights: over cold country (more of them in winter)
  st.auroraHere = Math.min(1, Math.max(0, (base - 0.25) / 0.45) + Math.max(0, now - 0.6) * 0.8);
  // the snowman and the home lake's skating go by the home lake
  st.homeWinter = chillNow(lakeChill(HOME), st.season) > 0.47;
}

/** The ways the year can be held: 'auto' (it turns on its own) or a season. */
export const SEASON_MODES = ORDER;
export const seasonMode = () => mode;
/** Hold the year at a season, or let it turn ('auto'): the `season` command (features/commands.js). */
export const setSeasonMode = (m) => { if (ORDER.includes(m)) setMode(m); };
function setMode(m) {
  mode = m;
  held = null;
  turnYear(); // (not kept in the save: a held season is for a look)
  recolourIn = 0; hereIn = 0; // (straight away: the trees, and how it is here)
  toast(m === 'auto' ? 'Each place keeps its own season.' : `${phaseName(st.phase)} is held everywhere, for a look.`);
  syncUi();
}

let recolourIn = 0, hereIn = 0, blend = 1;
export function initSeasons() {
  const q = query.get('season');
  mode = ORDER.includes(q) ? q : 'auto'; // (the save's old choice of season is not read: an old save that held winter does not bring it back)
  turnYear();
  ready = true;
  world.tintTree = tintTree;
  falling = makeFalling({ count: 500, box: [48, 14, 48], speed: [0.5, 1.0], size: 0.16, map: glowTex, sway: 0.8, colors: ['#ffffff'] });

  buttons().forEach((b) => b.addEventListener('click', () => setMode(b.dataset.season)));
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
    const kind = st.leavesHere === 'autumn' ? 'autumn' : st.leavesHere === 'spring' || (st.groveHere > 0.5 && st.leavesHere !== 'winter') ? 'spring' : '';
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
    if (!st.winterHere && k === 'snow' && ((st.seasonHere ?? st.season) < 0.3 || rnd() < 0.7)) return 'rain';
    return k;
  };
  return { resize: (h) => falling.resize(h) };
}

/**
 * You have travelled at once to another place (main.js travelTo): the season is as it is there
 * straight away. What eases as you walk (the grass's tint, the insects) and the snow carried on
 * the trees and rocks would otherwise come with you from a winter into a summer for some minutes.
 */
export function settleSeason(x, z) {
  if (!ready) return;
  readHere(x, z);
  const p = P[st.leavesHere || 'summer'];
  st.bugs = p.bugs;
  world.grassMat.color.setRGB(...p.grass);
  if (world.grassKitMat) world.grassKitMat.color.setRGB(...p.grass);
  world.terrain.material.color.setRGB(...p.ground);
  wx.cover = st.coverFloor; // (the snow lying on things: what the season gives here, no more)
  recolourIn = 0; hereIn = 0.5;
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
