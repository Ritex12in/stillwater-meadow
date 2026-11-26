// The map: the land you have explored (kept per world), and the places you have found marked on it.
import { test, expect } from './harness.js';
import { open, step, press, actions, toastText, noErrors } from './helpers.js';

const BACK = [23, 32, 39]; // (the unexplored dark: ui/map.js BACK)
const state = (page) => page.evaluate(() => { const v = window.__meadow.map; return { open: v.open, cells: v.cells, chosen: v.chosen, marks: v.marks, follow: v.follow }; });

test('the map shows only the land you have explored, fills in as you walk, marks the places you have found, and is kept per world', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 1.5);
  const at = await page.evaluate(() => { const m = window.__meadow, p = m.player; return { x: p.x, z: p.z, here: m.map.explored(p.x, p.z), far: m.map.explored(p.x + 600, p.z), cells: m.map.cells, open: m.map.open }; });
  expect(at.open).toBe(false);
  expect(at.here, 'where you stand is explored').toBe(true);
  expect(at.far, 'land you have not been to is not').toBe(false);
  expect(at.cells, 'about 190 m round you').toBeGreaterThan(80);
  expect(at.cells).toBeLessThan(160);

  // M opens it (U is the music now); the land about you is drawn, the land beyond is dark
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  await expect(page.locator('#mapPanel')).toBeVisible();
  expect(await page.locator('#musicBtn').getAttribute('aria-pressed'), 'M no longer starts the music').toBe('false');
  const seen = await page.evaluate(([x, z]) => { const v = window.__meadow.map, left = v.settle(); return { left, near: [[70, 0], [0, 70], [-70, -40]].map(([dx, dz]) => v.colourAt(x + dx, z + dz)), far: v.colourAt(x + 600, z) }; }, [at.x, at.z]);
  expect(seen.left, 'every cell in view is painted').toBe(0);
  for (const c of seen.near) expect(c, 'explored land is drawn').not.toEqual(BACK);
  expect(seen.far, 'unexplored land is dark').toEqual(BACK);
  expect(await page.locator('#mapSummary').textContent()).toMatch(/0\.1 km² explored · \d+ places?/);
  // only places you have found are marked: the home lake is, the other lakes about are not
  const s0 = await state(page), lakes = await page.evaluate(() => window.__meadow.lakes(1500).map((L) => 'lake:' + L.id)), found = await page.evaluate(() => window.__meadow.found().map((f) => f.id));
  expect(s0.marks.map((k) => k.id)).toContain('lake:home');
  expect(s0.marks.every((k) => found.includes(k.id)), 'nothing unfound is marked').toBe(true);
  expect(lakes.filter((id) => !found.includes(id)).length, 'there are lakes about not yet found').toBeGreaterThan(2);

  // walking on fills the map in
  await page.evaluate(([x, z]) => { window.__meadow.travelTo(x + 600, z); }, [at.x, at.z]);
  await step(page, 1);
  const then = await page.evaluate(([x, z]) => { const m = window.__meadow, v = m.map; v.settle(); return { cells: v.cells, far: v.explored(m.player.x, m.player.z), drawn: v.colourAt(m.player.x + 50, m.player.z + 50), back: v.colourAt(x + 70, z), px: m.player.x, pz: m.player.z }; }, [at.x, at.z]);
  expect(then.far).toBe(true);
  expect(then.cells).toBeGreaterThan(at.cells + 60);
  expect(then.drawn).not.toEqual(BACK);
  expect(then.back, 'and what you saw before stays').not.toEqual(BACK);

  // choose the home lake on the map and go back to it
  const home = (await state(page)).marks.find((k) => k.id === 'lake:home'), box = await page.locator('#mapCanvas').boundingBox();
  expect(home, 'the home lake is in view').toBeTruthy();
  await page.mouse.click(box.x + home.x, box.y + home.y);
  expect((await state(page)).chosen).toBe('lake:home');
  await expect(page.locator('#mapPlace')).toContainText('Stillwater');
  await page.locator('#mapGo').click(); // (home is a point you can always travel to: the view fades, and you are there)
  await page.waitForFunction(() => { const m = window.__meadow; return !m.waypoints.busy && Math.hypot(m.player.x - m.home.x, m.player.z - m.home.z) / m.home.rmax < 2.5; }, null, { timeout: 90000 }); // (the software renderer takes its time making the land you arrive in)
  await step(page, 0.5);
  await expect(page.locator('#mapPanel'), 'the map closes as you arrive').toBeHidden();
  // another panel takes the map's place: it is closed, not left working unseen
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  expect((await state(page)).open).toBe(true);
  await page.keyboard.press('KeyI');
  await step(page, 0.2);
  await expect(page.locator('#mapPanel')).toBeHidden();
  expect((await state(page)).open).toBe(false);
  await page.keyboard.press('Escape');

  // kept with the save: the same after a reload; another world starts blank; this one is there on coming back
  const kept = (await state(page)).cells;
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const after = await page.evaluate(([x, z]) => { const v = window.__meadow.map; return { cells: v.cells, far: v.explored(x + 600, z) }; }, [at.x, at.z]);
  expect(after.cells).toBeGreaterThanOrEqual(kept);
  expect(after.cells).toBeLessThan(kept + 40);
  expect(after.far).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await open(page, 'weather=clear&seed=2');
  await step(page, 1);
  expect((await state(page)).cells, 'another world: only where you stand').toBeLessThan(160);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await open(page, 'weather=clear');
  expect((await state(page)).cells, 'and the first world as you left it').toBeGreaterThanOrEqual(kept);
  noErrors(errors);
});

test('waystones: one to a stretch of country, asleep until you wake it; then you can travel to it from the map, and it stays awake', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 1);
  // where they stand: by the seed, spread out, on dry ground clear of home
  const land = await page.evaluate(async () => {
    const m = window.__meadow, H = m.home, S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')));
    const all = S.sitesNear(H.x, H.z, 4000, 'waystone');
    let gap = Infinity;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) gap = Math.min(gap, Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z));
    return { n: all.length, key: JSON.stringify(all.map((s) => [s.id, s.x, s.z])), gap, home: Math.hypot(all[0].x - H.x, all[0].z - H.z),
      dry: all.every((s) => m.geo.height(s.x, s.z) > 1 && m.geo.lakeT(s.x, s.z) > 2 && !m.geo.riverNear(s.x, s.z)), first: { id: all[0].id, x: all[0].x, z: all[0].z } };
  });
  expect(land.n, 'a fair number within four kilometres').toBeGreaterThan(10);
  expect(land.gap, 'well apart').toBeGreaterThan(600);
  expect(land.home, 'none by the home lake').toBeGreaterThan(600);
  expect(land.dry, 'each on dry ground, clear of lakes and rivers').toBe(true);
  // in play the lists that take you anywhere are gone; to begin with you can travel home, and nowhere else
  await page.locator('[data-panel="worldPanel"]').click();
  await expect(page.locator('#hereNow')).toBeVisible();
  await expect(page.locator('#placesBox')).toBeHidden();
  await expect(page.locator('#countriesBox')).toBeHidden();
  await page.keyboard.press('Escape');
  const w0 = await page.evaluate(() => window.__meadow.waypoints);
  expect(w0.awake).toEqual([]);
  expect(w0.points.map((p) => p.kind)).toEqual(['home']);
  expect(w0.asleep.map((s) => s.id)).toContain(land.first.id);

  // walk up to the nearest: it stands there asleep, shown dimly on the map, and cannot be travelled to
  const s = land.first;
  await page.evaluate((s) => { window.__meadow.travelTo(s.x - 1.5, s.z + 3, s.x, s.z); }, s);
  await step(page, 1.5);
  expect(await page.evaluate(() => window.__meadow.landmarks().some((l) => l.kind === 'waystone')), 'the stone stands there').toBe(true);
  expect((await actions(page)).map((a) => a.id)).toContain('waystone-wake');
  expect(await page.evaluate(() => window.__meadow.found().some((f) => f.kind === 'waystone')), 'a waystone is woken, not found').toBe(false);
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  let mark = (await state(page)).marks.find((k) => k.id === s.id);
  expect(mark && mark.awake, 'marked on the map, asleep').toBe(false);
  await page.keyboard.press('Escape');
  // wake it
  await press(page, 'KeyE', 0.5);
  const w1 = await page.evaluate(() => window.__meadow.waypoints);
  expect(w1.awake.map((w) => w.id)).toEqual([s.id]);
  expect(w1.awake[0].name).toMatch(/ waystone$/);
  expect(w1.asleep.map((q) => q.id)).not.toContain(s.id);
  expect(await toastText(page)).toContain('is awake');
  expect((await actions(page)).map((a) => a.id)).toContain('waystone-map');

  // from home, choose it on the map and travel: the view fades, you stand by the stone, the map has closed
  await page.evaluate(() => { const m = window.__meadow; m.travelTo(m.spawn.x, m.spawn.z); });
  await step(page, 1);
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  await page.locator('#mapOut').click();
  await page.locator('#mapOut').click();
  await step(page, 0.2);
  mark = (await state(page)).marks.find((k) => k.id === s.id);
  expect(mark && mark.awake, 'marked on the map, awake').toBe(true);
  await expect(page.locator('#mapGo')).toBeHidden();
  const box = await page.locator('#mapCanvas').boundingBox();
  await page.mouse.click(box.x + mark.x, box.y + mark.y);
  expect((await state(page)).chosen).toBe(s.id);
  await expect(page.locator('#mapGo')).toBeVisible();
  await page.locator('#mapGo').click();
  await page.waitForFunction(([x, z]) => { const m = window.__meadow; return !m.waypoints.busy && Math.hypot(m.player.x - x, m.player.z - z) < 6; }, [s.x, s.z], { timeout: 90000 }); // (the software renderer takes its time making the land you arrive in)
  await step(page, 0.5);
  await expect(page.locator('#mapPanel')).toBeHidden();
  expect(await page.locator('#fade').evaluate((el) => el.classList.contains('on')), 'the view has faded back in').toBe(false);

  // it stays awake
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  expect((await page.evaluate(() => window.__meadow.waypoints.awake)).map((w) => w.id)).toEqual([s.id]);
  // and the stones stand where they did, though this visit began out by the stone and came on the land another way
  const again = await page.evaluate(async () => {
    const m = window.__meadow, H = m.home, S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')));
    return { key: JSON.stringify(S.sitesNear(H.x, H.z, 4000, 'waystone').map((q) => [q.id, q.x, q.z])), far: Math.hypot(m.player.x - H.x, m.player.z - H.z) };
  });
  expect(again.far, 'begun away from home').toBeGreaterThan(600);
  expect(again.key).toBe(land.key);
  noErrors(errors);
});
