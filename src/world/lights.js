// Sky light, a little ambient fill, and the sun (or moon) with shadows.
import * as THREE from 'three';
import { scene } from '../core/render.js';

// Shadows only cover a square around you; instead of stopping at its edge, they thin out over the
// outer part of it. (Patches three's shadow lookup; the square is set in buildLights.)
const EDGE = 0.15; // fade width, as a share of the square's side (0.15 × 120 m = the outer 18 m)
const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
THREE.ShaderChunk.shadowmap_pars_fragment = chunk.replace(/return shadow;(\s*)\}(\s*)vec2 cubeToUV/, `float shadowEdge = min( min( shadowCoord.x, 1.0 - shadowCoord.x ), min( shadowCoord.y, 1.0 - shadowCoord.y ) );
\t\treturn mix( 1.0, shadow, smoothstep( 0.0, ${EDGE.toFixed(3)}, shadowEdge ) );$1}$2vec2 cubeToUV`);
if (THREE.ShaderChunk.shadowmap_pars_fragment === chunk) console.warn('Shadow edge fade: shadow shader code not as expected.');

export const hemi = new THREE.HemisphereLight(0xffffff, 0x556633, 0.6);
export const ambient = new THREE.AmbientLight(0xffffff, 0.15);
export const sun = new THREE.DirectionalLight(0xffffff, 1.2);

export function buildLights() {
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 320 });
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
