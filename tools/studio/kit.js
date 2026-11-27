// Dev tool: every downloaded model the game uses (core/assets.js: Quaternius' kits in public/assets/nature,
// meadow and props), each in its own square under plain light with its name, as the game loads it (its
// pieces, with the textures the game gives them). To see at a glance what in the game is not made in code.
// Open /tools/studio/kit.html ; window.__sheet is the picture (a data URL) once window.__ready is true.
import * as THREE from 'three';
import { loadKit, fit } from '/src/core/assets.js';
import { procTrees } from '/src/world/proctrees.js';
const kit = await loadKit(), made = new Set(Object.keys(procTrees().models));
const names = Object.keys(kit.models).filter((n) => !made.has(n)).sort();
// which texture a piece wears, by its material's name and its model's (as the game's own code pairs them)
const texFor = (model, part) => {
  const p = part.toLowerCase(), m = model.toLowerCase(), T = kit.tex;
  if (/^prop_vine/.test(m)) return T.vine;
  if (m === 'bench') return T.furniture;
  if (/^prop_/.test(m)) return T.woodtrim;
  if (/^pinetree/.test(m)) return /lea|needle/.test(p) ? T.slimpine_leaves : T.slimpine_bark;
  if (/^rock_\d/.test(m)) return T.crag;
  if (/^(grass_small|grass_large)/.test(m)) return T.meadow_grass;
  if (/clump/.test(m)) return /grass|leaf|lea/.test(p) ? T.meadow_grass : T.meadow_flowers;
  if (/twisted/.test(m)) return /lea/.test(p) ? T.leaves : T.bark_twisted;
  if (/^pine/.test(m)) return /lea/.test(p) ? T.leaves_pine : T.bark;
  if (/^commontree/.test(m)) return /lea/.test(p) ? T.leaves_round : T.bark;
  if (/^bush/.test(m)) return /flower/.test(p) ? T.flowers : T.leaves_bush;
  if (/rockpath|pebble/.test(m)) return T.pathrocks;
  if (/^rock/.test(m)) return T.rocks;
  if (/mushroom/.test(m)) return T.mushrooms;
  if (/flower/.test(p) || /petal/.test(p)) return T.flowers;
  return T.leaves;
};
const S = 220, cols = 8, rows = Math.ceil(names.length / cols);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(S, S);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9fb7c8');
scene.add(new THREE.HemisphereLight('#e6f0fa', '#6d7a4a', 0.9));
const sun = new THREE.DirectionalLight('#fff1d6', 0.85); sun.position.set(-3, 5, 4); scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#7f9a56' })); scene.add(floor);
const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const sheet = document.createElement('canvas'); sheet.width = cols * S; sheet.height = rows * (S + 22) + 36;
const ctx = sheet.getContext('2d'); ctx.fillStyle = '#12181c'; ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.fillStyle = '#f7f4ec'; ctx.font = '600 17px sans-serif'; ctx.fillText(`Downloaded models in the game (${names.length}): Quaternius' Stylized Nature kits and props, CC0. Each scaled to fill its square.`, 8, 22);
const group = new THREE.Group(); scene.add(group);
names.forEach((name, i) => {
  group.clear();
  const parts = fit(Object.fromEntries(Object.entries(kit.models[name]).map(([k, g]) => [k, g.clone()])), 2);
  const box = new THREE.Box3();
  for (const [part, g] of Object.entries(parts)) {
    const map = texFor(name, part) || null, leafy = /lea|grass|flower|petal|vine|needle/i.test(part) || /grass|flower|clump|vine|fern|clover|plant/i.test(name);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: leafy ? 0.4 : 0, side: THREE.DoubleSide }));
    group.add(m); g.computeBoundingBox(); box.union(g.boundingBox);
  }
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3()), far = Math.max(size.y, size.x, size.z) * 1.9 + 0.8;
  cam.position.set(mid.x + far * 0.55, mid.y + far * 0.35, mid.z + far * 0.8); cam.lookAt(mid);
  renderer.render(scene, cam);
  const x = (i % cols) * S, y = 36 + Math.floor(i / cols) * (S + 22);
  ctx.drawImage(renderer.domElement, x + 2, y + 2, S - 4, S - 4);
  ctx.fillStyle = '#f7f4ec'; ctx.font = '12px sans-serif'; ctx.fillText(name, x + 6, y + S + 14);
});
document.body.appendChild(sheet);
window.__sheet = sheet.toDataURL('image/png');
window.__names = names;
window.__ready = true;
