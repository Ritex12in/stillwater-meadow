// Short 008, "Into the hill" (docs/shorts/briefs/008-into-the-hill.md): at the `speed` command's 10 the
// boy sank into a slope climbing it (`fab26a5`); the first fix (`4a5d09c`) left him floating going down;
// the second (`0e2f0c4`) keeps him on any slope. Filmed running up and down the same hill east of home,
// with the key held down as a player would. The camera stays where it began, at his side.
import { OPENER, END, SPOT, run } from './helpers.mjs';
const SINKS = 'fab26a5', FLOATS = '4a5d09c', FIXED = '0e2f0c4', NOW = 'main', Q = 'seed=1&weather=clear';
// (with the camera at his side, `KeyD` runs him away from where he faced... no: toward the camera's right: up the hill. Checked on the stills.)
const up = (speed, stop = 1, dist = 9, pitch = 0.05) => run(SPOT.hill, SPOT.hillTop, speed, 1.57, dist, pitch, 'KeyW', stop);
const down = (speed, stop = 1, dist = 9, pitch = 0.05) => run(SPOT.hillTop, SPOT.hill, speed, 1.57, dist, pitch, 'KeyW', stop);

export default {
  id: '008', name: 'into-the-hill', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#16', still: 0.5, frame: up(1, 1, 7, 0.1) }] },
    { text: 'At ten times his speed, he ran straight into the hill.', shots: [{ commit: SINKS, query: Q, hash: '#16', still: 0.5, frame: up(10, 1, 10) }] },
    { text: 'The game has commands for testing. I typed speed ten, and ran up a slope.', shots: [{ commit: SINKS, query: Q, hash: '#16', still: 0.5, rate: 0.4, frame: up(10, 1, 10) }] },
    { text: 'He sank into the ground as he climbed, and only came up again when he stopped.', shots: [{ commit: SINKS, query: Q, hash: '#16', still: 0.75, rate: 0.5, frame: up(10, 0.6, 10) }] },
    { text: 'His height chased the ground at a fixed rate. Go fast enough, and it fell behind.', shots: [{ commit: SINKS, query: Q, hash: '#16', still: 0.5, rate: 0.35, frame: up(10, 1, 6, 0.0) }] },
    { text: 'The first fix made it keep up. Uphill was right. Downhill, he floated.', shots: [
      { commit: FLOATS, query: Q, hash: '#16', still: 0.5, rate: 0.5, frame: up(10, 1, 10) },
      { commit: FLOATS, query: Q, hash: '#16', still: 0.5, rate: 0.5, frame: down(10, 1, 10), cue: 'Downhill,' },
    ] },
    { text: 'So now he stays within three centimetres of any slope, either way.', shots: [
      { commit: FIXED, query: Q, hash: '#16', still: 0.5, rate: 0.5, frame: up(10, 1, 10) },
      { commit: FIXED, query: Q, hash: '#16', still: 0.5, rate: 0.5, frame: down(10, 1, 10), cue: 'either' },
    ], pad: 0.3 },
    { text: 'And a test now runs that hill every time, so the bug cannot come back.', shots: [{ commit: NOW, query: Q, hash: '#17.5', still: 0.4, tail: 3.2, frame: up(3, 1, 8, 0.12) }], pad: 0.3 },
  ],
  end: END,
};
