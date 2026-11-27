// Dev tool: pictures of the grove's heart nearest home (needs `npm run dev`): from below its cliff, close
// to the fall, from on top, from 300 m off, and from above. To e:/Games/_assets/previews/heart-*.png. SEED=1, HOUR=16.5.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
const tag = process.env.TAG || '';
await p.goto('http://127.0.0.1:8080/?seed=' + (process.env.SEED || 1) + '&weather=clear&season=spring#' + (process.env.HOUR || 16.5));
await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
await p.waitForTimeout(3000);
await p.addStyleTag({ content: 'body > *:not(canvas):not(#world) { display: none !important; }' });
const s = await p.evaluate(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')), S = await import(url), H = S.HOME;
  const s = S.sitesNear(H.x, H.z, 8000, 'heart')[0]; if (!s) return null;
  const r = S.riversNear(s.x, s.z, 200).find((q) => q.heart), land = (x, z) => { for (let k = 0; k < 40; k++) { if (S.walkable(x, z)) return [x, z]; x += Math.cos(s.th) * 3; z += Math.sin(s.th) * 3; } return [x, z]; };
  const fx = Math.cos(s.th), fz = Math.sin(s.th), px = r.x[r.n - 1], pz = r.z[r.n - 1];
  return { x: s.x, z: s.z, fx, fz, R: s.R, pool: [px, pz], lip: [r.x[r.n - 7], r.z[r.n - 7]], below: land(px + fx * 34 - fz * 14, pz + fz * 34 + fx * 14), near: land(px + fx * 9 + fz * 7, pz + fz * 9 - fx * 7), far: land(s.x + fx * 300 - fz * 60, s.z + fz * 300 + fx * 60) };
});
if (!s) { console.log('no heart near home'); await b.close(); process.exit(0); }
const shot = async (name, at, look, dist, pitch) => { await p.evaluate(([at, look, dist, pitch]) => { const m = window.__meadow; m.travelTo(at[0], at[1], look[0], look[1]); m.camState.dist = dist; m.camState.pitch = pitch; }, [at, look, dist, pitch]); await p.waitForTimeout(14000); await p.screenshot({ path: `e:/Games/_assets/previews/heart-${name}${tag}.png` }); };
await shot('below', s.below, s.pool, 8, -0.05);
await shot('fall', s.near, s.lip, 6, -0.12);
await shot('top', [s.x - s.fx * 2 + s.fz * 6, s.z - s.fz * 2 - s.fx * 6], [s.x + s.fx * 40, s.z + s.fz * 40], 11, 0.22);
await shot('pagodas', [s.x + s.fx * 24 + s.fz * 10, s.z + s.fz * 24 - s.fx * 10], [s.x - s.fx * 11, s.z - s.fz * 11], 13, 0.2);
for (const d of [150, 400, 900]) { const at = await p.evaluate(async ([s, d]) => { const S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'))); let x = s.x + s.fx * d, z = s.z + s.fz * d; for (let k = 0; k < 60 && !S.walkable(x, z); k++) { x += s.fz * 6; z -= s.fx * 6; } return [x, z]; }, [s, d]); await shot('d' + d, at, [s.x, s.z], 34, 0.42); }
if (process.env.STEEP) { const st = await p.evaluate(async (s) => { const S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'))), H = S.HOME; let best = null; for (let z = -4000; z <= 4000; z += 40) for (let x = -4000; x <= 4000; x += 40) { const X = H.x + x, Z = H.z + z; if (Math.hypot(X - s.x, Z - s.z) < 300) continue; const h = S.height(X, Z); if (h < 3) continue; const gx = (S.height(X + 2, Z) - S.height(X - 2, Z)) / 4, gz = (S.height(X, Z + 2) - S.height(X, Z - 2)) / 4, sl = Math.hypot(gx, gz); if (sl > 1.6 && (!best || sl > best.sl)) best = { X, Z, sl, gx: gx / sl, gz: gz / sl, h }; } if (!best) return null; let x = best.X - best.gx * 30, z = best.Z - best.gz * 30; for (let k = 0; k < 40 && !S.walkable(x, z); k++) { x -= best.gx * 4; z -= best.gz * 4; } return { ...best, at: [x, z] }; }, s); console.log('steepest away from the heart', JSON.stringify(st)); if (st) await shot('steep', st.at, [st.X, st.Z], 14, 0.1); }
await shot('far', s.far, [s.x, s.z], 9, 0.02);
await shot('above', [s.x + s.fx * 20, s.z + s.fz * 20], [s.x - s.fx * 40, s.z - s.fz * 40], 16, 1.15);
await b.close();
