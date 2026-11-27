// Short 003, "One valley" (docs/shorts/briefs/003-one-valley.md): how the world grew, from one
// hand-placed valley to land without an edge, then oceans, continents and harbours.
// (How a shot list is written: 001-the-character.mjs.)
const NOW = 'main';
const Q = 'seed=1&weather=clear&season=summer';
/** Go somewhere once (a debug command of the game's, or a spot), then hold the camera at `yaw` from his face, turning by `turn` over the shot. */
const at = (go, yaw, dist, pitch, turn = 0) => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; ${go} } m.camState.yaw = m.player.rot + ${yaw} + ${turn} * u; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;

export default {
  id: '003', name: 'one-valley', voice: 'en-US-AndrewNeural',
  lines: [
    // gliding high over home: the lake below, the land running on to the horizon
    { text: 'This world has no edge. Two weeks ago, it was one small valley.', shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#16', still: 0.5,
      frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 + 0.25 - 0.3 * u; m.camState.dist = 7.5; m.camState.pitch = 0.2; if (!c.go && t > 0.02) { c.go = 1; m.dropFrom(70, 7); } if (c.go === 1 && t > 0.2) { c.go = 2; m.jump(); } }` }] },
    { text: 'Day one. A meadow, a lake, and mountains you could never reach.', shots: [{ commit: '620f25a', query: '', hash: '#15' }] },
    { text: 'Then the land was grown from a single number. Walk any way, for ever.', shots: [{ commit: NOW, query: Q, hash: '#10', still: 0.5,
      frame: at(`m.travelTo(m.home.x + 2100, m.home.z + 700);`, 3.14 - 0.4, 15, 0.34, 0.9) }] },
    { text: 'But endless felt random. So it got oceans, and continents.', shots: [{ commit: NOW, query: Q, hash: '#14', still: 0.5,
      frame: at(`m.command('goto coast');`, 3.14 + 0.5, 11, 0.24, -0.9) }] },
    { text: 'And harbours, to sail between them.', shots: [{ commit: NOW, query: Q, hash: '#18.7', still: 0.4, tail: 4.6,
      frame: at(`m.command('goto harbour');`, 3.14 - 0.6, 8.5, 0.2, 0.5) }], pad: 0.4 },
  ],
  end: { title: 'Stillwater Meadow', sub: 'free · in your browser', say: 'Type any word, and it grows a world of your own. Stillwater Meadow, free in your browser.' },
};
