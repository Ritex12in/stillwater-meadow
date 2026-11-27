// Dev tool: pictures of the harbour nearest home (needs npm run dev): from the shore beside it, by day and
// at dusk; then a passage across, and the harbour you arrive at. SEED=7.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const out = 'e:/Games/_assets/previews/';
for (const hour of [15, 19.6]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 7) + '&weather=clear&season=summer#' + hour);
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  await p.waitForTimeout(2000);
  const h = await p.evaluate(() => { const m = window.__meadow, H = m.home; m.travelTo(H.x + 1, H.z + 1); return null; });
  const info = await p.evaluate(() => { const v = window.__meadow.harbours; return { h: v.near[0], passages: v.passages }; });
  if (hour === 15) console.log(JSON.stringify(info));
  const H = info.h, dx = H.x - H.ax, dz = H.z - H.az, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
  // stand on the shore to one side, looking along the jetty out to sea
  await p.evaluate(([H, ux, uz]) => { const m = window.__meadow; const sx = H.ax - uz * 9 - ux * 4, sz = H.az + ux * 9 - uz * 4; m.travelTo(sx, sz, H.x + ux * 10, H.z + uz * 10); m.camState.pitch = 0.22; m.camState.dist = 9; }, [H, ux, uz]);
  await p.waitForTimeout(12000);
  await p.screenshot({ path: out + `harbour-${hour === 15 ? 'day' : 'dusk'}.png` });
  if (hour === 15) {
    await p.evaluate((H) => { const m = window.__meadow; m.travelTo(H.ax, H.az, H.x, H.z); }, H);
    await p.waitForTimeout(3000);
    console.log('at the jetty:', JSON.stringify(await p.evaluate(() => ({ at: window.__meadow.harbours.at, actions: window.__meadow.actions().map((a) => a.label) }))));
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: out + 'harbour-panel.png' });
    await p.evaluate(() => document.querySelector('#harbourList button').click());
    await p.waitForTimeout(12000);
    console.log('after sailing:', JSON.stringify(await p.evaluate(() => { const m = window.__meadow, v = m.harbours; return { at: v.near[0] && v.near[0].name, known: v.known.map((k) => k.name), far: Math.round(Math.hypot(m.player.x - m.home.x, m.player.z - m.home.z)), points: m.waypoints.points.map((q) => q.kind) }; })));
    await p.screenshot({ path: out + 'harbour-arrived.png' });
    await p.keyboard.press('KeyM'); await p.waitForTimeout(400);
    await p.evaluate(() => { document.getElementById('mapOut').click(); document.getElementById('mapOut').click(); document.getElementById('mapOut').click(); document.getElementById('mapOut').click(); });
    await p.waitForTimeout(300);
    await p.evaluate(() => window.__meadow.map.settle());
    await p.waitForTimeout(500);
    await p.screenshot({ path: out + 'harbour-map.png' });
  }
  await p.close();
}
await b.close();
