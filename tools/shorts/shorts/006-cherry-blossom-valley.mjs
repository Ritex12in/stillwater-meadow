// Short 006, "The cherry blossom valley" (docs/shorts/briefs/006-cherry-blossom-valley.md): from a
// picture the owner showed, a grove built step by step, every step filmed from its own version at the
// same spot (the front door of the grove's heart in seed 1; before the heart was built, the grove there).
import { OPENER, END, SPOT, look } from './helpers.mjs';
const BEFORE = '635977a', COLOUR = '76a554d', LANTERNS = 'ad86a10', HEART = 'd7cd2eb', WAYIN = 'a93329c', NOW = 'main';
const Q = 'seed=1&weather=clear', QS = 'seed=1&weather=clear&season=spring';
const door = (turn = 0, dist = 6.5, pitch = -0.06) => look(SPOT.heartView, SPOT.heartFall, 3.14, dist, pitch, turn);

export default {
  id: '006', name: 'cherry-blossom-valley', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#17', still: 0.5, frame: door(0.2, 8) }] },
    { text: 'I showed the AI a picture of a cherry blossom valley, and said: build this.', shots: [{ commit: BEFORE, query: QS, hash: '#17', still: 0.5, frame: door(0.1) }] },
    { text: 'It counted the colours first. The picture was a third pink, and almost no green. My grove was mostly green.', shots: [{ commit: BEFORE, query: QS, hash: '#17', still: 0.5, frame: door(-0.3, 9, 0.1) }] },
    { text: 'So, colour first. Pink blossom, petals lying on the ground, and a pink haze in the air.', shots: [{ commit: COLOUR, query: QS, hash: '#17', still: 0.5, frame: door(0.2) }] },
    { text: 'Then stone lanterns along the paths, lit at dusk.', shots: [{ commit: LANTERNS, query: QS, hash: '#19.3', still: 0.5, frame: door(-0.2, 7, 0.05) }] },
    { text: 'Then the heart of it. The land raised into a cliff, a waterfall, and pagodas on top.', shots: [{ commit: HEART, query: QS, hash: '#16.5', still: 0.5, frame: door(0.15) }] },
    { text: 'Then a way in, so that walking up, you get the view.', shots: [{ commit: WAYIN, query: QS, hash: '#16.5', still: 0.5, frame: door(0, 5.5) }] },
    { text: 'And at night, the whole valley glows.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.5, frame: door(-0.2) }], pad: 0.4 },
    { text: 'Every step is the game as it really was.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.4, tail: 3.2, frame: door(0.25, 9) }], pad: 0.3 },
  ],
  end: END,
};
