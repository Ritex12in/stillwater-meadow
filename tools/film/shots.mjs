// The film's shots, in order. Each: name, duration (s), the world's season/weather/hour at load, where
// the boy starts (`at`), keys held (`keys`, for walking), captions (`text`), `setup(c)` once after
// loading, and `frame(c, t, u)` every frame, giving the camera ({ pos, look, fov }) and optionally the
// hour. The functions run in the page (see film.mjs): they may use only `c`, never names from here.
export const shots = [
  // 1. Dawn over the home lake: low over the water toward the jetty and the boat, the title rising
  {
    name: 'dawn', dur: 9, url: { hour: 6.2 }, at: [285, 277],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const H = c.P.home, e = c.ease(u);
      return { pos: [H.x + 26 - 18 * e, 2.0 - 0.5 * e, H.z + 9 - 7 * e], look: [292, 1.4, 259.5], fov: 46, hour: 6.25 + 0.5 * u };
    },
    text: [{ cls: 'title', from: 2.2, to: 8.2, fade: 1.3, html: '<h1>Stillwater Meadow</h1><p>a cosy world without end</p>' }],
  },
  // 2. The boy and his dog on the shore, the lake behind them; he smiles
  {
    name: 'friends', dur: 6, url: { hour: 9.5 }, at: [288.6, 275.4],
    setup: (c) => {
      c.hideFriend = true; c.spot = { x: c.player.x, z: c.player.z };
      c.after = (c) => { const d = c.dog, s = c.spot; if (!d) return; d.x = s.x + 0.95; d.z = s.z + 0.55; d.root.position.set(d.x, c.g(d.x, d.z), d.z); d.heading = c.player.rot; d.root.rotation.y = d.heading; };
    },
    frame: (c, t, u) => {
      const s = c.spot, y = c.g(s.x, s.z), a = -2.35 + 0.55 * c.ease(u), r = 3.6 - 0.5 * u;
      // he faces the camera; the dog sits at his side
      c.player.rot = Math.atan2(Math.sin(a), Math.cos(a)); // (toward the camera)
      if (c.hero) c.hero.face.flash(t > 1.6 ? 'happy' : 'calm', 0.2);
      const d = (c.dog = c.dog || c.animals.find((q) => q.kind === 'dog'));
      if (d) { d.sitting = true; d.sit = 1; d.state = 'idle'; d.timer = 99; d.hasTarget = false; d.speed = 0; }
      return { pos: [s.x + Math.sin(a) * r, y + 1.35, s.z + Math.cos(a) * r], look: [s.x + 0.3, y + 0.85, s.z + 0.2], fov: 40 };
    },
  },
  // 3. The skipper on his boat at the jetty, waving, seen from the water
  {
    name: 'boat', dur: 5, url: { hour: 10.5 }, at: [285, 277],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const b = c.P.board, e = c.ease(u);
      if (t > 1.0 && t < 1.1) c.sk.waveT = 2.6;
      return { pos: [b.x + 9 - 2.5 * e, 0.9 + 0.3 * e, b.z - 6.5 + 2 * e], look: [b.x - 0.4, 1.3, b.z + 0.2], fov: 42 };
    },
  },
  // 4. Up into the world: from the lake, a long climb and turn to the land beyond
  {
    name: 'rise', dur: 8, url: { hour: 11 }, at: [285, 277],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const H = c.P.home, e = c.ease(u), a = 0.9 - 0.7 * e, r = 30 + 110 * e;
      return { pos: [H.x - Math.sin(a) * r, 4 + 135 * e * e, H.z - Math.cos(a) * r], look: [H.x + Math.sin(a) * 600, 20 - 10 * e, H.z + Math.cos(a) * 600], fov: 50 };
    },
    text: [{ cls: 'lower', from: 2.3, to: 7.4, html: 'an endless world, grown from a seed' }],
  },
  // 5. A mountain stream stepping down in falls, the camera rising beside it
  {
    name: 'cascade', dur: 7, url: { hour: 15.5 }, at: [-300, 470],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const p = c.P.cascade.pts, A = p[27], B = p[14], e = c.ease(u), dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l;
      return { pos: [A[0] - nx * 13 - dx / l * (8 - 5 * e), A[1] + 6 + 7 * e, A[2] - nz * 13 - dz / l * (8 - 5 * e)], look: [c.lerp(A[0], B[0], 0.55), c.lerp(A[1], B[1], 0.55) + 1.5 * e, c.lerp(A[2], B[2], 0.55)], fov: 48 };
    },
  },
  // 6. The boy crossing a footbridge over a river, seen from the bank
  {
    name: 'bridge', dur: 6, url: { hour: 16.6 }, at: [3058, -142],
    setup: (c) => {
      const b = c.P.bridges[0]; c.hideFriend = true;
      c.M.travelTo(b.x - b.ux * (b.half + 3.2), b.z - b.uz * (b.half + 3.2), b.x + b.ux * 20, b.z + b.uz * 20);
    },
    keys: [{ key: 'KeyW', from: 0.5, to: 5.6 }],
    frame: (c, t, u) => {
      const b = c.P.bridges[0], e = c.ease(u), nx = -b.uz, nz = b.ux, a = -3 + 5 * e;
      return { pos: [b.x + nx * 11 + b.ux * a, b.deck + 1.2, b.z + nz * 11 + b.uz * a], look: [b.x + b.ux * a * 0.7, b.deck + 0.6, b.z + b.uz * a * 0.7], fov: 44 };
    },
  },
  // 7. The boy walking the stepping stones out to an island, in the late sun
  {
    name: 'stones', dur: 7, url: { hour: 17.6 }, at: [-994, 1455],
    setup: (c) => {
      const s = c.P.islands[0].stones, dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz); c.hideFriend = true;
      c.M.travelTo(s.ax - dx / l * 2.2, s.az - dz / l * 2.2, s.bx + dx / l * 20, s.bz + dz / l * 20);
    },
    keys: [{ key: 'KeyW', from: 0.6, to: 6.0 }],
    frame: (c, t, u) => {
      const s = c.P.islands[0].stones, I = c.P.islands[0].isle, dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l, e = c.ease(u);
      const mx = c.lerp(s.ax, I.x, 0.45), mz = c.lerp(s.az, I.z, 0.45);
      return { pos: [mx + nx * 10 - dx / l * (4 - 3 * e), 2.2 + 0.6 * e, mz + nz * 10 - dz / l * (4 - 3 * e)], look: [c.lerp(s.ax, I.x, 0.2 + 0.6 * e), 0.9, c.lerp(s.az, I.z, 0.2 + 0.6 * e)], fov: 42 };
    },
  },
  // 8. Every kind of country: a pagoda in its grove, the volcano at dusk, a ship on the sea
  {
    name: 'pagoda', dur: 3.4, url: { hour: 13 }, at: [-470, 470],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const s = c.P.pagoda, a = s.turn + 0.6 + 0.35 * u, r = 38;
      return { pos: [s.x + Math.sin(a) * r, s.y + 15, s.z + Math.cos(a) * r], look: [s.x, s.y + 5, s.z], fov: 46 };
    },
    text: [{ cls: 'lower', from: 0.5, to: 10.4, fade: 0.7, html: 'every kind of country' }],
  },
  {
    name: 'skyisles', dur: 3.4, url: { hour: 16.8 }, at: [-1300, -1260],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const s = c.P.skyisle, a = 0.4 + 0.25 * u, r = 120;
      return { pos: [s.x + Math.sin(a) * r, s.y + 34, s.z + Math.cos(a) * r], look: [s.x, s.y + 44, s.z], fov: 52 };
    },
  },
  {
    name: 'ship', dur: 3.4, url: { hour: 17.2 }, at: [-2290, -640],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const s = c.P.ship, a = s.turn + 1.1 + 0.3 * u, r = 46;
      return { pos: [s.x + Math.sin(a) * r, 4.5, s.z + Math.cos(a) * r], look: [s.x, 5, s.z], fov: 44 };
    },
  },
  // 9. The day turning to a starry night over the home lake
  {
    name: 'dusk', dur: 9, url: { hour: 17.4 }, at: [285, 277],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const H = c.P.home;
      return { pos: [H.x + 20 - 4 * u, 5.5, H.z + 17 - 3 * u], look: [H.x - 30, 3, H.z - 8], fov: 52, hour: 17.4 + 4.4 * c.ease(u) };
    },
    text: [{ cls: 'lower', from: 1.5, to: 8.2, html: 'days that turn to starry nights' }],
  },
  // 10. Winter: snow falling, the lake frozen, the boy skating across it
  {
    name: 'winter', dur: 7, url: { season: 'winter', weather: 'snow', hour: 11.5 }, at: [300, 266],
    setup: (c) => { c.hideFriend = true; c.M.travelTo(c.P.home.x - 20, c.P.home.z + 2, c.P.home.x + 30, c.P.home.z); },
    keys: [{ key: 'KeyW', from: 0.4, to: 4.5 }],
    frame: (c, t, u) => {
      const H = c.P.home, p = c.player, y = Math.max(0.1, c.g(p.x, p.z));
      c.look = c.look || { x: p.x, z: p.z }; c.look.x += (p.x - c.look.x) * 0.1; c.look.z += (p.z - c.look.z) * 0.1;
      return { pos: [c.look.x + 1.5 + 2 * u, y + 2.2, c.look.z + 7.5 - 1.5 * u], look: [c.look.x + 1, y + 0.9, c.look.z], fov: 46 };
    },
    text: [{ cls: 'lower', from: 1.0, to: 6.4, html: 'and every season' }],
  },
  // 11. Night: the campfire lit, the boy and his friend beside it; then up to the stars
  {
    name: 'campfire', dur: 9, url: { hour: 21.8 }, at: [271.2, 265.2],
    setup: (c) => { c.fire.on = true; c.fire.lit = 1; c.fire.left = 9999; },
    frame: (c, t, u) => {
      const f = c.P.fire, e = c.ease(Math.min(1, t / 6)), up = c.ease(Math.max(0, (t - 5.5) / 3.5));
      c.fire.on = true; c.fire.left = 9999;
      return { pos: [f.x + 7 - 3 * e, f.y + 1.4 + 0.6 * up, f.z + 4.5 - 1.8 * e], look: [f.x, f.y + 0.7 + 40 * up * up, f.z - 6 * up], fov: 44, hour: 21.8 };
    },
  },
  // 12. The end: the night sky over the lake, the title again
  {
    name: 'end', dur: 7, url: { hour: 22.4 }, at: [285, 277],
    setup: (c) => { c.hideHero = true; c.hideFriend = true; },
    frame: (c, t, u) => {
      const H = c.P.home;
      return { pos: [H.x + 14, 2.6, H.z + 11], look: [H.x - 60, 26 + 6 * u, H.z - 40], fov: 56, hour: 22.4 };
    },
    text: [{ cls: 'end', from: 1.0, to: 7.5, fade: 1.4, html: '<h1>Stillwater Meadow</h1><p>wander · rest · explore</p>' }],
  },
];
