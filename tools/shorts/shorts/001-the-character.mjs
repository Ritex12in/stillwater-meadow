// Short 001, "The character" (docs/shorts/briefs/001-the-character.md): its lines, and for each line
// the shots under it. A shot: the version of the game it is filmed from (`commit`), the address's
// options (`query`, `hash`: the hour), a share of its line's time (`weight`), and `frame(c, t, u)`, run
// in that version's page every frame (`c.m` is its `window.__meadow`, if it has one; `t` seconds into
// the shot, `u` 0..1 through it). The functions may use only what they are given.
//
// The camera is the game's own, following the boy: `yaw` is set from the way he faces (0 looks at his
// face, pi at his back), so every version is framed alike.
const NOW = 'main';
const Q = 'seed=1&weather=clear&season=summer';
// (the versions of 22 November show the game's own figures only when asked: `hero=classic`)
const OWN = 'hero=classic&weather=clear&season=summer';
/** The boy from his front quarter, close: the same in every version that has a handle. */
const close = (dist = 2.5, turn = 0.55, pitch = 0.08) => `(c, t, u) => { const m = c.m; if (!m || !m.camState) return; m.camState.yaw = m.player.rot + ${turn}; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;

export default {
  id: '001', name: 'the-character', voice: 'en-US-AndrewNeural',
  lines: [
    { text: 'This character has no 3D model.', shots: [{ commit: NOW, query: Q, hash: '#15', frame: close(2.3, 0.5, 0.06) }] },
    { text: "Every strand of his hair is code. And I didn't write it. An AI did.", shots: [{ commit: NOW, query: Q, hash: '#15', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 0.5 + u * 1.5; m.camState.dist = 2.3 + 0.5 * u; m.camState.pitch = 0.06 + 0.05 * u; }` }] },
    { text: 'Day one, he looked like this.', shots: [{ commit: '620f25a', query: '', hash: '#15' }] },
    { text: 'So I drew what I wanted, and described it. Round head. No, oval. Bigger hair. Spikes. With a curve.', shots: [
      { commit: 'e469097', query: OWN, hash: '#15', frame: close(), weight: 1.6 },
      { commit: '20fcba4', query: OWN, hash: '#15', frame: close() },
      { commit: '9d2b54f', query: OWN, hash: '#15', frame: close() },
      { commit: '36e98f0', query: OWN, hash: '#15', frame: close() },
      { commit: 'da8f185', query: OWN, hash: '#15', frame: close() },
      { commit: 'd9e1567', query: OWN, hash: '#15', frame: close() },
    ] },
    { text: 'Then his hair got physics.', shots: [{ commit: NOW, query: Q, hash: '#15', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 0.75; m.camState.dist = 3.3; m.camState.pitch = 0.1; if (!c.jumped && t > 0.3) { c.jumped = 1; m.jump(); } }` }] },
    { text: 'No modelling software. I described him. An AI coded him.', shots: [{ commit: NOW, query: Q, hash: '#19.1', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 - 0.5 + 0.25 * u; m.camState.dist = 5.5 + 1.2 * u; m.camState.pitch = 0.16; }`, tail: 2.6 }] },
  ],
  // the last shot runs on under the end card for its `tail` seconds
  end: { title: 'Stillwater Meadow', sub: 'free · in your browser', say: 'Stillwater Meadow. Free, in your browser.' },
};
