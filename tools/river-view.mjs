// Dev tool: pictures of a river (needs npm run dev). RID=-1:-1 picks one; BIG=1 the biggest fall within 2.5 km; DOWN=1 looks downstream; PITCH tilts the camera;
// SHOTS='[["name", metres downstream of the fall, metres to the side]]'. Writes e:/Games/_assets/previews/river-<name>.png
// Go to the nearest river with a fall (or ?id), stand beside it looking upstream at the fall, and take pictures.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CON', m.text().slice(0, 300)); });
await p.goto('http://127.0.0.1:8080/?seed=1&weather=clear&season=' + (process.env.SEASON || 'summer') + '&rid=' + (process.env.RID || '') + (process.env.BIG ? '&big=1' : '') + '&pitch=' + (process.env.PITCH || 0.32) + (process.env.DOWN ? '&down=1' : '') + '&far=' + (process.env.FAR || 0) + '#' + (process.env.HOUR || 12));
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 120000 });
await p.waitForTimeout(4000);
const shots = JSON.parse(process.env.SHOTS || '[["fall", 26, 6], ["calm", 0, 14]]');
const info = await p.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'));
  const S = await import(url), H = S.HOME;
  const list = S.riversNear(H.x, H.z, 2500).map((r) => ({ r, d: Math.min(...Array.from(r.x, (x, i) => Math.hypot(x - H.x, r.z[i] - H.z))) })).sort((a, b) => a.d - b.d);
  const q = new URLSearchParams(location.search), want = q.get('rid');
  let pick = (want && list.find((o) => o.r.id === want)) || null, fi = -1;
  if (!pick && q.get('big')) { let best = 0; for (const o of list) for (let i = 0; i < o.r.n - 1; i++) if (o.r.fall[i] && o.r.lv[i] - o.r.lv[i + 1] > best) { best = o.r.lv[i] - o.r.lv[i + 1]; pick = o; fi = i; } }
  pick = pick || list.find((o) => o.r.fall.some((f) => f)) || list[0];
  const r = pick.r; if (fi < 0) fi = r.fall.findIndex((f) => f);
  window.__riv = { r, fi: Math.max(0, fi) };
  return { drop: +(r.lv[Math.max(0, fi)] - r.lv[Math.max(0, fi) + 1]).toFixed(1), id: r.id, n: r.n, len: Math.round(r.len), falls: r.fall.reduce((a, f) => a + f, 0), fi, lvTop: r.lv[0], end: r.end };
});
console.log(JSON.stringify(info));
for (const [name, back, side] of shots) {
  await p.evaluate(([back, side]) => {
    const m = window.__meadow, { r, fi } = window.__riv;
    const i = Math.max(0, Math.min(r.n - 2, fi + Math.round(back / 6))), tx = r.x[i + 1] - r.x[i], tz = r.z[i + 1] - r.z[i], tl = Math.hypot(tx, tz) || 1;
    const x = r.x[i] - tz / tl * side, z = r.z[i] + tx / tl * side; // beside the river, downstream of the fall
    const look = new URLSearchParams(location.search).get('down') ? r.n - 1 : fi, far = +(new URLSearchParams(location.search).get('far') || 0);
    if (far) { // from the highest of 16 spots `far` metres off the river's middle, looking at it
      const c = r.n >> 1; let best = null;
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, px = r.x[c] + Math.cos(a) * far, pz = r.z[c] + Math.sin(a) * far, h = m.geo.height(px, pz); if (h > 0.5 && (!best || h > best.h)) best = { x: px, z: pz, h }; }
      m.travelTo(best.x, best.z, r.x[c], r.z[c]);
    } else m.travelTo(x, z, r.x[look], r.z[look]);
    m.camState.pitch = +(new URLSearchParams(location.search).get('pitch') || 0.32); m.camState.dist = 9;
  }, [back, side]);
  await p.waitForTimeout(6000);
  await p.screenshot({ path: `e:/Games/_assets/previews/river-${name}.png` });
}
const st = await p.evaluate(() => ({ shown: window.__meadow.riversShown().length, walk: window.__meadow.player }));
console.log('shown', st.shown);
await b.close();
