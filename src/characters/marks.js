// Little marks beside a child's head, as the owner's character sheets draw them with each expression:
// yellow dashes for joy, hearts for love, sparkles for wonder, a question mark when thinking, red
// exclamation strokes when worried, a dark scribble when cross, a tear-drop when sad, and "z"s when
// sleepy. Each pops up when the face changes to that expression, bobs a little, and fades.
import * as THREE from 'three';

const TEX = {};
/** A mark's picture, drawn once on a small canvas. */
function texOf(kind) {
  if (TEX[kind]) return TEX[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  const outline = (draw, fill, stroke, w) => { g.save(); draw(); g.lineWidth = w + 10; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.stroke(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = w; g.strokeStyle = stroke; g.stroke(); } g.restore(); };
  if (kind === 'joy') { // three short rays
    for (const [a, l] of [[-0.55, 34], [0, 40], [0.55, 34]]) outline(() => { g.beginPath(); g.moveTo(64 + Math.sin(a) * 26, 104 - Math.cos(a) * 26); g.lineTo(64 + Math.sin(a) * (26 + l), 104 - Math.cos(a) * (26 + l)); }, null, '#f2b632', 14);
  } else if (kind === 'heart') {
    outline(() => { g.beginPath(); g.moveTo(64, 108); g.bezierCurveTo(10, 70, 18, 22, 64, 44); g.bezierCurveTo(110, 22, 118, 70, 64, 108); g.closePath(); }, '#ef6f86', '#d9506b', 4);
  } else if (kind === 'sparkle') {
    outline(() => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 14 : 50; g.lineTo(64 + Math.sin(a) * r, 64 - Math.cos(a) * r); } g.closePath(); }, '#f6c742', '#e8a92a', 3);
  } else if (kind === 'question' || kind === 'zz') {
    g.font = kind === 'zz' ? 'italic 800 76px Manrope, sans-serif' : '800 104px Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const s = kind === 'zz' ? 'z' : '?';
    g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.strokeText(s, 64, 68);
    g.fillStyle = kind === 'zz' ? '#7f8fb0' : '#6b4a3a'; g.fillText(s, 64, 68);
  } else if (kind === 'exclaim') { // two red strokes, like a start of surprise
    for (const [x, a] of [[44, -0.25], [84, 0.25]]) outline(() => { g.beginPath(); g.moveTo(x, 86); g.lineTo(x + Math.sin(a) * 60, 86 - Math.cos(a) * 60); }, null, '#e2503f', 13);
  } else if (kind === 'scribble') { // a tangled dark cloud
    outline(() => { g.beginPath(); for (let i = 0; i <= 70; i++) { const a = i * 0.5, r = 16 + 30 * (0.5 + 0.5 * Math.sin(i * 0.37)) * (0.75 + 0.25 * Math.sin(i * 1.9)); g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r * 0.7); } }, null, '#3f3a3a', 5); // (a loose, looping scrawl)
  } else if (kind === 'drop') {
    outline(() => { g.beginPath(); g.moveTo(64, 14); g.bezierCurveTo(96, 60, 100, 82, 88, 98); g.bezierCurveTo(76, 116, 52, 116, 40, 98); g.bezierCurveTo(28, 82, 32, 60, 64, 14); g.closePath(); }, '#8cc6ee', '#5aa2d6', 4);
  }
  const t = new THREE.CanvasTexture(c);
  return (TEX[kind] = t);
}

/** Which marks go with an expression: [kind, x, y, size, delay] each, beside the head (in its frame; + x is its left). */
const MARKS = {
  happy: [['joy', -0.38, 0.5, 0.26, 0]],
  love: [['heart', -0.34, 0.6, 0.2, 0], ['heart', -0.46, 0.42, 0.14, 0.18]],
  wow: [['sparkle', -0.36, 0.62, 0.2, 0], ['sparkle', 0.36, 0.55, 0.14, 0.15]],
  think: [['question', -0.36, 0.62, 0.24, 0]],
  worried: [['exclaim', -0.36, 0.6, 0.24, 0]],
  grit: [['scribble', -0.36, 0.64, 0.26, 0]],
  sad: [['drop', -0.44, 0.4, 0.16, 0]], // (beside the temple, clear of the hair)
  sleepy: [['zz', -0.3, 0.6, 0.15, 0], ['zz', -0.42, 0.78, 0.2, 0.45]],
};
const LAST = 2.4; // seconds a mark stays

/** The marks for one head: `update(dt, expression)` once a frame. */
export function makeMarks(head) {
  const pool = [], live = [];
  let shown = null, since = 99;
  // (made up front, two per head, the most an expression uses: the scene holds the same whatever faces are pulled)
  for (let i = 0; i < 2; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 5; s.visible = false; head.add(s); pool.push(s); }
  const take = () => pool.find((p) => !p.visible) || null;
  return {
    update(dt, name) {
      since += dt;
      if (name !== shown) {
        shown = name;
        if (MARKS[name] && since > 1.2) { // (not again and again as a face flickers)
          since = 0;
          for (const [kind, x, y, size, delay] of MARKS[name]) {
            const s = take();
            if (!s) continue;
            s.material.map = texOf(kind); s.material.needsUpdate = true; s.visible = true;
            live.push({ s, x, y, size, t: -delay, spin: (Math.random() - 0.5) * 0.4 });
          }
        }
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const m = live[i];
        m.t += dt;
        const t = Math.max(0, m.t), pop = Math.min(1, t / 0.22), grow = 1 + 1.7 * (1 - pop) * pop * pop - 0.0; // (a little overshoot as it pops in)
        const fade = 1 - Math.max(0, (t - (LAST - 0.5)) / 0.5);
        m.s.position.set(m.x, m.y + 0.05 * Math.sin(t * 5) + 0.06 * t / LAST, 0.08);
        m.s.scale.setScalar(m.size * pop * grow);
        m.s.material.rotation = m.spin + Math.sin(t * 3) * 0.08;
        m.s.material.opacity = m.t < 0 ? 0 : Math.max(0, fade);
        if (t >= LAST) { m.s.visible = false; live.splice(i, 1); }
      }
    },
  };
}
