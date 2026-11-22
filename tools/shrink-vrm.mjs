// Shrink a VRM / GLB's textures (to at most MAX px, re-encoded as WebP, which keeps transparency; via
// the browser's canvas), keeping everything else. three.js decodes the images by their type.
//   node tools/shrink-vrm.mjs in.vrm out.vrm [max=1024]
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const [, , inFile, outFile, maxArg] = process.argv, MAX = +(maxArg || 1024);
const glb = readFileSync(inFile);
const jsonLen = glb.readUInt32LE(12), json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8, bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));
const view = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
const b = await chromium.launch({ channel: 'chrome' });
const p = await (await b.newContext()).newPage();
const replaced = new Map();
for (const im of json.images || []) {
  if (im.bufferView === undefined || replaced.has(im.bufferView)) continue;
  const src = view(im.bufferView).toString('base64');
  const out = await p.evaluate(async ([src, mime, MAX]) => {
    const bytes = Uint8Array.from(atob(src), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: mime }));
    const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await c.convertToBlob({ type: 'image/webp', quality: 0.9 });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, [src, im.mimeType || 'image/png', MAX]);
  if (out) { replaced.set(im.bufferView, Buffer.from(out, 'base64')); im.mimeType = 'image/webp'; }
}
await b.close();
// rebuild the binary chunk, view by view
const parts = []; let off = 0;
json.bufferViews.forEach((v, i) => {
  const data = replaced.get(i) || view(i);
  const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); off += pad; }
  v.byteOffset = off; v.byteLength = data.length; parts.push(data); off += data.length;
});
const padB = (4 - (off % 4)) % 4; if (padB) parts.push(Buffer.alloc(padB));
const newBin = Buffer.concat(parts); json.buffers[0].byteLength = newBin.length;
let js = Buffer.from(JSON.stringify(json), 'utf8'); const padJ = (4 - (js.length % 4)) % 4; js = Buffer.concat([js, Buffer.alloc(padJ, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + newBin.length, 8);
const ch = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };
writeFileSync(outFile, Buffer.concat([head, ch(js.length, 0x4E4F534A), js, ch(newBin.length, 0x004E4942), newBin]));
console.log(`${inFile}: ${(glb.length / 1e6).toFixed(1)} MB -> ${outFile}: ${((12 + 16 + js.length + newBin.length) / 1e6).toFixed(1)} MB (${replaced.size} textures resized)`);
