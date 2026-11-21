// Shared, dependency-free containers. Modules fill these in during boot; nothing here
// imports other game code, so any module can depend on it without creating cycles.

/** Handles to bulk world objects that later systems recolour or edit (trees, grass, flowers…). */
export const world = {};

/** Circular blockers the player and animals are pushed out of: { x, z, r }. */
export const obstacles = [];

/** Places to sit: { name, x, z, baseY, top, rot, standOff, standTo?, boat? }. */
export const seats = [];

/** Season state written by the seasons feature, read by weather, water and creatures. */
export const seasonState = {
  name: '', ice: 0, coverFloor: 0, bugs: 1, flowerFrac: 1, dayOfYear: null,
  // the year (core/year.js): its phase, the season value today and ICE_LAG back, whether it is cooling;
  // and how it is where you stand (features/seasons.js)
  phase: 0.5, season: 0, lagged: 0, cooling: false, winterHere: false, homeWinter: false, leavesHere: 'summer',
  mapWeather: (k) => k,
};

/** Per-frame callbacks registered by systems and features. */
export const hooks = { frame: [], pose: [], camera: [], anchor: [], lake: [] }; // (anchor: called after the lake's landmarks have moved to another lake, to put what stands on them there too; lake: called with the lake you have come to, to bring its creatures there)

export function pushOut(p, r) {
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const min = o.r + r;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
    }
  }
}
