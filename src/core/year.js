// The year, and what it does at each place.
//
// The time of year is a phase (0 midwinter, 0.25 mid-spring, 0.5 midsummer, 0.75 mid-autumn),
// the same for every player at the same real moment: a game year lasts YEAR_DAYS real days (the
// owner's choice: each season two days, while day and night still follow the real clock). Picking
// a season in the World panel holds the phase at that season's middle.
//
// Each place has its own "chill" (core/shape.js coldAt: its country's cold, its height, the way its
// slopes face; below 0 in warm country), which is how it is in its summer. Through the year the
// chill rises by the season value there times how much the year moves the place. Snow, lake ice,
// leaves, blossom and flowers all follow the chill as it is today, so a cold upland is white while
// the valley below is still in autumn colour, and spring reaches the high ground last.
//
// The year by latitude (the owner's rule: the kind of year a place has follows its latitude, as on
// Earth). Each place has, with its chill, a "year" (core/shape.js yearAt): `A`, how much the year
// moves it (nothing in the tropics, in full from the temperate belt to the pole, which is frozen by
// its chill anyway), and `m`, which half-year it keeps (0 as at home, 1 half a year apart: the
// other side of an equator). The season value there is `s + m * (WINTER_CHILL - 2s)`: the other
// half-year's is simply the winter's most less this one.
//
// These are pure functions: the ground and grass shaders work the same out from one uniform
// (SEASON_GLSL), so nothing is rebuilt as the days pass.
import { smooth } from './math.js';

/** How many real days a game year lasts. */
export const YEAR_DAYS = 8;
const YEAR_MS = YEAR_DAYS * 86400000;
/** How much the chill rises from midsummer to midwinter (at a place with a full swing). */
export const WINTER_CHILL = 0.75;
/** How far behind the season (in years) lake ice is: water freezes after weeks of cold, and thaws late. */
export const ICE_LAG = 0.05;
/** The middle of each season, as a phase. */
export const SEASON_PHASE = { winter: 0, spring: 0.25, summer: 0.5, autumn: 0.75 };
const NAMES = ['Winter', 'Spring', 'Summer', 'Autumn'];

/** The phase of the year at a real moment (milliseconds since 1970, UTC). */
export const yearPhase = (ms = Date.now()) => (((ms / YEAR_MS) % 1) + 1) % 1;
/** How far into the cold half the year is at a phase: 0 midsummer .. WINTER_CHILL midwinter. */
export const seasonValue = (p) => (WINTER_CHILL * (1 + Math.cos(2 * Math.PI * p))) / 2;
/** Is the year cooling (summer to winter) at a phase, or warming? */
export const isCooling = (p) => Math.sin(2 * Math.PI * p) < 0;
/** The name of the season at a phase. */
export const phaseName = (p) => NAMES[Math.floor(((((p + 0.125) % 1) + 1) % 1) * 4) % 4];
/** A calendar day of the year for a phase (for the length of the day and the sun's height). */
export const dayOfPhase = (p) => Math.floor((355 + p * 365.25) % 365.25) + 1;

/** The year as home has it: moved in full, in step with the calendar. (`y` below: a place's year, `{ A, m }`.) */
export const HOME_YEAR = { A: 1, m: 0 };
/** The season value at a place, from the world's `s`. */
export const seasonHere = (s, y = HOME_YEAR) => s + y.m * (WINTER_CHILL - 2 * s);
/** Is the year cooling at a place, given whether it is by the calendar? (The other half-year runs the other way.) */
export const coolingHere = (cooling, y = HOME_YEAR) => (y.m > 0.5 ? !cooling : cooling);
/** A place's chill today, from its summer chill `c`, the world's season value `s` and its year. */
export const chillNow = (c, s, y = HOME_YEAR) => c + seasonHere(s, y) * y.A;
/** How much snow lies (0..1), from the chill today. */
export const snowFrom = (c, s, y) => smooth(0.47, 0.6, chillNow(c, s, y));
/** How frozen a lake is (0..1), from its chill and the season value ICE_LAG back. */
export const iceFrom = (c, sLag, y) => smooth(0.5, 0.6, chillNow(c, sLag, y));
/** How many of the flowers are out (0..1): they come late in spring and go early in autumn. */
export function flowersOut(c, s, cooling, y) {
  const n = chillNow(c, s, y);
  return coolingHere(cooling, y) ? 1 - smooth(0.2, 0.42, n) : 1 - smooth(0.38, 0.5, n);
}
/** What a broadleaf tree's leaves are doing: 'spring' (blossom, fresh), 'summer', 'autumn' (turned) or 'winter' (bare). */
export function leavesAt(c, s, cooling, y) {
  const n = chillNow(c, s, y);
  if (n > 0.47) return 'winter';
  if (coolingHere(cooling, y)) return n > 0.2 ? 'autumn' : 'summer';
  return n > 0.24 ? 'spring' : 'summer';
}
/** The phase of the year at a place (the other half-year is half a year on). */
export const phaseHere = (p, y = HOME_YEAR) => (y.m > 0.5 ? (p + 0.5) % 1 : p);
/**
 * The same in GLSL, for the ground's shader (`uSeason` is the world's season value; `y` a spot's
 * year, x how much it moves, y which half-year). The grass keeps its own short form (world/grassfield.js).
 */
export const SEASON_GLSL = 'uniform float uSeason;\nfloat seasonHere(vec2 y) { return uSeason + y.y * (0.75 - 2.0 * uSeason); }\nfloat chillNow(float c, vec2 y) { return c + seasonHere(y) * y.x; }\n'
  // (warm country's drought, to add to how parched a spot is: in the subtropics in its summer, gold then and green in the winter rains; in the tropics, where the year moves nothing else, in the dry half, which is its winter)
  + 'float droughtNow(float c, vec2 y) { return (1.0 - smoothstep(-0.5, 0.0, c)) * 0.5 * mix(-1.0, 1.0, smoothstep(0.05, 0.3, y.x)) * (0.5 - seasonHere(y) / 0.75); }\n';
/** The year where the camera is (`[A, m]`), for the grass: its field is small enough to share one. */
export const yearHereU = { value: [1, 0] };
/** The uniform the ground and grass read: the season value today. */
export const seasonU = { value: 0 };
