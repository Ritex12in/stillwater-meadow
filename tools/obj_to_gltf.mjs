// Convert OBJ models to minimal glTF (positions, normals, UVs; one primitive per material, named
// after the OBJ material), for packs whose glTF folder is incomplete.
//
//     node tools/obj_to_gltf.mjs <out folder> <model.obj> [<model.obj> ...]
//
// Uses three's own OBJ reader. No textures are referenced: the game builds its own materials.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

const [out, ...files] = process.argv.slice(2);
if (!out || !files.length) { console.error('usage: node tools/obj_to_gltf.mjs <out folder> <model.obj> ...'); process.exit(1); }
mkdirSync(out, { recursive: true });

for (const file of files) {
  const name = basename(file, '.obj');
  const root = new OBJLoader().parse(readFileSync(file, 'utf8'));
  const chunks = [], views = [], accessors = [], primitives = [], materials = [], matIndex = new Map();
  let offset = 0;
  const addView = (array, target) => {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    chunks.push(bytes, Buffer.alloc(pad));
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    offset += bytes.length + pad;
    return views.length - 1;
  };
  const addAccessor = (array, itemSize, withBounds) => {
    const acc = { bufferView: addView(array, 34962), componentType: 5126, count: array.length / itemSize, type: { 2: 'VEC2', 3: 'VEC3' }[itemSize] };
    if (withBounds) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], array[i + k]); max[k] = Math.max(max[k], array[i + k]); }
      acc.min = min; acc.max = max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    for (const grp of groups) {
      const mname = (mats[grp.materialIndex] || mats[0]).name || 'Material';
      if (!matIndex.has(mname)) { matIndex.set(mname, materials.length); materials.push({ name: mname, doubleSided: true }); }
      const slice = (attr) => attr && attr.array.slice(grp.start * attr.itemSize, (grp.start + grp.count) * attr.itemSize);
      const P = slice(g.attributes.position), N = slice(g.attributes.normal), U = slice(g.attributes.uv);
      // OBJ comes in as separate triangles; share the corners that match exactly
      const seen = new Map(), pos = [], nor = [], uvs = [], idx = [];
      for (let v = 0; v < grp.count; v++) {
        const uvv = U ? [U[v * 2], 1 - U[v * 2 + 1]] : []; // OBJ's v runs up, glTF's down
        const key = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2], N ? N[v * 3] : 0, N ? N[v * 3 + 1] : 0, N ? N[v * 3 + 2] : 0, ...uvv].map((x) => x.toFixed(5)).join(',');
        let i = seen.get(key);
        if (i === undefined) {
          i = pos.length / 3; seen.set(key, i);
          pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          if (N) nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
          if (U) uvs.push(...uvv);
        }
        idx.push(i);
      }
      const attributes = { POSITION: addAccessor(new Float32Array(pos), 3, true) };
      if (N) attributes.NORMAL = addAccessor(new Float32Array(nor), 3);
      if (U) attributes.TEXCOORD_0 = addAccessor(new Float32Array(uvs), 2);
      const big = pos.length / 3 > 65535, ia = big ? new Uint32Array(idx) : new Uint16Array(idx);
      const iv = addView(ia, 34963);
      accessors.push({ bufferView: iv, componentType: big ? 5125 : 5123, count: ia.length, type: 'SCALAR' });
      primitives.push({ attributes, indices: accessors.length - 1, material: matIndex.get(mname) });
    }
  });
  const bin = Buffer.concat(chunks);
  const gltf = {
    asset: { version: '2.0', generator: 'stillwater obj_to_gltf' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }], meshes: [{ name, primitives }],
    materials, accessors, bufferViews: views, buffers: [{ uri: name + '.bin', byteLength: bin.length }],
  };
  writeFileSync(join(out, name + '.gltf'), JSON.stringify(gltf));
  writeFileSync(join(out, name + '.bin'), bin);
  console.log(name, primitives.length, 'parts', (bin.length / 1024).toFixed(0) + ' KB');
}
