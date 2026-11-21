// The endless land: ground everywhere, the same for the same seed, and no dearer the further you go.
import { test, expect } from './harness.js';
import { open, step, teleport, noErrors } from './helpers.js';

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
