// Short 003, "One valley" (docs/shorts/briefs/003-one-valley.md): how the world grew, from one
// hand-placed valley to land without an edge, then oceans, continents and harbours, rivers and
// waterfalls, and a cherry blossom valley. (How a shot list is written: 001-the-character.mjs.)
// 40 to 60 seconds, the opener first (docs/shorts/adr/0013). The rivers and the valley are live only
// from the publish of 2026-11-28 (world version 4): `main` must hold them when this is filmed.
const NOW = 'main';
const Q = 'seed=1&weather=clear';
/** Go somewhere once (a debug command of the game's, or a spot), then hold the camera at `yaw` from his face, turning by `turn` over the shot. */
const at = (go, yaw, dist, pitch, turn = 0) => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; ${go} } m.camState.yaw = m.player.rot + ${yaw} + ${turn} * u; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;
/** Gliding high over home: lifted `h` metres and the glider opened; the camera behind, turning by `turn` over the shot. */
const glide = (h, turn) => `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 + 0.25 - ${turn} * u; m.camState.dist = 7.5; m.camState.pitch = 0.2; if (!c.go && t > 0.02) { c.go = 1; m.dropFrom(${h}, 7); } if (c.go === 1 && t > 0.2) { c.go = 2; m.jump(); } }`;

export default {
  id: '003', name: 'one-valley', voice: 'en-US-AndrewNeural',
  lines: [
    // the opener: gliding high over the woods round home
    { text: "I'm building a whole game with AI. I haven't written a single line of code.", shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#16', still: 0.5, frame: glide(70, 0.2) }] },
    // the hook: gliding on, the land running to the horizon
    { text: 'This world has no edge. Two weeks ago, it was one small valley.', shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#16', still: 0.5, frame: glide(70, 0.35) }] },
    { text: 'Day one. A meadow, a lake, and mountains painted round it, that you could never reach.', shots: [{ commit: '620f25a', query: '', hash: '#15' }] },
    { text: 'Then the land was grown from one number. Type any word, and you get a different world.', shots: [{ commit: NOW, query: Q, hash: '#10', still: 0.5,
      frame: at(`m.travelTo(m.home.x + 2100, m.home.z + 700);`, 3.14 - 0.4, 15, 0.34, 0.9) }] },
    { text: 'But endless felt random. So it got oceans, continents and islands.', shots: [{ commit: NOW, query: Q, hash: '#14', still: 0.5,
      frame: at(`m.command('goto coast');`, 3.14 + 0.5, 11, 0.24, -0.9) }] },
    { text: 'And harbours, where a skipper sails you to the next continent.', shots: [{ commit: NOW, query: Q, hash: '#18.7', still: 0.4,
      frame: at(`m.command('goto harbour');`, 3.14 - 0.6, 8.5, 0.2, 0.5) }] },
    // the broadest fall near home in seed 1 (river 1:-1: 9.4 m tall, 13 m wide), from below
    { text: 'Rivers run from the hills to the sea, some twenty metres wide, falling in broad waterfalls.', shots: [{ commit: NOW, query: Q, hash: '#15', still: 0.5,
      frame: at(`m.travelTo(1335.2, -825.5, 1348.3, -800.3);`, 3.14, 7, -0.1, 0.25) }] },
    // the heart of a blossom grove at night, from its front door
    { text: 'And deep in a cherry blossom valley, a cliff with three waterfalls that glow at night.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.5,
      frame: at(`m.command('goto heart');`, 3.14, 6.5, -0.08, -0.2) }] },
    { text: 'All of it grown from that one number.', shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#18.4', still: 0.4, tail: 4.2, frame: glide(90, -0.3) }], pad: 0.3 },
  ],
  end: { title: 'Stillwater Meadow', sub: 'free · in your browser', say: 'Stillwater Meadow. Free, in your browser.' },
};
