// Short 002, "Through the floor" (docs/shorts/briefs/002-through-the-floor.md): a bug and its fix.
// The roll after a long fall went under the ground in the version it was first built in (`abed753`)
// and was put right in the next (`f8d77d0`). Both are filmed as they were, the same fall, the same
// camera. (How a shot list is written: 001-the-character.mjs. `rate`: slow motion; `still`: how far
// through the shot its check still is taken, 0..1.) 40 to 60 seconds, the opener first (docs/shorts/adr/0013).
const BROKEN = 'abed753', FIXED = 'f8d77d0', NOW = 'main';
const Q = 'seed=1&weather=clear&season=summer', QN = 'seed=1&weather=clear';
/** On level ground by the home lake, facing along the shore; then lifted `h` metres and let go, moving forward. The camera at `yaw` from his face, `dist` off. */
const fall = (h, yaw, dist, pitch = 0.1, at = 0.15) => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; m.travelTo(m.spawn.x + 14, m.spawn.z + 14, m.spawn.x + 60, m.spawn.z + 14); } m.camState.yaw = m.player.rot + ${yaw}; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; if (!c.go && t > ${at}) { c.go = 1; m.dropFrom(${h}, 3); } }`;

export default {
  id: '002', name: 'through-the-floor', voice: 'en-US-AndrewNeural',
  lines: [
    // the opener: the boy today by the home lake, the camera coming round behind him
    { text: "I'm building a whole game with AI. I haven't written a single line of code.", shots: [{ commit: NOW, query: QN, hash: '#16.5', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 - 0.7 + 0.5 * u; m.camState.dist = 5.5; m.camState.pitch = 0.12; }` }] },
    // the hook
    { text: 'I asked for a roll out of long falls. He went straight through the floor.', shots: [{ commit: BROKEN, query: Q, hash: '#15', frame: fall(28, -1.3, 5.5, 0.1, 0.05), still: 0.6 }] },
    { text: 'When I added jumping, every fall had to land right. A short one, softly. A higher one, heavily.', shots: [
      { commit: NOW, query: QN, hash: '#15', frame: fall(1.6, 1.3, 4.4, 0.1, 0.05), still: 0.5 },
      { commit: NOW, query: QN, hash: '#15', frame: fall(4.5, 1.3, 4.8, 0.1, 0.05), still: 0.6, cue: 'higher' },
    ] },
    { text: 'And a long one, in a forward roll. This is the version where the roll came in. Watch it slowly.', shots: [{ commit: BROKEN, query: Q, hash: '#15', frame: fall(7, 1.45, 4.6, 0.12, 0.05), rate: 0.3, still: 0.8 }] },
    { text: 'He lands, tucks, tips forward, and he is gone.', shots: [{ commit: BROKEN, query: Q, hash: '#15', frame: fall(7, 1.45, 4.6, 0.12, 0.05), rate: 0.3, still: 0.8 }] },
    { text: 'The bug: he was turning around his feet, not around his middle.', shots: [{ commit: BROKEN, query: Q, hash: '#15', frame: fall(7, 2.6, 4.4, 0.3, 0.05), rate: 0.45, still: 0.78 }] },
    { text: 'So the AI moved the turn to his middle, and now the roll carries him up and over.', shots: [{ commit: FIXED, query: Q, hash: '#15', frame: fall(6.3, 1.45, 4.6, 0.12, 0.05), rate: 0.75, still: 0.72 }] },
    { text: 'Same fall, same camera. Before. And after.', shots: [
      { commit: BROKEN, query: Q, hash: '#15', frame: fall(7, 1.45, 4.6, 0.12, 0.05), rate: 0.6, still: 0.7 },
      { commit: FIXED, query: Q, hash: '#15', frame: fall(7, 1.45, 4.6, 0.12, 0.05), rate: 0.6, still: 0.7, cue: 'after.' },
    ], pad: 0.4 },
    { text: 'Now fall as far as you like. He rolls it off and runs on.', shots: [{ commit: NOW, query: QN, hash: '#18.6', frame: fall(14, 1.1, 6, 0.1, 0.05), still: 0.6, tail: 2.8 }], pad: 0.3 },
  ],
  end: { title: 'Stillwater Meadow', sub: 'free · in your browser', say: 'Stillwater Meadow. Free, in your browser.' },
};
