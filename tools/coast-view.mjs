// Dev tool: pictures of the coast nearest home, four ways out from it (needs npm run dev): stands 70 m back from the first sea and looks out. SEED=7.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 7) + '&weather=clear&season=summer#15');
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
await p.waitForTimeout(3000);
const spots = await p.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'));
  const S = await import(url), H = S.HOME, out = [];
  // walk out from home in a few directions to the first sea; stand 60 m back on land, look out
  for (const a of [0.3, 2.0, 3.6, 5.1]) {
    let prev = null;
    for (let r = 2000; r < 9000; r += 20) { const x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r; if (S.seaAt(x, z) > 0 && S.height(x, z) < -0.5) { const bx = H.x + Math.cos(a) * (r - 70), bz = H.z + Math.sin(a) * (r - 70); out.push({ x: bx, z: bz, lx: x + Math.cos(a) * 400, lz: z + Math.sin(a) * 400, r, h: +S.height(bx, bz).toFixed(1), c: S.continentAt(x, z).name }); break; } }
  }
  return out;
});
console.log(JSON.stringify(spots));
for (const [k, s] of spots.entries()) {
  await p.evaluate((s) => { const m = window.__meadow; m.travelTo(s.x, s.z, s.lx, s.lz); m.camState.pitch = 0.25; m.camState.dist = 12; }, s);
  await p.waitForTimeout(14000);
  await p.screenshot({ path: `e:/Games/_assets/previews/coast-${k}.png` });
}
await b.close();
