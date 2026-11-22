// Exploring: places found and gone back to, postcards, your own camp and lanterns, skating, the
// floating islands' updraft, the flower journal, the view distance, and the imported character.
import { test, expect } from './harness.js';
import { open, step, teleport, press, actions, noErrors } from './helpers.js';

const nearestSite = (page, kind) => page.evaluate(async (kind) => {
  const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
  const SH = await import(url('/src/core/shape.js')), m = window.__meadow;
  const s = SH.sitesNear(m.home.x, m.home.z, 6000, kind)[0];
  return s ? { x: s.x, z: s.z, y: s.y, id: s.id } : null;
}, kind);

test('places: coming to one finds it, the journal lists it, you can go back from there, and a photo there is a postcard', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await step(page, 1.2);
  expect((await page.evaluate(() => window.__meadow.found())).map((f) => f.kind), 'the home lake, found as you start').toContain('lake');
  const c = await nearestSite(page, 'castle');
  expect(c, 'a castle somewhere near').not.toBeNull();
  await page.evaluate((c) => { const m = window.__meadow; m.travelTo(c.x + 30, c.z); for (let i = 0; i < 45; i++) m.tick(1 / 30); }, c);
  const found = await page.evaluate(() => window.__meadow.found());
  expect(found.some((f) => f.kind === 'castle'), 'the castle found').toBe(true);
  expect(await page.evaluate(() => window.__meadow.landmarks().some((l) => l.kind === 'castle')), 'and standing there').toBe(true);
  // go home, then back to it from the journal
  await page.evaluate(() => { const m = window.__meadow; m.travelTo(m.spawn.x, m.spawn.z); for (let i = 0; i < 5; i++) m.tick(1 / 30); });
  await page.keyboard.press('KeyJ');
  await step(page, 0.2);
  const row = page.locator('#placeList li', { hasText: 'Castle' }).first();
  await row.locator('button', { hasText: 'Go' }).click();
  await step(page, 0.5);
  const at = await page.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z }));
  expect(Math.hypot(at.x - c.x, at.z - c.z), 'back at the castle').toBeLessThan(40);
  await page.keyboard.press('Escape');
  // a photo here is a postcard of it
  await page.keyboard.press('KeyP');
  await step(page, 0.3);
  await page.click('#photoSave');
  await step(page, 0.5);
  await page.click('#photoExit');
  const cards = await page.evaluate(() => (window.__meadow.store.postcards || []).map((p) => p.kind));
  expect(cards).toContain('castle');
  noErrors(errors);
});

test('your own camp and lanterns: pitch the tent, set lanterns down and pick them up; they stay in this world', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await step(page, 0.5);
  expect(await page.evaluate(() => window.__meadow.pack.count('lantern'))).toBe(8);
  // pitch the tent: from the backpack
  const spot = await page.evaluate(() => { const m = window.__meadow, h = m.home, d = 1 / Math.hypot(m.spawn.x - h.x, m.spawn.z - h.z); return { x: m.spawn.x + (m.spawn.x - h.x) * d * 10, z: m.spawn.z + (m.spawn.z - h.z) * d * 10, fx: (m.spawn.x - h.x) * d, fz: (m.spawn.z - h.z) * d }; });
  await teleport(page, spot.x, spot.z, spot.fx, spot.fz);
  await page.evaluate((s) => { window.__meadow.player.rot = Math.atan2(s.fx, s.fz); }, spot);
  await page.keyboard.press('KeyI');
  await step(page, 0.2);
  await page.locator('#packGrid .slot.full', { has: page.locator('svg') }).first().click();
  const tentSlot = page.locator('#packGrid .slot.full[title="Tent"]');
  await tentSlot.click();
  await page.locator('#packInfo button', { hasText: 'Pitch camp here' }).click();
  await step(page, 0.3);
  const camp = await page.evaluate(() => window.__meadow.store.camp);
  expect(camp, 'pitched').toBeTruthy();
  expect(await page.evaluate(() => window.__meadow.compass().marks.some((k) => k.name === 'Your camp')), 'on the compass, from further off').toBe(false);
  // a lantern down, then picked up again
  await page.keyboard.press('KeyI');
  await step(page, 0.2);
  await page.locator('#packGrid .slot.full[title="Lantern"]').click();
  await page.locator('#packInfo button', { hasText: 'Set one down here' }).click();
  await step(page, 0.3);
  expect(await page.evaluate(() => ({ placed: window.__meadow.store.lanterns.length, left: window.__meadow.pack.count('lantern') }))).toEqual({ placed: 1, left: 7 });
  expect((await actions(page)).map((a) => a.id)).toContain('lantern-up');
  await press(page, 'KeyE', 0.3);
  expect(await page.evaluate(() => ({ placed: window.__meadow.store.lanterns.length, left: window.__meadow.pack.count('lantern') }))).toEqual({ placed: 0, left: 8 });
  // another world has no camp; this one keeps it
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.goto('/?seed=7&weather=clear&season=summer#12');
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  expect(await page.evaluate(() => window.__meadow.store.camp || null)).toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.goto('/?seed=1&weather=clear&season=summer#12');
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  expect(await page.evaluate(() => window.__meadow.store.camp)).toEqual(camp);
  noErrors(errors);
});

test('skating: on a frozen lake you gather speed and glide on after you let go', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=winter', '#12');
  await step(page, 1);
  const ice = await page.evaluate(() => window.__meadow.geo.lakePoint(1.9, 0.4));
  await teleport(page, ice.x, ice.z, 1, 0);
  await step(page, 0.3);
  await page.keyboard.down('KeyW'); await step(page, 1.2); await page.keyboard.up('KeyW');
  const a = await page.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z, skating: window.__meadow.player.skating }));
  await step(page, 0.6);
  const b = await page.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z }));
  expect(a.skating, 'skating on the ice').toBe(true);
  expect(Math.hypot(b.x - a.x, b.z - a.z), 'still gliding after letting go').toBeGreaterThan(0.4);
  noErrors(errors);
});

test('floating islands: the updraft lifts you onto one, you walk its top, its edge stops you, and you glide back down', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const s = await nearestSite(page, 'skyisle');
  expect(s, 'floating islands somewhere near').not.toBeNull();
  await page.evaluate((s) => { const m = window.__meadow; m.travelTo(s.x, s.z); for (let i = 0; i < 40; i++) m.tick(1 / 30); }, s);
  expect((await actions(page)).map((a) => a.id)).toContain('updraft');
  await press(page, 'KeyE', 0.5);
  const up = await page.evaluate(() => ({ y: window.__meadow.player.y, floor: window.__meadow.player.floor }));
  expect(up.floor, 'on the island').toBeTruthy();
  expect(up.y - s.y, 'high above the ground').toBeGreaterThan(40);
  await page.keyboard.down('KeyW'); await step(page, 12); await page.keyboard.up('KeyW');
  const edge = await page.evaluate(() => { const p = window.__meadow.player; return Math.hypot(p.x - p.floor.x, p.z - p.floor.z) - p.floor.r; });
  expect(edge, 'the edge stops you').toBeLessThan(0.01);
  await page.evaluate(() => { const p = window.__meadow.player; p.x = p.floor.x; p.z = p.floor.z; });
  await press(page, 'KeyE', 0.5);
  expect(await page.evaluate(() => !window.__meadow.player.floor && Math.abs(window.__meadow.player.y - window.__meadow.geo.height(window.__meadow.player.x, window.__meadow.player.z)) < 1), 'back on the ground').toBe(true);
  noErrors(errors);
});

test('the flower journal keeps each kind you pick, and where; the view distance setting draws less land when near', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#11');
  await step(page, 1.2);
  const f = await page.evaluate(() => { const m = window.__meadow; return m.flowers().filter((it) => it.shown).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0]; });
  await teleport(page, f.x + 0.4, f.z);
  await press(page, 'KeyG', 0.8);
  const fj = await page.evaluate(() => window.__meadow.store.flowerJournal);
  expect(Object.keys(fj).length).toBe(1);
  expect(Object.values(fj)[0].where).toBe('the meadows');
  await page.keyboard.press('KeyJ');
  await expect(page.locator('#flowerList li.got')).toHaveCount(1);
  await page.keyboard.press('Escape');
  const tiles = async (v) => page.evaluate((v) => { const m = window.__meadow; m.quality.opts.view = v; for (let i = 0; i < 5; i++) m.tick(1 / 30); m.ground.settle(m.player.x, m.player.z); return m.ground.stats().shown; }, v);
  const far = await tiles(2), mid = await tiles(1), near = await tiles(0);
  expect(near).toBeLessThan(mid);
  expect(mid).toBeLessThan(far);
  noErrors(errors);
});

test('the imported character (?hero=kaykit) loads, rigged and animated, and walks with you', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer&hero=kaykit', '#12');
  await page.waitForFunction(() => window.__meadow.rigged, null, { timeout: 60000 });
  const clips = await page.evaluate(() => window.__meadow.rigged.clips);
  for (const c of ['Idle', 'Walking_A', 'Running_A', 'Sit_Chair_Idle', 'Lie_Idle', 'Cheer']) expect(clips).toContain(c);
  noErrors(errors);
});

test('trails join the places: worn paths with no trees on them, and signposts naming where they go', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), m = window.__meadow, S = 57.6;
    const ends = SH.trailEndsNear(m.home.x, m.home.z, 3000);
    // walk the first trail from the home end: the ground is a trail all the way, and no tree stands on it
    let onTrail = 0, trees = 0, looked = 0;
    for (const e of ends.slice(0, 6)) for (let d = 10; d < Math.min(e.far - 10, 400); d += 7) {
      const x = e.x + Math.sin(e.toward) * d, z = e.z + Math.cos(e.toward) * d;
      let best = 0, bx = x, bz = z; for (let k = -16; k <= 16; k += 0.5) { const xx = x + Math.cos(e.toward) * k, zz = z - Math.sin(e.toward) * k, t = SH.trailAt(xx, zz); if (t > best) { best = t; bx = xx; bz = zz; } }
      looked++; if (best > 0.9) onTrail++;
      for (const t of m.wilds.square(Math.floor(bx / S), Math.floor(bz / S))) if (Math.hypot(t.x - bx, t.z - bz) < 1.2) trees++;
    }
    return { ends: ends.length, signs: m.signs(m.spawn.x, m.spawn.z), share: onTrail / looked, trees };
  });
  expect(r.ends, 'trails within 3 km of home').toBeGreaterThan(3);
  expect(r.signs.length, 'a signpost by the home lake').toBeGreaterThan(0);
  expect(r.signs[0].to.length).toBeGreaterThan(3);
  expect(r.share, 'the trails run on unbroken (but across lakes)').toBeGreaterThan(0.8);
  expect(r.trees, 'no tree stands on a trail').toBe(0);
  noErrors(errors);
});

test('the sea: never near home, not to be walked on, sand and palms by it, ships at anchor; travelling to a ship lands you on the shore', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), m = window.__meadow, H = m.home;
    let nearHome = 0;
    for (let d = 0; d < 2000; d += 100) for (let a = 0; a < 6.28; a += 0.3) if (SH.seaAt(H.x + Math.cos(a) * d, H.z + Math.sin(a) * d) > 0) nearHome++;
    let open = null;
    for (let d = 2000; d < 8000 && !open; d += 50) for (let a = 0; a < 6.28; a += 0.05) { const x = H.x + Math.cos(a) * d, z = H.z + Math.sin(a) * d; if (SH.seaAt(x, z) > 0.6 && SH.height(x, z) < -4) { open = { x, z }; break; } }
    const sites = SH.sitesNear(H.x, H.z, 8000), ships = sites.filter((s) => s.kind === 'ship');
    const drowned = sites.filter((s) => s.kind !== 'ship' && SH.height(s.x, s.z) < 0.5).map((s) => s.id);
    const homeLake = m.seaDrawnAt(H.x, H.z); // (the sheet, if near, is cut away over the land)
    const ship = ships[0];
    m.travelTo(ship.x, ship.z);
    for (let i = 0; i < 30; i++) m.tick(1 / 30);
    let palms = 0; const S = 57.6;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) palms += m.wilds.biome(Math.floor(m.player.x / S) + i, Math.floor(m.player.z / S) + j).palms.length;
    return { nearHome, open, walkOpen: open && SH.walkable(open.x, open.z), ships: ships.length, shipY: ships.map((s) => s.y), shipDeep: ships.every((s) => SH.height(s.x, s.z) < -5), drowned, homeLake,
      shore: SH.walkable(m.player.x, m.player.z), far: Math.hypot(m.player.x - ship.x, m.player.z - ship.z), sea: m.seaShown(), palms, lost: m.wilds.stats().dropped };
  });
  expect(r.nearHome, 'no sea within 2 km of home').toBe(0);
  expect(r.open, 'open sea within 8 km').not.toBeNull();
  expect(r.walkOpen, 'the sea is not to be walked on').toBe(false);
  expect(r.drowned, 'no building under the sea but the ships').toEqual([]);
  expect(r.ships, 'ships at anchor within 8 km').toBeGreaterThan(0);
  expect(r.shipDeep, 'ships ride in deep water').toBe(true);
  for (const y of r.shipY) expect(y).toBe(0);
  expect(r.homeLake, 'no sea drawn over the home lake').toBe(0);
  expect(r.shore, 'travelling to a ship lands you on dry ground').toBe(true);
  expect(r.far, 'on the shore nearest it').toBeLessThan(1200);
  expect(r.sea, 'the sea is shown by the coast').toBe(true);
  expect(r.palms, 'palms grow on the beaches about').toBeGreaterThan(0);
  expect(r.lost, 'nothing is dropped for want of a slot').toBe(0);
  noErrors(errors);
});
