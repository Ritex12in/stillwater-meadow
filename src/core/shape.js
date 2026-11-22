// The shape of the world: terrain height, lakes, the path round a lake, the jetty, and where you
// can walk. The land has no edge: its height is a formula of the world's seed and a position,
// so it can be worked out anywhere, in any order (the ground is drawn from it in tiles: see
// world/terrain.js).
//
// Lakes and the places beside them are data, not constants: a lake is an object (makeLake) that
// knows its own outline, and the jetty, campfire, bench, chairs and starting spot are worked out
// from a lake (landmarksOf). Questions about a spot ("how far from the water is this?") go to the
// lake nearest that spot (lakeAt), so the same code holds for one lake or many. Lakes are
// scattered over the whole land by its seed (see "Lakes from the seed"); one of them is HOME, the
// lake you start beside, and the single-lake names (LAKE, lakeR, lakePoint, SPAWN, dockStart, ...)
// stand for whichever lake the landmarks are at (HOME, until they move).
import { TAU, smooth, clamp, fbm, fbmD, hash, mulberry32 } from './math.js';
import { iceFrom } from './year.js';
import { seasonState } from './state.js';
import { worldSeed } from '../systems/save.js';
import { query } from './env.js';

export const PATH_T = 1.32;       // the path runs round a lake at this many lake-radii

// ── The world's seed ───────────────────────────────────────────
// One number decides the whole landscape: the save picks it (systems/save.js: the address's
// `?seed=`, else your last world, else a new one at random). It shifts where in the endless noise
// the land is read from. The first world, seed 1, reads from the start.
const DEFAULT_SEED = 1;
export const WORLD = { seed: worldSeed };
const shift = mulberry32(WORLD.seed * 7919 + 101);
const SX = WORLD.seed === DEFAULT_SEED ? 0 : Math.floor(shift() * 9000) + 0.37, SZ = WORLD.seed === DEFAULT_SEED ? 0 : Math.floor(shift() * 9000) + 0.61;

// ── Lakes ──────────────────────────────────────────────────────
/**
 * A lake at (x, z). Its shore is a wobbly circle, drawn out long one way: at angle `a` from the
 * centre the radius is
 *   (R0 + A3 sin(3a + P3) + A5 cos(5a + P5) + A7 sin(7a + P7)) x (1 + E cos(2(a - TH)))
 * (the lake's water shader draws its foam and shallows from the same numbers). Lakes differ in
 * more than outline: `beach` is how broad the sand round it is (1 as at home; near 0, grass or
 * snow comes down to the water), `ring` whether a path circles it, `tint` the cast of its water.
 */
export function makeLake({ x, z, R0 = 30, A3 = 4, P3 = 0, A5 = 2.5, P5 = 1.3, A7 = 1.5, P7 = 0.4, E = 0, TH = 0, beach = 1, ring = true, tint = [1, 1, 1] }) {
  const rmax = (R0 + Math.abs(A3) + Math.abs(A5) + Math.abs(A7)) * (1 + E);
  // how far out its bowl runs before the land is its own again, in lake-radii: 1.6 at home, more for a small lake (or it would lie in a pit), but never past 80 m
  const bowl = Math.max(1.6, Math.min(44 / R0, 80 / rmax));
  const L = { x, z, R0, A3, P3, A5, P5, A7, P7, E, TH, beach, ring, tint, rmax, bowl, id: 'home', name: 'Stillwater', frozen: false, reach2: (rmax * 7.5) ** 2 }; // (reach2: beyond this the lake has no say in the land)
  /** Shore radius at angle `a`. */
  L.r = (a) => (R0 + A3 * Math.sin(3 * a + P3) + A5 * Math.cos(5 * a + P5) + A7 * Math.sin(7 * a + P7)) * (1 + E * Math.cos(2 * (a - TH)));
  /** How far out a spot is, in lake-radii: 0 at the centre, 1 on the shore. */
  L.t = (px, pz) => { const dx = px - L.x, dz = pz - L.z; return Math.hypot(dx, dz) / L.r(Math.atan2(dz, dx)); };
  /** The spot at angle `a`, `t` lake-radii out. */
  L.point = (a, t) => ({ x: L.x + Math.cos(a) * L.r(a) * t, z: L.z + Math.sin(a) * L.r(a) * t });
  /** How much a spot is on the path that circles the lake (0..1; 0 everywhere if no path does). */
  L.path = (px, pz) => {
    if (!ring) return 0;
    const dx = px - L.x, dz = pz - L.z;
    const r = L.r(Math.atan2(dz, dx)) * PATH_T;
    return 1 - smooth(1.3, 2.7, Math.abs(Math.hypot(dx, dz) - r));
  };
  return L;
}
/** The side of the squares the land is ruled into, one lake (or none) to a square. */
export const LAKE_CELL = 420;
/**
 * The home lake: the one you start beside. Like every lake it comes from the world's seed; unlike
 * the others it is always there (in the square at the world's middle), is always settled, has
 * every landmark, and lies in mild country. It is put at the flattest of a dozen spots in its
 * square, well clear of the mountains, and kept near enough round, and big enough, that a jetty
 * always fits and the boat has room for its tour.
 */
function makeHome() {
  const R = mulberry32((Math.imul(WORLD.seed, 0x2545F491) ^ 0x1B873593) | 0);
  let spot = null;
  for (let k = 0; k < 14; k++) {
    const x = (0.2 + R() * 0.6) * LAKE_CELL, z = (0.2 + R() * 0.6) * LAKE_CELL, rough = rangeAt(x, z) + fbm((x + SX * 31) * 0.0055 - 9.2, (z + SZ * 31) * 0.0055 + 23.6) * 0.3;
    if (!spot || rough < spot.rough) spot = { x, z, rough };
  }
  const R0 = 27 + R() * 6, wob = 0.55 + R() * 0.45;
  return makeLake({ x: spot.x, z: spot.z, R0, A3: R0 * 0.13 * wob, P3: R() * TAU, A5: R0 * 0.085 * wob, P5: R() * TAU, A7: R0 * 0.05 * wob, P7: R() * TAU, E: R() * 0.1, TH: R() * Math.PI });
}
export const HOME = makeHome();
HOME.settled = true;
HOME.clime = { dry: 0, lush: 0, snow: 0 };

// ── Lakes from the seed ────────────────────────────────────────
// The land is ruled into squares LAKE_CELL metres wide, and each square has one lake or none,
// decided by the world's seed and the square's place: where in the square it lies, how big it is
// and the shape of its shore: round ponds, long narrow waters, lakes with deep bays. A lake keeps
// to the middle of its square, which keeps any two far enough apart that their bowls never touch;
// none lies among the mountains. The country it lies in gives it its character: a broad beach in
// the meadows and broader still on the heath, where the water is clear turquoise; grass to the
// water's edge and dark green water in lush country; ice the year round in the snow. Some have a
// path worn round them. One square holds HOME instead.
const lakeCells = new Map(), aroundCells = new Map();
const HOME_CX = Math.floor(HOME.x / LAKE_CELL), HOME_CZ = Math.floor(HOME.z / LAKE_CELL);
const NAME_A = ['Mirror', 'Heron', 'Willow', 'Amber', 'Silver', 'Moss', 'Lark', 'Fern', 'Otter', 'Birch', 'Glass', 'Hollow', 'Mist', 'Reed', 'Thistle', 'Ember', 'Swan', 'Dawn', 'Quiet', 'Lantern'];
const NAME_COLD = ['Frost', 'Snow', 'White', 'Winter', 'Crystal', 'Pale'], NAME_B = ['water', 'mere', 'pool', 'tarn', 'deep', 'rest', 'glass', 'hollow'];
/** The first of a square's draws: whether it has a lake and where (and the random stream, for the rest of the lake). */
function cellSpot(cx, cz) {
  const R = mulberry32((Math.floor(hash(cx * 11 + 7, cz * 17 - 3) * 4294967296) ^ Math.imul(WORLD.seed, 0x85EBCA6B)) | 0);
  const there = R() < 0.62, x = (cx + 0.2 + R() * 0.6) * LAKE_CELL, z = (cz + 0.2 + R() * 0.6) * LAKE_CELL;
  return { R, x, z, there: there && rangeAt(x, z) < 0.3 };
}
// Settled lakes are the ones with things built beside them: a jetty, a fire, a bench (see kitOf).
/**
 * Whether lakes away from home are settled (with a jetty, fire, bench and lamps of their own). For
 * now they are not: away from home the lakes are wild (the owner's decision: lamps and benches out
 * in the wilds looked out of place). The rules for settled lakes are kept, and `?settlements=1`
 * turns them on (their tests use it).
 */
export const SETTLEMENTS = query.has('settlements');
let sitesReady = false;
// A lake is settled if it outranks every lake in the eight squares round its own, by a rank fixed
// by the seed. So no two settled lakes are neighbours: they lie half a kilometre apart at the
// least, each out of sight of the next. The home lake outranks all.
const cellRank = (cx, cz) => (cx === HOME_CX && cz === HOME_CZ ? 2 : hash(cx * 5 + 1 + WORLD.seed * 3, cz * 9 - 4));
function settledCell(cx, cz) {
  const mine = cellRank(cx, cz);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue;
    const nx = cx + dx, nz = cz + dz;
    if (cellRank(nx, nz) > mine && ((nx === HOME_CX && nz === HOME_CZ) || cellSpot(nx, nz).there)) return false;
  }
  return true;
}
function lakeOfCell(cx, cz) {
  const key = cx + ':' + cz;
  let L = lakeCells.get(key);
  if (L !== undefined) return L;
  L = null;
  if (cx === HOME_CX && cz === HOME_CZ) L = HOME;
  else {
    const { R, there, x, z } = cellSpot(cx, cz), settled = SETTLEMENTS && there && settledCell(cx, cz);
    const size = R(), p3 = R() * TAU, p5 = R() * TAU, p7 = R() * TAU, wob = 0.35 + R() * 1.25, n1 = R(), n2 = R(), long = R(), th = R() * Math.PI, worn = R();
    if (there) {
      // size, how deeply the shore is scalloped, and how long and narrow it is (one in three is nearly round);
      // then scaled down, if need be, so the longest reach of the shore stays inside the lake's own square
      let R0 = 12 + size * size * 30;
      const E = long < 0.33 ? long * 0.15 : 0.08 + (long - 0.33) * 0.42, lobes = (0.13 + 0.085 + 0.05) * wob;
      R0 *= Math.min(1, 47 / (R0 * (1 + lobes) * (1 + E)));
      // its character, from the country it lies in
      const rain = rainAt(x, z), dry = dryOf(rain), lush = lushOf(rain), snow = snowOf(coldAt(x, z, 1));
      const beach = clamp(1 + dry * 0.5 - lush * 0.8 - snow * 0.9, 0.1, 1.5);
      const tint = [1 - lush * 0.3 - dry * 0.12 - snow * 0.12, 1 + lush * 0.04 + dry * 0.16 - snow * 0.04, 1 - lush * 0.2 + dry * 0.12 + snow * 0.12];
      L = makeLake({ x, z, R0, A3: R0 * 0.13 * wob, P3: p3, A5: R0 * 0.085 * wob, P5: p5, A7: R0 * 0.05 * wob, P7: p7, E, TH: th, beach, ring: settled || (SETTLEMENTS && worn < 0.25), tint }); // (a settled lake always has its path)
      L.id = key;
      L.settled = settled;
      L.clime = { dry, lush, snow }; // (the country it lies in: what grows and lives at it follows from this)
      L.frozen = snow > 0.6;
      const first = L.frozen ? NAME_COLD : NAME_A;
      L.name = first[Math.floor(n1 * first.length)] + NAME_B[Math.floor(n2 * NAME_B.length)];
    }
  }
  lakeCells.set(key, L);
  return L;
}
/** The lakes that could matter at a spot: those of its square and the eight round it. */
let lastAround = null, lastCX = NaN, lastCZ = NaN;
function lakesAround(x, z) {
  const cx = Math.floor(x / LAKE_CELL), cz = Math.floor(z / LAKE_CELL);
  if (cx === lastCX && cz === lastCZ) return lastAround;
  const key = cx + ':' + cz;
  let list = aroundCells.get(key);
  if (!list) {
    list = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const L = lakeOfCell(cx + dx, cz + dz); if (L) list.push(L); }
    aroundCells.set(key, list);
  }
  lastCX = cx; lastCZ = cz; lastAround = list;
  return list;
}
/** Every lake within `r` metres of a spot, nearest first. */
export function lakesNear(x, z, r) {
  const out = [], c0 = Math.floor((x - r) / LAKE_CELL), c1 = Math.floor((x + r) / LAKE_CELL), d0 = Math.floor((z - r) / LAKE_CELL), d1 = Math.floor((z + r) / LAKE_CELL);
  for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) { const L = lakeOfCell(cx, cz); if (L && Math.hypot(L.x - x, L.z - z) < r + L.R0) out.push(L); }
  return out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
}
/** The lake nearest a spot (by how far out the spot is, in that lake's own radii). There always is one, though it may be far off. */
export function lakeAt(x, z) {
  const list = lakesAround(x, z);
  let best = null, bt = Infinity;
  for (let i = 0; i < list.length; i++) {
    const L = list[i], dx = x - L.x, dz = z - L.z, d2 = dx * dx + dz * dz;
    const t = d2 > L.reach2 ? Math.sqrt(d2) / L.R0 : L.t(x, z); // (far off, the exact shore doesn't matter)
    if (t < bt) { bt = t; best = L; }
  }
  return best || lakesNear(x, z, LAKE_CELL * 4)[0] || HOME;
}
/** How far out a spot is from its nearest lake, in lake-radii (1 = on the shore). */
export const lakeT = (x, z) => lakeAt(x, z).t(x, z);
/** How much a spot is on the path round its nearest lake. */
export const pathAmt = (x, z) => lakeAt(x, z).path(x, z);
// the single-lake names: the lake the landmarks stand at (the home lake, until anchorTo moves them)
export let LAKE = HOME, lakeR = HOME.r;

// ── Terrain ────────────────────────────────────────────────────
/**
 * The lie of the land before any lake is cut into it. Three layers: the gentle meadow underfoot;
 * broad rolling hills; and, in some regions, mountains with long sharp ridges. The hills and
 * mountains are held back round every lake (`open` is 0 by a lake, 1 away from any), so each lake
 * lies in its own valley. Never below 0.6 m: the only water is the lakes.
 */
/**
 * How strongly the mountains' fine relief is worn off their steep sides (see land()). Running water
 * and falling rock strip the small bumps from a steep slope and leave them on the ridges and the
 * flats; here the bumps shrink by 1 / (1 + EROSION * slope²), the slope being that of the broad
 * shape of the mountain beneath them.
 */
export const EROSION = 1.0;
const gH = [0, 0, 0], gC = [0, 0, 0];
function land(x, z, open) {
  const u = x + SX * 31, v = z + SZ * 31;
  const meadow = 0.6 + fbm(u * 0.018 + 3.1, v * 0.018 - 7.4) * 7.5;
  if (open <= 0) return meadow;
  const range = rangeAt(x, z);
  if (range <= 0) { const hills = fbm(u * 0.0055 - 9.2, v * 0.0055 + 23.6); return meadow + open * hills * hills * 46; }
  // the mountains: broad hills and ridged crests (with their slopes, in metres per metre)...
  fbmD(u * 0.0055 - 9.2, v * 0.0055 + 23.6, gH);
  fbmD(u * 0.0038 + 71.1, v * 0.0038 + 5.5, gC);
  const hills = gH[0], f = gC[0], sgn = 2 * f - 1 >= 0 ? 1 : -1;
  const crest = 1 - Math.abs(2 * f - 1); // ridged: sharp along the tops
  const kx = 2 * hills * 46 * gH[1] * 0.0055 - range * 2 * crest * 205 * 2 * sgn * gC[1] * 0.0038;
  const kz = 2 * hills * 46 * gH[2] * 0.0055 - range * 2 * crest * 205 * 2 * sgn * gC[2] * 0.0038;
  // ...and their fine relief, worn off where that broad shape is steep
  const wear = 1 / (1 + EROSION * (kx * kx + kz * kz) * open * open);
  const detail = 0.5 + (fbm(u * 0.021 - 3.3, v * 0.021 + 8.8) - 0.5) * wear;
  return meadow + open * (hills * hills * 46 + range * (28 + crest * crest * 205 + detail * 24 * range));
}
/** How much a spot is in the mountains (0 none .. 1 the heart of a range). */
export function rangeAt(x, z) { return smooth(0.5, 0.72, fbm((x + SX * 31) * 0.0014 + 41.3, (z + SZ * 31) * 0.0014 - 17.9)); }
let shaped = false; // (did the last rawHeight() land on a lake's own shaped ground: its bowl, shore and path?)
/**
 * The land as the seed gives it, before the ground under any shrine is levelled: held down in the
 * valleys of the lakes within reach, with the nearest lake's bowl and path cut in. (Every lake's
 * valley is a smooth factor and the bowls never overlap, so the land has no seam where "the
 * nearest lake" changes from one to another.) Where a shrine may stand is decided from this.
 */
export function rawHeight(x, z) {
  const list = lakesAround(x, z);
  let open = 1, lake = null, t = 99;
  for (let i = 0; i < list.length; i++) {
    const L = list[i], dx = x - L.x, dz = z - L.z;
    if (dx * dx + dz * dz > L.reach2) continue;
    const lt = L.t(x, z);
    open *= smooth(2.4, 7.5, lt);
    if (lt < t) { t = lt; lake = L; }
  }
  const base = land(x, z, open);
  shaped = !!lake && t < lake.bowl + 0.1;
  if (!shaped) return base; // (beyond the bowl and the path)
  const floor = t < 1 ? -3.2 * (1 - t * t) : (t - 1) * 2.0;
  const k = smooth(0.8, lake.bowl, t);
  return floor * (1 - k) + base * k - lake.path(x, z) * 0.08;
}

/**
 * Exact terrain height: the land, with the ground under each shrine made level (flat for PAD_FLAT
 * metres round its middle, easing back into the lie of the land by PAD_OUT). The ground's tiles
 * are built from it. A shrine never stands on a lake's own ground, so that is left as it is.
 */
export function height(x, z) {
  const h = rawHeight(x, z);
  if (shaped) return h;
  const s = shrineSiteAt(x, z, PAD_OUT);
  if (s) return h + (s.y - h) * (1 - smooth(PAD_FLAT, PAD_OUT, Math.hypot(x - s.x, z - s.z)));
  if (sitesReady) { const v = volcanoAt(x, z); if (v) return h + coneRise(Math.hypot(x - v.x, z - v.z)); }
  const b = sitesReady ? siteAt(x, z) : null; // (a building's levelled ground)
  if (b && b.out > 0) return h + (b.y - h) * (1 - smooth(b.flat, b.out, Math.hypot(x - b.x, z - b.z)));
  return h;
}

// ── Climate ────────────────────────────────────────────────────
// Two broad fields, read from the same seeded noise as the land, decide what kind of country a
// place is: how cold it is and how much rain it gets. Everything that covers the land reads them
// (the ground's colour and snow, the grass, which trees grow and how thickly, the flowers), so
// the kinds of country change together as you travel, and blend where they meet:
//   cold  -> snow in drifts, then snowfields; pines; no flowers      (also: the higher, the colder)
//   dry   -> golden heath, tall pale grass, a few airy trees, more boulders
//   wet   -> lush dark-green country, thick mixed woods, ferns and mushrooms
// and here and there a blossom grove. Round the home lake the country is always mild.
const mild = (x, z) => smooth(140, 330, Math.hypot(x - HOME.x, z - HOME.z)); // (0 by the home lake, 1 beyond it)
// ── Moisture, and what temperature and moisture make together ──
// As in nature (and in Minecraft, which picks its biomes from temperature and humidity), the kind
// of country comes from how cold and how wet it is together: mild and wet, thick lush woods; mild
// and dry, golden heath; cold and wet, deep snow and dark pine woods (taiga); cold and dry, bare
// tundra where little snow lies, for snow needs moisture as well as cold. The ground is wetter near
// water, so a lake's shores are greener than the country about it.
/** How much wetter (in rain's units) dry ground is right by a lake, fading out over a few lake-radii (never past middling: water greens dry country, it does not make a swamp of mild). */
export const WATER_WET = 0.08;
/** How much less snowy cold, dry country is (in coldAt's units): the tundra. */
export const SNOW_DRY = 0.3;
/** How wet the ground is (0 parched .. 1 soaked): the rain, and, in dry country, more of it near a lake. */
export function moistAt(x, z) {
  const rain = rainAt(x, z);
  if (rain >= 0.5) return rain;
  return Math.min(0.5, rain + WATER_WET * (1 - smooth(1.2, 3.5, lakeAt(x, z).t(x, z))));
}
/** Cold, as far as snow goes (pass to snowOf): cold needs moisture to give snow. */
export const snowCold = (cold, moist) => cold - SNOW_DRY * (1 - smooth(0.33, 0.45, moist));

/** How warm the warm country is, in the units of the cold (it takes the chill below zero). */
export const WARMTH = 0.6;
/**
 * How cold the country is at a spot, before its height: 0 mild .. 1 frozen, and below 0 in warm
 * country (to -WARMTH): one broad field of temperature, cold at one end and warm at the other, the
 * home lake in the middle of it.
 */
export function coldBase(x, z) {
  const n = fbm((x + SX * 17) * 0.0011 - 63.4, (z + SZ * 17) * 0.0011 + 28.9);
  return (smooth(0.575, 0.7, n) - WARMTH * smooth(0.425, 0.3, n)) * mild(x, z);
}
/**
 * How cold a spot is in summer ("chill"): about 0 mild, 1 frozen, below 0 in warm country; the
 * country's cold and the height (`h`, the ground's height there). Through the year it rises
 * (core/year.js chillNow).
 */
export function coldAt(x, z, h, base = coldBase(x, z)) {
  return clamp(base + smooth(78, 132, h), -1, 1);
}

// ── Treeline, rock and the way a slope faces ─────────────────
// Air is colder the higher you go, so trees give out at a certain height, then grass, then bare
// rock, then snow. Here they all follow one quantity, the height a spot "feels": its height, raised
// in cold country (the treeline is lower there) and on slopes that face north, away from the sun
// (north is -z: systems/time.js), which are colder and hold their snow longer; slopes facing south
// are warmer. Snow follows the same through coldAt(x, z, h + ASPECT * north).
/** Felt height (m) where trees give out, in mild country on level ground. */
export const TREELINE = 64;
/** How much lower (m) the treeline lies in the coldest country. */
export const TREE_COLD = 25;
/** How much higher (m) a slope facing north feels, per unit of its rise (and lower for one facing south). */
export const ASPECT = 14;
const look = { north: 0, scree: 0 };
/**
 * How the land lies at a spot, measured over fixed distances (so it is the same at every scale the
 * ground is drawn), from one shared set of samples:
 *   north: how much it faces north (+) or south (-): its rise toward +z per metre, over 8 m (0 on
 *     low, mild ground, where it would change nothing);
 *   scree (0..1): loose rock fallen from a cliff, lying at its resting angle (about 33 to 37
 *     degrees) at the cliff's foot: a slope of about 22 to 40 degrees with ground steeper than
 *     about 42 between 9 and 15 m above it.
 * The result is reused: copy what you need before the next call. A caller that already has the
 * slope over about 8 m (`slope`: [rise per metre toward +x, toward +z]) may pass it.
 */
export function slopeLook(x, z, h, base = coldBase(x, z), slope = null) {
  look.north = 0; look.scree = 0;
  const wantNorth = h >= 18 || base >= 0.25, wantScree = h >= 10;
  if (!wantNorth && !wantScree) return look;
  const gx = slope ? slope[0] : (height(x + 4, z) - height(x - 4, z)) / 8, gz = slope ? slope[1] : (height(x, z + 4) - height(x, z - 4)) / 8;
  if (wantNorth) look.north = clamp(gz, -1.2, 1.2);
  if (wantScree) {
    const sl = Math.hypot(gx, gz);
    if (sl >= 0.4 && sl <= 0.85) {
      const ux = gx / sl, uz = gz / sl, cliff = (height(x + ux * 15, z + uz * 15) - height(x + ux * 9, z + uz * 9)) / 6; // (uphill)
      look.scree = smooth(0.4, 0.55, sl) * (1 - smooth(0.72, 0.85, sl)) * smooth(0.9, 1.2, cliff);
    }
  }
  return look;
}
/** How much the land at a spot faces north (+) or south (-): see slopeLook. */
export const northness = (x, z, h, base) => slopeLook(x, z, h, base).north;
/** How much a spot is scree (0..1): see slopeLook. */
export const screeAt = (x, z, h) => slopeLook(x, z, h).scree;
/** The height (m) a spot feels like: see above. `north` from northness(). */
export const feltHeight = (x, z, h, north, base = coldBase(x, z)) => h + TREE_COLD * base + ASPECT * north;
/** How far into the treeline band a spot is: 0 below it, 1 at the line and above (no trees). */
export const aboveTrees = (felt) => smooth(TREELINE - 16, TREELINE, felt);
/** How much rain a spot gets, 0 parched .. 1 soaked (0.5 in between, and in the valley). */
export function rainAt(x, z) {
  const n = fbm((x + SX * 17) * 0.0013 + 19.2, (z + SZ * 17) * 0.0013 - 51.7);
  return 0.5 + (n - 0.5) * mild(x, z);
}
/** From the rain: how parched (0..1) and how lush (0..1) a spot is. */
export const dryOf = (rain) => smooth(0.475, 0.37, rain), lushOf = (rain) => smooth(0.535, 0.65, rain);
/** How much a spot is part of a blossom grove (0..1): rare pockets, a hundred metres or so across. */
export function groveAt(x, z) {
  return smooth(0.675, 0.74, fbm((x + SX * 17) * 0.0042 + 133.1, (z + SZ * 17) * 0.0042 - 87.5)) * mild(x, z);
}
/** How much snow lies at a spot with this much cold (before the ragged edge the ground's shader gives it). */
export const snowOf = (cold) => smooth(0.46, 0.62, cold);

// ── The ground as drawn ────────────────────────────────────────
// The ground is drawn in tiles; where a fine tile is loaded, heights are read from its own
// vertices (with the same triangle split), so feet and paws sit exactly on the surface you see and
// a lookup costs a few multiplies instead of several noise evaluations. Anywhere else the exact
// formula answers, so every question about the land works whether or not that land is on screen.
let sampler = null;
/** The ground hands over its lookup: (x, z) -> height, or NaN where no fine tile is loaded. */
export function setGroundSampler(fn) { sampler = fn; }
/** Height of the ground at a spot. */
export function heightAt(x, z) {
  if (sampler) { const h = sampler(x, z); if (h === h) return h; }
  return height(x, z);
}
/** How steep the ground is at a spot (rise over run: 1 is a 45 degree slope). */
export function slopeAt(x, z) {
  const e = 0.6;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

export let lakePoint = HOME.point;

// ── Places beside a lake ───────────────────────────────────────
export let DOCK_A = Math.PI / 2 + 0.55, CHAIR_A = Math.PI / 2 - 0.95; // (where round the lake the jetty and the lawn chairs are)
export const DOCK_BACK = 1.6, DOCK_LEN = 9, DOCK_HALF = 1.05;
/**
 * Where things stand round a lake: the starting spot on the path, the jetty (where it leaves the
 * shore, which way it runs, how high its deck is), the two lawn chairs, the campfire and the bench.
 * The whole arrangement is turned round the lake by the lake's own `turn` (0 at home), so no two
 * lakes are laid out facing the same way.
 */
export function landmarksOf(lake) {
  const kit = kitOf(lake), turn = lake.turn || 0, dockA = Math.PI / 2 + 0.55 + turn, chairA = Math.PI / 2 - 0.95 + turn;
  const start = kit.dock ? lake.point(dockA, 1.03) : { x: PARK.x, z: PARK.z };
  const away = () => ({ x: PARK.x, z: PARK.z });
  return {
    dockA, chairA, kit,
    spawn: lake.point(Math.PI / 2 + turn, PATH_T + 0.04),
    dockStart: start,
    dockDir: { x: -Math.cos(dockA), z: -Math.sin(dockA) },
    dockY: kit.dock ? Math.max(0.5, height(start.x, start.z) + 0.1) : 0.5,
    chairs: kit.bench ? [lake.point(chairA, 1.17), lake.point(chairA + 0.05, 1.17)] : [away(), away()],
    fire: kit.fire ? lake.point(Math.PI / 2 + 0.34 + turn, 1.68) : away(),
    bench: kit.bench ? lake.point(Math.PI / 2 - 0.5 + turn, 1.5) : away(),
  };
}
/**
 * Where the spots of things a lake does not have are put: far beyond anywhere you will walk. A
 * lake with no jetty has its "jetty spot" out there, so nothing can stand on a jetty that isn't
 * to be seen, sit on its chair or board its boat.
 */
export const PARK = { x: 4.0e5, z: 4.0e5 };
/** Would a jetty at this lake, with the arrangement turned this way, stand in deep water with room for the boat's tour? */
function jettyFits(lake, turn) {
  const a = Math.PI / 2 + 0.55 + turn, s0 = lake.point(a, 1.03), dx = -Math.cos(a), dz = -Math.sin(a);
  if (height(s0.x, s0.z) < 0.25) return false;                                                       // it leaves dry land
  for (const s of [3.5, 6, DOCK_LEN]) if (height(s0.x + dx * s, s0.z + dz * s) > -0.35) return false; // and runs out over water
  const mx = s0.x + dx * (DOCK_LEN + 0.85), mz = s0.z + dz * (DOCK_LEN + 0.85), tm = lake.t(mx, mz);
  if (tm > 0.82 || tm < 0.25) return false;                                                           // the mooring is well inside the lake, not across it
  for (let i = 1; i < 28; i++) { const p = lake.point(a + (i / 28) * TAU, tm); if (height(p.x, p.z) > -0.5) return false; } // and the tour floats all the way round
  return true;
}
/**
 * What is built beside a lake: `{ dock, fire, bench }`. Nothing at a lake that isn't settled; at
 * a settled one, most of them: a jetty with the boat and its skipper if the shore allows (not on
 * a frozen lake), a campfire with its logs, a bench with the lawn chairs and the path lamps. Also
 * settles the lake's `turn`: which way the whole arrangement faces. Worked out when first asked
 * for (it needs the shape of the land), then kept on the lake.
 */
export function kitOf(lake) {
  if (lake.kit) return lake.kit;
  if (lake === HOME) {
    // the home lake has everything; its arrangement faces the first of sixteen ways that gives the jetty deep water
    const first = hash(WORLD.seed * 13 + 5, 77) * TAU;
    lake.turn = first;
    let fits = false;
    for (let k = 0; k < 16 && !fits; k++) { const t = first + (k / 16) * TAU; if (jettyFits(lake, t)) { lake.turn = t; fits = true; } }
    // (none of those: try the ways between them; in the 42 worlds checked this was never needed)
    for (let k = 0; k < 64 && !fits; k++) { const t = first + ((k + 0.5) / 64) * TAU; if (jettyFits(lake, t)) { lake.turn = t; fits = true; } }
    return (lake.kit = { dock: true, fire: true, bench: true });
  }
  if (!lake.settled) return (lake.kit = { dock: false, fire: false, bench: false });
  const R = mulberry32((Math.floor(hash(Math.round(lake.x), Math.round(lake.z)) * 4294967296) ^ 0x3C6EF372) | 0);
  const first = R() * TAU, wantDock = R() < 0.85, wantFire = R() < 0.8, wantBench = R() < 0.72;
  let dock = false;
  lake.turn = first;
  if (wantDock && !lake.frozen) for (let k = 0; k < 10 && !dock; k++) { const t = first + (k / 10) * TAU; if (jettyFits(lake, t)) { lake.turn = t; dock = true; } }
  return (lake.kit = { dock, fire: wantFire || (!dock && !wantBench), bench: wantBench });
}
/** The landmark spots of a lake, wherever the landmarks themselves are just now (worked out once, kept on the lake). */
const marksOf = (lake) => lake.marks || (lake.marks = landmarksOf(lake));
/**
 * Is a spot kept clear for something built? Trees, boulders and small plants keep off the path
 * round a settled lake and out of the way of its jetty, fire, bench, chairs and lamps, and off
 * the shrine's ground. The rule is the lake's own (its spots, not where the single set of
 * landmarks happens to be), so a square of land always grows the same things.
 */
export function clearingAt(x, z) {
  if (shrineSiteAt(x, z, SHRINE_R + 7)) return true;
  if (sitesReady && siteAt(x, z, -1)) return true; // (and a building's ground)
  const L = lakeAt(x, z);
  if (!L.settled) return false;
  const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz), r = L.r(Math.atan2(dz, dx));
  if (d > r * 2.1) return false;
  if (L.path(x, z) > 0.02 || Math.abs(d - r * (PATH_T + 0.085)) < 1.6) return true; // the path, and the lamps along it
  const m = marksOf(L), near = (p, reach) => (x - p.x) ** 2 + (z - p.z) ** 2 < reach * reach;
  return near(m.spawn, 8) || near(m.fire, 5.5) || near(m.bench, 4) || near(m.chairs[0], 3.5) || near(m.chairs[1], 3.5) || near(m.dockStart, 5.5);
}
// ── Shrines ────────────────────────────────────────────────────
// Where a shrine may stand is fixed by the land, so by the seed: one site a little way back from
// the home lake, and others out in the world, in blossom groves. The land is ruled into squares of
// SHRINE_CELL metres and a square has a site if a grove with level, low, snowless ground lies in
// its middle half, clear of every lake. The ground under a site is levelled (see height()), and
// trees, boulders and small plants keep off it (clearingAt). There is one shrine; it stands at
// the site nearest you (world/shrine.js moves it while it is out of sight).
/**
 * How sites are chosen, in metres: the squares' side; how far out the levelled ground is flat and
 * where it has eased back into the land; the ring the shrine and its path lie within; how many
 * spots a square tries; how much of a grove a spot must be; how far the ground may rise or fall
 * round it; and how far a site keeps from the home lake's own.
 */
const SHRINE_CELL = 640, PAD_FLAT = 25, PAD_OUT = 46, SHRINE_R = 17, SHRINE_TRIES = 14, SHRINE_GROVE = 0.6, SHRINE_RELIEF = 5, SHRINE_APART = 320;
const shrineCells = new Map();
const SHRINE_NAMES = ['Petalfall', 'Mistbloom', 'Quietbough', 'Rosecloud', 'Lanternhill', 'Softrain', 'Paleblossom', 'Windchime', 'Moonpetal', 'Hollowcherry', 'Dawnbloom', 'Silkpetal', 'Stillbranch', 'Cloudcherry', 'Duskpetal', 'Fernbloom'];
let homeShrine = null, lastShrine = null, lastSX = NaN, lastSZ = NaN;
/** How much the land rises or falls round a spot (the worst of twelve looks, 18 and 34 m out). */
function reliefAt(x, z, h) {
  let worst = 0;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, d = k % 2 ? 34 : 18; worst = Math.max(worst, Math.abs(rawHeight(x + Math.cos(a) * d, z + Math.sin(a) * d) - h)); }
  return worst;
}
/** Would levelled ground round this spot keep off every lake's own shaped ground (its bowl, shore and path)? */
function clearOfLakes(x, z) {
  const lakes = lakesNear(x, z, 220);
  for (const L of lakes) {
    if (L.t(x, z) < L.bowl + 0.2) return false;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; if (L.t(x + Math.cos(a) * (PAD_OUT + 2), z + Math.sin(a) * (PAD_OUT + 2)) < L.bowl + 0.2) return false; }
  }
  return true;
}
/**
 * The site by the home lake: the most level place back from it, looking toward the water. Near
 * the lake where the country is gentle; where the home lake lies among steep hills, as far off
 * as it takes to find level ground (a few hundred metres at most). `{ id, x, z, y, fx, fz, r }`: its name, its middle, the height its ground is levelled
 * to, the way it faces, and the radius of the ring it lies within.
 */
export function homeShrineSite() {
  if (homeShrine) return homeShrine;
  const L = HOME;
  let best = null;
  for (let a = 0; a < TAU; a += TAU / 60) {
    for (let r = L.rmax * 2.4; r <= L.rmax * 12; r += 7) {
      const x = L.x + Math.cos(a) * r, z = L.z + Math.sin(a) * r, h = rawHeight(x, z);
      if (h < 0.8 || h > 70 || snowOf(snowCold(coldAt(x, z, h), moistAt(x, z))) > 0.15 || !clearOfLakes(x, z)) continue;
      const score = reliefAt(x, z, h) + (r / L.rmax) * 0.45; // (level first; of two as level, the nearer)
      if (!best || score < best.score) best = { x, z, score };
    }
  }
  if (!best) best = { x: L.x - L.rmax * 3.4, z: L.z };
  const d = Math.hypot(L.x - best.x, L.z - best.z);
  return (homeShrine = { id: 'home', name: HOME.name + ' Shrine', x: best.x, z: best.z, y: rawHeight(best.x, best.z), fx: (L.x - best.x) / d, fz: (L.z - best.z) / d, r: SHRINE_R });
}
/** The shrine site of one square of the land, or null: most squares have none. Worked out once, then kept. */
function shrineOfCell(cx, cz) {
  const key = cx + ':' + cz;
  if (shrineCells.has(key)) return shrineCells.get(key);
  const R = mulberry32((Math.floor(hash(cx * 5 + 17, cz * 11 - 3) * 4294967296) ^ Math.imul(WORLD.seed, 0x85EBCA6B) ^ 0x51A7E) | 0), home = homeShrineSite();
  let best = null;
  for (let k = 0; k < SHRINE_TRIES; k++) {
    // (in the square's middle half, so two sites are never close and levelled ground never crosses into the next square)
    const x = (cx + 0.25 + R() * 0.5) * SHRINE_CELL, z = (cz + 0.25 + R() * 0.5) * SHRINE_CELL;
    if (groveAt(x, z) < SHRINE_GROVE) continue;
    const h = rawHeight(x, z);
    if (h < 1 || h > 48 || snowOf(snowCold(coldAt(x, z, h), moistAt(x, z))) > 0.15 || Math.hypot(x - home.x, z - home.z) < SHRINE_APART || !clearOfLakes(x, z)) continue;
    const relief = reliefAt(x, z, h);
    if (relief < SHRINE_RELIEF && (!best || relief < best.relief)) best = { x, z, h, relief };
  }
  let site = null;
  if (best) {
    // it looks down the gentlest way out: its path climbs to it from the lowest ground about
    let low = Infinity, fx = 0, fz = 1;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, y = rawHeight(best.x + Math.cos(a) * 34, best.z + Math.sin(a) * 34); if (y < low) { low = y; fx = Math.cos(a); fz = Math.sin(a); } }
    site = { id: key, name: SHRINE_NAMES[Math.floor(hash(cx * 3 - 41, cz * 7 + 19) * SHRINE_NAMES.length) % SHRINE_NAMES.length] + ' Shrine', x: best.x, z: best.z, y: best.h, fx, fz, r: SHRINE_R };
  }
  shrineCells.set(key, site);
  return site;
}
/** The shrine site whose middle is within `reach` metres of a spot (at most PAD_OUT), or null. */
export function shrineSiteAt(x, z, reach = PAD_OUT) {
  const h = homeShrineSite();
  if ((x - h.x) ** 2 + (z - h.z) ** 2 < reach * reach) return h;
  const cx = Math.floor(x / SHRINE_CELL), cz = Math.floor(z / SHRINE_CELL);
  if (cx !== lastSX || cz !== lastSZ) { lastSX = cx; lastSZ = cz; lastShrine = shrineOfCell(cx, cz); }
  const s = lastShrine;
  return s && (x - s.x) ** 2 + (z - s.z) ** 2 < reach * reach ? s : null;
}
/** Every shrine site within `r` metres of a spot, nearest first. */
export function shrineSitesNear(x, z, r) {
  const out = [], h = homeShrineSite(), near = (s) => Math.hypot(s.x - x, s.z - z);
  if (near(h) < r) out.push(h);
  for (let cz = Math.floor((z - r) / SHRINE_CELL); cz <= Math.floor((z + r) / SHRINE_CELL); cz++) for (let cx = Math.floor((x - r) / SHRINE_CELL); cx <= Math.floor((x + r) / SHRINE_CELL); cx++) { const s = shrineOfCell(cx, cz); if (s && near(s) < r) out.push(s); }
  return out.sort((a, b) => near(a) - near(b));
}
// ── Biomes ─────────────────────────────────────────────────────
// (core/biome.js explains them; their weights live here so the land's height can use them for the
// buildings' levelled ground without the two modules needing each other.)
let BSX = null, BSZ = 0;
const awayFromHome = (x, z) => smooth(450, 900, Math.hypot(x - HOME.x, z - HOME.z));
/** The wonder field: rare pockets (0..1), a few hundred metres across, of two kinds (a and b) that never meet. */
export function wonderAt(x, z) {
  if (BSX === null) { BSX = hash(WORLD.seed, 101) * 7000; BSZ = hash(WORLD.seed, 103) * 7000; }
  const n = fbm((x + BSX) * 0.0011 + 5.3, (z + BSZ) * 0.0011 - 8.1), k = fbm((x - BSZ) * 0.0004 - 2.2, (z + BSX) * 0.0004 + 6.6);
  const w = smooth(0.66, 0.74, n) * awayFromHome(x, z);
  return { a: w * smooth(0.45, 0.55, k), b: w * (1 - smooth(0.45, 0.55, k)) };
}
/** The biomes' weights at a spot (0..1 each): desert, swamp, enchanted, volcanic. `base` and `rain` may be passed when known. */
export function biomesAt(x, z, h, base = coldBase(x, z), rain = rainAt(x, z)) {
  const away = awayFromHome(x, z), wonder = wonderAt(x, z), range = rangeAt(x, z);
  return {
    desert: smooth(-0.18, -0.36, base) * smooth(0.45, 0.37, rain) * away,
    swamp: smooth(0.6, 0.68, rain) * (1 - smooth(8, 22, h)) * (1 - range) * (1 - smooth(0.2, 0.4, base)) * away,
    enchanted: wonder.a * smooth(0.5, 0.58, rain) * (1 - smooth(0.3, 0.5, base)),
    volcanic: wonder.b * smooth(0.2, 0.5, range),
  };
}
/** The strongest biome at a spot and its weight, or null in ordinary country. */
export function biomeAt(x, z, h, min = 0.5) {
  const w = biomesAt(x, z, h);
  let best = null, bw = min;
  for (const k in w) if (w[k] > bw) { bw = w[k]; best = k; }
  return best ? { id: best, w: bw } : null;
}

// ── Buildings' sites ───────────────────────────────────────────
// Where the biomes' buildings stand (world/landmarks.js builds and sets them down): fixed by the
// land, so by the seed, each kind by its own rule, one or none to a square of its own size, in the
// square's middle half (so two are never close), on ground levelled for it (see height()), clear
// of every lake, of the shrines and of the start. `flat`/`out`: the levelled ground's radii.
const SITE_KINDS = {
  // a pagoda in a blossom grove
  pagoda: { cell: 700, flat: 10, out: 18, salt: 0x9A60D, tries: 10, chance: 0.6, rule: (x, z, h) => groveAt(x, z) > 0.6 && h > 1 && h < 45 },
  // a castle on a hilltop in mild, open country
  castle: { cell: 1500, flat: 20, out: 34, relief: 10, salt: 0x2C451E, tries: 16, chance: 0.6, rule: (x, z, h) => Math.abs(coldBase(x, z)) < 0.2 && rangeAt(x, z) < 0.15 && h > 8 && h < 60 && hilltop(x, z, h) > 5 },
  // ruins: in the plains, and sandstone ones in the desert
  ruin: { cell: 900, flat: 7, out: 12, salt: 0x5017, tries: 10, chance: 0.35, rule: (x, z, h) => h > 1 && h < 50 && (biomesAt(x, z, h).desert > 0.5 || (rangeAt(x, z) < 0.2 && Math.abs(coldBase(x, z)) < 0.25)) },
  // a hut on stilts in the swamp (no levelled ground: it stands over the water)
  hut: { cell: 420, flat: 0, out: 0, salt: 0x4D7, tries: 12, rule: (x, z, h) => h < 4 && biomesAt(x, z, h).swamp > 0.5 },
  // a windmill on an open, windy rise
  windmill: { cell: 980, flat: 6, out: 12, salt: 0x3111, tries: 12, chance: 0.7, rule: (x, z, h) => h > 14 && h < 70 && rangeAt(x, z) < 0.35 && Math.abs(coldBase(x, z)) < 0.3 && hilltop(x, z, h) > 3 },
  // places to find: a ring of standing stones on a hilltop; a cairn on a summit; a hot spring in the snow
  circle: { cell: 1250, flat: 9, out: 15, salt: 0x51C1E, tries: 14, chance: 0.75, rule: (x, z, h) => h > 10 && h < 90 && hilltop(x, z, h) > 7 },
  cairn: { cell: 1100, flat: 3, out: 6, relief: 60, salt: 0xCA12, tries: 20, chance: 0.4, rule: (x, z, h) => h > 90 && hilltop(x, z, h) > 22 },
  spring: { cell: 900, flat: 4, out: 8, salt: 0x5B21, tries: 14, chance: 0.4, rule: (x, z, h) => h > 2 && h < 90 && snowOf(coldAt(x, z, h)) > 0.5 },
  // an ice castle on a snowy height
  icecastle: { cell: 1700, flat: 20, out: 34, relief: 20, salt: 0x1CE, tries: 24, chance: 0.8, rule: (x, z, h) => h > 6 && h < 170 && snowOf(coldAt(x, z, h)) > 0.55 && hilltop(x, z, h) > 2 },
  // a crystal grotto: a basin sunk into the ground and ringed with great glowing crystals (in a wonder)
  grotto: { cell: 1300, flat: 11, out: 24, sink: 6, salt: 0x6207, tries: 12, rule: (x, z, h) => h > 3 && h < 80 && wonderAt(x, z).a > 0.35 },
  // a volcano: a great cone with a crater, raised in a wonder in the mountains (no levelled ground: its cone, see height())
  volcano: { cell: 2200, flat: 0, out: 0, cone: 430, salt: 0xB01C, tries: 10, rule: (x, z, h) => wonderAt(x, z).b > 0.55 && rangeAt(x, z) > 0.2 },
  // floating islands over a wonder in the hills, an updraft below to ride up
  skyisle: { cell: 1900, flat: 6, out: 11, salt: 0x5C15, tries: 12, rule: (x, z, h) => h > 4 && h < 90 && wonderAt(x, z).a > 0.3 && rangeAt(x, z) < 0.45 },
};
/** The volcano's cone: how much it raises the land (m) at a distance `r` from its middle; a crater at the top. */
export const VOLCANO = { height: 160, radius: 430, crater: 58, deep: 46 };
const coneRise = (r) => (r >= VOLCANO.radius ? 0 : VOLCANO.height * (1 - r / VOLCANO.radius) ** 1.6 - (r < VOLCANO.crater ? VOLCANO.deep * (1 - (r / VOLCANO.crater) ** 2) : 0));
let lastVolcano = null;
/** The volcano whose cone reaches a spot, or null. */
function volcanoAt(x, z) {
  const K = SITE_KINDS.volcano, cx = Math.floor(x / K.cell), cz = Math.floor(z / K.cell);
  if (!lastVolcano || lastVolcano.cx !== cx || lastVolcano.cz !== cz) lastVolcano = { cx, cz, s: siteOfCell('volcano', cx, cz) };
  const s = lastVolcano.s;
  return s && (x - s.x) ** 2 + (z - s.z) ** 2 < VOLCANO.radius * VOLCANO.radius ? s : null;
}
/** How much higher a spot is than the ground about it (m, the mean of eight looks 70 m out). */
function hilltop(x, z, h) {
  let s = 0;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; s += rawHeight(x + Math.cos(a) * 70, z + Math.sin(a) * 70); }
  return h - s / 8;
}
const siteCells = new Map(), lastSite = {};
function siteOfCell(kind, cx, cz) {
  const key = kind + ':' + cx + ':' + cz;
  if (siteCells.has(key)) return siteCells.get(key);
  const K = SITE_KINDS[kind], R = mulberry32((Math.floor(hash(cx * 13 + 7, cz * 5 - 11) * 4294967296) ^ Math.imul(WORLD.seed, 0x27D4EB2F) ^ K.salt) | 0);
  let site = null;
  const chance = R(), home = homeShrineSite();
  if (chance < (K.chance === undefined ? 1 : K.chance)) {
    let best = null;
    for (let k = 0; k < K.tries; k++) {
      const x = (cx + 0.25 + R() * 0.5) * K.cell, z = (cz + 0.25 + R() * 0.5) * K.cell, turn = R(), variant = R();
      if (Math.hypot(x - HOME.x, z - HOME.z) < 600 || Math.hypot(x - home.x, z - home.z) < 120) continue;
      const h = rawHeight(x, z);
      if (!K.rule(x, z, h)) continue;
      if (K.flat > 0 && !clearOfLakes(x, z)) continue;
      if (K.flat === 0 && lakeAt(x, z).t(x, z) < (K.cone ? 12 : 2.2)) continue;
      const relief = K.flat > 0 ? reliefAt(x, z, h) : 0;
      if (relief > (K.relief || 6)) continue; // (how far the ground about may rise or fall: a summit's cairn allows a steep one)
      const near = shrineSitesNear(x, z, 80);
      if (near.length) continue;
      if (!best || relief < best.relief) best = { x, z, h, relief, turn, variant };
    }
    if (best) site = { id: key, kind, x: best.x, z: best.z, y: best.h - (K.sink || 0), turn: best.turn * TAU, variant: Math.floor(best.variant * 1000), flat: K.flat, out: K.out };
  }
  siteCells.set(key, site);
  return site;
}
/** The building site whose levelled ground reaches a spot (within its `out`, or `reach` if given), or null. */
export function siteAt(x, z, reach) {
  for (const kind in SITE_KINDS) {
    const K = SITE_KINDS[kind], cx = Math.floor(x / K.cell), cz = Math.floor(z / K.cell), m = lastSite[kind];
    let s;
    if (m && m.cx === cx && m.cz === cz) s = m.s; else { s = siteOfCell(kind, cx, cz); lastSite[kind] = { cx, cz, s }; }
    if (!s) continue;
    const r = reach === undefined ? s.out : reach < 0 ? Math.max(s.flat, 8) + 4 : reach; // (reach < 0: the ground kept clear round it)
    if (r > 0 && (x - s.x) ** 2 + (z - s.z) ** 2 < r * r) return s;
  }
  return null;
}
/** Every building site of a kind (or all kinds) within `r` metres of a spot, nearest first. */
export function sitesNear(x, z, r, kind) {
  const out = [], dist = (s) => Math.hypot(s.x - x, s.z - z);
  for (const k in SITE_KINDS) {
    if (kind && k !== kind) continue;
    const K = SITE_KINDS[k];
    for (let cz = Math.floor((z - r) / K.cell); cz <= Math.floor((z + r) / K.cell); cz++) for (let cx = Math.floor((x - r) / K.cell); cx <= Math.floor((x + r) / K.cell); cx++) { const s = siteOfCell(k, cx, cz); if (s && dist(s) < r) out.push(s); }
  }
  return out.sort((a, b) => dist(a) - dist(b));
}
const HOME_PLACES = landmarksOf(HOME);
DOCK_A = HOME_PLACES.dockA; CHAIR_A = HOME_PLACES.chairA;
export const SPAWN = HOME_PLACES.spawn;

// ── Jetty ──────────────────────────────────────────────────────
export const dockStart = HOME_PLACES.dockStart;
export const dockDir = HOME_PLACES.dockDir;
export let DOCK_Y = HOME_PLACES.dockY;
export function onDock(x, z) {
  const rx = x - dockStart.x, rz = z - dockStart.z;
  const s = rx * dockDir.x + rz * dockDir.z;
  const w = rx * dockDir.z - rz * dockDir.x;
  return s > -DOCK_BACK && s < DOCK_LEN && Math.abs(w) < DOCK_HALF;
}
/** A point on the jetty: `s` metres out along it, `w` metres to the side. */
export const dockAt = (s, w) => ({ x: dockStart.x + dockDir.x * s + dockDir.z * w, z: dockStart.z + dockDir.z * s - dockDir.x * w });

// ── Walking ────────────────────────────────────────────────────
/** True when the lake is frozen solid enough to walk on, and (x, z) is over it. */
/** A lake's chill (its place's cold in summer, at the water), kept on the lake. */
export const lakeChill = (L) => (L.chill !== undefined ? L.chill : (L.chill = coldAt(L.x, L.z, 1)));
/**
 * How frozen a lake is just now (0 open water .. 1 ice you can walk on): each by its own place and
 * the season a few weeks back; a lake of the snowfields is frozen all year. The home lake's ice is
 * kept by features/seasons.js (it waits for the boat to be moored).
 */
export function lakeIce(L) {
  if (L === HOME) return seasonState.ice;
  return L.frozen ? 1 : iceFrom(lakeChill(L), seasonState.lagged || 0);
}
export const onIce = (x, z) => { const lake = lakeAt(x, z); return lakeIce(lake) > 0.85 && lake.t(x, z) < 1.0 && heightAt(x, z) < 0.3; }; // 
export const ICE_Y = 0.09;
export const groundAt = (x, z) => (onDock(x, z) ? Math.max(DOCK_Y + 0.05, heightAt(x, z)) : onIce(x, z) ? Math.max(heightAt(x, z), ICE_Y) : heightAt(x, z));
export const MAX_SLOPE = 1.25;    // steeper than this (about 51 degrees) is a cliff, not a hillside
/** Anywhere that is dry land and not too steep to climb (or the jetty, or solid ice). */
export function walkable(x, z) {
  if (onDock(x, z) || onIce(x, z)) return true;
  return heightAt(x, z) > 0.22 && slopeAt(x, z) < MAX_SLOPE;
}
export const animalWalkable = (x, z) => onDock(x, z) || (walkable(x, z) && !onIce(x, z) && heightAt(x, z) > 0.35);

/**
 * Somewhere to stand, for someone who is where they can't: out over water (the ice just thawed),
 * the nearest shore going outward from the lake's centre; up on a cliff, the nearest gentler ground.
 */
export function nearestShore(x, z) {
  const lake = lakeAt(x, z);
  if (lake.t(x, z) < 1.4) {
    const a = Math.atan2(z - lake.z, x - lake.x);
    for (let t = Math.max(lake.t(x, z), 0.5); t < 1.8; t += 0.02) {
      const p = lake.point(a, t);
      if (walkable(p.x, p.z) && !onIce(p.x, p.z)) return p;
    }
    return lake.point(a, 1.3);
  }
  for (let r = 1.5; r < 60; r += 1.5) {
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (walkable(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/** First point straight ahead (dir = {x, z}) that is open water, trying several distances. */
export function waterAhead(from, dir, dists = [4.5, 3.5, 6, 7.5, 2.5]) {
  for (const d of dists) {
    const x = from.x + dir.x * d, z = from.z + dir.z * d;
    if (lakeT(x, z) < 0.97 && heightAt(x, z) < -0.05 && !onDock(x, z)) return { x, z };
  }
  return null;
}

// ── Reserved spots: lawn chairs and the campfire ───────────────
export const chairSpots = HOME_PLACES.chairs;
export const FIRE_SPOT = HOME_PLACES.fire;
export const BENCH_SPOT = HOME_PLACES.bench;

// ── Moving the landmarks to another lake ───────────────────────
/** The lake the jetty, the fire and the bench stand at just now, and which of them it has. */
export let ANCHOR = HOME;
export const KIT = { dock: true, fire: true, bench: true };
/**
 * Point the single-lake names at another lake: LAKE, lakeR and lakePoint become that lake, and
 * the landmark spots (SPAWN, dockStart, dockDir, DOCK_Y, chairSpots, FIRE_SPOT, BENCH_SPOT) are
 * worked out afresh round it. The spots are the same objects as before with new numbers in them,
 * so whoever holds one sees it move. This moves only the *places*: the things standing on them
 * are moved by whoever built them, through hooks.anchor (see core/state.js).
 */
export function anchorTo(lake) {
  const m = landmarksOf(lake);
  ANCHOR = LAKE = lake; lakeR = lake.r; lakePoint = lake.point;
  Object.assign(KIT, m.kit);
  DOCK_A = m.dockA; CHAIR_A = m.chairA; DOCK_Y = m.dockY;
  Object.assign(SPAWN, m.spawn); Object.assign(dockStart, m.dockStart); Object.assign(dockDir, m.dockDir);
  Object.assign(FIRE_SPOT, m.fire); Object.assign(BENCH_SPOT, m.bench);
  chairSpots.forEach((c, i) => Object.assign(c, m.chairs[i]));
}
export const nearReserved = (x, z, r) => chairSpots.some((c) => Math.hypot(x - c.x, z - c.z) < r) || Math.hypot(x - FIRE_SPOT.x, z - FIRE_SPOT.z) < r + 1.6;
sitesReady = true; // (from here on the land's height levels the buildings' ground)
