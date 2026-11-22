//   node tools/face-profile.mjs public/assets/characters/vroid/e.vrm
// The face outline of a VRoid model: half-width at each height, and the front's depth down the middle, normalised to the head.
import { readFileSync } from 'node:fs';
const file = process.argv[2];
const glb = readFileSync(file), jl = glb.readUInt32LE(12), J = JSON.parse(glb.subarray(20, 20 + jl).toString('utf8'));
const bs = 20 + jl + 8, bin = glb.subarray(bs);
const acc = (i) => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], off = (v.byteOffset || 0) + (a.byteOffset || 0), n = a.count, out = new Float32Array(n * 3); const stride = v.byteStride || 12; for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) out[k * 3 + c] = bin.readFloatLE(off + k * stride + c * 4); return out; };
const face = J.meshes.find((m) => /Face/.test(m.name));
let pts = [];
for (const p of face.primitives) {
  const mat = J.materials[p.material].name;
  if (!/SKIN/i.test(mat)) continue;
  const pos = acc(p.attributes.POSITION);
  for (let k = 0; k < pos.length; k += 3) pts.push([pos[k], pos[k + 1], pos[k + 2]]);
  console.log('material', mat, pos.length / 3);
}
const ys = pts.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), H = y1 - y0;
// (VRM 0.x faces -z: the front is the most negative z)
const zs = pts.map((q) => q[2]), zf = Math.min(...zs), zb = Math.max(...zs);
const W = Math.max(...pts.map((q) => Math.abs(q[0])));
console.log('height', H.toFixed(3), 'half-width', W.toFixed(3), 'depth', (zb - zf).toFixed(3));
for (let i = 0; i <= 20; i++) {
  const y = y0 + (H * i) / 20, band = pts.filter((q) => Math.abs(q[1] - y) < H / 40);
  if (!band.length) continue;
  const hw = Math.max(...band.map((q) => Math.abs(q[0])));
  const mid = band.filter((q) => Math.abs(q[0]) < W * 0.08), front = mid.length ? Math.min(...mid.map((q) => q[2])) : NaN;
  const side = band.filter((q) => Math.abs(Math.abs(q[0]) - hw * 0.7) < W * 0.08), sideFront = side.length ? Math.min(...side.map((q) => q[2])) : NaN;
  console.log(`${(i / 20).toFixed(2)}  halfwidth ${(hw / W).toFixed(2)}  front ${((front - zf) / (zb - zf)).toFixed(2)}  front@0.7w ${((sideFront - zf) / (zb - zf)).toFixed(2)}`);
}
