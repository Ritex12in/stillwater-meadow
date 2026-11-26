// The map: the land you have explored (kept per world), and the places you have found marked on it.
import { test, expect } from './harness.js';
import { open, step, noErrors } from './helpers.js';

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
  await page.locator('#mapGo').click();
  await step(page, 0.5);
  const back = await page.evaluate(() => { const m = window.__meadow; return Math.hypot(m.player.x - m.home.x, m.player.z - m.home.z) / m.home.rmax; });
  expect(back, 'you stand by the home lake').toBeLessThan(2.5);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mapPanel')).toBeHidden();

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
