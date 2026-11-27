// Short 013, "Grey falls at night" (docs/shorts/briefs/013-grey-falls-at-night.md): the owner played in
// winter after midnight on low graphics and sent a report: the falls were flat grey slabs (`75b5b3b`).
// Icicles first (`d313a7d`); then the owner: "it looks weird and static; a waterfall should not change
// with the season; make it glow at night" (`932d97a`).
import { OPENER, END, SPOT, look } from './helpers.mjs';
const GREY = '75b5b3b', ICE = 'd313a7d', GLOW = '932d97a', NOW = 'main', QW = 'seed=1&weather=clear&season=winter', Q = 'seed=1&weather=clear';
const door = (turn = 0, dist = 6.5, pitch = -0.06) => look(SPOT.heartView, SPOT.heartFall, 3.14, dist, pitch, turn);
const close = (turn = 0) => look([SPOT.heartFall[0] + (SPOT.heartView[0] - SPOT.heartFall[0]) * 0.45, SPOT.heartFall[1] + (SPOT.heartView[1] - SPOT.heartFall[1]) * 0.45], SPOT.heartFall, 3.14, 6, -0.12, turn);

export default {
  id: '013', name: 'grey-falls-at-night', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.5, frame: door(0.15, 8) }] },
    { text: 'I sent the AI a report: the waterfall looks wrong at night.', shots: [{ commit: GREY, query: QW, hash: '#0.5', still: 0.5, frame: door(0.1) }] },
    { text: 'The game has a report command. It saves a screenshot, with the seed, the place and the time.', shots: [{ commit: GREY, query: QW, hash: '#0.5', still: 0.5, frame: door(-0.3, 9, 0.08) }] },
    { text: 'It read the report. Winter, after midnight, low graphics. The falls had frozen into flat grey slabs.', shots: [{ commit: GREY, query: QW, hash: '#0.5', still: 0.5, frame: close(0.15) }] },
    { text: 'Its fix: icicles, pale in the moonlight.', shots: [{ commit: ICE, query: QW, hash: '#0.5', still: 0.5, frame: close(-0.1) }] },
    { text: "I said it looked static. A waterfall shouldn't change with the season. Make it glow at night.", shots: [{ commit: ICE, query: QW, hash: '#0.5', still: 0.5, frame: door(0.2, 8, 0.02) }] },
    { text: 'So now these falls never freeze, and after dark they glow.', shots: [{ commit: GLOW, query: QW, hash: '#0.5', still: 0.5, frame: door(-0.15) }], pad: 0.4 },
    { text: 'I play, I report, it fixes.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.4, tail: 3.2, frame: close(0.25) }], pad: 0.3 },
  ],
  end: END,
};
