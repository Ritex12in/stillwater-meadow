// The year, and what it does at each place.
//
// The time of year is a phase (0 midwinter, 0.25 mid-spring, 0.5 midsummer, 0.75 mid-autumn),
// the same for every player at the same real moment: a game year lasts YEAR_DAYS real days (the
// owner's choice: each season two days, while day and night still follow the real clock). Picking
// a season in the World panel holds the phase at that season's middle.
//
// Each place has its own "chill" (core/shape.js coldAt: its country's cold, its height, the way its
// slopes face; below 0 in warm country), which is how it is in summer. Through the year the chill
// rises by the season value times the place's swing: nothing in midsummer, the most in midwinter;
// warm country swings less. Snow, lake ice, leaves, blossom and flowers all follow the chill as it
// is today, so a cold upland is white while the valley below is still in autumn colour, spring
// reaches the high ground last, and a warm coast stays green all winter.
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

/** How much a place's chill swings through the year: less in warm country (by the sea, in the south). */
export const swing = (c) => 1 - 0.55 * (1 - smooth(-0.5, 0, c));
/** A place's chill today, from its summer chill `c` and the season value `s`. */
export const chillNow = (c, s) => c + s * swing(c);
/** How much snow lies (0..1), from the chill today. */
export const snowFrom = (c, s) => smooth(0.47, 0.6, chillNow(c, s));
/** How frozen a lake is (0..1), from its chill and the season value ICE_LAG back. */
export const iceFrom = (c, sLag) => smooth(0.5, 0.6, chillNow(c, sLag));
/** How many of the flowers are out (0..1): they come late in spring and go early in autumn. */
export function flowersOut(c, s, cooling) {
  const n = chillNow(c, s);
  return cooling ? 1 - smooth(0.2, 0.42, n) : 1 - smooth(0.38, 0.5, n);
}
/** What a broadleaf tree's leaves are doing: 'spring' (blossom, fresh), 'summer', 'autumn' (turned) or 'winter' (bare). */
export function leavesAt(c, s, cooling) {
  const n = chillNow(c, s);
  if (n > 0.47) return 'winter';
  if (cooling) return n > 0.2 ? 'autumn' : 'summer';
  return n > 0.24 ? 'spring' : 'summer';
}
/** The same chill today, in GLSL, for the ground and grass shaders (`uSeason` is the season value). */
export const SEASON_GLSL = 'uniform float uSeason;\nfloat chillNow(float c) { return c + uSeason * (1.0 - 0.55 * (1.0 - smoothstep(-0.5, 0.0, c))); }\n';
/** The uniform the ground and grass read: the season value today. */
export const seasonU = { value: 0 };
