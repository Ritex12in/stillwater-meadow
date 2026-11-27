// Short 004, "Wide rivers" (docs/shorts/briefs/004-wide-rivers.md): the owner typed "I want wide rivers
// and waterfalls", and the rivers widened. The same river and the same fall filmed in the version
// before (`fab26a5`: 2.4 to 5.8 m wide, falls of 3.2 m) and the one that widened them (`f508d5a`).
import { OPENER, END, SPOT, look } from './helpers.mjs';
const NARROW = 'fab26a5', WIDE = 'f508d5a', NOW = 'main', Q = 'seed=1&weather=clear';
const fallView = (turn = 0.2, dist = 7) => look(SPOT.wideFallAt, SPOT.wideFallLip, 3.14, dist, -0.08, turn);
const downstream = look(SPOT.wideFallLip, SPOT.wideFallAt, 3.14 - 0.5, 9, 0.22, 0.4);

export default {
  id: '004', name: 'wide-rivers', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#15.5', still: 0.5, frame: fallView(0.3, 8) }] },
    { text: 'One night I typed: I want wide rivers, and waterfalls.', shots: [{ commit: NARROW, query: Q, hash: '#15.5', still: 0.5, frame: fallView(0.1) }] },
    { text: 'Every river in the game was a stream. Two and a half metres at its spring, and never wider than six.', shots: [{ commit: NARROW, query: Q, hash: '#15.5', still: 0.5, frame: downstream }] },
    { text: 'Now a river starts as a rill, and widens as it runs, to twenty metres in half a kilometre.', shots: [{ commit: WIDE, query: Q, hash: '#15.5', still: 0.5, frame: downstream }] },
    { text: 'And the falls grow with it. A stream drops three metres at a time. A wide river, up to ten, in broad cascades.', shots: [
      { commit: NARROW, query: Q, hash: '#15.5', still: 0.5, frame: fallView(-0.1) },
      { commit: WIDE, query: Q, hash: '#15.5', still: 0.5, frame: fallView(-0.1), cue: 'wide' },
    ] },
    { text: 'Same river, same spot. Before. And after.', shots: [
      { commit: NARROW, query: Q, hash: '#16.5', still: 0.5, frame: fallView(0, 6) },
      { commit: WIDE, query: Q, hash: '#16.5', still: 0.5, frame: fallView(0, 6), cue: 'after.' },
    ], pad: 0.4 },
    { text: 'The water is deeper where it is wide, but you can still wade across.', shots: [{ commit: NOW, query: Q, hash: '#17.5', still: 0.5, frame: downstream }] },
    { text: 'All of that, from one sentence.', shots: [{ commit: NOW, query: Q, hash: '#18.5', still: 0.4, tail: 3.2, frame: fallView(0.4, 11) }], pad: 0.3 },
  ],
  end: END,
};
