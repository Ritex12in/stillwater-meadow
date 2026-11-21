// The weather over the land: a field, a function of a place and the real moment, the same for
// everyone in the same world at the same moment (the owner's choice: shared weather).
//
// As in nature: broad banks of cloud drift across the land on the prevailing wind (from the west,
// turned a little by the world's seed), slowly changing shape as they go. Where a bank is thick
// enough it rains, more readily in wet country and on slopes that face the wind (the air is lifted
// and wrung out), less in the lee of hills. Rain falls as snow where it is cold enough there today
// (core/year.js), so in summer the high peaks get snow showers. The heaviest cells turn to storms in
// warm country on warm afternoons. Fog gathers of a morning in low ground by water, where the cold
// air of the night pools, on some mornings and not others.
//
// You feel it where you stand: systems/weather.js samples it there now and then and eases toward it,
// so you can walk out of the rain, or watch a storm come in over the hills.
import { fbm, smooth, clamp, hash } from '../core/math.js';
import { WORLD, height, moistAt, coldAt, lakeAt } from '../core/shape.js';
import { chillNow } from '../core/year.js';
import { seasonState } from '../core/state.js';

/** The wind that drives the weather: metres per second, and the way it blows (radians; 0 is toward +x, so from the west). */
export const WIND = { speed: 3, angle: (hash(WORLD.seed * 7 + 3, 91) - 0.5) * 0.9 };
/** The size of a bank of cloud (m), and how long (s) the field takes to change its shape. */
const BANK = 6000, CHANGE = 5400;
const wx0 = Math.cos(WIND.angle), wz0 = Math.sin(WIND.angle);
const SEED_U = hash(WORLD.seed, 17) * 300, SEED_V = hash(WORLD.seed, 29) * 300;

/** The drifting banks of cloud over a spot at a moment (`t` in seconds): before the land's own wetness and slopes have their say. */
export function cloudAt(x, z, t) {
  const u = (x - wx0 * WIND.speed * t) / BANK + SEED_U, v = (z - wz0 * WIND.speed * t) / BANK + SEED_V;
  const k = Math.floor(t / CHANGE), f = t / CHANGE - k, e = f * f * (3 - 2 * f);
  const a = fbm(u + k * 7.31, v - k * 3.17), b = fbm(u + (k + 1) * 7.31, v - (k + 1) * 3.17);
  return a + (b - a) * e;
}

/**
 * The weather at a place: `{ cloud, rain, storm, fog, snow, wind, type }` (0..1 each; `type` the
 * one word for it: clear, rain, storm, fog or snow). `ms` is the real moment (UTC milliseconds),
 * `hour` the time of day there.
 */
export function weatherAt(x, z, ms, hour) {
  const t = ms / 1000;
  const h = height(x, z), wet = moistAt(x, z);
  // air rises up a slope facing the wind and drops its rain; behind the hill it is drier
  const up = ((height(x + wx0 * 40, z + wz0 * 40) - height(x - wx0 * 40, z - wz0 * 40)) / 80);
  const lift = clamp(-up, -1, 1) * 0.12; // (the ground rising toward where the wind comes from: we are on its windward face)
  const bank = cloudAt(x, z, t) + (wet - 0.5) * 0.35 + lift;
  const cloud = smooth(0.42, 0.7, bank);
  let rain = smooth(0.6, 0.72, bank);
  const chill = chillNow(coldAt(x, z, h), seasonState.season || 0);
  // storms: the heaviest cells, in warm air, of an afternoon
  const afternoon = smooth(11.5, 14, hour) * (1 - smooth(19, 21.5, hour));
  const storm = smooth(0.76, 0.84, bank) * (1 - smooth(0.2, 0.45, chill)) * (0.35 + 0.65 * afternoon);
  // rain or snow, by how cold it is there today
  const asSnow = smooth(0.4, 0.5, chill);
  const snow = rain * asSnow;
  rain *= 1 - asSnow;
  // morning fog in low ground by water, on some mornings (a slow noise by the day)
  const morning = smooth(4.2, 5.8, hour) * (1 - smooth(8.5, 10.5, hour));
  const L = lakeAt(x, z), byWater = 1 - smooth(1.6, 4, L.t(x, z));
  const someDays = smooth(0.45, 0.6, fbm(Math.floor(t / 86400) * 0.37 + SEED_U, 4.1 + SEED_V));
  const fog = Math.max(morning * (1 - smooth(8, 35, h)) * Math.max(byWater, smooth(0.5, 0.65, wet)) * someDays * (1 - cloud * 0.3), rain * 0.15);
  const wind = 0.25 + cloud * 0.35 + storm * 0.4;
  const type = storm > 0.5 ? 'storm' : snow > 0.3 ? 'snow' : rain > 0.3 ? 'rain' : fog > 0.5 ? 'fog' : 'clear';
  return { cloud: Math.max(cloud, snow * 0.34), rain: rain * 0.6 + storm * 0.4, storm, fog, snow, wind, type };
}
