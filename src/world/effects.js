// Small pooled effects: ripple rings on the water and hearts above petted animals.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, rnd } from '../core/math.js';

const ringTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 18, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const ripples = [];
const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const heartTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.moveTo(32, 56);
  g.bezierCurveTo(6, 38, 4, 18, 18, 12);
  g.bezierCurveTo(26, 8, 32, 14, 32, 21);
  g.bezierCurveTo(32, 14, 38, 8, 46, 12);
  g.bezierCurveTo(60, 18, 58, 38, 32, 56);
  g.fillStyle = '#ff5f86'; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.ellipse(20, 21, 5, 3.5, -0.6, 0, TAU); g.fill();
  return new THREE.CanvasTexture(c);
})();
const hearts = [];
const headPos = new THREE.Vector3();

export function buildEffects() {
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 2;
    scene.add(m);
    ripples.push({ m, life: 0, size: 1 });
  }
  for (let i = 0; i < 20; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    scene.add(sp);
    hearts.push({ sp, life: 0, max: 1.7, sway: 0 });
  }
}

export function spawnRipple(x, z, size, y = 0.045) {
  const r = ripples.find((q) => q.life <= 0);
  if (!r) return;
  r.m.position.set(x, y, z); // (y: a river's water is higher than the lakes') r.life = 1.6; r.size = size; r.m.visible = true;
}

/** Hearts float up from an animal's head. */
export function spawnHeart(a) {
  const h = hearts.find((x) => x.life <= 0);
  if (!h) return;
  a.head.getWorldPosition(headPos);
  h.sp.position.set(headPos.x + rnd(-0.15, 0.15), headPos.y + 0.22, headPos.z + rnd(-0.15, 0.15));
  h.life = h.max; h.sway = rnd() * TAU; h.sp.visible = true;
}

export function updateEffects(dt, dayLevel) {
  const shade = 0.35 + 0.65 * Math.max(dayLevel, 0.15);
  for (const r of ripples) {
    if (r.life <= 0) continue;
    r.life -= dt;
    if (r.life <= 0) { r.m.visible = false; continue; }
    const age = 1.6 - r.life, sc = (0.3 + age * 1.5) * r.size;
    r.m.scale.set(sc, 1, sc);
    r.m.material.opacity = (r.life / 1.6) * 0.55;
    r.m.material.color.setScalar(shade);
  }
  for (const h of hearts) {
    if (h.life <= 0) continue;
    h.life -= dt;
    if (h.life <= 0) { h.sp.visible = false; continue; }
    const age = h.max - h.life;
    h.sp.position.y += dt * 0.55;
    h.sp.position.x += Math.sin(age * 3 + h.sway) * dt * 0.15;
    const sc = 0.16 + Math.min(age * 0.6, 0.14);
    h.sp.scale.set(sc, sc, 1);
    h.sp.material.opacity = Math.min(1, age * 6) * Math.min(1, h.life * 1.6);
  }
}
