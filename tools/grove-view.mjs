// Dev tool: pictures of what the cherry blossom valley has so far (needs `npm run dev`): a trail through a
// grove with its lanterns by day and at dusk, a great old cherry, a garden bridge and a spotted deer if any
// is found near home. Pictures to e:/Games/_assets/previews/grove2-*.png. SEED=1.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const out = 'e:/Games/_assets/previews/grove2-';
for (const [hash, tag] of [['#16.5', 'day'], ['#19.3', 'dusk']]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
  await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear&season=spring' + hash);
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  await p.waitForTimeout(3000);
  await p.addStyleTag({ content: 'body > *:not(canvas):not(#world) { display: none !important; }' });
  const found = await p.evaluate(async () => {
    const m = window.__meadow, url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')), S = await import(url), H = m.home, res = {};
    // lanterns: the spot near home with the most of them about
    for (const pg of S.sitesNear(H.x, H.z, 6000, 'pagoda')) {
      const l = m.lanternSpots(pg.x, pg.z, 300); if (l.length < 8) continue;
      // stand on the trail between the two lanterns nearest the pagoda, looking along the row
      l.sort((p, q) => Math.hypot(p.x - pg.x, p.z - pg.z) - Math.hypot(q.x - pg.x, q.z - pg.z));
      const far = l[Math.min(l.length - 1, 6)];
      res.lanterns = { n: l.length, x: (l[0].x + l[1].x) / 2, z: (l[0].z + l[1].z) / 2, fx: far.x, fz: far.z, pagoda: Math.round(Math.hypot(pg.x - H.x, pg.z - H.z)) };
      break;
    }
    // a garden bridge: a river in a grove with a trail over it
    for (const rv of S.riversNear(H.x, H.z, 5000)) { const br = S.bridgesOf(rv).find((q) => q.grove > 0.5); if (br) { res.bridge = { x: br.x - br.ux * (br.half + 5) + br.uz * 3, z: br.z - br.uz * (br.half + 5) - br.ux * 3, fx: br.x, fz: br.z, arch: +br.arch.toFixed(2), far: Math.round(Math.hypot(br.x - H.x, br.z - H.z)) }; break; } }
    // a great old cherry
    for (let r = 300; r < 5000 && !res.giant; r += 60) for (let a = 0; a < 6.28 && !res.giant; a += 0.2) { const x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r; if (S.groveAt(x, z) < 0.75 || m.climate(x, z).cold > 0.08) continue; /* (in mild country: a cold grove is still bare in spring) */ const t = m.wilds.square(Math.floor(x / 57.6), Math.floor(z / 57.6)).find((q) => q.type === 'blossom' && q.s > 2.2); if (t) res.giant = { x: t.x, z: t.z, s: +t.s.toFixed(2) }; }
    return res;
  });
  if (tag === 'day') console.log(JSON.stringify(found));
  const shot = async (name, at, dist, pitch) => { await p.evaluate(([at, dist, pitch]) => { const m = window.__meadow; m.travelTo(at.x, at.z, at.fx, at.fz); m.camState.dist = dist; m.camState.pitch = pitch; }, [at, dist, pitch]); await p.waitForTimeout(13000); await p.screenshot({ path: out + name + '-' + tag + '.png' }); };
  if (found.lanterns && !process.env.GIANT) await shot('lanterns', found.lanterns, 7, 0.14);
  if (found.giant) await shot('great-cherry', { x: found.giant.x + 15, z: found.giant.z + 10, fx: found.giant.x, fz: found.giant.z }, 11, 0.04);
  if (found.bridge && tag === 'day') await shot('bridge', found.bridge, 8, 0.2);
  if (tag === 'day') console.log('lanterns standing:', await p.evaluate(() => window.__meadow.trailsideShown()));
  await p.close();
}
await b.close();
