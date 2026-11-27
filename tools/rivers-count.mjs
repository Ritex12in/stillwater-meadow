// Dev tool: the rivers near home for a few seeds: how many, how long, how wide, their falls (how many, the tallest, the widest).
//   node tools/rivers-count.mjs        (dev server running; SEEDS=1,7,42)
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const seed of (process.env.SEEDS || '1,7,42').split(',')) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8080/?seed=' + seed + '&weather=clear#12');
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  console.log('seed ' + seed + '\n' + await p.evaluate(async () => {
    const S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js'))), H = S.HOME;
    const t0 = performance.now(), list = S.riversNear(H.x, H.z, 3000).filter((r) => !r.heart), ms = performance.now() - t0;
    const out = [`  ${list.length} rivers within 3 km of home (worked out in ${Math.round(ms)} ms)`];
    for (const r of list) {
      let falls = 0, tall = 0, wide = 0, up = 0; for (let i = 0; i < r.n - 1; i++) { if (r.lv[i + 1] > r.lv[i] + 1e-4) up++; if (r.fall[i]) { falls++; const d = r.lv[i] - r.lv[i + 1]; if (d > tall) { tall = d; wide = r.w[i]; } } }
      out.push(`   ${r.id.padEnd(8)} ${String(Math.round(r.len)).padStart(5)} m long · ${r.w[0].toFixed(1)} to ${r.w[r.n - 1].toFixed(1)} m wide · ${falls} falls, the tallest ${tall.toFixed(1)} m (${wide.toFixed(1)} m wide) · ends ${r.end.split(':')[0]} · uphill ${up} · nearest home ${Math.round(Math.min(...Array.from(r.x).map((x, i) => Math.hypot(x - H.x, r.z[i] - H.z))))} m`);
    }
    return out.join('\n');
  }));
  await p.close();
}
await b.close();
