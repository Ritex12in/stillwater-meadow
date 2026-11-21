// Worlds: a new player gets a world of their own, kept in the save; each world keeps its own places.
import { test, expect } from './harness.js';
import { open, step, teleport, press, noErrors } from './helpers.js';

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

test('a new player gets a world of their own, kept in the save; any text is a seed; each world keeps its own places, and an old save is world 1', async ({ page }) => {
  const errors = await visit(page, '/?weather=clear&season=summer#11');
  const mine = await world(page);
  expect(mine.seed, 'a world picked at random, not the first one').toBeGreaterThan(1);
  expect(mine.seed).toBeLessThanOrEqual(4294967295);
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
  // an empty seed is ignored: you stay in the world you were in
  await again(page, '/?weather=clear&seed=%20#11');
  expect((await world(page)).seed).toBe(mine.seed);
  // any text is a seed, as in Minecraft: the same text, the same world; other text, another world
  await again(page, '/?weather=clear&seed=' + encodeURIComponent('Cherry valley') + '#11');
  const text = await world(page);
  expect(text.shown).toBe('Cherry valley');
  const land = () => page.evaluate(() => { const m = window.__meadow; return [m.home.x, m.home.z, m.geo.height(m.home.x + 300, m.home.z - 200)].map((v) => v.toFixed(3)).join(','); });
  const cherry = await land();
  await again(page, '/?weather=clear&seed=' + encodeURIComponent('Cherry valley') + '#11');
  expect((await world(page)).seed).toBe(text.seed);
  expect(await land(), 'the same text, the same land').toBe(cherry);
  await again(page, '/?weather=clear&seed=' + encodeURIComponent('Cherry valley!') + '#11');
  expect((await world(page)).seed).not.toBe(text.seed);
  expect(await land(), 'other text, other land').not.toBe(cherry);
  // a number with leading zeros is that number
  await again(page, '/?weather=clear&seed=007#11');
  expect(await world(page)).toEqual({ seed: 7, shown: '7', bench: null });
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

test('the backpack holds what you carry in slots, and the compass points true: north as the sky has it, home and the shrine marked', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await step(page, 0.5);
  // nothing carried yet
  expect((await page.evaluate(() => window.__meadow.backpack())).every((x) => x === null)).toBe(true);
  await press(page, 'KeyI', 0.2);
  expect(await page.locator('#backpack').isVisible()).toBe(true);
  await expect(page.locator('#packGrid .slot')).toHaveCount(24);
  await expect(page.locator('#packInfo')).toContainText('Nothing yet');
  await press(page, 'KeyI', 0.2);
  // a rod and two fish of one kind: two slots, the fish stacked
  await page.evaluate(() => { const p = window.__meadow.pack; p.add('rod'); p.add('fish', 'perch', 20); p.add('fish', 'perch', 24); });
  const held = (await page.evaluate(() => window.__meadow.backpack())).filter(Boolean);
  expect(held.map((t) => `${t.type} ${t.name} ${t.n}`)).toEqual(['rod Fishing rod 1', 'fish Yellow Perch 2']);
  await press(page, 'KeyI', 0.2);
  await expect(page.locator('#packGrid .slot.full')).toHaveCount(2);
  await page.locator('#packGrid .slot.full').nth(1).click();
  await expect(page.locator('#packInfo')).toContainText('20 cm, 24 cm');
  await press(page, 'KeyI', 0.2);

  // the compass: facing north (-z) reads 0, facing east (+x) reads 90 (the sun rises in the east: +x)
  const heading = async (fx, fz) => {
    const p = await page.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z }));
    await teleport(page, p.x, p.z, fx, fz);
    await step(page, 1.2); // (the camera eases round)
    return page.evaluate(() => window.__meadow.compass().heading);
  };
  const north = await heading(0, -1), east = await heading(1, 0);
  expect(Math.min(north, 360 - north)).toBeLessThan(3);
  expect(Math.abs(east - 90)).toBeLessThan(3);
  const sunrise = await page.evaluate(() => { const m = window.__meadow; m.timeCtl.live = false; m.timeCtl.target = m.timeCtl.hour = 6.5; m.tick(0.01); return { x: m.sunDir.x, z: m.sunDir.z }; });
  expect(sunrise.x, 'the sun comes up in the east').toBeGreaterThan(0.5);

  // far from home: the home lake is marked, the way it lies, and the nearest shrine is marked too
  const far = await page.evaluate(() => { const m = window.__meadow, L = m.lakes(3000).filter((q) => q.settled && q.id !== 'home').pop(); m.visitLake(L.id); for (let i = 0; i < 20; i++) m.tick(1 / 30); return { name: L.name }; });
  await expect(page.locator('#toast')).toContainText(far.name);
  const marks = await page.evaluate(() => { const m = window.__meadow; for (let i = 0; i < 20; i++) m.tick(1 / 30); return { view: m.compass(), p: { x: m.player.x, z: m.player.z }, home: m.home, shrine: m.shrines(2500)[0] }; });
  const home = marks.view.marks.find((k) => k.kind === 'home');
  expect(home, 'home is on the compass').toBeTruthy();
  const want = ((Math.atan2(marks.home.x - marks.p.x, -(marks.home.z - marks.p.z)) * 180) / Math.PI + 360) % 360;
  expect(Math.abs(((home.bearing - want + 540) % 360) - 180)).toBeLessThan(1);
  expect(marks.view.marks.some((k) => k.kind === 'shrine' && k.name === marks.shrine.name)).toBe(true);
  expect(marks.view.marks.length).toBeLessThanOrEqual(4);
  noErrors(errors);
});

test('an older save moves what you carried into the backpack: the rod, the fish from the creel, the pine cones', async ({ page }) => {
  const errors = await visit(page, '/?seed=1&weather=clear#12');
  await page.evaluate(() => {
    localStorage.setItem('stillwater-meadow', JSON.stringify({ version: 2, seed: 1, lastVisit: Date.now() - 1000, settings: {}, journal: { perch: { n: 2, best: 24 } }, creel: [{ id: 'perch', cm: 20 }, { id: 'carp', cm: 41 }, { id: 'perch', cm: 24 }], cones: 3 }));
    Storage.prototype.setItem = function () {}; // (this page must not write its own save over the old one as it goes)
  });
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const got = await page.evaluate(() => window.__meadow.pack.view().filter(Boolean).map((it) => `${it.type}:${it.key || ''}:${it.n}:${(it.list || []).join('/')}`));
  expect(got).toEqual(['rod::1:', 'fish:perch:2:20/24', 'fish:carp:1:41', 'cone::3:']);
  expect(await page.evaluate(() => window.__meadow.rod())).toMatchObject({ rod: true, cones: 3 });
  noErrors(errors);
});
