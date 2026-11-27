// Dev tool: the falls of the grove's heart nearest home at a given hour and graphics level (needs `npm run dev`).
// To e:/Games/_assets/previews/fall-<level>-<hour>-<view>.png.   LEVEL=low HOUR=23 SEED=1 node tools/fall-night.mjs
import { chromium } from 'playwright';
const level = process.env.LEVEL || 'low', hour = process.env.HOUR || 23, season = process.env.SEASON || 'place';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear' + (process.env.SEASON ? '&season=' + season : '') + '#' + hour);
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
await p.waitForTimeout(3000);
await p.addStyleTag({ content: 'body > *:not(canvas):not(#world) { display: none !important; }' });
const s = await p.evaluate(async (level) => {
  const find = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
  const S = await import(find('/src/core/shape.js')), Q = await import(find('/src/systems/quality.js')), H = S.HOME;
  Q.setQuality(level);
  const s = S.sitesNear(H.x, H.z, 8000, 'heart')[0], L = S.heartLayout(s), fx = Math.cos(s.th), fz = Math.sin(s.th), r = S.riversNear(s.x, s.z, 200).find((q) => q.heart), br = S.bridgesOf(r)[0];
  return { fx, fz, fall: [L.fall.x, L.fall.z], view: [L.view.x, L.view.z], past: br && [br.x + br.ux * 9, br.z + br.uz * 9], level: Q.quality.level };
}, level);
console.log('graphics', s.level, 'hour', hour);
const shot = async (name, at, look, dist, pitch) => { await p.evaluate(([at, look, dist, pitch]) => { const m = window.__meadow; m.travelTo(at[0], at[1], look[0], look[1]); m.camState.dist = dist; m.camState.pitch = pitch; }, [at, look, dist, pitch]); await p.waitForTimeout(13000); await p.screenshot({ path: `e:/Games/_assets/previews/fall-${level}-${season}-${hour}-${name}.png` }); };
await shot('way-in', s.view, s.fall, 6.5, -0.1);
if (s.past) await shot('bridge', s.past, s.fall, 7, -0.08);
await shot('close', [s.fall[0] + s.fx * 27 + s.fz * 5, s.fall[1] + s.fz * 27 - s.fx * 5], s.fall, 6, -0.16);
await shot('pool', [s.fall[0] + s.fx * 19 - s.fz * 9, s.fall[1] + s.fz * 19 + s.fx * 9], [s.fall[0] + s.fx * 6, s.fall[1] + s.fz * 6], 7, 0.25);
await b.close();
