// What lives at a lake: reeds along its shore and lily pads on its water, at every lake you come
// near; and the one family of ducks, the heron, the frogs and the mist, which are wherever you are.
//
// Reeds and lilies are worked out per lake from the lake itself (its seed, size and the country
// it lies in: thick reed beds and many lilies in lush country, a few reeds on the heath, dry
// stalks and no lilies round a frozen lake), so a lake always has the same ones. They are drawn
// from fixed slots, refilled for the three lakes nearest the camera.
//
// "The lake you are at" (`lifeLake`) changes only when you have left the old one out of sight;
// whoever keeps creatures there is told through `hooks.lake` (core/state.js) and moves them.
import { TAU, mulberry32, hash } from '../core/math.js';
import { HOME, height, lakesNear, kitOf, lakeIce, lakeChill } from '../core/shape.js';
import { flowersOut } from '../core/year.js';
import { col } from '../core/materials.js';
import { hooks, world, seasonState } from '../core/state.js';

const REED_GREENS = ['#6b7f3a', '#7f8f45', '#5a7034'].map(col), REED_STRAW = ['#a39a62', '#b3a871', '#8f8650'].map(col);
const PAD_GREENS = ['#4f8a3c', '#5e9a46', '#447a36'].map(col), BLOOMS = ['#f7c6d6', '#ffffff', '#f3a8c3'].map(col);

/** The reeds, their brown heads, the lily pads and the lilies of a lake. The same every time; kept on the lake. */
export function lifeOf(lake) {
  if (lake.life) return lake.life;
  const R = mulberry32((Math.floor(hash(Math.round(lake.x) + 3, Math.round(lake.z) - 8) * 4294967296) ^ 0x7F4A7C15) | 0), r = (a, b) => a + (b - a) * R();
  const c = lake.clime || { dry: 0, lush: 0, snow: 0 }, size = lake.R0 / 30, kit = kitOf(lake), jetty = Math.PI / 2 + 0.55 + (lake.turn || 0);
  const reeds = [], heads = [], pads = [], blooms = [];
  // reed beds: more of them round a bigger lake, a lusher one, one with little beach
  const beds = Math.min(46, Math.round(22 * size * (0.75 + c.lush * 1.0 - c.dry * 0.45 + Math.max(0, 1 - lake.beach) * 0.3)));
  const cols = lake.frozen ? REED_STRAW : REED_GREENS;
  for (let b = 0; b < beds; b++) {
    const ca = R() * TAU, ct = r(0.93, 1.03), n = 10 + Math.floor(R() * 9), spread = 0.06 / Math.sqrt(size);
    const near = Math.abs(((ca - jetty) % TAU + TAU + Math.PI) % TAU - Math.PI) < 0.12 / size; // (no reeds across the jetty)
    for (let i = 0; i < n; i++) {
      const a = ca + r(-spread, spread), t = ct + r(-0.04, 0.04), s = r(0.7, 1.25), rx = r(-0.12, 0.12), rz = r(-0.12, 0.12), ry = R() * TAU, color = cols[Math.floor(R() * cols.length)];
      if (kit.dock && near) continue;
      const p = lake.point(a, t), reed = { x: p.x, z: p.z, y: Math.max(height(p.x, p.z), -0.6), s, rx, rz, ry, color };
      reeds.push(reed);
      if (i % 3 === 0) heads.push(reed);
    }
  }
  // lily pads in rafts out on the water (none on ice), with a flower on some
  if (!lake.frozen) {
    const rafts = Math.round(8 * size * size * (0.35 + c.lush * 1.3 - c.dry * 0.2));
    for (let b = 0; b < rafts; b++) {
      const ca = R() * TAU, ct = r(0.45, 0.82);
      for (let i = 0; i < 6; i++) {
        const p = lake.point(ca + r(-0.08, 0.08) / Math.sqrt(size), ct + r(-0.06, 0.06)), s = r(0.6, 1.1), ry = R() * TAU, color = PAD_GREENS[Math.floor(R() * PAD_GREENS.length)], flower = R() < 0.3, tint = BLOOMS[Math.floor(R() * BLOOMS.length)];
        if (height(p.x, p.z) > -0.3) continue; // (too near the shore to float)
        pads.push({ x: p.x, z: p.z, y: 0.05, s, ry, color });
        if (flower) blooms.push({ x: p.x + 0.15, z: p.z, y: 0.12, s: 1, color: tint });
      }
    }
  }
  return (lake.life = { reeds, heads, pads, blooms });
}

// ── drawing: the three nearest lakes' reeds and lilies, from fixed slots ──
let sets = null, shown = '';
/** Hand over the slot sets the reeds and lilies are drawn with (world/vegetation.js makes them, with the home lake's own). */
export function setLakeLifeSets(s) { sets = s; shown = ''; }
const LIFE_REACH = 330;
/** Once a frame: draw the reeds and lilies of the lakes nearest (x, z). Only does work when those lakes change. */
export function updateLakeLife(x, z) {
  if (!sets) return;
  // (each lake's lilies by its own season: no pads on ice, no flowers out of their season)
  const near = lakesNear(x, z, LIFE_REACH).slice(0, 3);
  const ice = near.map((L) => lakeIce(L) > 0.4), bloom = near.map((L) => flowersOut(lakeChill(L), seasonState.season, seasonState.cooling) > 0.3);
  const key = near.map((L, i) => L.id + (ice[i] ? '*' : '') + (bloom[i] ? '+' : '')).join('|');
  if (key === shown) return;
  shown = key;
  const all = { reeds: [], heads: [], pads: [], blooms: [] };
  near.forEach((L, i) => {
    const life = lifeOf(L);
    for (const k in all) { if ((k === 'pads' || k === 'blooms') && ice[i]) continue; if (k === 'blooms' && !bloom[i]) continue; for (const it of life[k]) all[k].push(it); }
  });
  let dropped = 0;
  for (const k in all) { sets[k].setItems(all[k], () => 0); dropped += sets[k].dropped; }
  lifeStats.reeds = all.reeds.length; lifeStats.pads = all.pads.length; lifeStats.lakes = near.length; lifeStats.dropped = dropped;
}
/** For tests: what is drawn just now. */
export const lifeStats = { reeds: 0, pads: 0, lakes: 0, dropped: 0 };

// ── the lake you are at ──
/** The lake the ducks, the heron, the frogs and the mist are at. */
export let lifeLake = HOME;
const shore = (L, x, z) => Math.max(0, Math.hypot(L.x - x, L.z - z) - L.R0);
let since = 0;
/**
 * Now and then (call every tick): if you have come to another lake and left the old one out of
 * sight, the creatures are there. With `now`, at once (on arriving by the Places list, and at load).
 */
export function updateLifeLake(dt, x, z, now = false) {
  since += dt;
  if (!now && since < 0.5) return;
  since = 0;
  const here = lakesNear(x, z, 260)[0];
  if (!here || here === lifeLake) return;
  if (!now && (shore(here, x, z) > 150 || shore(lifeLake, x, z) < 240)) return;
  lifeLake = here;
  world.lifeLake = here;
  for (const fn of hooks.lake) { try { fn(here); } catch (e) { console.error('lake life', e); } }
}
