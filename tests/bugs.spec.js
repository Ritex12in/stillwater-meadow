// Regression tests for the bugs found in the code review.
import { test, expect } from './harness.js';
import { open, step, teleport, actions, activity, press, noErrors } from './helpers.js';

test('boots without errors and shows the interface', async ({ page }) => {
  const errors = await open(page);
  await step(page, 1);
  await expect(page.locator('#clock')).toContainText(/am|pm/);
  await expect(page.locator('.toolbar')).toBeVisible();
  noErrors(errors);
});

test('thawing ice carries you back to the shore instead of trapping you', async ({ page }) => {
  const errors = await open(page, 'season=winter&weather=clear');
  await step(page, 1);
  const p = await page.evaluate(() => window.__meadow.geo.lakePoint(Math.PI / 2, 0.6));
  await teleport(page, p.x, p.z);
  await step(page, 0.5);
  expect(await page.evaluate(() => window.__meadow.geo.walkable(window.__meadow.player.x, window.__meadow.player.z))).toBe(true);
  // the season turns: ice melts under the player
  await page.evaluate(() => { window.__meadow.seasonState.ice = 0.5; });
  await step(page, 0.2);
  await page.evaluate(() => { window.__meadow.seasonState.ice = 0.5; });
  await step(page, 6);
  const end = await page.evaluate(() => { const m = window.__meadow; return { ok: m.geo.walkable(m.player.x, m.player.z), y: m.player.y }; });
  expect(end.ok).toBe(true);
  expect(end.y).toBeGreaterThan(0);
  await expect(page.locator('#toast')).toContainText('thawing');
  noErrors(errors);
});

test('lying down blocks petting and sitting until you get up', async ({ page }) => {
  const errors = await open(page, 'weather=clear', '#23');
  await step(page, 1);
  const cat = await page.evaluate(() => { const a = window.__meadow.animals.find((x) => x.kind === 'cat'); return { x: a.x, z: a.z }; });
  await teleport(page, cat.x + 1.4, cat.z);
  await press(page, 'KeyZ', 1.5);
  expect(await activity(page)).toBe('lie');
  const ids = (await actions(page)).map((a) => a.id);
  expect(ids).not.toContain('pet');
  expect(ids).not.toContain('sit');
  await press(page, 'KeyF', 0.5);
  expect(await activity(page)).toBe('lie');
  await press(page, 'KeyZ', 0.5);
  expect(await activity(page)).toBe('free');
  noErrors(errors);
});

test('photo mode and stargazing no longer fight over movement', async ({ page }) => {
  const errors = await open(page, 'weather=clear', '#23');
  await step(page, 1);
  await press(page, 'KeyZ', 1);
  expect(await activity(page)).toBe('lie');
  await page.keyboard.press('KeyP');
  await step(page, 0.8); // the old code unfroze movement 0.5 s after getting up, even inside photo mode
  expect(await activity(page)).toBe('photo');
  expect(await page.evaluate(() => window.__meadow.activity.locksMovement())).toBe(true);
  await page.keyboard.press('KeyP');
  await step(page, 0.2);
  expect(await activity(page)).toBe('lie');
  noErrors(errors);
});

test('Enter on the focused Save button saves one photo, not two', async ({ page }) => {
  const errors = await open(page);
  await step(page, 0.5);
  await page.keyboard.press('KeyP');
  await page.locator('#photoSave').focus();
  await page.keyboard.press('Enter');
  await step(page, 0.3);
  expect(await page.evaluate(() => window.__meadow.photoSaves())).toBe(1);
  noErrors(errors);
});

test('with sound saved as on, the first click on Sound turns it on (not on-then-off)', async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.setItem('stillwater-meadow', JSON.stringify({ version: 2, sound: true, settings: {}, journal: {} })));
  const errors = await open(page);
  await page.locator('#sound').click();
  await step(page, 0.2);
  expect(await page.evaluate(() => window.__meadow.audio.enabled)).toBe(true);
  await expect(page.locator('#soundLabel')).toHaveText('Sound on');
  noErrors(errors);
});

test('audio pauses while the tab is hidden', async ({ page }) => {
  const errors = await open(page);
  await page.locator('#sound').click();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => window.__meadow.audio.ctx.state === 'suspended');
  noErrors(errors);
});

test('the lake does not freeze around the boat during a tour', async ({ page }) => {
  const errors = await open(page, 'season=summer&weather=clear');
  await step(page, 0.5);
  const bp = await page.evaluate(() => window.__meadow.BOARD_POINT);
  await teleport(page, bp.x, bp.z);
  await press(page, 'KeyE', 4);
  expect(await page.evaluate(() => window.__meadow.ferry.state)).toBe('touring');
  await page.locator('[data-panel="worldPanel"]').click();
  await page.locator('[data-season="winter"]').click();
  await step(page, 40);
  const s = await page.evaluate(() => ({ ice: window.__meadow.seasonState.ice, ferry: window.__meadow.ferry.state }));
  if (s.ferry === 'touring') expect(s.ice).toBeLessThanOrEqual(0.21);
  noErrors(errors);
});

test('name tags are drawn in the scene, so things in front can hide them', async ({ page }) => {
  const errors = await open(page);
  await step(page, 0.5);
  const tagged = await page.evaluate(() => {
    const a = window.__meadow.animals[0];
    a.name = 'Biscuit';
    window.__meadow.tick(1 / 30);
    const sprite = a.head.children.find((c) => c.isSprite);
    return sprite ? sprite.material.depthTest : null;
  });
  expect(tagged).toBe(true);
  noErrors(errors);
});

test('the save keeps time, weather and the flowers you picked across a reload', async ({ page }) => {
  const errors = await open(page, '', '');
  await step(page, 0.5);
  for (let k = 0; k < 2; k++) {
    const f = await page.evaluate(() => { const m = window.__meadow; return m.flowers().filter((it) => it.shown).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0]; });
    await teleport(page, f.x + 0.4, f.z);
    await press(page, 'KeyG', 0.8);
  }
  await page.evaluate(() => { const m = window.__meadow; m.timeCtl.live = false; m.timeCtl.target = 21; m.wx.auto = false; m.wx.type = 'fog'; });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player);
  const s = await page.evaluate(() => ({ live: window.__meadow.timeCtl.live, target: window.__meadow.timeCtl.target, wx: window.__meadow.wx.type, auto: window.__meadow.wx.auto, bouquet: window.__meadow.pack.count('flower') }));
  expect(s.live).toBe(false);
  expect(Math.round(s.target)).toBe(21);
  expect(s.wx).toBe('fog');
  expect(s.auto).toBe(false);
  expect(s.bouquet, 'the picked flowers are still in the backpack').toBe(2);
  noErrors(errors);
});
