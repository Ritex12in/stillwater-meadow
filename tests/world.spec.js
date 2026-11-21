// The endless land: ground everywhere, the same for the same seed, and no dearer the further you go.
import { test, expect } from './harness.js';
import { open, step, teleport, noErrors } from './helpers.js';

test('the land has no edge: you can stand far beyond the old valley, on ground that matches its formula', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  // somewhere dry and not too steep, well past where the valley used to end
  const spot = await page.evaluate(() => {
    const g = window.__meadow.geo;
    for (let d = 400; d < 900; d += 7) for (let a = 0; a < 6.28; a += 0.4) { const x = Math.cos(a) * d, z = Math.sin(a) * d; if (g.walkable(x, z)) return { x, z }; }
    return null;
  });
  expect(spot, 'there is walkable ground 400 m and more from the middle').not.toBeNull();
  await teleport(page, spot.x, spot.z);
  await step(page, 2);
  const there = await page.evaluate(() => { const m = window.__meadow; return { x: m.player.x, z: m.player.z, y: m.player.y, ground: m.geo.height(m.player.x, m.player.z) }; });
  expect(Math.hypot(there.x - spot.x, there.z - spot.z), 'nothing drags you back toward the valley').toBeLessThan(1);
  expect(Math.abs(there.y - there.ground), 'you stand on the ground').toBeLessThan(0.5);
  // with the tiles round you loaded, the drawn ground agrees with the formula (it is the formula, sampled every 1.2 m)
  const gap = await page.evaluate(() => {
    const m = window.__meadow, g = m.geo;
    m.ground.settle(m.player.x, m.player.z);
    let worst = 0;
    for (let i = 0; i < 200; i++) { const x = m.player.x + Math.cos(i) * i * 0.4, z = m.player.z + Math.sin(i) * i * 0.4; worst = Math.max(worst, Math.abs(g.heightAt(x, z) - g.height(x, z))); }
    return { worst, fine: m.ground.stats().fine };
  });
  expect(gap.fine, 'fine tiles are loaded round you').toBeGreaterThan(8);
  expect(gap.worst).toBeLessThan(0.35);
  noErrors(errors);
});

test('walking two kilometres out and back, again and again, stops costing more: tiles are reused', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const trip = () => page.evaluate(() => {
    const g = window.__meadow.ground;
    const settle = (x, z) => { g.settle(x, z); for (let i = 0; i < 200; i++) g.update(x, z); }; // (the updates let unused tiles go back to the pool)
    settle(2000, 300);
    settle(0, 20);
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
