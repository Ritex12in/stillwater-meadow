// Short 005, "The waterfall" (docs/shorts/briefs/005-the-waterfall.md): the first falls (`0c6dc4e`, 22
// November), redone because "they literally need a better visual" (`df1e170`), then built to a
// description at a grove's heart (`2b16521`), and glowing at night (today).
import { OPENER, END, SPOT, look, belowFall } from './helpers.mjs';
const FIRST = '0c6dc4e', REDONE = 'df1e170', HEART = '2b16521', NOW = 'main', Q = 'seed=1&weather=clear', QS = 'seed=1&weather=clear&season=summer';
const heart = (turn = 0, dist = 6.5) => look(SPOT.heartView, SPOT.heartFall, 3.14, dist, -0.08, turn);

export default {
  id: '005', name: 'the-waterfall', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#16', still: 0.5, frame: heart(0.15) }] },
    { text: 'This was my first waterfall. A flat blue ribbon, with white stripes.', shots: [{ commit: FIRST, query: QS, hash: '#15', still: 0.5, frame: belowFall(3.14, 6, -0.05) }] },
    { text: 'Rivers came in on day ten. Springs in the hills, running down to the lakes, stepping down in falls.', shots: [{ commit: FIRST, query: QS, hash: '#15', still: 0.5, frame: belowFall(3.14 - 0.6, 9, 0.15, 0.5) }] },
    { text: 'Five days later I told the AI: rivers and waterfalls literally need a better look.', shots: [{ commit: FIRST, query: QS, hash: '#15', still: 0.5, frame: belowFall(3.14 + 0.4, 5, 0.0) }] },
    { text: 'So: white water in ropes, mist rising from the foot, rocks beside it, and a pool.', shots: [{ commit: REDONE, query: QS, hash: '#15', still: 0.5, frame: belowFall(3.14, 6, -0.05, 0.3) }] },
    { text: 'Then I asked it how a waterfall should look, and to build exactly that. Three falls, one pool, wet rock with moss.', shots: [{ commit: HEART, query: QS, hash: '#16', still: 0.5, frame: heart(0.2) }] },
    { text: 'And now, at night, they glow.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.5, frame: heart(-0.15) }], pad: 0.4 },
    { text: 'Six days, from a ribbon to this.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.4, tail: 3.2, frame: heart(0.2, 9) }], pad: 0.3 },
  ],
  end: END,
};
