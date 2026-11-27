// Short 011, "One number" (docs/shorts/briefs/011-one-number.md): every world grows from a seed; any
// word is a seed. The same flight over home in worlds grown from different words.
import { OPENER, END, glide, at } from './helpers.mjs';
const NOW = 'main', W = (seed) => `seed=${seed}&weather=clear&glider=1`;

export default {
  id: '011', name: 'one-number', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: W('1'), hash: '#15', still: 0.5, frame: glide(70, 0.2) }] },
    { text: 'Type any word, and you get a world nobody has ever seen.', shots: [{ commit: NOW, query: W('dragon'), hash: '#15', still: 0.5, frame: glide(70, 0.3) }] },
    { text: 'Every world in my game grows from one number, called a seed.', shots: [{ commit: NOW, query: W('1'), hash: '#15', still: 0.5, frame: glide(70, -0.2) }] },
    { text: 'The same seed always grows the same land. The same hills, the same rivers, the same coasts.', shots: [{ commit: NOW, query: 'seed=1&weather=clear', hash: '#14', still: 0.5, frame: at(`m.command('goto coast');`, 3.14 + 0.5, 11, 0.24, -0.6) }] },
    { text: 'A different word, a different world. This one is moon.', shots: [{ commit: NOW, query: W('moon'), hash: '#16', still: 0.5, frame: glide(70, 0.3) }] },
    { text: 'This one is pizza.', shots: [{ commit: NOW, query: W('pizza'), hash: '#16', still: 0.5, frame: glide(70, -0.3) }] },
    { text: 'And no world has an edge. It keeps growing as you walk.', shots: [{ commit: NOW, query: 'seed=1&weather=clear', hash: '#10', still: 0.5, frame: at(`m.travelTo(m.home.x + 2100, m.home.z + 700);`, 3.14 - 0.4, 15, 0.34, 0.9) }], pad: 0.3 },
    { text: 'Your own name is a world, too.', shots: [{ commit: NOW, query: W('stillwater'), hash: '#18', still: 0.4, tail: 3.2, frame: glide(80, 0.3) }], pad: 0.3 },
  ],
  end: END,
};
