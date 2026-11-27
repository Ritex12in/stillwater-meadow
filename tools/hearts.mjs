// Dev tool: the hearts of the blossom groves near home (core/shape.js, "The heart of a grove"), for a few
// seeds: where each is, how high its cliff and fall are, and that nothing else stands or runs on it.
//   node tools/hearts.mjs        (dev server running; SEEDS=1,7,42)
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
for (const seed of (process.env.SEEDS || '1,7,42').split(',')) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 300)); });
  await p.goto('http://127.0.0.1:8080/?seed=' + seed + '&weather=clear#12');
  await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  console.log('seed ' + seed + '\n' + await p.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')), S = await import(url), H = S.HOME, out = [];
    const t0 = performance.now(), hearts = S.sitesNear(H.x, H.z, 6000, 'heart');
    out.push(`  ${hearts.length} hearts within 6 km of home (found in ${Math.round(performance.now() - t0)} ms)`);
    for (const s of hearts) {
      const rv = S.riversNear(s.x, s.z, 200).filter((r) => r.heart), r = rv[0];
      const others = S.sitesNear(s.x, s.z, 120).filter((q) => q.kind !== 'heart' && q.kind !== 'waystone').map((q) => q.kind), stones = S.sitesNear(s.x, s.z, 90, 'waystone').length;
      const strays = S.riversNear(s.x, s.z, 400).filter((q) => !q.heart && Array.from(q.x).some((x, i) => Math.hypot(x - s.x, q.z[i] - s.z) < 150)).length;
      const fx = Math.cos(s.th), fz = Math.sin(s.th), top = S.height(s.x, s.z), foot = S.height(s.x + fx * (s.R * 1.2 + 12), s.z + fz * (s.R * 1.2 + 12)), back = S.height(s.x - fx * (s.R + 80), s.z - fz * (s.R + 80));
      let steepest = 0; for (let d = s.R * 0.8; d < s.R * 1.25 + 8; d += 0.5) steepest = Math.max(steepest, (S.height(s.x + fx * d, s.z + fz * d) - S.height(s.x + fx * (d + 0.5), s.z + fz * (d + 0.5))) / 0.5);
      // the way up round the back: the steepest metre of it
      let ramp = 0; for (let d = 0; d < s.R + 80; d += 1) ramp = Math.max(ramp, Math.abs(S.height(s.x - fx * d, s.z - fz * d) - S.height(s.x - fx * (d + 1), s.z - fz * (d + 1))));
      out.push(`  ${String(Math.round(Math.hypot(s.x - H.x, s.z - H.z))).padStart(5)} m off · top ${top.toFixed(1)} m (level ${s.T.toFixed(1)}) · cliff ${(top - foot).toFixed(1)} m, steepest ${steepest.toFixed(1)} m per m · back ${(top - back).toFixed(1)} m down, steepest ${ramp.toFixed(2)} · top walkable ${S.walkable(s.x, s.z)} · fall ${r ? r.drop.toFixed(1) + ' m (' + r.n + ' points)' : 'NONE'} · on it: other sites ${others.length ? others.join(',') : 0}, waystones ${stones}, shrines ${S.shrineSitesNear(s.x, s.z, 150).length}, lakes ${S.lakesNear(s.x, s.z, 150).length}, other rivers ${strays} · grove ${S.groveAt(s.x, s.z).toFixed(2)}`);
      // step 4, the way in: the path (each length walked a metre at a time), the stream below the pool, the bridge, the trails' ends
      const L = S.heartLayout(s), segs = S.trailsNear(s.x, s.z, 260), inner = segs.filter((q) => q.inner && q.id.startsWith(s.id + '~')), outer = segs.filter((q) => !q.inner && (q.a.id === s.id || q.b.id === s.id));
      let worst = 0, off = 0, steps = 0, wet = 0;
      for (const q of inner) for (let d = 0; d < q.len; d += 1) { const a = S.trailPoint(q, d / q.len), c = S.trailPoint(q, Math.min(1, (d + 1) / q.len)); steps++; if (!S.walkable(a.x, a.z)) { off++; if (S.riverNear(a.x, a.z)) wet++; } if (!S.riverNear(a.x, a.z) && !S.riverNear(c.x, c.z)) worst = Math.max(worst, Math.abs(S.height(c.x, c.z) - S.height(a.x, a.z))); }
      const doors = outer.map((q) => { const e = q.a.id === s.id ? q.a : q.b; return Math.hypot(e.x - L.view.x, e.z - L.view.z) < 1 ? 'front' : Math.hypot(e.x - L.back.x, e.z - L.back.z) < 1 ? 'back' : 'ELSEWHERE'; });
      // (does any trail from outside climb the cliff? the steepest metre along each, within 200 m of the heart)
      let outSteep = 0; for (const q of outer) for (let d = 0; d < q.len; d += 1) { const a = S.trailPoint(q, d / q.len); if (Math.hypot(a.x - s.x, a.z - s.z) > 200) continue; const c = S.trailPoint(q, Math.min(1, (d + 1) / q.len)); if (!S.riverNear(a.x, a.z) && !S.riverNear(c.x, c.z)) outSteep = Math.max(outSteep, Math.abs(S.height(c.x, c.z) - S.height(a.x, a.z))); }
      let rising = 0; if (r) for (let i = 1; i < r.n; i++) if (r.lv[i] > r.lv[i - 1] + 1e-4) rising++;
      const br = r ? S.bridgesOf(r) : [], end = r ? Math.hypot(r.x[r.n - 1] - s.x, r.z[r.n - 1] - s.z) - s.R : 0;
      out.push(`        the way in: path ${inner.length} lengths, ${steps} m, steepest metre ${worst.toFixed(2)}, not walkable ${off} m (${wet} in the stream) · trails from outside: ${doors.join(', ') || 'none'}, steepest metre near it ${outSteep.toFixed(2)} · stream runs to ${end.toFixed(0)} m past the rim, ${r ? Array.from(r.fall).reduce((a, f) => a + f, 0) : 0} falls, uphill ${rising} · bridges ${br.length}${br.length ? ' (garden ' + br.filter((q) => q.grove > 0.5).length + ')' : ''} · pagodas ${Math.round(Math.hypot(L.big.x - s.x, L.big.z - s.z))} and ${Math.round(Math.hypot(L.small.x - s.x, L.small.z - s.z))} m from the middle (rim ${s.R.toFixed(0)})`);
    }
    return out.join('\n');
  }));
  await p.close();
}
await b.close();
