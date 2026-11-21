// Worlds: a new player gets a world of their own, kept in the save; each world keeps its own places.
import { test, expect } from './harness.js';
import { step, teleport, press, noErrors } from './helpers.js';

/** Load the game at an address as it is (no world pinned), and wait for it. */
async function visit(page, address) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) errors.push(m.text()); });
  await page.goto(address);
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  return errors;
}
const again = async (page, address) => {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // (the save is written as the page goes)
  await page.goto(address);
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
};
const world = (page) => page.evaluate(() => ({ seed: window.__meadow.seed, shown: document.getElementById('seedNo').textContent, bench: window.__meadow.store.benchBouquet || null }));

test('a new player gets a world of their own, kept in the save; each world keeps its own places, and an old save is world 1', async ({ page }) => {
  const errors = await visit(page, '/?weather=clear&season=summer#11');
  const mine = await world(page);
  expect(mine.seed, 'a world picked at random, not the first one').toBeGreaterThan(1);
  expect(mine.seed).toBeLessThanOrEqual(99999);
  expect(mine.shown, 'its number is shown').toBe(String(mine.seed));
  // leave a bouquet on the home bench in this world
  await step(page, 1.5);
  for (let k = 0; k < 3; k++) {
    const f = await page.evaluate(() => { const m = window.__meadow; return m.flowers().filter((it) => it.shown).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0]; });
    await teleport(page, f.x + 0.4, f.z);
    await press(page, 'KeyG', 0.8);
  }
  const b = await page.evaluate(() => window.__meadow.geo.bench());
  await teleport(page, b.x + Math.sin(b.rot) * 1.3, b.z + Math.cos(b.rot) * 1.3);
  await press(page, 'KeyG', 0.3);
  expect((await world(page)).bench, 'left on the bench').not.toBeNull();
  // the same world on coming back, with the bouquet where it was left
  await again(page, '/?weather=clear#11');
  const back = await world(page);
  expect(back.seed).toBe(mine.seed);
  expect(back.bench).not.toBeNull();
  // a link to another world takes you there: its bench is empty, and it is the world you are in from now on
  await again(page, '/?weather=clear&seed=7#11');
  expect(await world(page)).toEqual({ seed: 7, shown: '7', bench: null });
  await again(page, '/?weather=clear#11');
  expect((await world(page)).seed, 'the last world played').toBe(7);
  // back to your own world by its number: the bouquet is still on its bench
  await again(page, `/?weather=clear&seed=${mine.seed}#11`);
  const home = await world(page);
  expect(home.seed).toBe(mine.seed);
  expect(home.bench).toEqual(back.bench);
  // a number that is no world is ignored: you stay in the world you were in
  await again(page, '/?weather=clear&seed=abc#11');
  expect((await world(page)).seed).toBe(mine.seed);
  // a save from before worlds had numbers is world 1, with its places
  await page.evaluate(() => {
    localStorage.setItem('stillwater-meadow', JSON.stringify({ version: 2, lastVisit: Date.now() - 1000, settings: {}, journal: {}, benchBouquet: ['#ffffff:0', '#f6d65a:1', '#f19cb7:2'] }));
    Storage.prototype.setItem = function () {}; // (this page must not write its own save over the old one as it goes)
  });
  await page.goto('/?weather=clear#11');
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const old = await world(page);
  expect(old.seed).toBe(1);
  expect(old.bench).toEqual(['#ffffff:0', '#f6d65a:1', '#f19cb7:2']);
  noErrors(errors);
});
