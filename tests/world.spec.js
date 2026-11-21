// The endless land: ground everywhere, the same for the same seed, and no dearer the further you go.
import { test, expect } from './harness.js';
import { open, step, teleport, press, noErrors } from './helpers.js';

test('the land has no edge: you can stand far beyond the old valley, on ground that matches its formula', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  // somewhere dry and not too steep, well past where the valley used to end
  const spot = await page.evaluate(() => {
    const g = window.__meadow.geo, h = window.__meadow.home;
    for (let d = 400; d < 900; d += 7) for (let a = 0; a < 6.28; a += 0.4) { const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d; if (g.walkable(x, z)) return { x, z }; }
    return null;
  });
  expect(spot, 'there is walkable ground 400 m and more from home').not.toBeNull();
  await teleport(page, spot.x, spot.z);
  await step(page, 2);
  const there = await page.evaluate(() => { const m = window.__meadow; return { x: m.player.x, z: m.player.z, y: m.player.y, ground: m.geo.height(m.player.x, m.player.z) }; });
  expect(Math.hypot(there.x - spot.x, there.z - spot.z), 'nothing drags you back toward the valley').toBeLessThan(1);
  expect(Math.abs(there.y - there.ground), 'you stand on the ground').toBeLessThan(0.5);
  // with the tiles round you loaded, the drawn ground agrees with the formula (it is the formula, sampled every 1.2 m)
  const gap = await page.evaluate(() => {
    const m = window.__meadow, g = m.geo;
    m.ground.settle(m.player.x, m.player.z);
    // (the drawn ground is the formula sampled every 1.2 m and joined flat between: at the samples the
    // two are the same; between them they part only where the formula has a sharp crest)
    let worst = 0;
    const off = [];
    for (let i = 0; i < 200; i++) {
      const x = m.player.x + Math.cos(i) * i * 0.4, z = m.player.z + Math.sin(i) * i * 0.4, gx = Math.round(x / 1.2) * 1.2, gz = Math.round(z / 1.2) * 1.2;
      worst = Math.max(worst, Math.abs(g.heightAt(gx, gz) - g.height(gx, gz)));
      off.push(Math.abs(g.heightAt(x, z) - g.height(x, z)));
    }
    off.sort((p, q) => p - q);
    return { worst, usual: off[180], fine: m.ground.stats().fine };
  });
  expect(gap.fine, 'fine tiles are loaded round you').toBeGreaterThan(8);
  expect(gap.worst, 'at its samples the drawn ground is the formula').toBeLessThan(0.02);
  expect(gap.usual, 'and nine times in ten it is within a hand of it between them').toBeLessThan(0.12);
  noErrors(errors);
});

test('walking two kilometres out and back, again and again, stops costing more: tiles are reused', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const trip = () => page.evaluate(() => {
    const g = window.__meadow.ground;
    const settle = (x, z) => { g.settle(x, z); for (let i = 0; i < 200; i++) g.update(x, z); }; // (the updates let unused tiles go back to the pool)
    const h = window.__meadow.home;
    settle(h.x + 2000, h.z + 300);
    settle(h.x, h.z + 50);
    return g.stats();
  });
  const first = await trip(), second = await trip(), third = await trip();
  expect(first.queued).toBe(0);
  expect(first.made, 'the trip really did make new ground').toBeGreaterThan(150);
  expect(third.made).toBeGreaterThan(second.made);
  expect(third.parts, 'no new tile buffers once the pool has filled').toBe(second.parts);
  expect(third.parts).toBeLessThan(400);
  noErrors(errors);
});

test('one seed, one world: the same seed gives the same land and another seed a different one', async ({ page }) => {
  const sample = () => page.evaluate(() => Array.from({ length: 60 }, (_, i) => window.__meadow.geo.height(Math.cos(i * 2.4) * i * 40, Math.sin(i * 2.4) * i * 40)));
  await open(page, 'seed=7');
  const a = await sample();
  await open(page, 'seed=7');
  const b = await sample();
  await open(page, 'seed=8');
  const c = await sample();
  expect(b).toEqual(a);
  expect(c).not.toEqual(a);
});

test('woods beyond the valley: each square grows the same trees every time, and near you they are real trees', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  // a square is always the same, however often it is grown
  const same = await page.evaluate(() => {
    const w = window.__meadow.wilds, list = (ix, iz) => JSON.stringify(w.square(ix, iz).map((t) => [t.x, t.z, t.type, t.s]));
    let trees = 0, best = null;
    for (let iz = -12; iz <= 12; iz++) for (let ix = -12; ix <= 12; ix++) { const n = w.square(ix, iz).length; trees += n; if (!best || n > best.n) best = { ix, iz, n }; }
    return { repeat: list(best.ix, best.iz) === list(best.ix, best.iz), trees, best };
  });
  expect(same.repeat).toBe(true);
  expect(same.trees, 'there are woods out there').toBeGreaterThan(1500);
  expect(same.best.n, 'and thick ones').toBeGreaterThan(15);
  // stand in the thickest square: its trees are drawn as models, block the way, and none is dropped for want of room
  const there = await page.evaluate(({ ix, iz }) => {
    const m = window.__meadow, x = (ix + 0.5) * 57.6, z = (iz + 0.5) * 57.6, before = m.trees().length;
    m.player.x = x; m.player.z = z; m.player.slide = null;
    m.ground.settle(x, z); m.wilds.settle(x, z);
    for (let i = 0; i < 30; i++) m.tick(1 / 30);
    return { before, after: m.trees().length, stats: m.wilds.stats(), wild: m.trees().filter((t) => t.wild).length };
  }, same.best);
  expect(there.wild).toBeGreaterThan(same.best.n - 1);
  expect(there.stats.near).toBe(there.wild);
  expect(there.stats.cards).toBeGreaterThan(there.stats.near);
  expect(there.stats.dropped).toBe(0);
  noErrors(errors);
});

test('travelling far and back, again and again, leaves the scene holding exactly what it held', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const trip = () => page.evaluate(() => {
    const m = window.__meadow;
    const go = (x, z) => { m.player.x = x; m.player.z = z; m.player.slide = null; m.ground.settle(x, z); for (let i = 0; i < 200; i++) m.ground.update(x, z); m.wilds.settle(x, z); for (let i = 0; i < 10; i++) m.tick(1 / 30); };
    go(m.home.x + 2000, m.home.z + 300);
    const out = m.wilds.stats();
    go(m.spawn.x, m.spawn.z);
    return { out, back: m.wilds.stats(), objects: m.objects(), trees: m.trees().length };
  });
  const first = await trip(), second = await trip(), third = await trip();
  expect(first.out.cards, 'trees were met on the way').toBeGreaterThan(200);
  expect(second.out).toEqual(first.out);
  expect(third.back).toEqual(second.back);
  expect(third.objects, 'no meshes are left behind').toBe(second.objects);
  expect(third.trees).toBe(second.trees);
  expect(third.out.dropped + third.back.dropped).toBe(0);
  noErrors(errors);
});

test('without the nature models the land and its woods still work (hand-built trees)', async ({ page }) => {
  const errors = await open(page, 'assets=0&weather=clear&season=summer', '#12');
  const out = await page.evaluate(() => {
    const m = window.__meadow, w = m.wilds;
    let best = null;
    for (let iz = -10; iz <= 10; iz++) for (let ix = -10; ix <= 10; ix++) { const n = w.square(ix, iz).length; if (!best || n > best.n) best = { ix, iz, n }; }
    const x = (best.ix + 0.5) * 57.6, z = (best.iz + 0.5) * 57.6;
    m.player.x = x; m.player.z = z; m.player.slide = null;
    m.ground.settle(x, z); w.settle(x, z);
    for (let i = 0; i < 30; i++) m.tick(1 / 30);
    return { stats: w.stats(), wild: m.trees().filter((t) => t.wild).length };
  });
  expect(out.wild).toBeGreaterThan(10);
  expect(out.stats.dropped).toBe(0);
  await step(page, 1);
  noErrors(errors);
});

test('the wilds are furnished: each square has its own boulders, bushes and flower drifts, the same every time', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const grown = await page.evaluate(() => {
    const w = window.__meadow.wilds, flat = (list) => JSON.stringify(list.map((t) => [t.x, t.z, t.y, t.s, t.kind]));
    const small = (ix, iz) => { const s = w.small(ix, iz); return flat(s.bushes) + flat(s.ferns) + flat(s.shrooms) + flat(s.flowers); };
    let rocks = 0, plants = 0, best = null;
    for (let iz = -9; iz <= 9; iz++) for (let ix = -9; ix <= 9; ix++) {
      if (Math.hypot(ix, iz) < 3.5) continue;
      const s = w.small(ix, iz), n = s.bushes.length + s.ferns.length + s.shrooms.length + s.flowers.length;
      rocks += w.rocks(ix, iz).length; plants += n;
      if (!best || n > best.n) best = { ix, iz, n };
    }
    return { rocks, plants, best, sameRocks: flat(w.rocks(7, -5)) === flat(w.rocks(7, -5)), sameSmall: small(best.ix, best.iz) === small(best.ix, best.iz) };
  });
  expect(grown.sameRocks).toBe(true);
  expect(grown.sameSmall).toBe(true);
  expect(grown.rocks, 'boulders lie about').toBeGreaterThan(200);
  expect(grown.plants, 'and small plants grow').toBeGreaterThan(800);
  // stand in the lushest square: its plants and the boulders round it are set out, and none goes undrawn
  const there = await page.evaluate(({ ix, iz }) => {
    const m = window.__meadow, x = (ix + 0.5) * 57.6, z = (iz + 0.5) * 57.6;
    m.player.x = x; m.player.z = z; m.player.slide = null;
    m.ground.settle(x, z); m.wilds.settle(x, z);
    for (let i = 0; i < 30; i++) m.tick(1 / 30);
    return m.wilds.stats();
  }, grown.best);
  expect(there.small).toBeGreaterThan(grown.best.n - 1);
  expect(there.rocks).toBeGreaterThan(0);
  expect(there.dropped).toBe(0);
  noErrors(errors);
});

test('kinds of country: snow, heath, lush woods and blossom groves all exist, and each grows its own trees', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const land = await page.evaluate(() => {
    const m = window.__meadow, w = m.wilds, S = 57.6, kinds = {};
    const add = (k, trees) => { const o = kinds[k] || (kinds[k] = { squares: 0, trees: 0, pines: 0, blossom: 0 }); o.squares++; o.trees += trees.length; o.pines += trees.filter((t) => t.type === 'pine').length; o.blossom += trees.filter((t) => t.type === 'blossom').length; };
    for (let iz = -45; iz <= 45; iz += 2) for (let ix = -45; ix <= 45; ix += 2) {
      const x = (ix + 0.5) * S, z = (iz + 0.5) * S;
      if (m.geo.height(x, z) > 60) continue; // (lowland only: mountains are rock and snow whatever the climate)
      const c = m.climate(x, z);
      add(c.snow > 0.8 ? 'snow' : c.grove > 0.8 ? 'grove' : c.dry > 0.8 ? 'heath' : c.lush > 0.8 ? 'lush' : c.snow + c.dry + c.lush + c.grove < 0.1 ? 'meadow' : 'between', w.square(ix, iz));
    }
    return { kinds, home: m.climate(m.spawn.x, m.spawn.z) };
  });
  const k = land.kinds;
  for (const name of ['snow', 'heath', 'lush', 'grove', 'meadow']) expect(k[name] && k[name].squares, `there is ${name} country`).toBeGreaterThan(8);
  expect(k.snow.pines / k.snow.trees, 'the cold grows pines').toBeGreaterThan(0.85);
  expect(k.lush.trees / k.lush.squares, 'lush country is thickly wooded').toBeGreaterThan(2.5 * k.heath.trees / k.heath.squares);
  expect(k.grove.blossom / k.grove.trees, 'groves are blossom trees').toBeGreaterThan(0.4);
  expect(k.meadow.blossom / k.meadow.trees).toBeLessThan(0.08);
  expect(land.home.snow + land.home.dry + land.home.lush + land.home.grove, 'the valley keeps its mild weather').toBeLessThan(0.01);
  noErrors(errors);
});

test('flowers to pick grow wherever the land allows: far from home too, each remembered while you are away, none under snow', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await step(page, 0.5);
  const sign = () => page.evaluate(() => { const m = window.__meadow; return m.wilds.picksNear(m.home.x, m.home.z, 90).map((f) => f.id + '@' + f.x.toFixed(3) + ',' + f.z.toFixed(3) + ':' + f.kind).join(' '); });
  // by the home lake: a bouquet of three kinds is a short walk away (the skipper asks for one)
  const home = await page.evaluate(() => {
    const m = window.__meadow, by = {};
    for (const f of m.wilds.picksNear(m.spawn.x, m.spawn.z, 60)) by[f.kind] = (by[f.kind] || 0) + 1;
    return { kinds: Object.values(by).filter((n) => n >= 4).length, shown: m.flowers().filter((f) => f.shown).length, dropped: m.wilds.stats().dropped };
  });
  expect(home.kinds, 'kinds with four or more flowers within 60 m of where you start').toBeGreaterThanOrEqual(3);
  expect(home.shown).toBeGreaterThan(200);
  expect(home.dropped).toBe(0);
  const before = await sign();
  // far out in open country (no lake's meadow): find a few, by the land's rule alone
  const spot = await page.evaluate(() => {
    const m = window.__meadow, h = m.home;
    for (let d = 1500; d < 2600; d += 60) for (let a = 0; a < 6.28; a += 0.5) {
      const x = h.x + Math.cos(a) * d, z = h.z + Math.sin(a) * d;
      if (!m.geo.walkable(x, z) || m.lakes(200).some((L) => Math.hypot(L.x - x, L.z - z) < 300)) continue;
      const f = m.wilds.picksNear(x, z, 30);
      if (f.length >= 3 && m.geo.walkable(f[0].x + 0.4, f[0].z)) return { x: f[0].x + 0.4, z: f[0].z, id: f[0].id };
    }
    return null;
  });
  expect(spot, 'flowers grow 1.5 km and more from home').not.toBeNull();
  // (arrive, let the camera catch up, and have everything round you grown at once rather than a little each frame)
  const go = (x, z) => page.evaluate(([x, z]) => { const m = window.__meadow; m.travelTo(x, z); for (let i = 0; i < 30; i++) m.tick(1 / 30); m.ground.settle(x, z); m.wilds.settle(x, z); }, [x, z]);
  await go(spot.x, spot.z);
  const seen = (id) => page.evaluate((id) => { const f = window.__meadow.flowers().find((q) => q.id === id); return f ? f.shown : null; }, id);
  expect(await seen(spot.id), 'it stands there').toBe(true);
  await press(page, 'KeyG', 0.8);
  const got = await page.evaluate(() => { const m = window.__meadow, mine = m.flowers().filter((f) => !f.shown); return { bouquet: m.pack.count('flower'), gone: mine.map((f) => f.id), dropped: m.wilds.stats().dropped }; });
  expect(got.bouquet, 'picked').toBe(1);
  expect(got.gone.length).toBe(1);
  expect(got.dropped).toBe(0);
  const picked = got.gone[0];
  // go a long way off (its square is forgotten) and come back: it is still picked
  await go(spot.x + 700, spot.z);
  expect(await seen(picked), 'out of reach, it is not kept at all').toBeNull();
  await go(spot.x, spot.z);
  expect(await seen(picked), 'still picked on coming back').toBe(false);
  // and after a few minutes it has grown again
  await page.evaluate(() => { const m = window.__meadow; for (let i = 0; i < 2460; i++) m.tick(0.1); });
  expect(await seen(picked), 'grown back').toBe(true);
  // none under snow
  const snow = await page.evaluate(() => {
    const m = window.__meadow, S = 57.6;
    for (let iz = -45; iz <= 45; iz += 2) for (let ix = -45; ix <= 45; ix += 2) {
      const x = (ix + 0.5) * S, z = (iz + 0.5) * S;
      if (m.geo.height(x, z) < 60 && m.climate(x, z).snow > 0.8) return { n: m.wilds.picks(ix, iz).length };
    }
    return null;
  });
  expect(snow, 'there is snow country to look in').not.toBeNull();
  expect(snow.n).toBe(0);
  // the same flowers, with the same names, after loading the world again
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  expect(await sign(), 'the same flowers after a reload').toBe(before);
  noErrors(errors);
});

test('nature: trees give out at a treeline, north faces hold more snow, cold dry country is snowless tundra, and water greens dry country', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), m = window.__meadow;
    // the highest tree in mild country stands near the treeline, and none far above it
    let top = 0;
    for (let iz = -40; iz <= 40; iz++) for (let ix = -40; ix <= 40; ix++) for (const t of m.wilds.square(ix, iz)) if (Math.abs(SH.coldBase(t.x, t.z)) < 0.05) top = Math.max(top, t.y);
    // snow at the same heights on slopes facing north and south
    const sn = [[0, 0], [0, 0]];
    let tundra = [0, 0], taiga = [0, 0], oasis = null;
    for (let z = -2800; z < 2800; z += 29) for (let x = -2800; x < 2800; x += 29) {
      const y = SH.height(x, z);
      if (y > 85 && y < 140 && SH.coldBase(x, z) < 0.1) { const n = SH.northness(x, z, y), s = SH.snowOf(SH.coldAt(x, z, y + SH.ASPECT * n)); if (n > 0.4) { sn[0][0] += s; sn[0][1]++; } else if (n < -0.4) { sn[1][0] += s; sn[1][1]++; } }
      if (y < 40 && SH.coldBase(x, z) > 0.7) { const w = SH.moistAt(x, z), s = SH.snowOf(SH.snowCold(SH.coldAt(x, z, y), w)); if (w < 0.33) { tundra[0] += s; tundra[1]++; } else if (w > 0.5) { taiga[0] += s; taiga[1]++; } }
    }
    // by a lake in dry country, the ground is wetter than the rain alone
    for (const L of m.lakes(4000)) { const x = L.x + L.rmax * 1.4, z = L.z; if (SH.rainAt(x, z) < 0.42) { oasis = { rain: SH.rainAt(x, z), moist: SH.moistAt(x, z) }; break; } }
    return { top, north: sn[0][0] / sn[0][1], south: sn[1][0] / sn[1][1], counts: [sn[0][1], sn[1][1], tundra[1], taiga[1]], tundra: tundra[0] / tundra[1], taiga: taiga[0] / taiga[1], oasis, line: SH.TREELINE };
  });
  expect(r.top, 'no tree far above the treeline').toBeLessThan(r.line + 8);
  expect(r.top, 'woods reach up toward it').toBeGreaterThan(r.line - 20);
  expect(r.counts.every((n) => n > 20), 'enough of each kind of ground to compare: ' + r.counts).toBe(true);
  expect(r.north - r.south, 'north faces are snowier').toBeGreaterThan(0.2);
  expect(r.taiga - r.tundra, 'cold and wet is snowier than cold and dry').toBeGreaterThan(0.3);
  expect(r.oasis, 'a lake in dry country').not.toBeNull();
  expect(r.oasis.moist).toBeGreaterThan(r.oasis.rain);
  noErrors(errors);
});

test('seasons by place: the year turns every 8 days; cold uplands whiten and their lakes freeze while home is in autumn, warm country stays green in winter, and at home there is always a way to the rod', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), Y = await import(url('/src/core/year.js')), m = window.__meadow;
    const out = { quarter: Y.yearPhase(2 * 86400000) - Y.yearPhase(0) };
    // late autumn: find a cold upland, a warm place, and a cold lake, by the land's own rules
    const late = 0.78, s = Y.seasonValue(late), lag = Y.seasonValue(late - Y.ICE_LAG), cool = Y.isCooling(late);
    let upland = null, warm = null;
    for (let z = -2800; z < 2800 && !(upland && warm); z += 41) for (let x = -2800; x < 2800; x += 41) {
      const h = SH.height(x, z), c = SH.coldAt(x, z, h);
      if (!upland && c > 0.2 && c < 0.4 && h > 0) upland = { c };
      if (!warm && c < -0.35) warm = { c };
    }
    const home = SH.lakeChill(SH.HOME);
    out.homeSnow = Y.snowFrom(home, s); out.uplandSnow = upland ? Y.snowFrom(upland.c, s) : null;
    out.homeLeaves = Y.leavesAt(home, s, cool); out.uplandLeaves = upland ? Y.leavesAt(upland.c, s, cool) : null;
    const coldLake = m.lakes(4000).map((L) => SH.lakesNear(L.x, L.z, 1)[0]).find((L) => L && !L.frozen && SH.lakeChill(L) > 0.3 && SH.lakeChill(L) < 0.45);
    out.homeIce = Y.iceFrom(home, lag); out.coldLakeIce = coldLake ? Y.iceFrom(SH.lakeChill(coldLake), lag) : null;
    // midwinter in warm country: no snow, the trees in leaf
    out.warmSnow = warm ? Y.snowFrom(warm.c, Y.seasonValue(0)) : null; out.warmLeaves = warm ? Y.leavesAt(warm.c, Y.seasonValue(0), false) : null;
    // the year at home, in 50 steps: a bouquet of three kinds is in reach, or the skipper asks for pine cones
    const fl = m.wilds.picksNear(m.spawn.x, m.spawn.z, 60), bad = [];
    for (let k = 0; k < 50; k++) {
      m.year.hold(k / 50);
      const st = m.year.state, by = {};
      for (const f of fl) if (f.keep < Y.flowersOut(f.chill || 0, st.season, st.cooling)) by[f.kind] = (by[f.kind] || 0) + 1;
      const kinds = Object.values(by).filter((n) => n >= 4).length;
      if (kinds < 3 && !(st.flowerFrac < 0.35)) bad.push(k / 50);
    }
    out.bad = bad;
    m.year.hold(null);
    return out;
  });
  expect(r.quarter, 'a quarter of the year every 2 real days').toBeCloseTo(0.25, 5);
  expect(r.uplandSnow, 'late autumn: snow on the cold uplands').toBeGreaterThan(0.5);
  expect(r.homeSnow, 'and none at home yet').toBeLessThan(0.1);
  expect(r.uplandLeaves).toBe('winter');
  expect(r.homeLeaves).toBe('autumn');
  expect(r.coldLakeIce, 'a cold lake is frozen').toBeGreaterThan(0.85);
  expect(r.homeIce, 'while home is open water').toBeLessThan(0.1);
  expect(r.warmSnow, 'warm country: no snow in midwinter').toBe(0);
  expect(r.warmLeaves, 'and its trees in leaf').toBe('summer');
  expect(r.bad, 'no time of year at home without a way to the rod').toEqual([]);
  noErrors(errors);
});

test('weather moves over the land: the same for everyone at a moment, carried by the wind, rain here and sun there, and Auto is the weather where you stand', async ({ page }) => {
  const errors = await open(page, 'season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const W = await import(url('/src/systems/weatherfield.js')), m = window.__meadow, h = m.home, t0 = Date.UTC(2026, 10, 22, 12);
    const a = W.weatherAt(h.x + 300, h.z, t0, 12), b = W.weatherAt(h.x + 300, h.z, t0, 12);
    // carried by the wind: a minute later, the cloud that was here is a wind's minute downwind
    const dx = Math.cos(W.WIND.angle) * W.WIND.speed * 60, dz = Math.sin(W.WIND.angle) * W.WIND.speed * 60;
    let drift = 0, still = 0;
    for (let i = 0; i < 40; i++) {
      const x = h.x + Math.cos(i) * i * 70, z = h.z + Math.sin(i) * i * 70, t = (t0 + i * 977000) / 1000;
      const now = W.cloudAt(x, z, t);
      drift = Math.max(drift, Math.abs(W.cloudAt(x + dx, z + dz, t + 60) - now));
      still += Math.abs(W.cloudAt(x, z, t + 60 * 30) - now);
    }
    // somewhere in the next days there is a moment with rain in one place and sun in another
    let mixed = null;
    for (let k = 0; k < 96 && !mixed; k++) {
      const t = t0 + k * 3600000, kinds = new Set();
      for (let z = -3000; z <= 3000; z += 500) for (let x = -3000; x <= 3000; x += 500) kinds.add(W.weatherAt(h.x + x, h.z + z, t, 12).type);
      if (kinds.has('clear') && (kinds.has('rain') || kinds.has('snow') || kinds.has('storm'))) mixed = [...kinds];
    }
    // Auto: the game feels the field where you stand
    m.wx.auto = true; m.wx.nextChange = 0;
    for (let i = 0; i < 10; i++) m.tick(1 / 30);
    const here = W.weatherAt(m.player.x, m.player.z, Date.now(), m.timeCtl.hour);
    return { same: JSON.stringify(a) === JSON.stringify(b), drift, still: still / 40, mixed, auto: m.wx.type, here: here.type };
  });
  expect(r.same, 'one place, one moment, one weather').toBe(true);
  expect(r.drift, 'the cloud moves with the wind').toBeLessThan(0.02);
  expect(r.still, 'and half an hour later, where you stand, it has moved on').toBeGreaterThan(0.01);
  expect(r.mixed, 'rain in one place while the sun shines in another').not.toBeNull();
  expect(r.auto).toBe(r.here);
  noErrors(errors);
});
