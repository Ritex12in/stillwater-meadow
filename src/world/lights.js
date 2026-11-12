// Sky light, a little ambient fill, and the sun (or moon) with shadows.
import * as THREE from 'three';
import { scene } from '../core/render.js';

export const hemi = new THREE.HemisphereLight(0xffffff, 0x556633, 0.6);
export const ambient = new THREE.AmbientLight(0xffffff, 0.15);
export const sun = new THREE.DirectionalLight(0xffffff, 1.2);

export function buildLights() {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 320 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, ambient, sun, sun.target);
}

/** Change the shadow map resolution (quality settings). */
export function setShadowSize(size) {
  if (sun.shadow.mapSize.x === size) return;
  sun.shadow.mapSize.set(size, size);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
}
