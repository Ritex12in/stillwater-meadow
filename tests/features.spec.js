// End-to-end checks of the main features, driven through the real key bindings.
import { test, expect } from './harness.js';
import { open, step, teleport, actions, activity, press, toastText, noErrors } from './helpers.js';

const side = (page) => page.evaluate(() => { const d = window.__meadow.geo.dockDir; return { x: d.z, z: -d.x }; });

test('fishing: cast, hook a bite, and the catch goes in the journal', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#18');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.pack.add('rod'); });
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
  expect((await page.evaluate(() => window.__meadow.pack.fish())).length, 'the catch went into the creel').toBe(1);
  noErrors(errors);
});

test('fishing punishes reeling non-stop: the line snaps', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#18');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.pack.add('rod'); });
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
  expect(await page.evaluate(() => window.__meadow.pack.fish().length)).toBe(0);
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
  // (three kinds, chosen once: the three with the most flowers about)
  const kinds = await page.evaluate(() => { const by = {}; for (const f of window.__meadow.flowers()) if (f.shown) by[f.kind] = (by[f.kind] || 0) + 1; return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => +k); });
  for (let k = 0; k < 12; k++) {
    const f = await page.evaluate((want) => {
      const m = window.__meadow, all = m.flowers().filter((it) => it.shown);
      return all.filter((it) => it.kind === want).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0];
    }, kinds[Math.floor(k / 4)]);
    await teleport(page, f.x + 0.4, f.z);
    await press(page, 'KeyG', 0.7);
  }
  expect(await page.evaluate(() => window.__meadow.pack.tie()), 'tied into a bouquet in the backpack').toBe(true);
  const bp = await page.evaluate(() => window.__meadow.BOARD_POINT);
  await teleport(page, bp.x, bp.z);
  await press(page, 'KeyG', 0.5);
  // (when it fails now and then, say why: what the skipper said, and what was offered)
  const why = await page.evaluate(() => ({ toast: document.getElementById('toast').textContent, actions: window.__meadow.actions().map((a) => a.id), pack: JSON.stringify(window.__meadow.pack.items ? window.__meadow.pack.items() : '') }));
  expect(await page.evaluate(() => window.__meadow.rod().rod), JSON.stringify(why)).toBe(true);
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
  expect(await page.evaluate(() => window.__meadow.pack.count('flower')), 'flowers in the backpack').toBe(3);
  expect(await page.evaluate(() => window.__meadow.pack.tie()), 'tied into a bouquet in the backpack').toBe(true);
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
  await page.evaluate(() => { const p = window.__meadow.pack; p.add('fish', 'perch', 20); p.add('fish', 'carp', 40); });
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
  expect(await page.evaluate(() => window.__meadow.pack.fish().length)).toBe(0);
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
  await page.evaluate(() => { window.__meadow.pack.add('fish', 'minnow', 8); });
  // (a spot 5 m from the cat on the land side, away from the lake, and the way from there to the cat)
  const landward = () => page.evaluate(() => {
    const m = window.__meadow, a = m.animals[3], h = m.home, d = Math.hypot(a.x - h.x, a.z - h.z), ux = (a.x - h.x) / d, uz = (a.z - h.z) / d;
    return { x: a.x + ux * 5, z: a.z + uz * 5, fx: -ux, fz: -uz };
  });
  const cat = await landward();
  // walk straight at it: it bolts
  await teleport(page, cat.x, cat.z, cat.fx, cat.fz);
  await page.keyboard.down('KeyW'); await step(page, 0.8); await page.keyboard.up('KeyW');
  await step(page, 0.4);
  const fled = await page.evaluate(() => window.__meadow.pets()[3]);
  expect(['flee', 'wary', 'cornered']).toContain(fled.state);
  // from a few metres off, throw it the fish, then keep still
  await step(page, 4);
  const c2 = await landward();
  await teleport(page, c2.x, c2.z, c2.fx, c2.fz);
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

test('winter: a snowman, and the skating dance on the ice with her', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=winter', '#16');
  await step(page, 0.5);
  const m = (fn) => page.evaluate(fn);
  expect(await m(() => window.__meadow.snowman().visible)).toBe(true);
  // out on the ice, hand in hand (she follows you onto it)
  await m(() => { const w = window.__meadow, f = w.friendSt; w.player.x = f.x + 1; w.player.z = f.z; });
  await press(page, 'KeyX', 1);
  const ice = await m(() => window.__meadow.geo.lakePoint(1.9, 0.5)); // (well out on the home lake)
  await teleport(page, ice.x, ice.z);
  await page.evaluate((p) => { const w = window.__meadow, f = w.friendSt; f.x = p.x - 0.6; f.z = p.z; w.player.rot = 2.5; }, ice);
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

test('frame cost stays small', async ({ page }) => {
  const errors = await open(page, 'weather=storm', '#20');
  await step(page, 1);
  const ms = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 300; i++) window.__meadow.tick(1 / 60); return (performance.now() - t0) / 300; });
  console.log(`simulation: ${ms.toFixed(2)} ms per frame (excluding rendering)`);
  expect(ms).toBeLessThan(6);
  noErrors(errors);
});

test('fishing in a river: cast from the bank, the float rides the river, a river fish bites', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#8');
  await step(page, 0.5);
  await page.evaluate(() => { window.__meadow.pack.add('rod'); });
  // on the bank of a calm river near home, facing across it
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), m = window.__meadow, H = m.home;
    const v = SH.riversNear(H.x, H.z, 2000).filter((q) => !q.fall.some((f) => f) && q.w[q.n >> 1] > 3).sort((a, b) => Math.hypot(a.x[0] - H.x, a.z[0] - H.z) - Math.hypot(b.x[0] - H.x, b.z[0] - H.z))[0];
    const i = v.n >> 1, tx = v.x[i + 1] - v.x[i], tz = v.z[i + 1] - v.z[i], tl = Math.hypot(tx, tz), nx = -tz / tl, nz = tx / tl, off = v.w[i] / 2 + 1.2;
    return { x: v.x[i] + nx * off, z: v.z[i] + nz * off, fx: -nx, fz: -nz, lv: v.lv[i] };
  });
  await page.evaluate(({ x, z, fx, fz }) => window.__meadow.travelTo(x, z, x + fx, z + fz), r);
  await step(page, 0.6);
  expect((await actions(page)).map((a) => a.id)).toContain('fish-cast');
  await page.keyboard.down('KeyR'); await step(page, 0.3); await page.keyboard.up('KeyR');
  let info = await page.evaluate(() => window.__meadow.fishingInfo());
  for (let i = 0; i < 600 && info.state !== 'bite'; i++) { await step(page, 0.1); info = await page.evaluate(() => window.__meadow.fishingInfo()); }
  expect(info.state).toBe('bite');
  expect(info.river, 'the float is in the river').toBe(true);
  expect(Math.abs(info.floatY - r.lv), 'it rides the river, not the lakes\' level').toBeLessThan(0.2);
  expect(['trout', 'minnow', 'char', 'perch', 'bluegill', 'pike', 'catfish', 'carp', 'koi', 'pupfish', 'bowfin', 'glowfin', 'ember']).toContain(info.species);
  noErrors(errors);
});
