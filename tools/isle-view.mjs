// Dev tool: pictures of the islands nearest home (needs npm run dev). SEASON=winter, HOUR=22; N how many islands; DIST metres back from the shore.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear&season=' + (process.env.SEASON || 'summer') + '#' + (process.env.HOUR || 12));
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 120000 });
await p.waitForTimeout(3000);
const list = await p.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'));
  const S = await import(url), H = S.HOME, all = S.lakesNear(H.x, H.z, 3000), isles = all.filter((L) => L.isle);
  return { lakes: all.length, big: all.filter((L) => L.R0 >= 24).length, isles: isles.map((L) => ({ id: L.id, x: L.x, z: L.z, ix: L.isle.x, iz: L.isle.z, r: +L.isle.r.toFixed(1), top: +L.isle.top.toFixed(1), frozen: L.frozen, R0: +L.R0.toFixed(1), d: Math.round(Math.hypot(L.x - H.x, L.z - H.z)), ground: +S.height(L.isle.x, L.isle.z).toFixed(2), mid: +S.height(L.x, L.z).toFixed(2) })).sort((a, b) => a.d - b.d) };
});
console.log(JSON.stringify({ lakes: list.lakes, big: list.big, isles: list.isles.length }));
for (const I of list.isles.slice(0, 4)) console.log(JSON.stringify(I));
for (const [k, I] of list.isles.slice(0, +(process.env.N || 2)).entries()) {
  await p.evaluate((I) => {
    const m = window.__meadow, ax = I.ix - I.x, az = I.iz - I.z, al = Math.hypot(ax, az) || 1;
    // on the far shore from the island, looking across the water at it
    const sa = Math.atan2(az, ax) + 1.9; // (round the shore to the side, so the island is seen across open water)
    let x = I.x + Math.cos(sa) * I.R0, z = I.z + Math.sin(sa) * I.R0;
    for (let k = 0; k < 40; k++) { if (m.geo.height(x, z) > 0.4) break; x += Math.cos(sa) * 2; z += Math.sin(sa) * 2; }
    m.travelTo(x, z, I.ix, I.iz); m.camState.pitch = 0.15; m.camState.dist = 9;
  }, I);
  await p.waitForTimeout(+(process.env.WAIT || 14000));
  await p.screenshot({ path: `e:/Games/_assets/previews/isle-${k}${process.env.SEASON ? '-' + process.env.SEASON : ''}.png` });
}
await b.close();
