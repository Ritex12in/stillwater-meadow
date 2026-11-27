// The second film, "The world" (2026-11-28): the game a week after the first film, with what came since
// it: oceans and harbours, broad rivers and falls, the cherry blossom valley, the moves and the glider,
// each place in its own season, and the nights that glow. Seed 1, world version 4. Made as the first
// (see shots.mjs for how a shot is written): FILM=world node tools/film/film.mjs, then edit.mjs.
//
// Shots that start something (a fall, a glide) do it only once the frames are being taken: film.mjs
// first runs each shot through to warm the land up, then back to the start (`c.live` below).
import { shots as first } from './shots.mjs';
const keep = (name) => first.find((s) => s.name === name);

/** The heart of a blossom grove in seed 1: its front door, its main fall, its large pagoda. The broadest fall near home. */
// (as fixed points inside the shots, since a shot may use only `c`: copied there by hand)
//   heart view (-845.5, 282.4), fall (-791.3, 312.7), big pagoda (-805.7, 335.4); wide fall below (1335.2, -825.5), lip (1348.3, -800.3)

export const shots = [
  keep('dawn'),
  keep('friends'),
  keep('rise'),
  // the sea: low behind the boy at the nearest coast, looking out over the water, rising
  {
    name: 'coast', dur: 7, url: { hour: 14 },
    setup: (c) => {
      c.hideFriend = true; c.M.command('goto coast');
      let best = 0, a0 = 0; for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283, s = c.S.seaAt(c.player.x + Math.sin(a) * 140, c.player.z + Math.cos(a) * 140); if (s > best) { best = s; a0 = a; } }
      c.spot = { x: c.player.x, z: c.player.z, a: a0 };
    },
    frame: (c, t, u) => {
      const s = c.spot, e = c.ease(u), y = c.g(s.x, s.z), a = s.a + 0.35 - 0.5 * e, r = 9 + 6 * e;
      return { pos: [s.x - Math.sin(a) * r, y + 2.5 + 9 * e, s.z - Math.cos(a) * r], look: [s.x + Math.sin(s.a) * 80, y + 1, s.z + Math.cos(s.a) * 80], fov: 50 };
    },
    text: [{ cls: 'lower', from: 1.2, to: 6.4, html: 'oceans, continents and islands' }],
  },
  // a harbour at dusk: the jetty running out to sea, the boy on the shore
  {
    name: 'harbour', dur: 6.5, url: { hour: 18.6 },
    setup: (c) => {
      c.hideFriend = true; c.M.command('goto harbour');
      let best = 0, a0 = 0; for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283, s = c.S.seaAt(c.player.x + Math.sin(a) * 60, c.player.z + Math.cos(a) * 60); if (s > best) { best = s; a0 = a; } }
      c.spot = { x: c.player.x, z: c.player.z, a: a0 };
    },
    frame: (c, t, u) => {
      const s = c.spot, e = c.ease(u), y = c.g(s.x, s.z), a = s.a + 1.2 - 0.4 * e;
      return { pos: [s.x + Math.sin(a) * 12, y + 3.2, s.z + Math.cos(a) * 12], look: [s.x + Math.sin(s.a) * 25, y + 0.8, s.z + Math.cos(s.a) * 25], fov: 46 };
    },
    text: [{ cls: 'lower', from: 1.0, to: 6.0, html: 'and harbours, to sail between them' }],
  },
  // the broadest waterfall near home, the camera rising from its pool
  {
    name: 'widefall', dur: 7, url: { hour: 15.5 }, at: [1335.2, -825.5],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const e = c.ease(u), F = [1335.2, -825.5], L = [1348.3, -800.3], dx = L[0] - F[0], dz = L[1] - F[1], l = Math.hypot(dx, dz), y = c.g(F[0], F[1]), top = c.h(L[0], L[1]);
      return { pos: [F[0] - dx / l * (6 - 3 * e) - dz / l * 4, y + 2 + 9 * e, F[1] - dz / l * (6 - 3 * e) + dx / l * 4], look: [L[0], c.lerp(y + 3, top, 0.5 + 0.3 * e), L[1]], fov: 52 };
    },
    text: [{ cls: 'lower', from: 1.2, to: 6.4, html: 'rivers that widen as they run' }],
  },
  // the cherry blossom valley: from its front door, up toward the large pagoda over the falls
  {
    name: 'valley', dur: 8, url: { hour: 16.4 }, at: [-845.5, 282.4],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const e = c.ease(u), V = [-845.5, 282.4], F = [-791.3, 312.7], B = [-805.7, 335.4], y = c.g(V[0], V[1]);
      const px = c.lerp(V[0] - 6, c.lerp(V[0], F[0], 0.45), e), pz = c.lerp(V[1] - 4, c.lerp(V[1], F[1], 0.45), e);
      return { pos: [px, y + 1.8 + 16 * e * e, pz], look: [c.lerp(F[0], B[0], e), c.lerp(y + 10, c.h(B[0], B[1]) + 8, e), c.lerp(F[1], B[1], e)], fov: 50 };
    },
    text: [{ cls: 'lower', from: 1.2, to: 7.2, html: 'a valley of cherry blossom' }],
  },
  // the garden bridge over the valley's stream, the boy crossing it
  {
    name: 'gardenbridge', dur: 6.5, url: { hour: 17.2 }, at: [-845.5, 282.4],
    setup: (c) => {
      c.hideFriend = true;
      const r = c.S.riversNear(-773.3, 355.2, 260).find((q) => q.heart), b = (c.br = r && c.S.bridgesOf(r)[0]);
      if (b) c.M.travelTo(b.x - b.ux * (b.half + 3), b.z - b.uz * (b.half + 3), b.x + b.ux * 20, b.z + b.uz * 20);
    },
    keys: [{ key: 'KeyW', from: 0.5, to: 6.0 }],
    frame: (c, t, u) => {
      const b = c.br; if (!b) return { pos: [-840, 30, 270], look: [-791, 20, 312], fov: 50 };
      const e = c.ease(u), nx = -b.uz, nz = b.ux, a = -3 + 5 * e, deck = Math.max(b.ya, b.yb) + 0.6;
      return { pos: [b.x + nx * 10 + b.ux * a, deck + 1.4, b.z + nz * 10 + b.uz * a], look: [b.x + b.ux * a * 0.7, deck + 0.4, b.z + b.uz * a * 0.7], fov: 44 };
    },
  },
  // the moves: dropped from high over home, the glider opens; the camera behind him
  {
    name: 'glide', dur: 8, url: { hour: 16.8 },
    setup: (c) => { c.hideFriend = true; c.M.command('give glider'); c.M.travelTo(c.P.spawn.x + 14, c.P.spawn.z + 14, c.P.spawn.x + 60, c.P.spawn.z - 30); },
    frame: (c, t, u) => {
      // (only while the frames are taken: film.mjs runs every shot through once first, then back to the start)
      if (t < (c.lastT ?? 0)) c.live = true; c.lastT = t;
      if (c.live && !c.go && t > 0.05) { c.go = 1; c.M.dropFrom(60, 7); }
      if (c.go === 1 && t > 0.3) { c.go = 2; c.M.jump(); }
      const p = c.player, b = 9 + 2 * u;
      return { pos: [p.x - Math.sin(p.rot - 0.35) * b, p.y + 3.2, p.z - Math.cos(p.rot - 0.35) * b], look: [p.x + Math.sin(p.rot) * 6, p.y - 1, p.z + Math.cos(p.rot) * 6], fov: 52 };
    },
    text: [{ cls: 'lower', from: 1.5, to: 7.4, html: 'climb, jump, and glide' }],
  },
  // each place in its own season: the snowy highlands
  {
    name: 'snow', dur: 6.5, url: { hour: 12.5 },
    setup: (c) => { c.hideFriend = true; c.M.command('goto snow'); c.spot = { x: c.player.x, z: c.player.z, a: c.player.rot }; },
    frame: (c, t, u) => {
      const s = c.spot, e = c.ease(u), y = c.g(s.x, s.z), a = s.a + 2.6 + 0.6 * e;
      return { pos: [s.x + Math.sin(a) * 11, y + 3 + 3 * e, s.z + Math.cos(a) * 11], look: [s.x, y + 1.2, s.z], fov: 48 };
    },
    text: [{ cls: 'lower', from: 1.0, to: 6.0, html: 'snow where it is cold' }],
  },
  // every kind of country, quickly: the desert, the volcano, the floating islands
  {
    name: 'desert', dur: 3.4, url: { hour: 13.5 },
    setup: (c) => { c.hideFriend = true; c.M.command('goto desert'); c.spot = { x: c.player.x, z: c.player.z, a: c.player.rot }; },
    frame: (c, t, u) => { const s = c.spot, y = c.g(s.x, s.z), a = s.a + 2.4 + 0.3 * u; return { pos: [s.x + Math.sin(a) * 14, y + 5, s.z + Math.cos(a) * 14], look: [s.x, y + 1.5, s.z], fov: 50 }; },
    text: [{ cls: 'lower', from: 0.5, to: 10.0, fade: 0.7, html: 'every kind of country' }],
  },
  {
    name: 'volcano', dur: 3.4, url: { hour: 18.4 },
    setup: (c) => { c.hideHero = true; c.hideFriend = true; c.M.command('goto volcano'); c.spot = { x: c.player.x, z: c.player.z, a: c.player.rot }; },
    frame: (c, t, u) => { const s = c.spot, y = c.g(s.x, s.z), a = s.a + 3.14 + 0.25 * u; return { pos: [s.x + Math.sin(a) * 30, y + 12, s.z + Math.cos(a) * 30], look: [s.x - Math.sin(a) * 120, y + 60, s.z - Math.cos(a) * 120], fov: 54 }; },
  },
  {
    name: 'skyisle', dur: 3.4, url: { hour: 16.6 },
    setup: (c) => { c.hideHero = true; c.hideFriend = true; c.M.command('goto skyisle'); c.spot = { x: c.player.x, z: c.player.z, a: c.player.rot }; },
    frame: (c, t, u) => { const s = c.spot, y = c.g(s.x, s.z), a = s.a + 3.14 + 0.3 * u; return { pos: [s.x + Math.sin(a) * 40, y + 10, s.z + Math.cos(a) * 40], look: [s.x - Math.sin(a) * 60, y + 40, s.z - Math.cos(a) * 60], fov: 54 }; },
  },
  keep('dusk'),
  // the valley at night: the blossom and the falls glowing
  {
    name: 'glow', dur: 9, url: { hour: 22.6 }, at: [-845.5, 282.4],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const e = c.ease(u), V = [-845.5, 282.4], F = [-791.3, 312.7], y = c.g(V[0], V[1]);
      return { pos: [c.lerp(V[0] - 8, c.lerp(V[0], F[0], 0.3), e), y + 2.4 + 2 * e, c.lerp(V[1] - 6, c.lerp(V[1], F[1], 0.3), e)], look: [F[0], y + 9 + 2 * e, F[1]], fov: 50, hour: 22.6 };
    },
    text: [{ cls: 'lower', from: 1.5, to: 8.2, html: 'and nights that glow' }],
  },
  keep('campfire'),
  keep('end'),
];
/** The order on screen, the quick cuts, and the shot where the music turns to night (edit.mjs). */
export const ORDER = ['dawn', 'friends', 'rise', 'coast', 'harbour', 'widefall', 'valley', 'gardenbridge', 'glide', 'snow', 'desert', 'volcano', 'skyisle', 'dusk', 'glow', 'campfire', 'end'];
export const QUICK = ['volcano', 'skyisle'];
export const NIGHT = 'dusk';
