// Short 009, "The year that stopped" (docs/shorts/briefs/009-the-year-that-stopped.md): the game had a
// turning year; in winter the cherry blossom valley was bare trees in snow (`932d97a`, held at winter);
// the owner said "remove the season concept, season will be fixed for places" (`0d94bdd`). Today: cold
// country always winter, the valley always in blossom, the rest summer.
import { OPENER, END, SPOT, look, at, glide } from './helpers.mjs';
const YEAR = '932d97a', NOW = 'main', Q = 'seed=1&weather=clear';
const door = (turn = 0, dist = 6.5, pitch = -0.04) => look(SPOT.heartView, SPOT.heartFall, 3.14, dist, pitch, turn);

export default {
  id: '009', name: 'the-year-that-stopped', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#16', still: 0.5, frame: door(0.2, 8) }] },
    { text: 'In winter, my cherry blossom valley was nothing but bare trees in the snow.', shots: [{ commit: YEAR, query: Q + '&season=winter', hash: '#13', still: 0.5, frame: door(0.1) }] },
    { text: 'The game had a whole year. Every two real days, a new season.', shots: [{ commit: YEAR, query: Q + '&season=autumn&glider=1', hash: '#15', still: 0.5, frame: glide(60, 0.3) }] },
    { text: 'Leaves turned, snow came and went, and the lakes froze over.', shots: [{ commit: YEAR, query: Q + '&season=winter&glider=1', hash: '#14', still: 0.5, frame: glide(60, -0.3) }] },
    { text: 'But a blossom valley without blossom has lost its point. So I said: remove the seasons. Each place keeps its own.', shots: [{ commit: YEAR, query: Q + '&season=winter', hash: '#15', still: 0.5, frame: door(-0.25, 9, 0.1) }] },
    { text: 'Now cold country is always winter,', shots: [{ commit: NOW, query: Q, hash: '#14', still: 0.5, frame: at(`m.command('goto snow');`, 3.14 + 0.4, 9, 0.18, -0.4) }] },
    { text: 'the valley is always in blossom,', shots: [{ commit: NOW, query: Q, hash: '#16', still: 0.5, frame: door(0.15) }] },
    { text: 'and everywhere else, it is summer.', shots: [{ commit: NOW, query: Q, hash: '#16.5', still: 0.5, frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 - 0.5 + 0.4 * u; m.camState.dist = 7; m.camState.pitch = 0.14; }` }], pad: 0.4 },
    { text: 'Where you are decides the season. Not the date.', shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#17.5', still: 0.4, tail: 3.2, frame: glide(70, 0.3) }], pad: 0.3 },
  ],
  end: END,
};
