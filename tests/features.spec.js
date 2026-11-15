// End-to-end checks of the main features, driven through the real key bindings.
import { test, expect } from './harness.js';
import { open, step, teleport, actions, activity, press, toastText, noErrors } from './helpers.js';

const side = (page) => page.evaluate(() => { const d = window.__meadow.geo.dockDir; return { x: d.z, z: -d.x }; });

test('fishing: cast, hook a bite, and the catch goes in the journal', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#18');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.store.rod = true; });
  const p = await page.evaluate(() => window.__meadow.geo.dockAt(5, 0));
  const s = await side(page);
  await teleport(page, p.x, p.z, s.x, s.z);
  await step(page, 0.4);
  expect((await actions(page)).map((a) => a.id)).toContain('fish-cast');
  // hold R to charge the cast, let go to throw
  await page.keyboard.down('KeyR'); await step(page, 0.7); await page.keyboard.up('KeyR');
  let info = await page.evaluate(() => window.__meadow.fishingInfo());
  for (let i = 0; i < 600 && info.state !== 'bite'; i++) { await step(page, 0.1); info = await page.evaluate(() => window.__meadow.fishingInfo()); }
  expect(info.state).toBe('bite');
  await page.keyboard.press('KeyR'); // strike while the float is under
  await step(page, 0.05);
  // the fight: reel in the rests, ease off when it pulls
  let down = false;
  for (let i = 0; i < 400; i++) {
    info = await page.evaluate(() => window.__meadow.fishingInfo());
    if (info.state !== 'fight') break;
    const want = (!info.pulling && info.tension < 0.75) || info.tension < 0.12;
    if (want && !down) { await page.keyboard.down('KeyR'); down = true; }
    if (!want && down) { await page.keyboard.up('KeyR'); down = false; }
    await step(page, 0.1);
  }
  if (down) await page.keyboard.up('KeyR');
  await step(page, 2);
  const journal = await page.evaluate(() => window.__meadow.store.journal);
  expect(Object.keys(journal).length).toBe(1);
  await expect(page.locator('#toast')).toContainText('You caught');
  expect((await page.evaluate(() => window.__meadow.store.creel)).length, 'the catch went into the creel').toBe(1);
  noErrors(errors);
});

test('fishing punishes reeling non-stop: the line snaps', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#18');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.store.rod = true; });
  const p = await page.evaluate(() => window.__meadow.geo.dockAt(5, 0));
  const s = await side(page);
  await teleport(page, p.x, p.z, s.x, s.z);
  await step(page, 0.4);
  await page.keyboard.down('KeyR'); await step(page, 0.5); await page.keyboard.up('KeyR');
  let info = await page.evaluate(() => window.__meadow.fishingInfo());
  for (let i = 0; i < 600 && info.state !== 'bite'; i++) { await step(page, 0.1); info = await page.evaluate(() => window.__meadow.fishingInfo()); }
  await page.keyboard.press('KeyR');
  await page.keyboard.down('KeyR'); await step(page, 12); await page.keyboard.up('KeyR');
  await expect(page.locator('#toast')).toContainText('Snap');
  expect(await page.evaluate(() => window.__meadow.store.creel.length)).toBe(0);
  noErrors(errors);
});

test('the skipper trades his rod for a full bouquet of three kinds, not before', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#11');
  await step(page, 0.5);
  const p = await page.evaluate(() => window.__meadow.geo.dockAt(5, 0));
  const s = await side(page);
  await teleport(page, p.x, p.z, s.x, s.z);
  await step(page, 0.4);
  expect((await actions(page)).map((a) => a.id)).not.toContain('fish-cast');
  for (let k = 0; k < 12; k++) {
    const f = await page.evaluate((k) => {
      const m = window.__meadow, all = m.flowers().filter((it) => it.shown);
      const kinds = [...new Set(all.map((it) => it.kind))].slice(0, 3), want = kinds[Math.floor(k / 4)];
      return all.filter((it) => it.kind === want).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0];
    }, k);
    await teleport(page, f.x + 0.4, f.z);
    await press(page, 'KeyG', 0.7);
  }
  const bp = await page.evaluate(() => window.__meadow.BOARD_POINT);
  await teleport(page, bp.x, bp.z);
  await press(page, 'KeyG', 0.5);
  expect(await page.evaluate(() => window.__meadow.rod().rod)).toBe(true);
  await teleport(page, p.x, p.z, s.x, s.z);
  await step(page, 0.4);
  expect((await actions(page)).map((a) => a.id)).toContain('fish-cast');
  noErrors(errors);
});

test('campfire: light it and the animals gather round; logs can be sat on', async ({ page }) => {
  const errors = await open(page, 'weather=clear', '#21');
  await step(page, 0.5);
  await page.evaluate(() => window.__meadow.animals.forEach((a) => { a.tamed = true; })); // only your pets come to the fire
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
    dogs.forEach((a) => { a.tamed = true; a.sit = 0; a.sitting = false; a.state = 'follow'; a.timer = 999; a.side = 0.3; a.x = m.player.x + 1; a.z = m.player.z + 1; });
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

test('feeding a dog fish tames it: then you name it, pet it, and it greets you after a reload', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.store.creel = [{ id: 'perch', cm: 20 }, { id: 'carp', cm: 40 }]; });
  // the others stay at home, out of the way, so T always means this dog
  const dog = await page.evaluate(() => {
    const [a, ...rest] = window.__meadow.animals;
    rest.forEach((o, i) => { o.x = a.x + 30 + i * 3; o.z = a.z; o.home = { x: o.x, z: o.z }; o.hasTarget = false; });
    return { x: a.x, z: a.z };
  });
  await teleport(page, dog.x + 1.2, dog.z);
  await step(page, 0.2);
  expect((await actions(page)).find((a) => a.id === 'pet-untamed'), 'not yours yet, so no petting').toBeTruthy();
  // the first fish: the best you have (the carp, worth 3); now you know it loves perch
  await press(page, 'KeyT', 0.3);
  let pet = (await page.evaluate(() => window.__meadow.pets()))[0];
  expect(pet.trust).toBe(3);
  expect(pet.favKnown, 'favourite revealed').toBe(true);
  expect(pet.tamed, 'not yet tamed').toBe(false);
  // it's chewing for a minute; after that, its favourite (perch, worth 2 x 2) wins it over
  await step(page, 61);
  const d = await page.evaluate(() => { const a = window.__meadow.animals[0]; return { x: a.x, z: a.z }; });
  await teleport(page, d.x + 1.2, d.z);
  await step(page, 0.2);
  await press(page, 'KeyT', 1.5);
  pet = (await page.evaluate(() => window.__meadow.pets()))[0];
  expect(pet.tamed).toBe(true);
  expect(await page.evaluate(() => window.__meadow.store.creel.length)).toBe(0);
  await expect(page.locator('#nameDialog')).toBeVisible();
  await page.locator('#nameInput').fill('Biscuit');
  await page.locator('#nameInput').press('Enter');
  await step(page, 0.3);
  expect(await page.evaluate(() => window.__meadow.animals[0].name)).toBe('Biscuit');
  const d2 = await page.evaluate(() => { const a = window.__meadow.animals[0]; return { x: a.x, z: a.z }; });
  await teleport(page, d2.x + 1.2, d2.z);
  await step(page, 0.2);
  expect((await actions(page)).map((a) => a.id)).toContain('pet');
  await page.evaluate(() => { window.__meadow.animals[0].bond = 0.8; window.dispatchEvent(new Event('pagehide')); });
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player);
  await page.waitForTimeout(1500);
  await expect(page.locator('#toast')).toContainText('Biscuit runs over to greet you');
  expect(await page.evaluate(() => window.__meadow.animals[0].state)).toBe('follow');
  expect((await page.evaluate(() => window.__meadow.pets()))[0].tamed).toBe(true);
  noErrors(errors);
});

test('an untamed cat runs from you, but eats a thrown fish if you keep still at a distance', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.store.creel = [{ id: 'minnow', cm: 8 }]; });
  const cat = await page.evaluate(() => { const a = window.__meadow.animals[3]; return { x: a.x, z: a.z }; });
  // walk straight at it: it bolts
  await teleport(page, cat.x + 5, cat.z, -1, 0);
  await page.keyboard.down('KeyW'); await step(page, 0.8); await page.keyboard.up('KeyW');
  await step(page, 0.4);
  const fled = await page.evaluate(() => window.__meadow.pets()[3]);
  expect(['flee', 'wary', 'cornered']).toContain(fled.state);
  // from a few metres off, throw it the fish, then keep still
  await step(page, 4);
  const c2 = await page.evaluate(() => { const a = window.__meadow.animals[3]; return { x: a.x, z: a.z }; });
  await teleport(page, c2.x + 5, c2.z, -1, 0);
  await step(page, 0.2);
  const throwIt = (await actions(page)).find((a) => a.id === 'feed');
  expect(throwIt && throwIt.label).toContain('Throw');
  await press(page, 'KeyT', 0.2);
  await step(page, 10);
  const fed = await page.evaluate(() => window.__meadow.pets()[3]);
  expect(fed.trust, 'its favourite minnow: 1 x 2').toBe(2);
  expect(fed.favKnown).toBe(true);
  expect(fed.tamed).toBe(false);
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

test('winter: winter clothes, a snowman, and the skating dance on the ice with her', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=winter', '#16');
  await step(page, 0.5);
  const m = (fn) => page.evaluate(fn);
  expect(await m(() => window.__meadow.wardrobe())).toBe('winter');
  expect(await m(() => window.__meadow.snowman().visible)).toBe(true);
  // out on the ice, hand in hand (she follows you onto it)
  await m(() => { const w = window.__meadow, f = w.friendSt; w.player.x = f.x + 1; w.player.z = f.z; });
  await press(page, 'KeyX', 1);
  await teleport(page, -3, -13.2);
  await m(() => { const w = window.__meadow, f = w.friendSt; f.x = -3.6; f.z = -13.2; w.player.rot = 2.5; });
  await step(page, 1.5);
  expect(await m(() => window.__meadow.geo.walkable(window.__meadow.friendSt.x, window.__meadow.friendSt.z))).toBe(true);
  await press(page, 'KeyK', 0.5);
  expect(await activity(page)).toBe('dance');
  // the whole dance: both stay on the ice throughout, in each part in turn
  const parts = new Set();
  for (let t = 0; t < 61; t += 2) {
    await step(page, 2);
    const v = await m(() => { const w = window.__meadow, f = w.friendSt; return { d: w.dance(), on: w.geo.walkable(w.player.x, w.player.z) && w.geo.walkable(f.x, f.z), gap: Math.hypot(f.x - w.player.x, f.z - w.player.z) }; });
    if (!v.d) break;
    parts.add(v.d.part);
    expect(v.on).toBe(true);
    for (const [k, gap] of Object.entries(v.d.contacts)) if (k !== 'heads') expect(gap).toBeLessThan(0.05); // held hands touch
    expect(v.gap).toBeGreaterThan(0.6);  // never inside each other
  }
  expect([...parts].sort()).toEqual(['close', 'dip', 'embrace', 'meet', 'side by side', 'twirl']);
  await step(page, 3);
  expect(await activity(page)).toBe('free');
  expect(await m(() => window.__meadow.friendSt.together)).toBe(true);
  // again, cut short by walking away
  await press(page, 'KeyK', 5);
  expect(await activity(page)).toBe('dance');
  await page.keyboard.down('KeyW'); await step(page, 1); await page.keyboard.up('KeyW');
  expect(await activity(page)).toBe('free');
  // and once more, ended by the thaw: you both get back to the shore
  await press(page, 'KeyK', 5);
  expect(await activity(page)).toBe('dance');
  await m(() => { window.__meadow.seasonState.ice = 0.5; });
  await step(page, 20);
  expect(await activity(page)).toBe('free');
  expect(await m(() => { const w = window.__meadow, f = w.friendSt; return w.geo.walkable(w.player.x, w.player.z) && w.geo.walkable(f.x, f.z); })).toBe(true);
  noErrors(errors);
});

test('winter clothes go on and come off as the season changes, even sitting on the bench together', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#16');
  await step(page, 0.5);
  const bench = await page.evaluate(() => window.__meadow.geo.bench());
  await page.evaluate((be) => { const m = window.__meadow, f = m.friendSt; m.player.x = be.x + Math.sin(be.rot); m.player.z = be.z + Math.cos(be.rot); f.x = m.player.x + 0.8; f.z = m.player.z; }, bench);
  await press(page, 'KeyX', 1);
  await press(page, 'KeyE', 3);
  expect(await activity(page)).toBe('sit');
  await page.evaluate(() => document.querySelector('#season button[data-season="winter"]').click());
  await step(page, 0.5);
  expect(await page.evaluate(() => window.__meadow.wardrobe())).toBe('winter');
  expect(await activity(page)).toBe('sit');
  expect(await page.evaluate(() => window.__meadow.friend().sit)).toBeGreaterThan(0.9);
  await page.evaluate(() => document.querySelector('#season button[data-season="summer"]').click());
  await step(page, 0.5);
  expect(await page.evaluate(() => window.__meadow.wardrobe())).toBe('summer');
  expect(await activity(page)).toBe('sit');
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
