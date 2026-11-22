import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const out = [];
for (const q of ['auto', 'low']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://127.0.0.1:8080/?seed=1&weather=clear&season=summer#12');
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 240000 });
  await p.evaluate(async (q) => { const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('/src/systems/quality.js')); if (q !== 'auto') (await import(url)).setQuality(q); window.__meadow.travelTo(285, 277, 318, 261); }, q);
  await p.waitForTimeout(8000);
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 5000) res(Math.round(n / 5)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  out.push(q + ' ' + fps);
  await p.close();
}
console.log(process.argv[2], out.join('  '));
await b.close();
