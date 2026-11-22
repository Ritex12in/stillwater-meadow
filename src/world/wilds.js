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
//     wildflowers (which fade out with distance anyway, so there is no point in more), and the
//     flowers you can pick: a few in any open country, meadows of them round a lake, and thick
//     drifts beside a lake's path and along its bank.
// What grows where follows the climate (core/shape.js): thick mixed woods in lush country, a few
// airy birches on the dry heath, pines and little else in the cold, and now and then a grove of
// blossom trees over a carpet of flowers.
// Everything is drawn from fixed slots that are refilled; nothing is made or thrown away as you
// walk.
import { TAU, mulberry32, hash, smooth, clamp, fbm } from '../core/math.js';
import { height, lakeT, lakeAt, lakesNear, PATH_T, WORLD, northness, feltHeight, screeAt, aboveTrees, TREELINE, moistAt, snowCold, coldAt, dryOf, lushOf, snowOf, groveAt, clearingAt, seaAt, coldBase, cliffsAt } from '../core/shape.js';
import { col } from '../core/materials.js';
import { world, obstacles } from '../core/state.js';
import { kit } from '../core/assets.js';
import { TILE_N, CELL, rockAmt } from './terrain.js';
import { setWildTrees, MODEL_FAR, TREE_COLOURS, dressFlower } from './vegetation.js';
import { setFarTrees } from './farforest.js';
import { treeFamily } from './kitplants.js';
import { biomesAt } from '../core/biome.js';

const S = TILE_N * CELL;
/**
 * Distances, in metres from the camera to a square: when squares are grown (`load`) and forgotten
 * (`drop`), when their trees are real models and their boulders are out (`nearIn`/`nearOut`), and
 * when their small plants are (`closeIn`/`closeOut`).
 */
export const WILD = { load: 235, drop: 265, nearIn: MODEL_FAR + 8, nearOut: MODEL_FAR + 30, closeIn: 66, closeOut: 86, tries: 96 };
const squares = new Map();
let biomeCount = 0, cards = 0, lost = 0, near = 0, stale = false, rockCount = 0, smallCount = 0, pickCount = 0, lostRocks = 0, lostSmall = 0, rockBlocks = [];
/** The cards show each tree's season colour: ask for them to be redone when the season has turned. */
world.refreshFarTrees = () => { stale = true; };

const seedOf = (ix, iz, salt) => mulberry32((Math.floor(hash(ix * 7 + 3, iz * 13 - 5) * 4294967296) ^ Math.imul(WORLD.seed, 0x9E3779B1) ^ salt) | 0);
const slopeOf = (x, z) => Math.hypot(height(x + 1.5, z) - height(x - 1.5, z), height(x, z + 1.5) - height(x, z - 1.5)) / 3;
/** The height a spot feels (for the treeline and rock: core/shape.js). */
const feltAt = (x, z, h) => feltHeight(x, z, h, northness(x, z, h));
/** Where the woods are (0 open country .. 1 deep wood): broad patches. */
const woodAt = (x, z) => smooth(0.4, 0.62, fbm(x * 0.0063 + 31.7, z * 0.0063 - 12.2));

/** The trees of one square. The same answer every time. */
export function growSquare(ix, iz) {
  const R = seedOf(ix, iz, 0);
  const x0 = ix * S, z0 = iz * S, trees = [];
  // the biome at the square's middle: no woods in the desert, thick old woods in the enchanted wood
  const B = biomesAt(x0 + S / 2, z0 + S / 2, height(x0 + S / 2, z0 + S / 2)), biomeWood = (1 - B.desert * 0.97) * (1 - B.volcanic * 0.9) * (1 - B.plains * 0.85);
  for (let k = 0; k < WILD.tries; k++) {
    // (every try takes the same draws, so turning one spot down never moves the trees after it)
    const x = x0 + R() * S, z = z0 + R() * S, roll = R(), size = R(), turn = R(), tint = R(), keep = R();
    if (lakeT(x, z) < 1.22 || clearingAt(x, z)) continue; // (not in the water, nor where a lake's path, jetty, fire and bench are, nor on the shrine's ground)
    const h = height(x, z), felt = feltAt(x, z, h), line = aboveTrees(felt);
    if (line >= 1) continue; // (above the treeline)
    const cold = coldAt(x, z, h), rain = moistAt(x, z), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(snowCold(cold, rain)), grove = groveAt(x, z) * (1 - snowOf(cold)); // (no blossom in the cold, snowy or not)
    // woods in broad patches with open country between, and clumps and clearings inside a wood;
    // lush country is wooded nearly everywhere, the heath and the snowfields hardly at all
    // (and thinning out toward the treeline)
    const wooded = Math.min(1, (0.06 + woodAt(x, z) * 0.9) * (1 - dry * 0.8) * (1 - snow * 0.65) + lush * 0.45 * (1 - snow * 0.5) + grove * 0.6 + B.enchanted * 0.5) * (1 - line) * biomeWood;
    if (keep > wooded * (0.35 + fbm(x * 0.03 + 9, z * 0.03))) continue;
    // not on rock, cliffs or the high peaks (the same test the grass and the ground's texture use)
    const slope = slopeOf(x, z);
    if (slope > 0.62 || rockAmt(h, slope, felt) > 0.3) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 11)) continue;
    // pines in the cold and up the mountains, few on the heath; blossom trees in their groves
    // (near the treeline only pines, and stunted ones)
    const nearLine = smooth(TREELINE - 34, TREELINE - 8, felt);
    const pines = clamp(0.36 + cold * 0.7 + smooth(22, 60, h) * 0.3 - dry * 0.22 - grove + nearLine * 0.8, 0, 0.97);
    const type = roll < pines ? 'pine' : roll > 0.975 - grove * 0.8 ? 'blossom' : 'round';
    const s = (0.8 + size * 0.7) * (1 + lush * 0.14 - snow * 0.12 + B.enchanted * 0.6) * (1 - 0.4 * smooth(TREELINE - 28, TREELINE, felt)), cols = TREE_COLOURS[type];
    const t = { x, z, y: h - 0.15, type, s, ry: turn * TAU, color: cols[Math.floor(tint * cols.length)], top: (kit ? 6.2 : 5.2) * s, wild: true, chill: cold };
    const wind = cliffsAt(x, z); if (wind > 0.2) t.rx = wind * (0.22 + 0.12 * tint); // (bent by the wind on the windy cliffs, all one way)
    if (kit) {
      // on the heath the broadleaf trees are the light, airy ones: birches and the open-crowned "normal" trees
      t.family = type === 'round' && dry > 0.5 && kit.models.BirchTree_1 ? (tint < 0.62 || !kit.models.NormalTree_1 ? 'birch' : 'normal') : treeFamily(t);
      if (type === 'round' && kit.models.GiantTree_1) {
        if (tint < B.enchanted * 0.75) { t.family = 'giant'; t.s *= 1.7; t.top *= 1.7; }
        else if (tint < B.swamp * 0.8) t.family = 'willow';
      }
    }
    trees.push(t);
  }
  return trees;
}

/** How many spots a square tries for scree stones (most squares have no scree, and take none). */
const SCREE_TRIES = 40;
const ROCK_COLS = ['#8f8d82', '#7d7c73', '#a09d90', '#6f6e68'].map(col);
/** The boulders of one square: a few in the meadows, many where the ground turns to rock and scree. */
export function growRocks(ix, iz) {
  const R = seedOf(ix, iz, 0x51ED27), x0 = ix * S, z0 = iz * S, rocks = [];
  for (let k = 0; k < 16; k++) {
    const x = x0 + R() * S, z = z0 + R() * S, size = R(), a = R(), b = R(), c = R(), turn = R(), tilt = R(), tint = R(), keep = R();
    if (lakeT(x, z) < 1.15 || clearingAt(x, z)) continue;
    const h = height(x, z), rocky = rockAmt(h, slopeOf(x, z), feltAt(x, z, h));
    // (more of them on the dry heath and in the cold, where little else stands)
    if (keep > 0.07 + rocky * 0.8 + smooth(30, 70, h) * 0.15 + dryOf(moistAt(x, z)) * 0.16 + snowOf(coldAt(x, z, h)) * 0.08) continue;
    const s = 0.4 + size * size * (1.1 + rocky * 1.3);
    rocks.push({ x, z, y: h - s * 0.25, s, sx: s * (0.9 + a * 0.6), sy: s * (0.55 + b * 0.35), sz: s * (0.9 + c * 0.4), ry: turn * TAU, rx: tilt * 0.4 - 0.2, color: ROCK_COLS[Math.floor(tint * ROCK_COLS.length)] });
  }
  // scree: many smaller stones heaped at the foot of a cliff (after the boulders, from the same
  // stream, so they move none of them; small enough not to stand in your way)
  for (let k = 0; k < SCREE_TRIES; k++) {
    const x = x0 + R() * S, z = z0 + R() * S, size = R(), a = R(), b = R(), c = R(), turn = R(), tilt = R(), tint = R(), keep = R();
    const h = height(x, z);
    if (h < 10 || lakeT(x, z) < 1.15 || clearingAt(x, z)) continue;
    const scree = screeAt(x, z, h);
    if (keep > scree * 1.4) continue;
    const s = 0.22 + size * 0.36;
    rocks.push({ x, z, y: h - s * 0.3, s, sx: s * (0.9 + a * 0.6), sy: s * (0.5 + b * 0.3), sz: s * (0.9 + c * 0.4), ry: turn * TAU, rx: tilt * 0.6 - 0.3, color: ROCK_COLS[Math.floor(tint * ROCK_COLS.length)] });
  }
  return rocks;
}

const BUSH_GREENS = ['#7aa84a', '#86b352', '#6b9a40', '#93bb5a'].map(col);
/** The small plants of one square: bushes at the woods' edges, ferns under pines, mushrooms under broadleaf trees, drifts of wildflowers in the open. */
export function growSmall(ix, iz, trees) {
  const R = seedOf(ix, iz, 0x2C1B3F), r = (a, b) => a + (b - a) * R(), x0 = ix * S, z0 = iz * S;
  const out = { bushes: [], ferns: [], shrooms: [], clover: [], flowers: [] };
  // (the land's own formula, not the drawn tiles: a square must come out the same whether or not its ground is loaded)
  const fits = (x, z) => { if (lakeT(x, z) <= 1.16 || clearingAt(x, z)) return false; const h = height(x, z); return rockAmt(h, slopeOf(x, z), feltAt(x, z, h)) < 0.2; };
  // the climate, taken once at the square's middle (it changes over hundreds of metres)
  const mx = x0 + S / 2, mz = z0 + S / 2, mh = height(mx, mz), rain = moistAt(mx, mz), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(snowCold(coldAt(mx, mz, mh), rain));
  for (const t of trees) {
    const bush = R(), fern = R(), shroom = R(), a1 = R() * TAU, d1 = r(2.2, 3.6), a2 = R() * TAU, d2 = r(1.0, 2.2), a3 = R() * TAU;
    if (snow > 0.5) continue; // (under snow: nothing small)
    if (bush < 0.16 * (1 - dry * 0.6)) { const x = t.x + Math.cos(a1) * d1, z = t.z + Math.sin(a1) * d1; if (fits(x, z)) out.bushes.push({ x, z, y: height(x, z) - 0.05, s: r(0.75, 1.3), ry: r(0, TAU), color: BUSH_GREENS[Math.floor(R() * BUSH_GREENS.length)], flowers: R() < 0.3 }); } // (some bushes are in flower)
    if (t.type === 'pine' && fern < 0.3 + lush * 0.4) { const x = t.x + Math.cos(a2) * d2, z = t.z + Math.sin(a2) * d2; if (fits(x, z)) out.ferns.push({ x, z, y: height(x, z) - 0.03, s: r(0.8, 1.3), ry: r(0, TAU) }); }
    if (t.type !== 'pine' && shroom < 0.12 + lush * 0.18) for (let k = 0; k < 2; k++) { const d = r(0.7, 1.4), x = t.x + Math.cos(a3 + k * 2.1) * d, z = t.z + Math.sin(a3 + k * 2.1) * d; if (fits(x, z)) out.shrooms.push({ x, z, y: height(x, z) - 0.02, s: r(0.7, 1.3), ry: r(0, TAU) }); }
  }
  // clover: low patches in the open, where a fine noise says so
  for (let k = 0; k < 10; k++) {
    const x = x0 + R() * S, z = z0 + R() * S, s = r(0.8, 1.4), ry = r(0, TAU);
    if (snow > 0.4 || fbm(x * 0.08 - 13, z * 0.08 + 5) < 0.55 - lush * 0.1 + dry * 0.12 || !fits(x, z)) continue;
    out.clover.push({ x, z, y: height(x, z) - 0.02, s, ry });
  }
  // wildflowers: drifts in the open meadow (where a broad patch of noise says so), each with a favourite kind
  const lupin = world.lupinColours || [];
  for (let k = 0; k < 5; k++) {
    const cx = x0 + R() * S, cz = z0 + R() * S, fav = Math.floor(R() * 3), n = 6 + Math.floor(R() * 9), rad = r(2, 5), keep = R();
    // (few on the heath, none in the snow; a blossom grove is carpeted, mostly with tulips)
    const grove = groveAt(cx, cz) * (1 - snowOf(coldAt(cx, cz, mh)));
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

/**
 * How many spots a square tries for flowers to pick: a few anywhere, many more where it lies in
 * the meadow round a lake (within `meadow` lake-radii of one).
 */
const PICK = { tries: 70, lakeTries: 1100, meadow: 2.4 };
/** Where a lake's sand ends and its grass begins, in lake-radii. */
const sandEnd = (L) => Math.max(1.06, 1 + 0.14 * L.beach);
/**
 * Where a lake's drifts of flowers are: two in three beside its path if it has one (either side),
 * the rest on the bank just above the sand. More round a bigger lake, fewer on the heath, none
 * round a frozen one. The same every time; kept on the lake.
 */
function driftsOf(lake) {
  if (lake.drifts) return lake.drifts;
  const R = mulberry32((Math.floor(hash(Math.round(lake.x) + 11, Math.round(lake.z) - 29) * 4294967296) ^ Math.imul(WORLD.seed, 0x9E3779B1) ^ 0x3D4F1A) | 0);
  const c = lake.clime || { dry: 0, lush: 0, snow: 0 }, n = lake.frozen || c.snow > 0.3 ? 0 : Math.round(40 * (lake.R0 / 30) * (1 - c.dry * 0.6)), out = [];
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, side = R() < 0.5 ? -1 : 1, off = R(), kind = Math.floor(R() * 64), size = 1.3 + R() * 1.3, count = 30 + Math.floor(R() * 26), seed = Math.floor(R() * 4294967296) | 0;
    const t = lake.ring && i % 3 < 2 ? PATH_T + side * (3.4 + off * 2.5) / lake.r(a) : sandEnd(lake) + 0.03 + off * 0.07, p = lake.point(a, t);
    out.push({ i, x: p.x, z: p.z, kind, size, count, seed });
  }
  return (lake.drifts = out);
}
/**
 * The flowers you can pick in one square. The same answer every time, and each flower has a name
 * of its own (`id`) that it keeps, so a picked one can be remembered while its square is away.
 * Only the land's own rules decide (the lakes, their paths and clearings, the climate): never
 * where the landmarks happen to stand, nor which ground is loaded.
 */
export function growPicks(ix, iz) {
  const R = seedOf(ix, iz, 0x7A11E5), x0 = ix * S, z0 = iz * S, out = [];
  const mx = x0 + S / 2, mz = z0 + S / 2, wet = moistAt(mx, mz), dry = dryOf(wet), chill = coldAt(mx, mz, height(mx, mz)), snow = snowOf(snowCold(chill, wet));
  if (snow > 0.4) return out; // (none under snow)
  const lakes = lakesNear(mx, mz, 220).filter((L) => Math.hypot(L.x - mx, L.z - mz) < L.rmax * PICK.meadow + S * 0.75);
  const tries = lakes.length ? PICK.lakeTries : PICK.tries, thin = 1 - dry * 0.6;
  for (let k = 0; k < tries; k++) {
    // (every try takes the same draws, so turning one spot down never moves or renames the flowers after it)
    const x = x0 + R() * S, z = z0 + R() * S, s = 0.8 + R() * 0.6, ry = R() * TAU, a = R(), b = R(), c = R(), keep = R(), stay = R();
    if (fbm(x * 0.07 + 20, z * 0.07 - 4) < 0.56) continue; // they grow in patches
    const L = lakeAt(x, z), lt = L.t(x, z), meadow = lt < PICK.meadow;
    if (k >= PICK.tries && !meadow) continue;
    // (a settled lake's meadow is thick with them; a wild lake's less so; open country has a few, fewer in the woods)
    if (stay > (meadow ? (L.settled ? 1 : 0.6) : 1 - woodAt(x, z) * 0.6) * thin) continue;
    if (lt < sandEnd(L) || L.path(x, z) > 0.2 || clearingAt(x, z)) continue;
    const h = height(x, z);
    if (rockAmt(h, slopeOf(x, z), feltAt(x, z, h)) > 0.2) continue;
    out.push(dressFlower({ id: ix + ':' + iz + ':' + k, x, z, y: h - 0.02, s, ry, keep, chill }, undefined, a, b, c));
  }
  // the drifts of the lakes here whose middle lies in this square
  for (const L of lakes) {
    for (const d of driftsOf(L)) {
      if (d.x < x0 || d.x >= x0 + S || d.z < z0 || d.z >= z0 + S) continue;
      const D = mulberry32(d.seed);
      for (let m = 0; m < d.count; m++) {
        const a = D() * TAU, far = d.size * Math.sqrt(D()) * (0.6 + 0.4 * D()), s = 0.8 + D() * 0.6, ry = D() * TAU, c = D(), keep = D();
        const x = d.x + Math.cos(a) * far * 1.4, z = d.z + Math.sin(a) * far; // drifts are a little long
        const N = lakeAt(x, z);
        if (N.t(x, z) < sandEnd(N) + 0.01 || N.path(x, z) > 0.15 || clearingAt(x, z)) continue;
        out.push(dressFlower({ id: L.id + ':d' + d.i + ':' + m, x, z, y: height(x, z) - 0.02, s, ry, keep, chill }, d.kind, 0, 0, c));
      }
    }
  }
  return out;
}
/** For tests and tools: every flower to pick within `r` metres of a spot, whether or not its square is loaded. */
export function picksNear(x, z, r) {
  const out = [];
  for (let iz = Math.floor((z - r) / S); iz <= Math.floor((z + r) / S); iz++) for (let ix = Math.floor((x - r) / S); ix <= Math.floor((x + r) / S); ix++) for (const f of growPicks(ix, iz)) if (Math.hypot(f.x - x, f.z - z) < r) out.push(f);
  return out;
}

/**
 * The biomes' own things in one square (core/biome.js): cacti in the desert; crystals and glowing
 * mushrooms in the enchanted wood. From a stream of its own, so nothing else moves.
 */
export function growBiome(ix, iz) {
  const R = seedOf(ix, iz, 0x6B10E), x0 = ix * S, z0 = iz * S, out = { palms: [], cacti: [], crystals: [], mushrooms: [], pools: [], lotus: [] };
  const mx = x0 + S / 2, mz = z0 + S / 2, B = biomesAt(mx, mz, height(mx, mz));
  if (B.desert < 0.05 && B.enchanted < 0.05 && B.swamp < 0.05 && !(seaAt(mx, mz) > 0)) return out;
  const PALM = ['#4f8a3a', '#5b9440', '#46803a'].map(col);
  const MUSH = [0xb8f4ff, 0x9fffd0, 0xffa6f0, 0xc7b0ff].map((c) => col('#' + c.toString(16).padStart(6, '0')));
  const CRYS = [0x7fe3ff, 0xb48cff, 0xff8fd6, 0x8fffd9].map((c) => col('#' + c.toString(16).padStart(6, '0')));
  const CACT = ['#5f8a3e', '#6d9645', '#557d38'].map(col), LOTUS = ['#ffd6ec', '#ffffff', '#f6b8ff', '#c9e8ff'].map(col);
  for (let k = 0; k < 60; k++) {
    const x = x0 + R() * S, z = z0 + R() * S, roll = R(), size = R(), turn = R(), v = Math.floor(R() * 4), tint = R();
    if (lakeT(x, z) < 1.15 || clearingAt(x, z, false)) continue;
    const h = height(x, z), b = biomesAt(x, z, h);
    if (rockAmt(h, slopeOf(x, z), feltAt(x, z, h)) > 0.4) continue;
    if (b.beach > 0.3 && roll < 0.12 * (1 - Math.abs(coldBase(x, z)) * 2)) { out.palms.push({ x, z, y: h - 0.1, s: 0.85 + size * 0.4, ry: turn * TAU, v, color: PALM[Math.floor(tint * PALM.length)] }); continue; }
    if (roll < b.desert * 0.12) out.cacti.push({ x, z, y: h - 0.1, s: 0.8 + size * 0.6, ry: turn * TAU, v, color: CACT[Math.floor(tint * CACT.length)] });
    else if (roll > 1 - b.enchanted * 0.5) {
      if (size < 0.3) out.crystals.push({ x, z, y: h - 0.05, s: 0.6 + size * 2.4, ry: turn * TAU, v, color: CRYS[Math.floor(tint * CRYS.length)] });
      else out.mushrooms.push({ x, z, y: h - 0.02, s: 0.8 + size * 1.2, ry: turn * TAU, v, color: MUSH[Math.floor(tint * MUSH.length)] });
    } else if (roll < b.swamp * 0.3 && slopeOf(x, z) < 0.08) {
      // a still pool in the swamp's low ground (on level ground only, standing on its highest edge), and lotus on some
      const ps = 0.9 + size * 1.3;
      let top = h; for (let e = 0; e < 6; e++) { const a = e * 1.047; top = Math.max(top, height(x + Math.cos(a) * ps * 1.6, z + Math.sin(a) * ps * 1.6)); }
      if (top - h > 0.35) continue;
      out.pools.push({ x, z, y: top + 0.1, s: ps, ry: turn * TAU, v });
      for (let m = 0; m < Math.floor(tint * 4); m++) { const a = m * 2.4 + turn * 6, d = ps * (0.3 + 0.15 * m); out.lotus.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, y: top + 0.12, s: 1 + size * 0.5, ry: a, v: m, color: LOTUS[(v + m) % LOTUS.length] }); }
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
      const q = { ix, iz, trees: null, rocks: null, small: null, picks: null, biome: null, near: false, close: false };
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
    if (isNear !== q.near) { q.near = isNear; modelsDirty = true; if (isNear && !q.rocks) { q.rocks = growRocks(q.ix, q.iz); q.biome = growBiome(q.ix, q.iz); } }
    const isClose = q.close ? d < WILD.closeOut : d < WILD.closeIn;
    if (isClose !== q.close) { q.close = isClose; smallDirty = true; if (isClose && !q.small && kit) q.small = growSmall(q.ix, q.iz, q.trees); if (isClose && !q.picks) q.picks = growPicks(q.ix, q.iz); }
  });
  if (cardsDirty || stale || cards === 0) {
    stale = false;
    const list = [];
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
    // the biomes' own things, with the boulders
    const things = { palms: [], cacti: [], crystals: [], mushrooms: [], pools: [], lotus: [] };
    squares.forEach((q) => { if (q.near && q.biome) for (const k in things) for (const it of q.biome[k]) things[k].push(it); });
    biomeCount = things.palms.length + things.cacti.length + things.crystals.length + things.mushrooms.length + things.pools.length + things.lotus.length;
    lostRocks += world.setBiomeThings ? world.setBiomeThings(things) : 0;
  }
  if (smallDirty) {
    const all4 = { bushes: [], ferns: [], shrooms: [], clover: [], flowers: [] };
    squares.forEach((q) => { if (q.close && q.small) for (const k in all4) for (const it of q.small[k]) all4[k].push(it); });
    smallCount = all4.bushes.length + all4.ferns.length + all4.shrooms.length + all4.clover.length + all4.flowers.length;
    lostSmall = (world.setWildUndergrowth ? world.setWildUndergrowth(all4) : 0) + (world.setWildFlowers ? world.setWildFlowers(all4.flowers) : 0);
    // the flowers to pick: features/flowers.js keeps them, and says which are drawn
    const picks = [];
    squares.forEach((q) => { if (q.close && q.picks) for (const f of q.picks) picks.push(f); });
    pickCount = picks.length;
    world.picks = picks;
    if (world.setPicks) world.setPicks(picks);
  }
  return cardsDirty || modelsDirty || smallDirty;
}

/** Grow everything within reach of (x, z) now (at load, and after being moved a long way). */
export function settleWilds(x, z) { updateWilds(x, z, true); }

/**
 * For tests and the debug panel: squares kept, trees with a card, trees drawn as models, boulders,
 * small plants and flowers to pick set out. `dropped` is things that found no free slot to be drawn in: it should stay 0.
 */
export const wildStats = () => ({ squares: squares.size, cards, near, rocks: rockCount, things: biomeCount, small: smallCount, picks: pickCount, dropped: lost + lostRocks + lostSmall + (world.picksDropped || 0) + ((world.roundTop && world.roundTop.dropped) || 0) });
