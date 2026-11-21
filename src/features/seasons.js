// Seasons: follow the calendar (or pick one). Spring blossom and petals, summer green, autumn
// colours and falling leaves, winter snow cover and a frozen lake you can walk on.
import * as THREE from 'three';
import { clamp, damp, rnd, mulberry32, hash } from '../core/math.js';
import { query } from '../core/env.js';
import { glowTex } from '../core/materials.js';
import { hooks, seasonState as st, world } from '../core/state.js';
import { bindKey } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { wx, setWeather } from '../systems/weather.js';
import { cur } from '../systems/time.js';
import { makeFalling } from '../world/particles.js';
import { ferry } from '../characters/boat.js';
import { toast } from '../ui/hud.js';

const ORDER = ['auto', 'spring', 'summer', 'autumn', 'winter'];
const LABEL = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
// a representative day for each season, so a picked season also gets its day length
const MID_DAY = { spring: 105, summer: 196, autumn: 288, winter: 15 };
const calendarSeason = () => {
  const m = new Date().getMonth(); // northern hemisphere
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
};
const P = {
  spring: { ice: 0, cover: 0, bugs: 0.6, flowers: 1, grass: [0.95, 1.12, 0.9], ground: [1, 1.05, 0.96] },
  summer: { ice: 0, cover: 0, bugs: 1, flowers: 1, grass: [1, 1, 1], ground: [1, 1, 1] },
  autumn: { ice: 0, cover: 0, bugs: 0.3, flowers: 0.3, grass: [1.3, 1.05, 0.62], ground: [1.12, 1.0, 0.78] },
  winter: { ice: 1, cover: 0.72, bugs: 0, flowers: 0, grass: [1.05, 0.95, 0.75], ground: [1, 0.96, 0.88] },
};

let mode = 'auto', season = 'summer', blend = 1;
let falling = null, particleAmt = 0, ready = false;

// Every round tree has a crown colour for each season (`pal`) and the colour it is showing now
// (`shown`, which drifts toward the season's when the season turns). The valley's trees drew
// theirs from the runtime random stream when the game began; trees met later, out in the wilds,
// take theirs from a hash of where they stand, so a tree is the same colour every time you pass.
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
/** Give a tree the colour it should be showing (called for trees as they come into view). */
function tintTree(it) {
  if (!ready) return;
  if (!it.shown) it.shown = new THREE.Color();
  it.shown.copy(palOf(it)[season]);
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
  buttons().forEach((b) => {
    const v = b.dataset.season;
    b.setAttribute('aria-pressed', String(v === 'auto' ? mode === 'auto' : mode !== 'auto' && season === v));
    b.classList.toggle('current', mode === 'auto' && v === season);
  });
}
function apply(next, instant) {
  season = next;
  st.name = LABEL[season];
  st.dayOfYear = mode === 'auto' ? null : MID_DAY[season];
  blend = instant ? 1 : 0;
  if (instant) {
    roundTrees().forEach(tintTree);
    writeTrees();
    st.ice = P[season].ice; st.coverFloor = P[season].cover; st.bugs = P[season].bugs;
    world.grassMat.color.setRGB(...P[season].grass);
    if (world.grassKitMat) world.grassKitMat.color.setRGB(...P[season].grass);
    world.terrain.material.color.setRGB(...P[season].ground);
  }
  st.flowerFrac = P[season].flowers;
  st.mapWeather = (k) => {
    if (season === 'winter' && (k === 'rain' || k === 'storm')) return 'snow';
    if (season === 'summer' && k === 'snow') return 'rain';
    if ((season === 'spring' || season === 'autumn') && k === 'snow' && rnd() < 0.7) return 'rain';
    return k;
  };
  if (wx.auto) {
    if (season === 'winter' && (wx.type === 'rain' || wx.type === 'storm')) setWeather('snow', false);
    if (season === 'summer' && wx.type === 'snow') setWeather('rain', false);
  }
  const pal = season === 'autumn' ? ['#d9822b', '#e3a33b', '#c4542d', '#e8c547', '#b0452a'] : ['#f7c6d6', '#ffffff', '#f3a8c3', '#fde3ea'];
  const colors = falling.obj.geometry.attributes.color, c = new THREE.Color();
  for (let i = 0; i < colors.count; i++) { c.set(pal[i % pal.length]); colors.setXYZ(i, c.r, c.g, c.b); }
  colors.needsUpdate = true;
  syncUi();
}

function setMode(m) {
  mode = m;
  store.season = m;
  saveSoon();
  const next = m === 'auto' ? calendarSeason() : m;
  if (next !== season) { apply(next, false); toast(`${LABEL[next]} comes to the meadow.`); }
  else { st.dayOfYear = mode === 'auto' ? null : MID_DAY[season]; syncUi(); }
}

export function initSeasons() {
  const q = query.get('season');
  mode = ORDER.includes(q) ? q : store.season || 'auto';
  season = mode === 'auto' ? calendarSeason() : mode;
  // the valley's trees: season by season, in the order (and with the draws) they have always had
  const items = world.valleyRoundItems || world.roundItems || [];
  const spring = items.map((it) => springOf(it, rnd)), autumn = items.map((it) => autumnOf(it, rnd)), winter = items.map(() => pickWith(rnd)(WINTER));
  items.forEach((it, i) => { it.pal = { spring: spring[i], summer: it.color.clone(), autumn: autumn[i], winter: winter[i] }; it.shown = it.color.clone(); });
  ready = true;
  world.tintTree = tintTree;
  falling = makeFalling({ count: 500, box: [48, 14, 48], speed: [0.5, 1.0], size: 0.16, map: glowTex, sway: 0.8, colors: ['#ffffff'] });

  buttons().forEach((b) => b.addEventListener('click', () => setMode(b.dataset.season)));
  bindKey('KeyN', () => setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]));
  apply(season, true);

  hooks.frame.push((dt, t, camera) => {
    if (mode === 'auto' && season !== calendarSeason()) apply(calendarSeason(), false);
    const p = P[season];
    if (blend < 1) {
      blend = Math.min(1, blend + dt / 4);
      const k = clamp(dt * 1.5, 0, 1);
      roundTrees().forEach((it) => { if (!it.shown) tintTree(it); else if (blend >= 1) it.shown.copy(palOf(it)[season]); else it.shown.lerp(palOf(it)[season], k); });
      writeTrees();
    }
    // the lake only freezes while the boat is safely moored
    const iceTarget = ferry.state === 'docked' ? p.ice : Math.min(p.ice, 0.2);
    st.ice = clamp(st.ice + Math.sign(iceTarget - st.ice) * (dt / 25), Math.min(st.ice, iceTarget), Math.max(st.ice, iceTarget));
    st.coverFloor = damp(st.coverFloor, p.cover, 0.25, dt);
    st.bugs = damp(st.bugs, p.bugs, 0.5, dt);
    const g = world.grassMat.color, gr = world.terrain.material.color;
    g.setRGB(damp(g.r, p.grass[0], 1, dt), damp(g.g, p.grass[1], 1, dt), damp(g.b, p.grass[2], 1, dt));
    if (world.grassKitMat) world.grassKitMat.color.copy(g);
    gr.setRGB(damp(gr.r, p.ground[0], 1, dt), damp(gr.g, p.ground[1], 1, dt), damp(gr.b, p.ground[2], 1, dt));
    const padsOn = st.ice < 0.4;
    world.padMesh.visible = padsOn;
    world.bloomMesh.visible = padsOn && season !== 'autumn';

    const want = season === 'autumn' ? 1 : season === 'spring' ? 0.6 : 0;
    particleAmt = damp(particleAmt, want * (1 - wx.rain * 0.7), 0.6, dt);
    falling.update(dt, t, camera.position, particleAmt, 0.75, 0.4 + wx.wind * 2, 0);
    if (falling.obj.visible) falling.u.uOpacity.value = Math.min(1, particleAmt * 1.3) * (0.35 + 0.65 * Math.max(cur.day, 0.2));
  });
  return { resize: (h) => falling.resize(h) };
}

export const seasonNow = () => season;
