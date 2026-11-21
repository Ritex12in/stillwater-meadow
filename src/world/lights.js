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

// The shadow square follows you. Moved freely, its texel grid slides across the ground and every
// shadow edge crawls as you walk; snapping its centre to whole texels (in the light's own
// right/up axes, the same ones three's lookAt gives the shadow camera) keeps the edges still.
const lx = new THREE.Vector3(), ly = new THREE.Vector3(), lz = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), c = new THREE.Vector3();
/** Put the sun (or moon) light `dist` away along `lightDir`, aimed at `center`, snapped to the shadow map's texels. */
export function placeSun(center, lightDir, dist = 140) {
  c.copy(center);
  lz.copy(lightDir).normalize();
  lx.crossVectors(UP, lz);
  if (lx.lengthSq() > 1e-6) {
    lx.normalize();
    ly.crossVectors(lz, lx);
    const cam = sun.shadow.camera, texel = (cam.right - cam.left) / sun.shadow.mapSize.x;
    const sx = Math.round(c.dot(lx) / texel) * texel, sy = Math.round(c.dot(ly) / texel) * texel, sz = c.dot(lz);
    c.copy(lx).multiplyScalar(sx).addScaledVector(ly, sy).addScaledVector(lz, sz);
  }
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(lz, dist);
}
