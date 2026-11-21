// What grows beyond the valley. The land is cut into the same 57.6 m squares as the ground's
// finest tiles, and each square grows its own trees, boulders and small plants from its own seed
// (the world's seed and the square's place), so a wood is always where it was, however you came
// to it and however long you were away.
//
// Squares within WILD.load metres of the camera are kept; further ones are forgotten and grown
// again when wanted. What a kept square shows depends on how near it is:
//   - every tree has a flat card (world/farforest.js), which is what you see from a distance;
//   - squares near you also hand their trees to the real tree models (world/vegetation.js), with
//     their shadows, their own shapes and the seasons' colours, and set out their boulders;
//   - the squares closest of all grow their small plants: bushes, ferns, mushrooms and clumps of
//     wildflowers (which fade out with distance anyway, so there is no point in more).
// What grows where follows the climate (core/shape.js): thick mixed woods in lush country, a few
// airy birches on the dry heath, pines and little else in the cold, and now and then a grove of
// blossom trees over a carpet of flowers.
// Everything is drawn from fixed slots that are refilled; nothing is made or thrown away as you
// walk. The valley's own plants are not grown here: they keep the places they have always had.
import { TAU, mulberry32, hash, smooth, clamp, fbm } from '../core/math.js';
import { height, lakeT, WORLD, coldAt, rainAt, dryOf, lushOf, snowOf, groveAt } from '../core/shape.js';
import { col } from '../core/materials.js';
import { world, obstacles } from '../core/state.js';
import { kit } from '../core/assets.js';
import { TILE_N, CELL, rockAmt } from './terrain.js';
import { setWildTrees, valleyTrees, MODEL_FAR, TREE_COLOURS } from './vegetation.js';
import { setFarTrees } from './farforest.js';
import { treeFamily } from './kitplants.js';

const S = TILE_N * CELL;
/**
 * Distances, in metres from the camera to a square: when squares are grown (`load`) and forgotten
 * (`drop`), when their trees are real models and their boulders are out (`nearIn`/`nearOut`), and
 * when their small plants are (`closeIn`/`closeOut`). `valley` and `home` are how far from the
 * middle of the world the valley's own trees and its smaller plants reach.
 */
export const WILD = { load: 235, drop: 265, nearIn: MODEL_FAR + 8, nearOut: MODEL_FAR + 30, closeIn: 66, closeOut: 86, valley: 155, home: 122, tries: 96 };
const squares = new Map();
let cards = 0, lost = 0, near = 0, stale = false, rockCount = 0, smallCount = 0, lostRocks = 0, lostSmall = 0, rockBlocks = [];
/** The cards show each tree's season colour: ask for them to be redone when the season has turned. */
world.refreshFarTrees = () => { stale = true; };

const seedOf = (ix, iz, salt) => mulberry32((Math.floor(hash(ix * 7 + 3, iz * 13 - 5) * 4294967296) ^ Math.imul(WORLD.seed, 0x9E3779B1) ^ salt) | 0);
const slopeOf = (x, z) => Math.hypot(height(x + 1.5, z) - height(x - 1.5, z), height(x, z + 1.5) - height(x, z - 1.5)) / 3;
/** Where the woods are (0 open country .. 1 deep wood): broad patches. */
const woodAt = (x, z) => smooth(0.4, 0.62, fbm(x * 0.0063 + 31.7, z * 0.0063 - 12.2));

/** The trees of one square. The same answer every time. */
export function growSquare(ix, iz) {
  const R = seedOf(ix, iz, 0);
  const x0 = ix * S, z0 = iz * S, trees = [];
  for (let k = 0; k < WILD.tries; k++) {
    // (every try takes the same draws, so turning one spot down never moves the trees after it)
    const x = x0 + R() * S, z = z0 + R() * S, roll = R(), size = R(), turn = R(), tint = R(), keep = R();
    if (Math.hypot(x, z) < WILD.valley || lakeT(x, z) < 1.3) continue;
    const h = height(x, z), cold = coldAt(x, z, h), rain = rainAt(x, z), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(cold), grove = groveAt(x, z) * (1 - snow);
    // woods in broad patches with open country between, and clumps and clearings inside a wood;
    // lush country is wooded nearly everywhere, the heath and the snowfields hardly at all
    const wooded = Math.min(1, (0.06 + woodAt(x, z) * 0.9) * (1 - dry * 0.8) * (1 - snow * 0.65) + lush * 0.45 * (1 - snow * 0.5) + grove * 0.6);
    if (keep > wooded * (0.35 + fbm(x * 0.03 + 9, z * 0.03))) continue;
    // not on rock, cliffs or the high peaks (the same test the grass and the ground's texture use)
    const slope = slopeOf(x, z);
    if (slope > 0.62 || rockAmt(h, slope) > 0.3) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 11)) continue;
    // pines in the cold and up the mountains, few on the heath; blossom trees in their groves
    const pines = clamp(0.36 + cold * 0.7 + smooth(22, 60, h) * 0.3 - dry * 0.22 - grove, 0, 0.97);
    const type = roll < pines ? 'pine' : roll > 0.975 - grove * 0.8 ? 'blossom' : 'round';
    const s = (0.8 + size * 0.7) * (1 + lush * 0.14 - snow * 0.12), cols = TREE_COLOURS[type];
    const t = { x, z, y: h - 0.15, type, s, ry: turn * TAU, color: cols[Math.floor(tint * cols.length)], top: (kit ? 6.2 : 5.2) * s, wild: true };
    if (kit) {
      // on the heath the broadleaf trees are the light, airy ones: birches and the open-crowned "normal" trees
      t.family = type === 'round' && dry > 0.5 && kit.models.BirchTree_1 ? (tint < 0.62 || !kit.models.NormalTree_1 ? 'birch' : 'normal') : treeFamily(t);
    }
    trees.push(t);
  }
  return trees;
}

const ROCK_COLS = ['#8f8d82', '#7d7c73', '#a09d90', '#6f6e68'].map(col);
/** The boulders of one square: a few in the meadows, many where the ground turns to rock and scree. */
export function growRocks(ix, iz) {
  const R = seedOf(ix, iz, 0x51ED27), x0 = ix * S, z0 = iz * S, rocks = [];
  for (let k = 0; k < 16; k++) {
    const x = x0 + R() * S, z = z0 + R() * S, size = R(), a = R(), b = R(), c = R(), turn = R(), tilt = R(), tint = R(), keep = R();
    if (Math.hypot(x, z) < WILD.home || lakeT(x, z) < 1.15) continue;
    const h = height(x, z), rocky = rockAmt(h, slopeOf(x, z));
    // (more of them on the dry heath and in the cold, where little else stands)
    if (keep > 0.07 + rocky * 0.8 + smooth(30, 70, h) * 0.15 + dryOf(rainAt(x, z)) * 0.16 + snowOf(coldAt(x, z, h)) * 0.08) continue;
    const s = 0.4 + size * size * (1.1 + rocky * 1.3);
    rocks.push({ x, z, y: h - s * 0.25, s, sx: s * (0.9 + a * 0.6), sy: s * (0.55 + b * 0.35), sz: s * (0.9 + c * 0.4), ry: turn * TAU, rx: tilt * 0.4 - 0.2, color: ROCK_COLS[Math.floor(tint * ROCK_COLS.length)] });
  }
  return rocks;
}

const BUSH_GREENS = ['#7aa84a', '#86b352', '#6b9a40', '#93bb5a'].map(col);
/** The small plants of one square: bushes at the woods' edges, ferns under pines, mushrooms under broadleaf trees, drifts of wildflowers in the open. */
export function growSmall(ix, iz, trees) {
  const R = seedOf(ix, iz, 0x2C1B3F), r = (a, b) => a + (b - a) * R(), x0 = ix * S, z0 = iz * S;
  const out = { bushes: [], ferns: [], shrooms: [], flowers: [] };
  // (the land's own formula, not the drawn tiles: a square must come out the same whether or not its ground is loaded)
  const fits = (x, z) => Math.hypot(x, z) > WILD.home && lakeT(x, z) > 1.2 && rockAmt(height(x, z), slopeOf(x, z)) < 0.2;
  // the climate, taken once at the square's middle (it changes over hundreds of metres)
  const mx = x0 + S / 2, mz = z0 + S / 2, mh = height(mx, mz), rain = rainAt(mx, mz), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(coldAt(mx, mz, mh));
  for (const t of trees) {
    const bush = R(), fern = R(), shroom = R(), a1 = R() * TAU, d1 = r(2.2, 3.6), a2 = R() * TAU, d2 = r(1.0, 2.2), a3 = R() * TAU;
    if (snow > 0.5) continue; // (under snow: nothing small)
    if (bush < 0.16 * (1 - dry * 0.6)) { const x = t.x + Math.cos(a1) * d1, z = t.z + Math.sin(a1) * d1; if (fits(x, z)) out.bushes.push({ x, z, y: height(x, z) - 0.05, s: r(0.75, 1.3), ry: r(0, TAU), color: BUSH_GREENS[Math.floor(R() * BUSH_GREENS.length)] }); }
    if (t.type === 'pine' && fern < 0.3 + lush * 0.4) { const x = t.x + Math.cos(a2) * d2, z = t.z + Math.sin(a2) * d2; if (fits(x, z)) out.ferns.push({ x, z, y: height(x, z) - 0.03, s: r(0.8, 1.3), ry: r(0, TAU) }); }
    if (t.type !== 'pine' && shroom < 0.16 + lush * 0.3) for (let k = 0; k < 2; k++) { const d = r(0.7, 1.4), x = t.x + Math.cos(a3 + k * 2.1) * d, z = t.z + Math.sin(a3 + k * 2.1) * d; if (fits(x, z)) out.shrooms.push({ x, z, y: height(x, z) - 0.02, s: r(0.7, 1.3), ry: r(0, TAU) }); }
  }
  // wildflowers: drifts in the open meadow (where a broad patch of noise says so), each with a favourite kind
  const lupin = world.lupinColours || [];
  for (let k = 0; k < 5; k++) {
    const cx = x0 + R() * S, cz = z0 + R() * S, fav = Math.floor(R() * 3), n = 6 + Math.floor(R() * 9), rad = r(2, 5), keep = R();
    // (few on the heath, none in the snow; a blossom grove is carpeted, mostly with tulips)
    const grove = groveAt(cx, cz);
    const meadow = Math.max(smooth(0.46, 0.6, fbm(cx * 0.021 + 77.7, cz * 0.021 - 41.3)) * (1 - woodAt(cx, cz) * 0.8) * (1 - dry * 0.7), grove) * (1 - snow);
    for (let m = 0; m < n; m++) {
      const a = R() * TAU, d = rad * Math.sqrt(R()), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, any = R() < 0.65 ? fav : Math.floor(R() * 3), s = r(0.8, 1.25), ry = r(0, TAU), tint = R();
      const kind = grove > 0.5 && tint < 0.7 ? 2 : any;
      if (keep > meadow || !fits(x, z)) continue;
      out.flowers.push({ x, z, y: height(x, z) - 0.02, s, ry, kind, color: kind === 1 && lupin.length ? lupin[Math.floor(tint * lupin.length)] : null });
    }
  }
  return out;
}

/** Distance from the camera to a square (0 inside it). */
const away = (q, cx, cz) => Math.hypot(Math.max(q.ix * S - cx, 0, cx - q.ix * S - S), Math.max(q.iz * S - cz, 0, cz - q.iz * S - S));

/**
 * Once a frame: grow the squares that have come within reach (a couple a frame, or all of them
 * at once with `all`), forget the ones left behind, and pass on what they hold. Returns true if
 * anything changed.
 */
export function updateWilds(cx, cz, all = false) {
  let cardsDirty = false, modelsDirty = false, smallDirty = false, made = 0;
  const i0 = Math.floor((cx - WILD.load) / S), i1 = Math.floor((cx + WILD.load) / S), j0 = Math.floor((cz - WILD.load) / S), j1 = Math.floor((cz + WILD.load) / S);
  for (let iz = j0; iz <= j1; iz++) {
    for (let ix = i0; ix <= i1; ix++) {
      const key = ix + ':' + iz;
      if (squares.has(key) || (!all && made >= 2)) continue;
      const q = { ix, iz, trees: null, rocks: null, small: null, near: false, close: false };
      if (away(q, cx, cz) >= WILD.load) continue;
      q.trees = growSquare(ix, iz);
      squares.set(key, q);
      made++;
      if (q.trees.length) cardsDirty = true;
    }
  }
  squares.forEach((q, key) => {
    const d = away(q, cx, cz);
    if (d > WILD.drop) { squares.delete(key); if (q.trees.length) cardsDirty = true; if (q.near) modelsDirty = true; if (q.close) smallDirty = true; return; }
    const isNear = q.near ? d < WILD.nearOut : d < WILD.nearIn;
    if (isNear !== q.near) { q.near = isNear; modelsDirty = true; if (isNear && !q.rocks) q.rocks = growRocks(q.ix, q.iz); }
    const isClose = q.close ? d < WILD.closeOut : d < WILD.closeIn;
    if (isClose !== q.close) { q.close = isClose; smallDirty = true; if (isClose && !q.small && kit) q.small = growSmall(q.ix, q.iz, q.trees); }
  });
  if (cardsDirty || stale || cards === 0) {
    stale = false;
    const list = valleyTrees().slice();
    squares.forEach((q) => { for (const t of q.trees) list.push(t); });
    cards = list.length;
    lost = setFarTrees(list);
  }
  if (modelsDirty) {
    const list = [], rocks = [];
    squares.forEach((q) => {
      if (!q.near) return;
      for (const t of q.trees) { if (world.tintTree) world.tintTree(t); list.push(t); }
      for (const r of q.rocks) rocks.push(r);
    });
    near = list.length;
    setWildTrees(list);
    // boulders: drawn, and (the bigger ones) in the way
    rockBlocks.forEach((b) => { const i = obstacles.indexOf(b); if (i >= 0) obstacles.splice(i, 1); });
    rockBlocks = [];
    for (const r of rocks) if (r.s > 0.6) { const b = r.block || (r.block = { x: r.x, z: r.z, r: r.s * 0.95 }); obstacles.push(b); rockBlocks.push(b); }
    rockCount = rocks.length;
    lostRocks = world.setWildRocks ? world.setWildRocks(rocks) : 0;
  }
  if (smallDirty) {
    const all4 = { bushes: [], ferns: [], shrooms: [], flowers: [] };
    squares.forEach((q) => { if (q.close && q.small) for (const k in all4) for (const it of q.small[k]) all4[k].push(it); });
    smallCount = all4.bushes.length + all4.ferns.length + all4.shrooms.length + all4.flowers.length;
    lostSmall = (world.setWildUndergrowth ? world.setWildUndergrowth(all4) : 0) + (world.setWildFlowers ? world.setWildFlowers(all4.flowers) : 0);
  }
  return cardsDirty || modelsDirty || smallDirty;
}

/** Grow everything within reach of (x, z) now (at load, and after being moved a long way). */
export function settleWilds(x, z) { updateWilds(x, z, true); }

/**
 * For tests and the debug panel: squares kept, trees with a card, trees drawn as models, boulders
 * and small plants set out. `dropped` is things that found no free slot to be drawn in: it should stay 0.
 */
export const wildStats = () => ({ squares: squares.size, cards, near, rocks: rockCount, small: smallCount, dropped: lost + lostRocks + lostSmall + ((world.roundTop && world.roundTop.dropped) || 0) });
