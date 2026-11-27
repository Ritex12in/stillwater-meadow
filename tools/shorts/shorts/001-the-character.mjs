// Short 001, "The character" (docs/shorts/briefs/001-the-character.md): its lines, and for each line
// the shots under it. A shot: the version of the game it is filmed from (`commit`), the address's
// options (`query`, `hash`: the hour), a share of its line's time (`weight`), and `frame(c, t, u)`, run
// in that version's page every frame (`c.m` is its `window.__meadow`, if it has one; `t` seconds into
// the shot, `u` 0..1 through it). The functions may use only what they are given. A line's `pad` is
// time held after it is said (s). A shot's `cue` is the word of its line it cuts in on (as written).
//
// The camera is the game's own, following the boy: `yaw` is set from the way he faces (0 looks at his
// face, pi at his back), so every version is framed alike.
//
// 40 to 60 seconds: the opener first, then the hook, then the story (docs/shorts/adr/0013).
const NOW = 'main';
const Q = 'seed=1&weather=clear';
// (the versions of 22 November show the game's own figures only when asked: `hero=classic`)
const OWN = 'hero=classic&weather=clear&season=summer';
/** The boy from his front quarter, close: the same in every version that has a handle. */
const close = (dist = 2.5, turn = 0.55, pitch = 0.08) => `(c, t, u) => { const m = c.m; if (!m || !m.camState) return; m.camState.yaw = m.player.rot + ${turn}; m.camState.dist = ${dist}; m.camState.pitch = ${pitch}; }`;
/** Lifted `h` metres by the home lake and let go moving forward at `v`; the camera `yaw` from his face. `glide`: open the glider just after. */
const drop = (h, v, yaw, dist, glide) => `(c, t, u) => { const m = c.m; if (!c.set) { c.set = 1; m.travelTo(m.spawn.x + 14, m.spawn.z + 14, m.spawn.x + 60, m.spawn.z + 14); } m.camState.yaw = m.player.rot + ${yaw}; m.camState.dist = ${dist}; m.camState.pitch = 0.1; if (!c.go && t > 0.05) { c.go = 1; m.dropFrom(${h}, ${v}); } ${glide ? 'if (c.go === 1 && t > 0.3) { c.go = 2; m.jump(); }' : ''} }`;

export default {
  id: '001', name: 'the-character', voice: 'en-US-AndrewNeural',
  lines: [
    // the opener: the boy today by the home lake in the late sun, the camera coming round to him
    { text: "I'm building a whole game with AI. I haven't written a single line of code.", shots: [{ commit: NOW, query: Q, hash: '#17.4', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 - 0.6 + 0.4 * u; m.camState.dist = 6 - 1.5 * u; m.camState.pitch = 0.12; }` }] },
    // the hook
    { text: 'Two weeks ago, this boy was a stack of boxes.', shots: [{ commit: NOW, query: Q, hash: '#15', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 0.5 + u * 0.5; m.camState.dist = 2.3; m.camState.pitch = 0.06; }` }] },
    { text: 'Day one. A few boxes, and his dog.', shots: [{ commit: '620f25a', query: '', hash: '#15' }], pad: 0.5 },
    { text: 'Day two, he was sculpted, all in code.', shots: [{ commit: 'c9b7c6f', query: 'weather=clear&season=summer', hash: '#15', frame: close(2.6, 0.55, 0.08) }] },
    { text: "But he didn't feel like mine. So I drew him on paper, and described what I saw.", shots: [{ commit: 'e469097', query: OWN, hash: '#15', frame: `(c, t, u) => { const m = c.m; if (!m || !m.camState) return; m.camState.yaw = m.player.rot + 0.55 + 0.6 * u; m.camState.dist = 3.2 - 0.7 * u; m.camState.pitch = 0.08; }` }] },
    { text: 'Round head. No, oval. Bigger hair. Spikes. With a curve.', shots: [
      { commit: '20fcba4', query: OWN, hash: '#15', frame: close() },
      { commit: '9d2b54f', query: OWN, hash: '#15', frame: close(), cue: 'oval.' },
      { commit: '36e98f0', query: OWN, hash: '#15', frame: close(), cue: 'Bigger' },
      { commit: 'da8f185', query: OWN, hash: '#15', frame: close(), cue: 'Spikes.' },
      { commit: 'd9e1567', query: OWN, hash: '#15', frame: close(), cue: 'With' },
    ] },
    { text: 'About twenty five tries in one day, and not one modelling program.', shots: [{ commit: 'd9e1567', query: OWN, hash: '#15', frame: `(c, t, u) => { const m = c.m; if (!m || !m.camState) return; m.camState.yaw = m.player.rot + 0.55 + 1.6 * u; m.camState.dist = 2.6; m.camState.pitch = 0.1; }` }] },
    { text: 'Then his hair got springs, so it bounces when he lands.', shots: [{ commit: NOW, query: Q, hash: '#15', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 0.75; m.camState.dist = 3.3; m.camState.pitch = 0.1; if (!c.jumped && t > 0.3) { c.jumped = 1; m.jump(); } }` }] },
    { text: 'Now he rolls out of long falls, and he glides.', shots: [
      { commit: NOW, query: Q, hash: '#16', frame: drop(14, 3, 1.1, 6), still: 0.6 },
      { commit: NOW, query: Q + '&glider=1', hash: '#16', frame: drop(13, 5, 3.14 - 0.8, 4.6, true), cue: 'glides.' },
    ], pad: 0.4 },
    { text: 'I describe him. The AI writes the code.', shots: [{ commit: NOW, query: Q, hash: '#19.1', frame: `(c, t, u) => { const m = c.m; m.camState.yaw = m.player.rot + 3.14 - 0.5 + 0.25 * u; m.camState.dist = 5.5 + 1.2 * u; m.camState.pitch = 0.16; }`, tail: 2.6 }] },
  ],
  // the last shot runs on under the end card for its `tail` seconds
  end: { title: 'Stillwater Meadow', sub: 'free · in your browser', say: 'Stillwater Meadow. Free, in your browser.' },
};
