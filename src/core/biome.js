// Biomes: the kinds of land beyond the ordinary country (meadow, heath, lush woods, blossom groves,
// snowfields, taiga, tundra, which core/shape.js's climate already makes). As in Minecraft, each
// is a region of a few broad fields of (seed, x, z) that also shape the land, so the land and what
// grows on it always agree:
//   temperature  core/shape.js coldBase: cold at one end, warm at the other, home in the middle
//   moisture     core/shape.js rainAt / moistAt
//   ruggedness   core/shape.js rangeAt: plains, hills, mountains
//   wonder       a rare field of its own, for the places that are more than natural (the owner
//                wants a fantasy world): an enchanted wood here, a volcano there
// A biome's weight at a spot (0..1) is how much the spot belongs to it; they blend at their
// edges. Everything that draws a biome (the ground, plants, rocks, buildings, the sky) asks here.
// Pure, like the rest of the land.
import { fbm, smooth, clamp, hash } from './math.js';
import { WORLD, HOME, coldBase, rainAt, rangeAt } from './shape.js';

const SX = hash(WORLD.seed, 101) * 7000, SZ = hash(WORLD.seed, 103) * 7000;
/** The land near home is always ordinary country (the start must be gentle); the biomes come in beyond. */
const awayFromHome = (x, z) => smooth(450, 900, Math.hypot(x - HOME.x, z - HOME.z));
/** The wonder field: rare pockets (0..1), a few hundred metres across, of two kinds (a and b) that never meet. */
export function wonderAt(x, z) {
  const n = fbm((x + SX) * 0.0011 + 5.3, (z + SZ) * 0.0011 - 8.1), k = fbm((x - SZ) * 0.0004 - 2.2, (z + SX) * 0.0004 + 6.6);
  const w = smooth(0.66, 0.74, n) * awayFromHome(x, z);
  return { a: w * smooth(0.45, 0.55, k), b: w * (1 - smooth(0.45, 0.55, k)) };
}

/**
 * The biomes' weights at a spot. `base` and `rain` may be passed when already known (the ground
 * works them out anyway). Keys: desert, swamp, enchanted, volcanic.
 */
export function biomesAt(x, z, h, base = coldBase(x, z), rain = rainAt(x, z)) {
  const away = awayFromHome(x, z), wonder = wonderAt(x, z), range = rangeAt(x, z);
  return {
    // hot and dry: sand and dunes, cacti, sandstone mesas and arches, old ruins
    desert: smooth(-0.18, -0.36, base) * smooth(0.45, 0.37, rain) * away,
    // warm or mild, very wet, low and flat: pools, willows, lotus, huts on stilts
    swamp: smooth(0.6, 0.68, rain) * (1 - smooth(8, 22, h)) * (1 - range) * (1 - smooth(0.2, 0.4, base)) * away,
    // an old wood more than natural: giant trees, glowing mushrooms and crystals, fireflies
    enchanted: wonder.a * smooth(0.5, 0.58, rain) * (1 - smooth(0.3, 0.5, base)),
    // a volcano in the mountains: black rock, lava, ash
    volcanic: wonder.b * smooth(0.2, 0.5, range),
  };
}
/** The strongest biome at a spot and its weight, or null in ordinary country (`min`: the least weight that counts). */
export function biomeAt(x, z, h, min = 0.5) {
  const w = biomesAt(x, z, h);
  let best = null, bw = min;
  for (const k in w) if (w[k] > bw) { bw = w[k]; best = k; }
  return best ? { id: best, w: bw } : null;
}
export const clamp01 = (v) => clamp(v, 0, 1);
