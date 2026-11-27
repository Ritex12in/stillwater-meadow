// Short 010, "The moves" (docs/shorts/briefs/010-the-moves.md): the owner, "he can't climb, jump, jump
// from a cliff, glide"; before the moves (`df1e170`), and today: the jump, the landings, the climb, the
// glider found by a cairn.
import { OPENER, END, SPOT, drop, jump, look, at, run } from './helpers.mjs';
const BEFORE = 'df1e170', NOW = 'main', Q = 'seed=1&weather=clear', QG = Q + '&glider=1';

export default {
  id: '010', name: 'the-moves', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: QG, hash: '#16', still: 0.5, frame: drop(16, 5, 3.14 - 0.8, 5, true) }] },
    { text: "I told the AI: he can't climb, he can't jump, he can't glide.", shots: [{ commit: BEFORE, query: Q + '&season=summer', hash: '#15', still: 0.5, frame: look(SPOT.face, SPOT.faceTop, 3.14 - 0.5, 6, 0.15, 0.3) }] },
    { text: 'So first it planned every move, frame by frame. The crouch, the push, the tuck, the landing.', shots: [{ commit: NOW, query: Q, hash: '#15', still: 0.4, rate: 0.4, frame: jump(1.2, 3.4, 0.1) }] },
    { text: 'A short drop, he lands softly. A long one, he rolls out of it.', shots: [
      { commit: NOW, query: Q, hash: '#15', still: 0.5, frame: drop(1.8, 2, 1.3, 4.4) },
      { commit: NOW, query: Q, hash: '#15', still: 0.6, frame: drop(14, 3, 1.1, 6), cue: 'long' },
    ] },
    { text: 'Push into a steep face, and he takes hold and climbs.', shots: [{ commit: NOW, query: Q, hash: '#15', still: 0.7, frame: run(SPOT.face, SPOT.faceTop, 1, 3.14 - 0.4, 5, 0.2, 'KeyW') }] },
    { text: 'And somewhere near home, a glider lies by a cairn.', shots: [{ commit: NOW, query: Q, hash: '#15', still: 0.5, frame: at(`m.command('goto glider');`, 3.14 - 0.5, 4.5, 0.18, 0.4) }] },
    { text: 'Find it, and you can jump off anything and fly.', shots: [{ commit: NOW, query: QG, hash: '#17', still: 0.5, frame: drop(40, 6, 3.14 - 0.4, 6.5, true) }], pad: 0.4 },
    { text: 'Every move is code. Not one animation file.', shots: [{ commit: NOW, query: QG, hash: '#18', still: 0.4, tail: 3.2, frame: drop(60, 7, 3.14 + 0.3, 7.5, true) }], pad: 0.3 },
  ],
  end: END,
};
