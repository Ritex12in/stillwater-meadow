// The ground: one smooth-shaded mesh with painted vertex colours (grass, sand, path, moss, rock),
// plus fine colour variation painted per pixel so the surface doesn't read as big flat triangles.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { smooth, fbm } from '../core/math.js';
import { height, lakeT, pathAmt, TERRAIN, bakeHeights } from '../core/shape.js';
import { col, weatherize, camU } from '../core/materials.js';
import { world } from '../core/state.js';

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.seg, TERRAIN.seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const g1 = col('#5c9040'), g2 = col('#86b44e'), g3 = col('#3d7034'), sand = col('#dcc895'), bed = col('#7a7856');
  const dirt = col('#c4ab7c'), moss = col('#5c7444'), rock = col('#8d8b7d');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = height(x, z);
    p.setY(i, h);
    c.copy(g1).lerp(g2, smooth(0.35, 0.7, fbm(x * 0.05 + 11, z * 0.05 - 3)));
    c.lerp(g3, smooth(0.5, 0.75, fbm(x * 0.11 - 5, z * 0.11 + 8)) * 0.6);
    c.lerp(sand, 1 - smooth(1.02, 1.16, lakeT(x, z)));
    c.lerp(bed, smooth(0.05, -0.8, h));
    c.lerp(dirt, pathAmt(x, z) * 0.9);
    c.lerp(moss, smooth(6, 12, h) * 0.6);
    c.lerp(rock, smooth(13, 24, h) * 0.85);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  bakeHeights(p);
  const terrain = new THREE.Mesh(geo, weatherize(groundDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })), 'std'));
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);
  world.terrain = terrain;
}

/**
 * Per-pixel variation on top of the vertex colours: broad patches of lighter and darker grass,
 * metre-scale mottling, and a fine grain that fades out with distance (so it doesn't shimmer).
 */
function groundDetail(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCam = camU;
    sh.vertexShader = 'varying vec3 vGround;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vGround = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'varying vec3 vGround;\nuniform vec3 uCam;\n' + `
      float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float gNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
    ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 q = vGround.xz;
        float d = length(vGround - uCam);
        float broad = gNoise(q * 0.045) * 0.6 + gNoise(q * 0.11) * 0.4;
        float mid = gNoise(q * 0.55) * 0.6 + gNoise(q * 1.3) * 0.4;
        float grain = gNoise(q * 4.0) * 0.5 + gNoise(q * 9.0) * 0.5;
        float nearK = 1.0 - smoothstep(12.0, 40.0, d);
        float shade = (broad - 0.5) * 0.18 + (mid - 0.5) * 0.24 + (grain - 0.5) * 0.22 * nearK;
        diffuseColor.rgb *= 1.0 + shade;
        // sunlit patches lean yellow-green, shaded ones blue-green
        diffuseColor.rgb += vec3(0.025, 0.02, -0.02) * (broad - 0.5) * 2.0;
      }`);
  };
  mat.customProgramCacheKey = () => 'ground';
  return mat;
}
