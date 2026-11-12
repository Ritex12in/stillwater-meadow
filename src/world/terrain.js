// The ground: one flat-shaded mesh with painted vertex colours (grass, sand, path, moss, rock).
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { smooth, fbm } from '../core/math.js';
import { height, lakeT, pathAmt, TERRAIN, bakeHeights } from '../core/shape.js';
import { col, weatherize } from '../core/materials.js';
import { world } from '../core/state.js';

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.seg, TERRAIN.seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const g1 = col('#6e9a48'), g2 = col('#9dbf5d'), g3 = col('#4b7a3a'), sand = col('#dcc895'), bed = col('#7a7856');
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
  const terrain = new THREE.Mesh(geo, weatherize(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }), 'std'));
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);
  world.terrain = terrain;
}
