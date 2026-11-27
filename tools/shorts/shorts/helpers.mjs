// What the shot lists share (tools/shorts/shorts/<id>-<name>.mjs). Each helper returns the source of a
// shot's `frame(c, t, u)` function, run in that version's page every frame (see 001-the-character.mjs).
// A frame function may use only what it is given: `c.m` (the version's `window.__meadow`), `t`, `u`.

/** The first line of every short (docs/shorts/adr/0013). */
export const OPENER = "I'm building a whole game with AI. I haven't written a single line of code.";
/** The end card, the same on every short. */
export const END = { title: 'Stillwater Meadow', sub: 'free · in your browser', say: 'Stillwater Meadow. Free, in your browser.' };

/** Fixed places in seed 1 (found by the game's own rules on 2026-11-28, world version 4). */
export const SPOT = {
  heartView: [-845.5, 282.4], heartFall: [-791.3, 312.7], heartBig: [-805.7, 335.4],   // a grove's heart: its front door, its main fall, its large pagoda
  wideFallAt: [1335.2, -825.5], wideFallLip: [1348.3, -800.3],                          // the broadest waterfall near home (river 1:-1), from below
  hill: [518.3, 261.5], hillTop: [573.5, 284.8],                                        // a long walkable slope east of home
  face: [207.2, 540.1], faceTop: [208.2, 554.1],                                        // the foot of a steep face, and the way up it
};

/** Go somewhere once (`go`: code), then hold the camera at `yaw` from his face, turning by `turn` over the shot. */
export const at = (go, yaw, dist, pitch, turn = 0) => `(c, t, u) => { const m = c.m; if (!m || !m.camState) return; if (!c.set) { c.set = 1; ${go} } m.camState.yaw = m.player.rot + ${yaw} + ${turn} * u; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;
/** Stand at a spot looking at another, the camera `yaw` from his face. */
export const look = (p, q, yaw, dist, pitch, turn = 0) => at(`m.travelTo(${p[0]}, ${p[1]}, ${q[0]}, ${q[1]});`, yaw, dist, pitch, turn);
/** Gliding high over where he stands: lifted `h` metres and the glider opened; the camera behind, turning by `turn` over the shot. (Needs `glider=1` in the query.) */
export const glide = (h, turn = 0, go = '') => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; ${go} } m.camState.yaw = m.player.rot + 3.14 + 0.25 - ${turn} * u; m.camState.dist = 7.5; m.camState.pitch = 0.2; if (!c.go && t > 0.02) { c.go = 1; m.dropFrom(${h}, 7); } if (c.go === 1 && t > 0.2) { c.go = 2; m.jump(); } }`;
/** By the home lake, lifted `h` metres and let go moving forward at `v`; the camera `yaw` from his face. `glideAfter`: open the glider just after. */
export const drop = (h, v, yaw, dist, glideAfter = false, rate = '') => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; m.travelTo(m.spawn.x + 14, m.spawn.z + 14, m.spawn.x + 60, m.spawn.z + 14); } m.camState.yaw = m.player.rot + ${yaw}; m.camState.dist = ${dist}; m.camState.pitch = 0.1; if (!c.go && t > 0.05) { c.go = 1; m.dropFrom(${h}, ${v}); } ${glideAfter ? 'if (c.go === 1 && t > 0.3) { c.go = 2; m.jump(); }' : ''} }`;
/** A jump where he stands, the camera close at his side. */
export const jump = (yaw = 0.75, dist = 3.3, at = 0.3) => `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + ${yaw}; m.camState.dist = ${dist}; m.camState.pitch = 0.1; if (!c.jumped && t > ${at}) { c.jumped = 1; m.jump(); } }`;

/**
 * Below the tallest waterfall near home, in any version that has rivers (found from that version's
 * own land, since rivers moved between versions): the camera `yaw` from his face.
 */
export const belowFall = (yaw, dist, pitch, turn = 0) => `(c, t, u) => { const m = c.m; if (!m || !m.camState) return;
  if (!c.set) { c.set = 1; const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'));
    import(url).then((S) => { const H = S.HOME; let best = null;
      for (const r of S.riversNear(H.x, H.z, 2500)) { if (r.heart) continue; for (let i = 1; i < r.n - 2; i++) { if (!r.fall[i]) continue; const d = r.lv[i] - r.lv[i + 1]; if (!best || d > best.d) best = { r, i, d }; } }
      if (!best) { c.err = 'no fall'; return; } const r = best.r, i = best.i, tx = r.x[i + 2] - r.x[i + 1], tz = r.z[i + 2] - r.z[i + 1], l = Math.hypot(tx, tz) || 1;
      let x = r.x[i + 1] + tx / l * 13 + tz / l * 4, z = r.z[i + 1] + tz / l * 13 - tx / l * 4; for (let k = 0; k < 30 && !S.walkable(x, z); k++) { x -= tz / l * 2; z += tx / l * 2; }
      m.travelTo(x, z, r.x[i], r.z[i]); }); }
  m.camState.yaw = m.player.rot + ${yaw} + ${turn} * u; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;

/**
 * Running with a key held down (as a player would: the game's own input), at the `speed` command's
 * `speed`, from `p` toward `q`. The camera stays where it began, `yaw` from his face then, so he runs
 * across the picture; `key` is the one that runs him that way with the camera there. Let go at `stop` (0..1).
 */
export const run = (p, q, speed, yaw, dist, pitch, key, stop = 1) => `(c, t, u) => { const m = c.m;
  if (!c.set) { c.set = 1; m.travelTo(${p[0]}, ${p[1]}, ${q[0]}, ${q[1]}); m.command('speed ${speed}'); }
  if (c.yaw === undefined && t > 0) c.yaw = m.player.rot + ${yaw};
  m.camState.yaw = c.yaw === undefined ? m.player.rot + ${yaw} : c.yaw; m.camState.dist = ${dist}; m.camState.pitch = ${pitch};
  if (!c.down && t > 0.1 && u < ${stop}) { c.down = 1; window.dispatchEvent(new KeyboardEvent('keydown', { code: '${key}', key: '${key}' })); }
  if (c.down === 1 && u >= ${stop}) { c.down = 2; window.dispatchEvent(new KeyboardEvent('keyup', { code: '${key}', key: '${key}' })); } }`;
