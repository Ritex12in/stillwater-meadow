// Short 012, "The mountains" (docs/shorts/briefs/012-the-mountains.md): a painted ridge round one valley
// (`620f25a`), reworked that evening into peaks still out of reach (`df8bfa5`), real ground once the land
// had no edge (`1dbed87`), and today: worn by water, a treeline, snow on the high faces. The two old
// versions of 13 November and the one of 21 November cannot be driven: they are filmed as they open.
import { OPENER, END, at, glide } from './helpers.mjs';
const DAY1 = '620f25a', EVENING = 'df8bfa5', ENDLESS = '1dbed87', NOW = 'main', Q = 'seed=1&weather=clear';

export default {
  id: '012', name: 'the-mountains', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#15', still: 0.5, frame: glide(80, 0.2, `m.command('goto snow');`) }] },
    { text: 'These mountains were a painting. You could never walk to them.', shots: [{ commit: DAY1, query: '', hash: '#15' }] },
    { text: 'On day one, they were a ridge drawn round a single valley.', shots: [{ commit: DAY1, query: '', hash: '#17' }] },
    { text: 'That evening they got pointed peaks, snow, and a forest in front. Still out of reach.', shots: [{ commit: EVENING, query: '', hash: '#15' }] },
    { text: 'A week later the land lost its edge, and the mountains became real ground you could walk up.', shots: [{ commit: ENDLESS, query: 'seed=1', hash: '#15' }] },
    { text: 'Then they were worn by water, given a treeline, and snow on the faces turned away from the sun.', shots: [{ commit: NOW, query: Q, hash: '#14', still: 0.5, frame: at(`m.command('goto snow');`, 3.14 + 0.4, 10, 0.2, -0.5) }] },
    { text: 'Now you can climb them, and glide off the top.', shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#15', still: 0.5, frame: glide(50, -0.3, `m.command('goto snow');`) }], pad: 0.4 },
    { text: 'From a painting, to somewhere you can stand.', shots: [{ commit: NOW, query: Q + '&glider=1', hash: '#17.5', still: 0.4, tail: 3.2, frame: glide(90, 0.3, `m.command('goto snow');`) }], pad: 0.3 },
  ],
  end: END,
};
