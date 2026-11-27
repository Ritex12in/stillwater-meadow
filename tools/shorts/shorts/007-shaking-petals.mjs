// Short 007, "The shaking petals" (docs/shorts/briefs/007-shaking-petals.md): after the blossom was made
// to glow at night (`aa550e9`) the petals on the ground flickered as the camera moved; the first fix
// (`20bc2b4`) drew them only near the camera; the owner said "why not paint them on the ground, like the
// grass", and that fixed it (`fab26a5`). Filmed at night at the grove's front door, the camera swinging.
import { OPENER, END, SPOT } from './helpers.mjs';
const SHAKE = 'aa550e9', NEAR = '20bc2b4', PAINTED = 'fab26a5', NOW = 'main', Q = 'seed=1&weather=clear';
/** At the front door at night, the camera swinging round him low over the petals: what makes them flicker. */
const swing = (from, by, dist, pitch) => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; m.travelTo(${SPOT.heartView[0]}, ${SPOT.heartView[1]}, ${SPOT.heartFall[0]}, ${SPOT.heartFall[1]}); } m.camState.yaw = m.player.rot + ${from} + ${by} * u; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;

export default {
  id: '007', name: 'shaking-petals', voice: 'en-US-AndrewNeural',
  lines: [
    { text: OPENER, shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14, 0.4, 7, 0.02) }] },
    { text: 'I asked for the cherry trees to glow at night. Then the petals on the ground started to shake.', shots: [{ commit: SHAKE, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14 - 0.6, 1.2, 6, 0.18) }] },
    { text: 'Every petal was drawn on its own. Smaller than a pixel, they flickered as the camera moved.', shots: [{ commit: SHAKE, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14 + 0.5, -1.0, 5, 0.25) }] },
    { text: 'The first fix hid the far ones. I said: now they only show round the camera.', shots: [{ commit: NEAR, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14 - 0.4, 0.8, 7, 0.15) }] },
    { text: "Then I asked: why can't we just paint the petals on the ground, like the grass?", shots: [{ commit: NEAR, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14 + 0.3, -0.6, 8, 0.1) }] },
    { text: 'So it did. One picture of scattered petals, made in code, laid over the ground.', shots: [{ commit: PAINTED, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14 - 0.6, 1.2, 6, 0.18) }] },
    { text: 'No flicker, and they reach as far as you can see.', shots: [{ commit: PAINTED, query: Q, hash: '#22.5', still: 0.5, frame: swing(3.14 + 0.5, -1.0, 9, 0.12) }], pad: 0.4 },
    { text: 'My idea. The AI wrote the code.', shots: [{ commit: NOW, query: Q, hash: '#22.5', still: 0.4, tail: 3.2, frame: swing(3.14, 0.3, 10, 0.05) }], pad: 0.3 },
  ],
  end: END,
};
