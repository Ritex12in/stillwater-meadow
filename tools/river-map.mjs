// Sweep and map the rivers round home: counts, lengths, falls, and a top-down picture.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear&season=summer#12');
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 120000 });
const R = +(process.env.R || 6000);
const out = await p.evaluate(async (R) => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'));
  const S = await import(url), H = S.HOME;
  const t0 = performance.now();
  const list = S.riversNear(H.x, H.z, R);
  const ms = performance.now() - t0;
  const info = list.map((r) => {
    let falls = 0, fallDrop = 0, steep = 0;
    for (let i = 0; i < r.n - 1; i++) { const seg = Math.hypot(r.x[i + 1] - r.x[i], r.z[i + 1] - r.z[i]), dr = (r.lv[i] - r.lv[i + 1]) / Math.max(0.5, seg); if (dr > 0.6) { steep++; fallDrop += r.lv[i] - r.lv[i + 1]; } }
    let cut = 0; for (let i = 0; i < r.n; i++) cut = Math.max(cut, r.g[i] - r.lv[i]);
    return { id: r.id, len: Math.round(r.len), end: r.end.split(':')[0], top: Math.round(r.lv[0]), steepSteps: steep, steepDrop: Math.round(fallDrop), maxCut: +cut.toFixed(1), dHome: Math.round(Math.min(...Array.from(r.x, (x, i) => Math.hypot(x - H.x, r.z[i] - H.z)))) };
  });
  // picture
  const N = 600, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = H.x - R + (i / N) * 2 * R, z = H.z - R + (j / N) * 2 * R, sea = S.seaAt(x, z), L = S.lakeAt(x, z).t(x, z);
    const h = S.rawHeight(x, z), k = (j * N + i) * 4, v = Math.max(0, Math.min(1, h / 120));
    if (sea > 0.2 && h < 0.2) { img.data[k] = 60; img.data[k + 1] = 110; img.data[k + 2] = 190; }
    else if (L < 1) { img.data[k] = 70; img.data[k + 1] = 140; img.data[k + 2] = 220; }
    else { img.data[k] = 90 + 150 * v; img.data[k + 1] = 140 + 100 * v; img.data[k + 2] = 80 + 160 * v; }
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const P = (x, z) => [(x - H.x + R) / (2 * R) * N, (z - H.z + R) / (2 * R) * N];
  for (const r of list) {
    for (let i = 0; i < r.n - 1; i++) { const seg = Math.hypot(r.x[i + 1] - r.x[i], r.z[i + 1] - r.z[i]), dr = (r.lv[i] - r.lv[i + 1]) / Math.max(0.5, seg); g.strokeStyle = dr > 0.6 ? '#ff3030' : '#1030c0'; g.lineWidth = 2; g.beginPath(); g.moveTo(...P(r.x[i], r.z[i])); g.lineTo(...P(r.x[i + 1], r.z[i + 1])); g.stroke(); }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(...P(r.spring.x, r.spring.z), 3, 0, 7); g.fill();
  }
  g.fillStyle = '#ff00ff'; g.beginPath(); g.arc(...P(H.x, H.z), 5, 0, 7); g.fill();
  return { ms: Math.round(ms), count: list.length, total: S.rivers.length, info, png: c.toDataURL('image/png') };
}, R);
writeFileSync('e:/Games/_assets/previews/rivers-map.png', Buffer.from(out.png.split(',')[1], 'base64'));
delete out.png;
console.log(JSON.stringify({ ms: out.ms, count: out.count, total: out.total }));
for (const r of out.info) console.log(JSON.stringify(r));
await b.close();
