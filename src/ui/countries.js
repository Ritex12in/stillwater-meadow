// Kinds of country: every biome in the world, how far the nearest stretch of each is from you, and a
// Go button that takes you there (in the World popover). The land is searched outward from you in
// rings, up to SEARCH_REACH; the wonders (floating islands, crystal grottos, the volcano) are
// building sites, found by their own rule.
import { height, walkable, cliffsAt, sitesNear, moistAt, coldAt, snowCold, snowOf, dryOf, lushOf, groveAt, VOLCANO } from '../core/shape.js';
import { biomesAt } from '../core/biome.js';

/** How far the search reaches (m), and how finely (m between looks). */
export const SEARCH_REACH = 6000;
const STEP = 120, ENOUGH = 0.6;

/** The kinds, in the order shown: `is(c)` reads a look at the land; `site` kinds are found as buildings. */
const KINDS = [
  { id: 'meadow', name: 'Mild meadow', is: (c) => c.mild },
  { id: 'plains', name: 'Verdant plains', is: (c) => c.b.plains > ENOUGH },
  { id: 'lush', name: 'Lush woods', is: (c) => c.lush > ENOUGH && c.snow < 0.3 },
  { id: 'heath', name: 'Golden heath', is: (c) => c.dry > ENOUGH && c.b.desert < 0.3 && c.snow < 0.3 },
  { id: 'grove', name: 'Blossom grove', is: (c) => c.grove > ENOUGH },
  { id: 'snow', name: 'Snowy highlands', is: (c) => c.snow > ENOUGH },
  { id: 'tundra', name: 'Aurora tundra', is: (c) => c.cold > 0.55 && c.snow < 0.3 }, // (cold, and too dry for snow to lie)
  { id: 'cliffs', name: 'Windy cliffs', is: (c) => c.cliffs > ENOUGH },
  { id: 'desert', name: 'Golden desert', is: (c) => c.b.desert > ENOUGH },
  { id: 'swamp', name: 'Mystic swamp', is: (c) => c.b.swamp > ENOUGH },
  { id: 'enchanted', name: 'Enchanted wood', is: (c) => c.b.enchanted > ENOUGH },
  { id: 'volcanic', name: 'Volcanic country', is: (c) => c.b.volcanic > ENOUGH },
  { id: 'coast', name: 'Coast and sea', is: (c) => c.b.beach > ENOUGH },
  { id: 'skyisle', name: 'Floating islands', site: 'skyisle', off: 14 },
  { id: 'grotto', name: 'Crystal grotto', site: 'grotto', off: 16 },
  { id: 'volcano', name: 'The volcano', site: 'volcano', off: VOLCANO.radius + 30 }, // (at the foot of its cone)
];

/** A look at the land at a spot: what the kinds are told of it. */
function look(x, z) {
  const h = height(x, z), wet = moistAt(x, z), cold = coldAt(x, z, h), b = biomesAt(x, z, h);
  const c = { b, h, cold, snow: snowOf(snowCold(cold, wet)), dry: dryOf(wet), lush: lushOf(wet), grove: groveAt(x, z), cliffs: cliffsAt(x, z) };
  c.mild = c.snow + c.dry + c.lush < 0.1 && c.grove < 0.3 && c.cliffs < 0.2 && Math.max(b.desert, b.swamp, b.enchanted, b.volcanic, b.plains, b.beach) < 0.2;
  return c;
}

/**
 * The nearest stretch of every kind of country from (x, z), within `reach` metres: [{ id, name, far,
 * x, z, faceX, faceZ }] in KINDS order, `far` null where none was found. Pure in the seed and the spot.
 */
export function nearestCountries(x, z, reach = SEARCH_REACH) {
  const found = new Map(), land = KINDS.filter((k) => k.is);
  const take = (k, px, pz, far, fx = px, fz = pz) => found.set(k.id, { x: px, z: pz, far: Math.round(far), faceX: fx, faceZ: fz });
  // the land, ring by ring outward (only walkable spots: somewhere to stand)
  const check = (px, pz, far) => {
    if (!walkable(px, pz)) return;
    const c = look(px, pz);
    for (const k of land) if (!found.has(k.id) && k.is(c)) take(k, px, pz, far);
  };
  check(x, z, 0);
  for (let r = STEP / 2; r <= reach && found.size < land.length; r += STEP) {
    const n = Math.max(8, Math.ceil((2 * Math.PI * r) / STEP));
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; check(x + Math.cos(a) * r, z + Math.sin(a) * r, r); }
  }
  // the wonders: the nearest site of each, and a spot just off it (facing it) to arrive at
  for (const k of KINDS) {
    if (!k.site) continue;
    const s = sitesNear(x, z, reach + 2000, k.site)[0];
    if (!s) continue;
    const d = Math.hypot(s.x - x, s.z - z) || 1, ux = (x - s.x) / d, uz = (z - s.z) / d;
    take(k, s.x + ux * k.off, s.z + uz * k.off, d, s.x, s.z);
  }
  return KINDS.map((k) => Object.assign({ id: k.id, name: k.name }, found.get(k.id) || { far: null }));
}
