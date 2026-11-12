// Drifting clouds, fireflies at dusk and butterflies by day.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { TAU, rng, rand, wrap } from '../core/math.js';
import { heightAt } from '../core/shape.js';
import { std, glowTex } from '../core/materials.js';

export const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, flatShading: true, roughness: 1, fog: false });
const clouds = [];

const FF = 170;
const ffSeed = [];
const ffGeo = new THREE.BufferGeometry();
export const ffMat = new THREE.PointsMaterial({ size: 0.32, map: glowTex, color: '#fff0a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
export const fireflies = new THREE.Points(ffGeo, ffMat);
export const butterflies = [];

export function buildClouds() {
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(5, 9), 1), cloudMat);
      m.position.set(k * rand(5, 7) - n * 3, rand(-1, 2), rand(-3, 3));
      m.scale.y = 0.55;
      g.add(m);
    }
    const a = rng() * TAU, r = rand(170, 300);
    g.position.set(Math.cos(a) * r, rand(75, 120), Math.sin(a) * r);
    g.rotation.y = rand(-0.3, 0.3);
    scene.add(g);
    clouds.push(g);
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
