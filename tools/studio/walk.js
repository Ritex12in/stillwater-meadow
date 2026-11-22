// A study of the characters' walk and run: frames through one cycle, side-on and from the front.
//   /tools/studio/walk.html?id=fumiriya&speed=2.7&view=side
import * as THREE from 'three';
import { scene } from '/src/core/render.js';
import { loadCharacter, followFigure } from '/src/characters/vroid.js';
const q = new URLSearchParams(location.search), id = q.get('id') || 'fumiriya', speed = +(q.get('speed') || 2.7), view = q.get('view') || 'side', act = q.get('act') || '';
const N = +(q.get('n') || 8), W = +(q.get('w') || 260), H = +(q.get('h') || 380);
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W * N, H); r.outputEncoding = THREE.sRGBEncoding; document.body.appendChild(r.domElement);
scene.background = new THREE.Color('#dfe7ea');
scene.add(new THREE.HemisphereLight('#ffffff', '#889988', 0.85));
const sun = new THREE.DirectionalLight('#ffffff', 0.8); sun.position.set(2, 4, 3); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#b7c9a8' })); scene.add(ground);
const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
const ch = await loadCharacter(id);
const p = { x: 0, y: 0, z: 0, rot: Math.PI / 2, move: speed, seat: null, sitAmt: 0, lieAmt: 0, pickT: 0, petAmt: 0, skating: false };
const c = { act, ground: 0, emote: q.get('emote') || null };
const dt = 1 / 120;
for (let i = 0; i < 240; i++) { p.x += speed * dt; followFigure(ch, p, dt, c); }
// one cycle: two steps
const legW = ch.legLen * 0.82, step = Math.min(speed / (speed > 3.2 ? 3.2 : 2.4), (speed > 3.2 ? 1.5 : 1.15) * legW), cycle = speed > 0.3 ? (2 * step) / speed : 2;
r.setScissorTest(true);
for (let f = 0; f < N; f++) {
  const until = cycle / N; let tt = 0;
  while (tt < until) { p.x += speed * dt; followFigure(ch, p, dt, c); tt += dt; }
  ch.root.updateMatrixWorld(true);
  const y = 0.72;
  if (view === 'handsfront') { const hy = 0.8; cam.position.set(p.x + 1.5, hy, 0.001); cam.lookAt(p.x, hy, 0); r.setViewport(f * W, 0, W, H); r.setScissor(f * W, 0, W, H); r.render(scene, cam); continue; }
  if (view === 'hands') { const hy = 0.8; cam.position.set(p.x + 0.55, hy + 0.05, 1.25); cam.lookAt(p.x, hy, 0); r.setViewport(f * W, 0, W, H); r.setScissor(f * W, 0, W, H); r.render(scene, cam); continue; }
  if (view === 'side') cam.position.set(p.x, y, 3.6); else if (view === 'front') cam.position.set(p.x + 3.6, y, 0.001); else cam.position.set(p.x + 2.4, y + 0.2, 2.4);
  cam.lookAt(p.x, y, 0);
  r.setViewport(f * W, 0, W, H); r.setScissor(f * W, 0, W, H);
  r.render(scene, cam);
}
window.done = true;
