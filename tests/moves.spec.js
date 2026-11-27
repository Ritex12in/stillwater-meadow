// Off the ground (characters/moves.js): jumping, falling and landing, climbing, sliding, gliding.
import { test, expect } from './harness.js';
import { open, step, actions, noErrors } from './helpers.js';

const T = (page, n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__meadow.tick(1 / 60); }, n);
const moves = (page) => page.evaluate(() => { const m = window.__meadow, v = m.moves; return { mode: v.mode, vy: v.vy, speed: v.speed, heavy: v.heavy, rolling: v.rolling, landing: v.landing, act: m.activity.current, y: m.player.y, x: m.player.x, z: m.player.z }; });
/** A steep face near home: a spot at its foot you can stand on, and the way up it. */
const findFace = (page) => page.evaluate(() => {
  const m = window.__meadow, G = m.geo, H = m.home;
  for (let r = 300; r < 3000; r += 40) for (let a = 0; a < 6.28; a += 0.15) {
    const x = H.x + Math.cos(a) * r, z = H.z + Math.sin(a) * r;
    if (!G.walkable(x, z) || G.height(x, z) < 2) continue;
    for (let q = 0; q < 6.28; q += 0.5) { const dx = Math.cos(q), dz = Math.sin(q); let ok = G.height(x + dx * 14, z + dz * 14) > G.height(x, z) + 14; for (let d = 1.5; ok && d < 14; d += 1.5) if (G.walkable(x + dx * d, z + dz * d)) ok = false; if (ok && G.walkable(x - dx * 2, z - dz * 2)) return { x, z, dx, dz }; }
  }
  return null;
});

test('jumping and falling: Space jumps about a metre, a running jump carries you on; a fall lands softly, heavily or in a roll by its height, and nothing else can be begun in the air', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 1);
  await page.evaluate(() => { const m = window.__meadow; m.travelTo(m.spawn.x + 14, m.spawn.z + 14); });
  await step(page, 0.5);
  expect((await actions(page)).map((a) => a.id), 'Space is an action (a button on a touch screen)').toContain('jump');
  const y0 = (await moves(page)).y;
  expect(await page.evaluate(() => window.__meadow.jump())).toBe(true);
  expect((await moves(page)).mode, 'a short crouch first').toBeNull();
  await T(page, 8);
  const up = await moves(page);
  expect(up.mode).toBe('air');
  expect(up.act, 'nothing else can be begun').toBe('aloft');
  expect(await page.evaluate(() => window.__meadow.jump()), 'no glider: Space in the air does nothing').toBe(false);
  const top = await page.evaluate(() => { const m = window.__meadow; let t = 0, n = 0; while (m.moves.mode && n++ < 200) { m.tick(1 / 60); t = Math.max(t, m.player.y); } return { t, n }; });
  expect(top.t - y0, 'about a metre').toBeGreaterThan(0.85);
  expect(top.t - y0).toBeLessThan(1.3);
  expect(top.n / 60, 'over in under a second').toBeLessThan(0.9);
  const down = await moves(page);
  expect(down.mode).toBeNull();
  expect(down.act).toBe('free');
  expect(down.landing, 'the knees soak it up').toBe(true);
  expect(Math.abs(down.y - y0)).toBeLessThan(0.3);
  // falls: soft under about 2 m, heavy to 6 m (a moment down), a roll beyond (carried forward)
  await T(page, 40);
  const fall = async (h, speed) => { await page.evaluate(([h, s]) => window.__meadow.dropFrom(h, s), [h, speed]); await page.evaluate(() => { const m = window.__meadow; let n = 0; while (m.moves.mode && n++ < 600) m.tick(1 / 60); }); return moves(page); };
  const soft = await fall(1.5, 0);
  expect([soft.heavy, soft.rolling]).toEqual([false, false]);
  await T(page, 40);
  const heavy = await fall(4, 0);
  expect([heavy.heavy, heavy.rolling]).toEqual([true, false]);
  await T(page, 60);
  const before = await moves(page);
  const roll = await fall(9, 3);
  expect(roll.rolling).toBe(true);
  expect(roll.act, 'until you are up').toBe('aloft');
  await T(page, 70);
  const after = await moves(page);
  expect(after.rolling).toBe(false);
  expect(after.act).toBe('free');
  expect(Math.hypot(after.x - before.x, after.z - before.z), 'the fall and the roll carried you forward').toBeGreaterThan(2);
  noErrors(errors);
});

test('climbing, sliding and gliding: push into a steep face to take hold and climb it; Space jumps off; you slide down a face you land on; the glider opens in the air, sinks slowly, turns and folds; it is found by a high place', async ({ page }) => {
  const errors = await open(page, 'weather=clear&glider=1');
  await step(page, 1);
  const f = await findFace(page);
  expect(f, 'a steep face within 3 km of home').toBeTruthy();
  // at its foot, the camera looking up it: W pushes into it, and after a moment you take hold
  await page.evaluate((f) => { const m = window.__meadow; m.travelTo(f.x, f.z, f.x + f.dx * 5, f.z + f.dz * 5); }, f);
  await step(page, 0.5);
  const y0 = (await moves(page)).y;
  await page.keyboard.down('KeyW');
  await T(page, 60);
  let v = await moves(page);
  expect(v.mode, 'took hold').toBe('climb');
  expect(v.act).toBe('aloft');
  await T(page, 360); // (six seconds up it)
  v = await moves(page);
  expect(v.mode).toBe('climb');
  expect(v.y - y0, 'about a metre a second up a steep face').toBeGreaterThan(3.5);
  expect(v.y - y0).toBeLessThan(9);
  await page.keyboard.up('KeyW');
  const held = v.y;
  await T(page, 60);
  expect(Math.abs((await moves(page)).y - held), 'you hang where you are').toBeLessThan(0.01);
  // climb on, well up the face
  await page.keyboard.down('KeyW'); await T(page, 900); await page.keyboard.up('KeyW');
  const high = await moves(page);
  // Space: off the face, into the air; no key held, so you land on the face and slide down it, to its foot
  expect(await page.evaluate(() => window.__meadow.jump())).toBe(true);
  expect((await moves(page)).mode).toBe('air');
  const slid = await page.evaluate(() => { const m = window.__meadow; let n = 0, slide = 0, top = 0; while (n++ < 3000) { m.tick(1 / 60); if (m.moves.mode === 'slide') { slide++; top = Math.max(top, m.moves.speed); } if (!m.moves.mode && !m.moves.landing) break; } return { slide, top, mode: m.moves.mode, ok: m.geo.walkable(m.player.x, m.player.z), y: m.player.y, act: m.activity.current }; });
  expect(slid.slide, 'slid for a while').toBeGreaterThan(20);
  expect(slid.top, 'at a fair speed, no faster than the rule').toBeGreaterThan(3);
  expect(slid.top).toBeLessThanOrEqual(7.6);
  expect(slid.mode).toBeNull();
  expect(slid.ok, 'on ground you can stand on').toBe(true);
  expect(slid.y).toBeLessThan(high.y - 3);
  expect(slid.act).toBe('free');

  // the glider: back up the face, off it, and open the wing
  await page.evaluate((f) => { const m = window.__meadow; m.travelTo(f.x, f.z, f.x + f.dx * 5, f.z + f.dz * 5); }, f);
  await step(page, 0.3);
  await page.keyboard.down('KeyW'); await T(page, 1200); await page.keyboard.up('KeyW');
  expect((await moves(page)).mode).toBe('climb');
  await page.evaluate(() => window.__meadow.jump());
  await T(page, 24);
  expect(await page.evaluate(() => window.__meadow.jump()), 'Space in the air opens it').toBe(true);
  expect((await moves(page)).mode).toBe('glide');
  expect(await page.evaluate(() => window.__meadow.glider.open)).toBe(true);
  await T(page, 150);
  const g0 = await moves(page);
  await T(page, 60);
  const g1 = await moves(page);
  expect(g1.mode).toBe('glide');
  expect(g0.y - g1.y, 'sinking about 1.5 m a second').toBeGreaterThan(1.1);
  expect(g0.y - g1.y).toBeLessThan(1.9);
  expect(Math.hypot(g1.x - g0.x, g1.z - g0.z), 'at about 7 m/s').toBeGreaterThan(6);
  expect(Math.hypot(g1.x - g0.x, g1.z - g0.z)).toBeLessThan(8);
  // D turns you; Space folds the wing and you fall again; Space opens it again
  const r0 = await page.evaluate(() => window.__meadow.player.rot);
  await page.keyboard.down('KeyD'); await T(page, 60); await page.keyboard.up('KeyD');
  expect(Math.abs(await page.evaluate(() => window.__meadow.player.rot) - r0), 'turned').toBeGreaterThan(0.5);
  expect(await page.evaluate(() => window.__meadow.jump())).toBe(true);
  expect((await moves(page)).mode).toBe('air');
  expect(await page.evaluate(() => window.__meadow.glider.open)).toBe(false);
  await T(page, 10);
  await page.evaluate(() => window.__meadow.jump());
  expect((await moves(page)).mode).toBe('glide');
  // down to the ground, wherever that is: you end standing, or sliding to where you can
  const end = await page.evaluate(() => { const m = window.__meadow; let n = 0; while (n++ < 12000) { m.tick(1 / 60); if (!m.moves.mode && !m.moves.landing && !m.player.slide) break; } return { mode: m.moves.mode, ok: m.geo.walkable(m.player.x, m.player.z), act: m.activity.current, open: m.glider.open }; });
  expect(end.mode).toBeNull();
  expect(end.ok).toBe(true);
  expect(end.act).toBe('free');
  expect(end.open).toBe(false);
  // where the glider lies for a player without one: by a high place on home's continent
  const spot = await page.evaluate(() => window.__meadow.glider.spot);
  expect(spot, 'it lies somewhere').toBeTruthy();
  expect(['cairn', 'windmill', 'circle', 'castle', 'waystone']).toContain(spot.kind);
  noErrors(errors);
});
