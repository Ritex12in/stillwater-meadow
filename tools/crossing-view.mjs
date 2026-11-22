// Dev tool: pictures of the nearest bridge and stepping stones (needs npm run dev), and a walk across each.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear&season=' + (process.env.SEASON || 'summer') + '#' + (process.env.HOUR || 12));
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 120000 });
await p.waitForTimeout(2000);
const spots = await p.evaluate(async (k) => {
  const url = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
  const S = await import(url('/src/core/shape.js')), H = S.HOME, all = [];
  for (const r of S.riversNear(H.x, H.z, 6000)) for (const b of S.bridgesOf(r)) all.push(b);
  all.sort((a, b) => Math.hypot(a.x - H.x, a.z - H.z) - Math.hypot(b.x - H.x, b.z - H.z));
  const B = all[k], L = S.lakesNear(H.x, H.z, 3000).filter((v) => v.isle).sort((a, b) => Math.hypot(a.x - H.x, a.z - H.z) - Math.hypot(b.x - H.x, b.z - H.z))[k], st = S.stonesOf(L);
  return { b: { x: B.x, z: B.z, ux: B.ux, uz: B.uz, half: B.half }, s: { ax: st.ax, az: st.az, bx: st.bx, bz: st.bz } };
}, +(process.env.K || 0));
const shot = async (name, x, z, fx, fz, pitch) => { await p.evaluate(([x, z, fx, fz, pitch]) => { const m = window.__meadow; m.travelTo(x, z, fx, fz); m.camState.pitch = pitch; m.camState.dist = 8; }, [x, z, fx, fz, pitch]); await p.waitForTimeout(9000); await p.screenshot({ path: `e:/Games/_assets/previews/${name}.png` }); };
const B = spots.b, S = spots.s;
// the bridge from the trail, then from beside the river
if (!process.env.NOSHOT) await shot('bridge', B.x - B.ux * (B.half + 9), B.z - B.uz * (B.half + 9), B.x, B.z, 0.12);
if (!process.env.NOSHOT) await shot('bridge-side', B.x - B.uz * 12 - B.ux * 3, B.z + B.ux * 12 - B.uz * 3, B.x, B.z, 0.1);
// the stepping stones from the shore
const dx = S.bx - S.ax, dz = S.bz - S.az, dl = Math.hypot(dx, dz);
if (!process.env.NOSHOT) await shot('stones', S.ax - dx / dl * 4 - dz / dl * 3, S.az - dz / dl * 4 + dx / dl * 3, S.bx, S.bz, 0.25);
// walk across each: hold W from one end and see where you get to, and how high you stood
const walk = async (x, z, fx, fz, secs) => {
  await p.evaluate(([x, z, fx, fz]) => { const m = window.__meadow; m.travelTo(x, z, fx, fz); }, [x, z, fx, fz]);
  await p.waitForTimeout(2500);
  await p.mouse.click(640, 400).catch(() => {});
  let lowest = 99;
  await p.keyboard.down('w');
  const track = [];
  for (let t = 0; t < secs * 4; t++) { await p.waitForTimeout(250); const q = await p.evaluate(() => { const m = window.__meadow; return { x: m.player.x, z: m.player.z, y: m.player.y, yaw: m.camState.yaw }; }); lowest = Math.min(lowest, q.y); track.push(q); }
  if (process.env.TRACK) console.log(track.filter((q, i) => i % 2 === 0).map((q) => [Math.round(Math.hypot(q.x - fx, q.z - fz) * 10) / 10, +q.y.toFixed(2), +q.yaw.toFixed(2)].join('/')).join(' '));
  await p.keyboard.up('w');
  const e = await p.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z }));
  return { gotTo: Math.round(Math.hypot(e.x - fx, e.z - fz)), lowest: +lowest.toFixed(2) };
};
console.log('bridge walk', JSON.stringify(await walk(B.x - B.ux * (B.half + 3), B.z - B.uz * (B.half + 3), B.x + B.ux * (B.half + 3), B.z + B.uz * (B.half + 3), 6)));
console.log('stones walk', JSON.stringify(await walk(S.ax - dx / dl * 1.5, S.az - dz / dl * 1.5, S.bx, S.bz, 6)));
await b.close();
