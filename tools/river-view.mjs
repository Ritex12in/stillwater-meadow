// Dev tool: pictures of the rivers near home (needs `npm run dev`): the widest fall, looking up at it from
// below; a wide calm stretch, from its bank and across; and the spring's rill. To e:/Games/_assets/previews/river-*.png.
//   SEED=1 HOUR=15 node tools/river-view.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear#' + (process.env.HOUR || 15));
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
await p.waitForTimeout(3000);
await p.addStyleTag({ content: 'body > *:not(canvas):not(#world) { display: none !important; }' });
const s = await p.evaluate(async () => {
  const S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'))), H = S.HOME;
  const list = S.riversNear(H.x, H.z, 3000).filter((r) => !r.heart);
  let fall = null, calm = null;
  for (const r of list) for (let i = 2; i < r.n - 3; i++) {
    const d = r.lv[i] - r.lv[i + 1], score = r.w[i] * Math.min(d, 10);
    if (r.fall[i] && (!fall || score > fall.score)) fall = { r, i, score, d, w: r.w[i] };
    if (!r.fall[i] && !r.fall[i - 1] && r.w[i] > 16 && S.riverIce(r) < 0.5 && (!calm || r.w[i] > calm.w)) calm = { r, i, w: r.w[i] }; // (open water, not a frozen river)
  }
  const frame = (r, i) => { const tx = r.x[i + 1] - r.x[i], tz = r.z[i + 1] - r.z[i], l = Math.hypot(tx, tz) || 1; return { x: r.x[i], z: r.z[i], tx: tx / l, tz: tz / l }; };
  const land = (x, z, dx, dz) => { for (let k = 0; k < 30 && !S.walkable(x, z); k++) { x += dx * 2; z += dz * 2; } return [x, z]; };
  const F = frame(fall.r, fall.i), foot = frame(fall.r, fall.i + 1), C = frame(calm.r, calm.i);
  return {
    fall: { info: `${fall.r.id}: ${fall.d.toFixed(1)} m tall, ${fall.w.toFixed(1)} m wide`, lip: [F.x, F.z], at: land(foot.x + foot.tx * 22 + foot.tz * 6, foot.z + foot.tz * 22 - foot.tx * 6, -foot.tz, foot.tx) },
    calm: { info: `${calm.r.id}: ${calm.w.toFixed(1)} m wide`, mid: [C.x, C.z], bank: land(C.x + C.tz * (calm.w / 2 + 3), C.z - C.tx * (calm.w / 2 + 3), C.tz, -C.tx), along: [C.x + C.tx * 40, C.z + C.tz * 40] },
  };
});
console.log('fall', s.fall.info, '· calm', s.calm.info);
const shot = async (name, at, look, dist, pitch) => { await p.evaluate(([at, look, dist, pitch]) => { const m = window.__meadow; m.travelTo(at[0], at[1], look[0], look[1]); m.camState.dist = dist; m.camState.pitch = pitch; }, [at, look, dist, pitch]); await p.waitForTimeout(13000); await p.screenshot({ path: `e:/Games/_assets/previews/river-${name}.png` }); };
await shot('fall', s.fall.at, s.fall.lip, 7, -0.1);
await shot('wide-across', s.calm.bank, s.calm.mid, 7, 0.12);
await shot('wide-along', s.calm.bank, s.calm.along, 8, 0.1);
await b.close();
