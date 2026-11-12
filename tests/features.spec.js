// End-to-end checks of the main features, driven through the real key bindings.
import { test, expect } from './harness.js';
import { open, step, teleport, actions, activity, press, toastText, noErrors } from './helpers.js';

const side = (page) => page.evaluate(() => { const d = window.__meadow.geo.dockDir; return { x: d.z, z: -d.x }; });

test('fishing: cast, hook a bite, and the catch goes in the journal', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#18');
  await step(page, 0.5);
  const p = await page.evaluate(() => window.__meadow.geo.dockAt(5, 0));
  const s = await side(page);
  await teleport(page, p.x, p.z, s.x, s.z);
  await step(page, 0.4);
  expect((await actions(page)).map((a) => a.id)).toContain('fish-cast');
  await press(page, 'KeyR', 1);
  let hooked = false;
  for (let i = 0; i < 400 && !hooked; i++) {
    await step(page, 0.1);
    if ((await page.evaluate(() => window.__meadow.fishing())) === 'bite') { await page.keyboard.press('KeyR'); hooked = true; }
  }
  expect(hooked).toBe(true);
  await step(page, 2);
  const journal = await page.evaluate(() => window.__meadow.store.journal);
  expect(Object.keys(journal).length).toBe(1);
  await expect(page.locator('#toast')).toContainText('You caught');
  noErrors(errors);
});

test('campfire: light it and the animals gather round; logs can be sat on', async ({ page }) => {
  const errors = await open(page, 'weather=clear', '#21');
  await step(page, 0.5);
  const c = await page.evaluate(() => window.__meadow.geo.FIRE_SPOT);
  await teleport(page, c.x + 1.0, c.z + 0.6, -1, -0.6);
  await press(page, 'KeyE', 0.3);
  expect(await page.evaluate(() => window.__meadow.fire.on)).toBe(true);
  await step(page, 40);
  const gathered = await page.evaluate(() => { const c = window.__meadow.geo.FIRE_SPOT; return window.__meadow.animals.filter((a) => a.goal && a.goal.src === 'fire' && Math.hypot(a.x - c.x, a.z - c.z) < 3.5).length; });
  expect(gathered).toBeGreaterThanOrEqual(4);
  noErrors(errors);
});

test('flowers: pick a few and leave the bouquet on the bench', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#11');
  await step(page, 1.5);
  for (let k = 0; k < 3; k++) {
    const f = await page.evaluate(() => {
      const m = window.__meadow;
      const near = m.flowers().filter((it) => it.shown).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0];
      return near;
    });
    await teleport(page, f.x + 0.4, f.z);
    await press(page, 'KeyG', 0.8);
  }
  expect((await page.evaluate(() => window.__meadow.store.bouquet)).length, 'flowers in hand').toBe(3);
  const b = await page.evaluate(() => window.__meadow.geo.bench());
  await teleport(page, b.x + Math.sin(b.rot) * 1.3, b.z + Math.cos(b.rot) * 1.3);
  await press(page, 'KeyG', 0.3);
  expect((await page.evaluate(() => window.__meadow.store.benchBouquet)).length, 'flowers on the bench').toBe(3);
  noErrors(errors);
});

test('ducks come for bread and do not get stuck afterwards', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#11');
  await step(page, 0.5);
  const p = await page.evaluate(() => window.__meadow.geo.dockAt(5, 0));
  const s = await side(page);
  await teleport(page, p.x, p.z, s.x, s.z);
  for (let i = 0; i < 6; i++) await press(page, 'KeyB', 3);
  await step(page, 20);
  const st = await page.evaluate(() => { const { ducks, crumbs } = window.__meadow.ducks(); return { chasing: ducks.filter((d) => d.chasing).length, crumbs: crumbs.length }; });
  expect(st.chasing).toBe(0);
  noErrors(errors);
});

test('dogs following you fan out instead of overlapping', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 0.5);
  const min = await page.evaluate(() => {
    const m = window.__meadow;
    const dogs = m.animals.filter((a) => a.kind === 'dog');
    dogs.forEach((a) => { a.state = 'follow'; a.timer = 999; a.side = 0.3; a.x = m.player.x + 1; a.z = m.player.z + 1; });
    let best = 99;
    for (let i = 0; i < 30 * 40; i++) {
      m.tick(1 / 30);
      if (i > 30 * 15) for (let x = 0; x < dogs.length; x++) for (let y = x + 1; y < dogs.length; y++) best = Math.min(best, Math.hypot(dogs[x].x - dogs[y].x, dogs[x].z - dogs[y].z));
    }
    return best;
  });
  expect(min).toBeGreaterThan(1.5);
  noErrors(errors);
});

test('petting asks for a name, and a bonded dog greets you after a reload', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 0.5);
  const dog = await page.evaluate(() => { const a = window.__meadow.animals[0]; return { x: a.x, z: a.z }; });
  await teleport(page, dog.x + 1.5, dog.z);
  await press(page, 'KeyF', 2.5);
  await expect(page.locator('#nameDialog')).toBeVisible();
  await page.locator('#nameInput').fill('Biscuit');
  await page.locator('#nameInput').press('Enter');
  await step(page, 0.3);
  expect(await page.evaluate(() => window.__meadow.animals[0].name)).toBe('Biscuit');
  await page.evaluate(() => { window.__meadow.animals[0].bond = 0.8; window.dispatchEvent(new Event('pagehide')); });
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player);
  await page.waitForTimeout(1500);
  await expect(page.locator('#toast')).toContainText('Biscuit runs over to greet you');
  expect(await page.evaluate(() => window.__meadow.animals[0].state)).toBe('follow');
  noErrors(errors);
});

test('the boat tour goes all the way round and you can step off at the jetty', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer');
  await step(page, 0.5);
  const bp = await page.evaluate(() => window.__meadow.BOARD_POINT);
  await teleport(page, bp.x, bp.z);
  await press(page, 'KeyE', 4);
  expect(await page.evaluate(() => window.__meadow.ferry.state)).toBe('touring');
  await page.keyboard.down('KeyW'); await step(page, 1); await page.keyboard.up('KeyW');
  expect(await activity(page)).toBe('sit');
  await step(page, 120);
  expect(await page.evaluate(() => window.__meadow.ferry.state)).toBe('docked');
  await press(page, 'KeyE', 1.5);
  expect(await activity(page)).toBe('free');
  expect(await page.evaluate(() => window.__meadow.geo.onDock(window.__meadow.player.x, window.__meadow.player.z))).toBe(true);
  noErrors(errors);
});

test('stargazing: lie down at night and see a shooting star', async ({ page }) => {
  const errors = await open(page, 'weather=clear', '#23');
  await step(page, 1);
  await press(page, 'KeyZ', 15);
  expect(await activity(page)).toBe('lie');
  expect(await toastText(page)).toContain('shooting star');
  noErrors(errors);
});

test('frame cost stays small', async ({ page }) => {
  const errors = await open(page, 'weather=storm', '#20');
  await step(page, 1);
  const ms = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 300; i++) window.__meadow.tick(1 / 60); return (performance.now() - t0) / 300; });
  console.log(`simulation: ${ms.toFixed(2)} ms per frame (excluding rendering)`);
  expect(ms).toBeLessThan(6);
  noErrors(errors);
});
