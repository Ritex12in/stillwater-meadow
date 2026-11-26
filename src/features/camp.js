// Places you make: a camp and lanterns. Your backpack holds a tent and lanterns (given once, with
// the backpack). Pitch the tent anywhere level and dry, from the backpack: a tent and a ring of
// stones with a small fire, kept in this world (one camp to a world: pitch it again and it moves).
// Set lanterns down as you go, to mark a trail: they glow at night; walk up to one to pick it up
// again. The camp is on the compass and in the journal, and you can go back to it from there.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { walkable, onIce, onDock, heightAt, slopeAt } from '../core/shape.js';
import { hooks, obstacles } from '../core/state.js';
import { glowTex, std } from '../core/materials.js';
import { cur } from '../systems/time.js';
import { player } from '../characters/player.js';
import { activity } from '../systems/activity.js';
import { registerAction } from '../systems/actions.js';
import { store, saveSoon } from '../systems/save.js';
import { itemKind, add, take, has, count } from '../systems/pack.js';
import { packActions } from '../ui/backpack.js';
import { toast, togglePanel } from '../ui/hud.js';

const LANTERNS = 24; // the most that can stand in a world at once
const svg = (b) => `<svg viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
itemKind('tent', { name: 'Tent', icon: () => svg('<path d="M3 20 L12 4 L21 20 Z" fill="#d8a457"/><path d="M12 4 L12 20 M9 20 L12 13 L15 20" stroke="#7a5236" stroke-width="1.2" fill="#6b4a2e"/>'), detail: () => 'Pitch it anywhere level and dry: your own camp in this world.' });
itemKind('lantern', { name: 'Lantern', max: 24, icon: () => svg('<rect x="9" y="7" width="6" height="9" rx="1" fill="#ffd27a" stroke="#4f3726" stroke-width="1.2"/><path d="M8 7 L16 7 L12 4 Z M10 16 L14 16 L14 19 L10 19 Z" fill="#4f3726"/>'), detail: (it) => `${it.n}. Set them down to mark a trail; they glow at night.` });

/** A tent (A-frame), a stone ring and logs: one group. */
function makeCamp() {
  const g = new THREE.Group(), cloth = std('#d8a457', { side: THREE.DoubleSide }), pole = std('#6b4a2e'), stone = std('#8f8b82');
  const tent = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.6, 3, 1, true).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.62, 0), cloth);
  tent.scale.set(1, 1.15, 1); tent.castShadow = tent.receiveShadow = true;
  g.add(tent);
  for (const z of [-1.3, 1.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5).translate(0, 0.8, z), pole); p.castShadow = true; g.add(p); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0).translate(Math.cos(a) * 0.55 + 2.6, 0.08, Math.sin(a) * 0.55), stone); r.castShadow = true; g.add(r); }
  for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 5).rotateZ(Math.PI / 2).rotateY(i * 2.1).translate(2.6, 0.1, 0), pole));
  const fireMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffb45e', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flame = new THREE.Sprite(fireMat); flame.position.set(2.6, 0.45, 0); flame.scale.set(1.1, 1.4, 1);
  g.add(flame);
  return { g, flame };
}
/** A lantern on a short post: its glass glows at night. */
function makeLantern() {
  const g = new THREE.Group(), post = std('#4f3726');
  const glass = new THREE.MeshStandardMaterial({ color: '#fff1cf', emissive: '#ffb45e', emissiveIntensity: 0 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.9, 5).translate(0, 0.45, 0), post));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(0, 1.02, 0), glass));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 4).rotateY(Math.PI / 4).translate(0, 1.22, 0), post));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffc27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 1.02; halo.scale.set(1.6, 1.6, 1);
  g.add(halo);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, glass, halo };
}

/** Is this a fit spot to pitch a tent or set a lantern? */
const fit = (x, z) => walkable(x, z) && !onIce(x, z) && !onDock(x, z) && heightAt(x, z) > 0.4 && slopeAt(x, z) < 0.35;

export function initCamp() {
  // the tent and lanterns come with the backpack (once)
  if (!store.campKit) { add('tent'); for (let i = 0; i < 8; i++) add('lantern'); store.campKit = true; saveSoon(); }
  // (lanterns that stood in a world whose land has since changed come back to the backpack: systems/save.js)
  if (store.lanternsBack > 0) { for (let i = 0; i < store.lanternsBack; i++) add('lantern'); delete store.lanternsBack; saveSoon(); }
  const camp = makeCamp(), block = { x: 4e5, z: 4e5, r: 1.4 };
  camp.g.visible = false;
  scene.add(camp.g);
  const showCamp = () => {
    const c = store.camp;
    camp.g.visible = !!c;
    if (!c) { const i = obstacles.indexOf(block); if (i >= 0) obstacles.splice(i, 1); return; }
    camp.g.position.set(c.x, heightAt(c.x, c.z) - 0.02, c.z); camp.g.rotation.y = c.rot;
    block.x = c.x; block.z = c.z;
    if (!obstacles.includes(block)) obstacles.push(block);
  };
  showCamp();
  const pitch = () => {
    const f = { x: Math.sin(player.rot), z: Math.cos(player.rot) }, x = player.x + f.x * 2.2, z = player.z + f.z * 2.2;
    if (!fit(x, z) || !fit(x + f.x * 2.6, z + f.z * 2.6)) { toast('Find level, dry ground to pitch the tent.'); return; }
    store.camp = { x, z, rot: player.rot };
    take('tent'); add('tent'); // (the tent stays in the backpack: pitching it again moves the camp)
    saveSoon(); showCamp();
    toast('You pitch your tent. Your camp is on the compass and in your journal.', 4);
  };
  // lanterns
  const pool = [];
  const lanterns = () => store.lanterns || (store.lanterns = []);
  const showLanterns = () => {
    const list = lanterns();
    while (pool.length < list.length) { const l = makeLantern(); scene.add(l.g); pool.push(l); }
    pool.forEach((l, i) => { const p = list[i]; l.g.visible = !!p; if (p) l.g.position.set(p.x, heightAt(p.x, p.z) - 0.02, p.z); });
  };
  showLanterns();
  const setLantern = () => {
    if (lanterns().length >= LANTERNS) { toast(`${LANTERNS} lanterns stand already: pick one up first.`); return; }
    const x = player.x + Math.sin(player.rot) * 0.9, z = player.z + Math.cos(player.rot) * 0.9;
    if (!fit(x, z)) { toast('Not here: set it on dry ground.'); return; }
    if (!take('lantern')) return;
    lanterns().push({ x: +x.toFixed(2), z: +z.toFixed(2) });
    saveSoon(); showLanterns();
  };
  const nearLantern = () => { let best = -1, bd = 1.4; lanterns().forEach((p, i) => { const d = Math.hypot(p.x - player.x, p.z - player.z); if (d < bd) { bd = d; best = i; } }); return best; };
  registerAction({
    id: 'lantern-up', key: 'KeyE', keyLabel: 'E', score: () => 6,
    available: () => activity.free && nearLantern() >= 0,
    label: () => 'Pick up the lantern',
    run: () => { const i = nearLantern(); if (i < 0) return; if (!add('lantern')) { toast('Your backpack is full.'); return; } lanterns().splice(i, 1); saveSoon(); showLanterns(); },
  });
  packActions((it) => {
    if (it.type === 'tent') return [{ label: store.camp ? 'Move my camp here' : 'Pitch camp here', primary: true, run: () => { togglePanel('backpack', false); pitch(); } }];
    if (it.type === 'lantern') return [{ label: 'Set one down here', primary: true, run: () => { togglePanel('backpack', false); setLantern(); } }];
    return [];
  });
  hooks.frame.push((dt, t) => {
    const night = cur.eve;
    for (const l of pool) if (l.g.visible) { l.glass.emissiveIntensity = night * 2.2; l.halo.material.opacity = night * 0.85; }
    if (camp.g.visible) { camp.flame.material.opacity = 0.55 + 0.35 * night + Math.sin(t * 9) * 0.06; camp.flame.scale.y = 1.3 + Math.sin(t * 7.3) * 0.12; }
  });
  return { has: () => has('tent'), lanterns: () => count('lantern') };
}
