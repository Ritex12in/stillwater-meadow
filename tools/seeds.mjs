// A sweep over world seeds on the real GPU: does each world start well?
//   node tools/seeds.mjs [first] [last]      (needs `npm run dev` running)
// For each seed: the game boots without errors; you start on dry, walkable ground beside the home
// lake; the home lake has its jetty (root on land, end and mooring over water), fire and bench;
// the country there is mild; flowers of at least three kinds grow within reach; and in winter
// there are at least five pine cones to find (the skipper asks for them when no flowers grow).
// Exits 1 if any seed fails.
import { chromium } from 'playwright';
const first = +(process.argv[2] || 1), last = +(process.argv[3] || 12);
const b = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
let bad = 0;
for (let seed = first; seed <= last; seed++) {
  const row = { seed };
  for (const season of ['summer', 'winter']) {
    const ctx = await b.newContext({ viewport: { width: 960, height: 600 } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) errs.push(m.text()); });
    await p.goto(`http://127.0.0.1:8080/?seed=${seed}&weather=clear&season=${season}#12`);
    await p.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 120000 });
    const r = await p.evaluate(() => {
      const m = window.__meadow, g = m.geo;
      for (let i = 0; i < 30; i++) m.tick(1 / 30);
      const root = g.dockAt(-1, 0), end = g.dockAt(8, 0), moor = g.dockAt(9.85, 0), c = m.climate(m.spawn.x, m.spawn.z);
      const fl = m.flowers().filter((f) => f.shown && Math.hypot(f.x - m.spawn.x, f.z - m.spawn.z) < 140);
      const rod = m.rod();
      return {
        home: [Math.round(m.home.x), Math.round(m.home.z), Math.round(m.home.r)], anchor: m.anchor(), kit: m.kit,
        spawnDry: g.walkable(m.player.x, m.player.z) && m.player.y > 0.3, jetty: g.height(root.x, root.z) > 0.2 && g.height(end.x, end.z) < -0.3 && g.height(moor.x, moor.z) < -0.3,
        benchDry: g.height(g.BENCH_SPOT.x, g.BENCH_SPOT.z) > 0.3, fireDry: g.height(g.FIRE_SPOT.x, g.FIRE_SPOT.z) > 0.3,
        mild: c.snow + c.dry + c.lush < 0.05, flowers: fl.length, kinds: new Set(fl.map((f) => f.kind)).size,
        cones: rod && rod.lying ? rod.lying.length : 0, conesFar: rod && rod.lying && rod.lying.length ? Math.round(Math.max(...rod.lying.map((q) => Math.hypot(q.x - m.spawn.x, q.z - m.spawn.z)))) : null, trees: m.trees().length, lakes: m.lakes(1500).length, settled: m.settled(3000).length,
        shrine: m.shrine ? Math.round(Math.hypot(m.shrine.x - m.home.x, m.shrine.z - m.home.z)) : null,
      };
    });
    await ctx.close();
    if (season === 'summer') Object.assign(row, r, { errors: errs.length });
    else { row.winterCones = r.cones; row.conesWithin = r.conesFar; row.winterErrors = errs.length; }
    if (errs.length) console.log(`  seed ${seed} ${season}:`, [...new Set(errs)].join(' | ').slice(0, 300));
  }
  const ok = !row.errors && !row.winterErrors && row.anchor === 'home' && row.kit.dock && row.kit.fire && row.kit.bench && row.spawnDry && row.jetty && row.benchDry && row.fireDry && row.mild && row.kinds >= 3 && row.winterCones >= 5;
  if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'BAD ') + JSON.stringify(row));
}
await b.close();
console.log(bad ? `${bad} seed(s) failed` : 'every seed starts well');
process.exit(bad ? 1 : 0);
