// Drifting clouds, fireflies at dusk, butterflies and pollen in the sunlight by day.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, rng, rand, wrap, mulberry32 } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { std, glowTex } from '../core/materials.js';

// clouds: soft painted puffs (sprites) gathered into banks; each bank is tinted by the sky and
// glows warm when it sits near a low sun
const clouds = [];
function puffTexture(seed) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 160;
  const ctx = cv.getContext('2d'), r = mulberry32(seed);
  for (let i = 0; i < 26; i++) {
    const x = 40 + r() * 176, y = 70 + (r() - 0.3) * 50 - Math.sin((x / 256) * Math.PI) * 30, rad = 18 + r() * 34;
    const g = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  // shade the underside blue-grey, keeping the shape
  ctx.globalCompositeOperation = 'source-atop';
  const v = ctx.createLinearGradient(0, 30, 0, 140);
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.55, 'rgba(200,210,228,0.35)'); v.addColorStop(1, 'rgba(140,152,178,0.85)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, 256, 160);
  const t = new THREE.CanvasTexture(cv);
  return t;
}
const FF = 170;
const ffSeed = [];
const ffGeo = new THREE.BufferGeometry();
export const ffMat = new THREE.PointsMaterial({ size: 0.32, map: glowTex, color: '#fff0a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
export const fireflies = new THREE.Points(ffGeo, ffMat);
export const butterflies = [];

// pollen and seed fluff, catching the light; its own random stream, so it can't move anything else
const PN = 260;
const pnSeed = [];
const pnGeo = new THREE.BufferGeometry();
export const pollenMat = new THREE.PointsMaterial({ size: 0.11, map: glowTex, color: '#fff1c2', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
export const pollen = new THREE.Points(pnGeo, pollenMat);
let pnDrift = 0;

export function buildPollen() {
  const r = mulberry32(7741);
  for (let i = 0; i < PN; i++) pnSeed.push({ x: (r() - 0.5) * 48, z: (r() - 0.5) * 48, y: 0.3 + r() * r() * 4.5, p: r() * TAU, s: 0.5 + r() });
  pnGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
  pollen.frustumCulled = false;
  scene.add(pollen);
}

export function buildClouds() {
  // the old low-poly clouds drew from the layout stream; take the same draws so everything
  // built after them stays where it was, and lay the new clouds out from their own stream
  for (let i = 0; i < 16; i++) { const n = 4 + Math.floor(rng() * 4); for (let k = 0; k < n * 4 + 4; k++) rng(); }
  const R = mulberry32(5150), cr = (a, b) => a + (b - a) * R();
  const texs = [11, 23, 37, 41].map(puffTexture);
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ map: texs[i % texs.length], transparent: true, depthWrite: false, fog: false });
    const n = 2 + Math.floor(R() * 3), w = cr(45, 80);
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(mat);
      sp.position.set((k - (n - 1) / 2) * w * 0.45 + cr(-6, 6), cr(-3, 4), cr(-8, 8));
      const s = w * cr(0.7, 1.1);
      sp.scale.set(s, s * 0.62, 1);
      g.add(sp);
    }
    const a = R() * TAU, r = cr(200, 320);
    g.position.set(Math.cos(a) * r, cr(70, 115), Math.sin(a) * r);
    g.userData.mat = mat;
    scene.add(g);
    clouds.push(g);
  }
}

const cTmp = new THREE.Vector3(), cCol = new THREE.Color();
/** Once a frame: clouds take the sky's cloud colour, glowing warm on the side of a low sun. */
export function tintClouds(cloudColor, glow, sunDir, camPos) {
  for (const c of clouds) {
    cTmp.copy(c.position).sub(camPos).normalize();
    const near = Math.pow(Math.max(0, cTmp.dot(sunDir)), 3);
    cCol.copy(cloudColor).lerp(glow, near * 0.6).multiplyScalar(1 + near * 0.35);
    c.userData.mat.color.copy(cCol);
  }
}

export function buildFireflies() {
  for (let i = 0; i < FF; i++) ffSeed.push({ x: rand(-32, 32), z: rand(-32, 32), y: rand(0.4, 2.2), p: rng() * TAU, s: rand(0.5, 1.1) });
  ffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FF * 3), 3));
  fireflies.frustumCulled = false;
  scene.add(fireflies);
}

export function buildButterflies() {
  const wingGeoL = new THREE.PlaneGeometry(0.17, 0.13).translate(-0.085, 0, 0).rotateX(-Math.PI / 2);
  const wingGeoR = new THREE.PlaneGeometry(0.17, 0.13).translate(0.085, 0, 0).rotateX(-Math.PI / 2);
  const bodyMat = std('#2b2622');
  const bodyGeo = new THREE.BoxGeometry(0.025, 0.025, 0.12);
  ['#f4c542', '#ffffff', '#f08ab0', '#8fc6f0', '#ffa552', '#f4c542', '#ffffff', '#c9a7f0', '#f08ab0', '#ffffff', '#8fc6f0', '#ffa552'].forEach((c) => {
    const wingMat = new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
    const g = new THREE.Group();
    const L = new THREE.Mesh(wingGeoL, wingMat), R = new THREE.Mesh(wingGeoR, wingMat);
    g.add(new THREE.Mesh(bodyGeo, bodyMat), L, R);
    scene.add(g);
    butterflies.push({ g, L, R, bx: rand(-26, 26), bz: rand(-26, 26), p: rng() * TAU, s: rand(0.6, 1.2), last: new THREE.Vector3() });
  });
}

/** Fireflies and butterflies wrap around `center` so there are always some nearby. */
export function updateAmbientLife(dt, t, center, dayLevel, wind) {
  if (pollen.visible) {
    pnDrift += dt * (0.25 + wind * 1.6);
    const arr = pnGeo.attributes.position.array;
    for (let i = 0; i < PN; i++) {
      const f = pnSeed[i];
      const x = wrap(f.x + pnDrift * 0.894 * f.s - center.x, -24, 24) + center.x + Math.sin(t * 0.21 * f.s + f.p) * 0.8;
      const z = wrap(f.z + pnDrift * 0.447 * f.s - center.z, -24, 24) + center.z + Math.cos(t * 0.17 * f.s + f.p) * 0.8;
      const y = Math.max(heightAt(x, z), 0) + f.y + Math.sin(t * 0.5 * f.s + f.p * 2.0) * 0.4;
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    pnGeo.attributes.position.needsUpdate = true;
  }
  if (fireflies.visible) {
    const arr = ffGeo.attributes.position.array;
    for (let i = 0; i < FF; i++) {
      const f = ffSeed[i];
      const x = wrap(f.x - center.x, -32, 32) + center.x + Math.sin(t * 0.3 * f.s + f.p) * 1.6;
      const z = wrap(f.z - center.z, -32, 32) + center.z + Math.cos(t * 0.25 * f.s + f.p * 1.3) * 1.6;
      const y = Math.max(heightAt(x, z), 0.1) + f.y + Math.sin(t * 0.8 + f.p) * 0.35;
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
    }
    ffGeo.attributes.position.needsUpdate = true;
    ffMat.size = 0.26 + Math.sin(t * 2.3) * 0.06;
  }
  if (dayLevel > 0.5) {
    for (const b of butterflies) {
      if (!b.g.visible) continue;
      const x = wrap(b.bx - center.x, -26, 26) + center.x + Math.sin(t * 0.32 * b.s + b.p) * 3.5;
      const z = wrap(b.bz - center.z, -26, 26) + center.z + Math.cos(t * 0.27 * b.s + b.p * 2.0) * 3.5;
      const y = Math.max(heightAt(x, z), 0.3) + 0.7 + Math.sin(t * 1.4 * b.s + b.p) * 0.35;
      const dx = x - b.last.x, dz = z - b.last.z;
      if (dx * dx + dz * dz > 1e-6) b.g.rotation.y = Math.atan2(dx, dz);
      b.g.position.set(x, y, z);
      b.last.set(x, y, z);
      const flap = Math.sin(t * 17 * b.s + b.p);
      b.L.rotation.z = flap; b.R.rotation.z = -flap;
    }
  }
  for (const c of clouds) {
    c.position.x += dt * (1.6 + wind * 7);
    if (c.position.x > 320) c.position.x = -320;
  }
}
