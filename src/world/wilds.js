// Trees beyond the valley. The land is cut into the same 57.6 m squares as the ground's finest
// tiles, and each square grows its own trees from its own seed (the world's seed and the square's
// place), so a wood is always where it was, however you came to it and however long you were away.
//
// Squares within WILD.load metres of the camera are kept; further ones are forgotten and grown
// again when wanted. Every tree in a kept square has a flat card (world/farforest.js), which is
// what you see from a distance; the squares close to you also hand their trees to the real tree
// models (world/vegetation.js), with their shadows, their own shapes and the seasons' colours.
// The valley's own trees are not grown here: they keep the places they have always had.
import { TAU, mulberry32, hash, smooth, fbm } from '../core/math.js';
import { height, lakeT, WORLD } from '../core/shape.js';
import { world } from '../core/state.js';
import { kit } from '../core/assets.js';
import { TILE_N, CELL, rockAmt } from './terrain.js';
import { setWildTrees, valleyTrees, MODEL_FAR, TREE_COLOURS } from './vegetation.js';
import { setFarTrees } from './farforest.js';
import { treeFamily } from './kitplants.js';

const S = TILE_N * CELL;
/** Distances (metres from the camera to a square): when squares are grown and forgotten, and when their trees are real models. */
export const WILD = { load: 235, drop: 265, nearIn: MODEL_FAR + 8, nearOut: MODEL_FAR + 30, valley: 155, tries: 96 };
const squares = new Map();
let cards = 0, lost = 0, near = 0;

/** The trees of one square. The same answer every time. */
export function growSquare(ix, iz) {
  const R = mulberry32(Math.floor(hash(ix * 7 + 3, iz * 13 - 5) * 4294967296) ^ Math.imul(WORLD.seed, 0x9E3779B1));
  const x0 = ix * S, z0 = iz * S, trees = [];
  for (let k = 0; k < WILD.tries; k++) {
    // (every try takes the same draws, so turning one spot down never moves the trees after it)
    const x = x0 + R() * S, z = z0 + R() * S, roll = R(), size = R(), turn = R(), tint = R(), keep = R();
    if (Math.hypot(x, z) < WILD.valley || lakeT(x, z) < 1.3) continue;
    // woods in broad patches with open country between, and clumps and clearings inside a wood
    const wood = smooth(0.4, 0.62, fbm(x * 0.0063 + 31.7, z * 0.0063 - 12.2));
    if (keep > (0.06 + wood * 0.9) * (0.35 + fbm(x * 0.03 + 9, z * 0.03))) continue;
    // not on rock, cliffs or the high peaks (the same test the grass and the ground's texture use)
    const h = height(x, z), slope = Math.hypot(height(x + 1.5, z) - height(x - 1.5, z), height(x, z + 1.5) - height(x, z - 1.5)) / 3;
    if (slope > 0.62 || rockAmt(h, slope) > 0.3) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 11)) continue;
    // more pines the higher you climb; now and then a blossom tree
    const type = roll < 0.4 + smooth(22, 60, h) * 0.5 ? 'pine' : roll > 0.975 ? 'blossom' : 'round';
    const s = 0.8 + size * 0.7, cols = TREE_COLOURS[type];
    const t = { x, z, y: h - 0.15, type, s, ry: turn * TAU, color: cols[Math.floor(tint * cols.length)], top: (kit ? 6.2 : 5.2) * s, wild: true };
    if (kit) t.family = treeFamily(t);
    trees.push(t);
  }
  return trees;
}

/** Distance from the camera to a square (0 inside it). */
const away = (q, cx, cz) => Math.hypot(Math.max(q.ix * S - cx, 0, cx - q.ix * S - S), Math.max(q.iz * S - cz, 0, cz - q.iz * S - S));

/**
 * Once a frame: grow the squares that have come within reach (a couple a frame, or all of them
 * at once with `all`), forget the ones left behind, and pass the trees on. Returns true if
 * anything changed.
 */
export function updateWilds(cx, cz, all = false) {
  let cardsDirty = false, modelsDirty = false, made = 0;
  const i0 = Math.floor((cx - WILD.load) / S), i1 = Math.floor((cx + WILD.load) / S), j0 = Math.floor((cz - WILD.load) / S), j1 = Math.floor((cz + WILD.load) / S);
  for (let iz = j0; iz <= j1; iz++) {
    for (let ix = i0; ix <= i1; ix++) {
      const key = ix + ':' + iz;
      if (squares.has(key) || (!all && made >= 2)) continue;
      const q = { ix, iz, trees: null, near: false };
      if (away(q, cx, cz) >= WILD.load) continue;
      q.trees = growSquare(ix, iz);
      squares.set(key, q);
      made++;
      if (q.trees.length) cardsDirty = true;
    }
  }
  squares.forEach((q, key) => {
    const d = away(q, cx, cz);
    if (d > WILD.drop) { squares.delete(key); if (q.trees.length) { cardsDirty = true; if (q.near) modelsDirty = true; } return; }
    const isNear = q.near ? d < WILD.nearOut : d < WILD.nearIn;
    if (isNear !== q.near) { q.near = isNear; if (q.trees.length) modelsDirty = true; }
  });
  if (cardsDirty || cards === 0) {
    const list = valleyTrees().slice();
    squares.forEach((q) => { for (const t of q.trees) list.push(t); });
    cards = list.length;
    lost = setFarTrees(list);
  }
  if (modelsDirty) {
    const list = [];
    squares.forEach((q) => { if (q.near) for (const t of q.trees) { if (world.tintTree) world.tintTree(t); list.push(t); } });
    near = list.length;
    setWildTrees(list);
  }
  return cardsDirty || modelsDirty;
}

/** Grow everything within reach of (x, z) now (at load, and after being moved a long way). */
export function settleWilds(x, z) { updateWilds(x, z, true); }

/** For tests and the debug panel. `dropped` is trees that found no free slot to be drawn in: it should stay 0. */
export const wildStats = () => ({ squares: squares.size, cards, near, dropped: lost + ((world.roundTop && world.roundTop.dropped) || 0) });
