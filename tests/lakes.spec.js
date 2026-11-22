// Lakes from the seed: where they are, their water, the frozen ones, and finding your way back.
import { test, expect } from './harness.js';
import { open, step, noErrors } from './helpers.js';

test('lakes lie all over the land: each in its own bowl, apart from its neighbours, the same for the same seed', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const look = () => page.evaluate(() => {
    const m = window.__meadow, g = m.geo, lakes = m.lakes(3000);
    let dry = 0, shoreUnder = 0, tooClose = 0;
    for (const L of lakes) {
      if (g.height(L.x, L.z) > -1) dry++;                                   // the middle is under water
      for (let a = 0; a < 6.28; a += 0.4) if (g.height(L.x + Math.cos(a) * L.rmax * 1.7, L.z + Math.sin(a) * L.rmax * 1.7) < 0.2) shoreUnder++; // and well outside the shore is dry land
    }
    for (let i = 0; i < lakes.length; i++) for (let j = i + 1; j < lakes.length; j++) if (Math.hypot(lakes[i].x - lakes[j].x, lakes[i].z - lakes[j].z) < 1.7 * (lakes[i].rmax + lakes[j].rmax)) tooClose++;
    const others = lakes.filter((L) => L.id !== 'home');
    return { long: others.filter((L) => L.long > 0.25).length, round: others.filter((L) => L.long < 0.06).length, small: others.filter((L) => L.r < 16).length, big: others.filter((L) => L.r > 28).length, ringed: others.filter((L) => L.ring).length, bare: others.filter((L) => L.beach < 0.4).length, n: lakes.length, frozen: lakes.filter((L) => L.frozen).length, dry, shoreUnder, tooClose, names: new Set(lakes.map((L) => L.name)).size, key: JSON.stringify(lakes.map((L) => [L.id, L.x, L.z, L.r, L.name])) };
  });
  const a = await look();
  expect(a.n, 'plenty of lakes within three kilometres').toBeGreaterThan(40);
  expect(a.frozen, 'some of them frozen').toBeGreaterThan(2);
  expect(a.frozen).toBeLessThan(a.n / 2);
  expect(a.dry).toBe(0);
  expect(a.shoreUnder).toBe(0);
  expect(a.tooClose, 'no two bowls touch').toBe(0);
  expect(a.names, 'with a spread of names').toBeGreaterThan(20);
  // and no two alike: long ones and round ones, ponds and broad waters, some with no beach; away from home they are wild (no path round them)
  for (const kind of ['long', 'round', 'small', 'big', 'bare']) expect(a[kind], `some lakes are ${kind}`).toBeGreaterThan(4);
  expect(a.ringed, 'only the home lake has a path round it').toBeLessThanOrEqual(1);
  await open(page, 'weather=clear&season=summer', '#12');
  expect((await look()).key, 'the same lakes on another visit').toBe(a.key);
  await open(page, 'seed=5&weather=clear&season=summer', '#12');
  expect((await look()).key, 'other lakes in another world').not.toBe(a.key);
  noErrors(errors);
});

test('going to a lake: its water is there, you can fish it, and visiting many leaves nothing behind', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await page.evaluate(() => { window.__meadow.pack.add('rod'); });
  const lakes = await page.evaluate(() => window.__meadow.lakes(2500).filter((L) => L.id !== 'home'));
  const openLake = lakes.find((L) => !L.frozen), frozen = lakes.find((L) => L.frozen);
  // an open lake: water is drawn for it, you stand dry on its shore, and a cast is on offer
  const there = await page.evaluate((id) => { const m = window.__meadow, ok = m.visitLake(id); for (let i = 0; i < 20; i++) m.tick(1 / 30); return { ok, water: m.waterLakes(), dry: m.geo.walkable(m.player.x, m.player.z) }; }, openLake.id);
  expect(there.ok).toBe(true);
  expect(there.water).toContain(openLake.id);
  expect(there.water.length).toBeLessThanOrEqual(4);
  expect(there.dry).toBe(true);
  expect(await page.evaluate((L) => window.__meadow.geo.walkable(L.x, L.z), openLake), 'you cannot walk on open water').toBe(false);
  // walk down to the water's edge, facing the lake
  await page.evaluate((L) => { const m = window.__meadow, g = m.geo; for (let k = 0; k < 400; k++) { const d = Math.hypot(L.x - m.player.x, L.z - m.player.z), nx = m.player.x + (L.x - m.player.x) / d * 0.15, nz = m.player.z + (L.z - m.player.z) / d * 0.15; if (!g.walkable(nx, nz) || g.height(nx, nz) < 0.3) break; m.player.x = nx; m.player.z = nz; } m.player.slide = null; m.player.rot = Math.atan2(L.x - m.player.x, L.z - m.player.z); m.camState.yaw = Math.atan2(m.player.x - L.x, m.player.z - L.z); }, openLake);
  await step(page, 0.6);
  expect((await page.evaluate(() => window.__meadow.actions())).map((a) => a.id), 'fishing works at any lake').toContain('fish-cast');
  // a lake of the snow country is ice in midsummer: you can walk out onto it
  expect(await page.evaluate((L) => window.__meadow.geo.walkable(L.x, L.z), frozen), 'a frozen lake bears your weight').toBe(true);
  // visit lake after lake: the sheets of water are lent out, never added to
  const tour = await page.evaluate((ids) => {
    const m = window.__meadow, counts = [];
    // (a first round fills the pools, which build what they lend as it is first needed; then two rounds are counted)
    for (let round = 0; round < 3; round++) { for (const id of ids) { m.visitLake(id); for (let i = 0; i < 200; i++) m.ground.update(m.player.x, m.player.z); for (let i = 0; i < 5; i++) m.tick(1 / 30); } if (round) counts.push(m.counts().objects); }
    return counts;
  }, lakes.slice(0, 6).map((L) => L.id));
  expect(tour[1], 'a second round of the same lakes adds no objects').toBe(tour[0]);
  noErrors(errors);
});

test('the world remembers where you were, and the Places list takes you to a lake', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  // the list in the World popover names the lakes about you; choosing one takes you to its shore
  await page.locator('#worldBtn, [aria-controls="worldPanel"], button:has-text("World")').first().click();
  const rows = page.locator('#places button');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(3);
  await expect(rows.first()).toContainText('Stillwater');
  const second = await rows.nth(2).textContent();
  await rows.nth(2).click();
  await step(page, 0.3);
  const at = await page.evaluate(() => { const m = window.__meadow, L = m.lakes(400)[0]; return { x: m.player.x, z: m.player.z, lake: L.name, far: L.far }; });
  expect(second).toContain(at.lake);
  expect(at.far).toBeLessThan(40);
  // leave and come back: you are where you were
  await page.evaluate(() => window.__meadow.travelTo(window.__meadow.player.x, window.__meadow.player.z));
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const back = await page.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z }));
  expect(Math.hypot(back.x - at.x, back.z - at.z)).toBeLessThan(2);
  // and `?at=` in the address starts you at a spot of your choosing
  const spot = await page.evaluate(() => { const g = window.__meadow.geo; for (let d = 500; d < 900; d += 9) for (let a = 0; a < 6.28; a += 0.5) { const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d); if (g.walkable(x, z)) return { x, z }; } return null; });
  await open(page, `at=${spot.x},${spot.z}&weather=clear`, '#12');
  const start = await page.evaluate(() => ({ x: window.__meadow.player.x, z: window.__meadow.player.z }));
  expect(Math.hypot(start.x - spot.x, start.z - spot.z)).toBeLessThan(2);
  noErrors(errors);
});

test('every lake has its own reeds and lilies, and the ducks and the heron are at the lake you are at', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const survey = () => page.evaluate(() => {
    const m = window.__meadow, lakes = m.lakes(2500).filter((L) => L.id !== 'home');
    return lakes.map((L) => Object.assign({ id: L.id, frozen: L.frozen, beach: L.beach }, m.lakeLife(L.id)));
  });
  const a = await survey();
  expect(a.filter((L) => L.reeds > 0).length, 'nearly every lake has reeds').toBeGreaterThan(a.length * 0.8);
  expect(a.filter((L) => !L.frozen && L.pads > 0).length, 'many have lilies').toBeGreaterThan(a.length * 0.3);
  expect(a.filter((L) => L.frozen && L.pads > 0).length, 'none on ice').toBe(0);
  const lush = a.filter((L) => L.beach < 0.5 && !L.frozen), heath = a.filter((L) => L.beach > 1.2);
  const mean = (list, k) => list.reduce((s, L) => s + L[k], 0) / list.length;
  expect(lush.length).toBeGreaterThan(2);
  expect(heath.length).toBeGreaterThan(2);
  expect(mean(lush, 'reeds'), 'reed beds are thick in lush country, thin on the heath').toBeGreaterThan(mean(heath, 'reeds') * 1.5);
  // the home lake has its own like any other, drawn with the rest
  const home = await page.evaluate(() => { const m = window.__meadow; return { own: m.lakeLife('home'), drawn: m.life() }; });
  expect(home.own.reeds).toBeGreaterThan(120);
  expect(home.own.pads).toBeGreaterThan(10);
  expect(home.drawn.lake).toBe('home');
  expect(home.drawn.reeds).toBeGreaterThanOrEqual(home.own.reeds);
  expect(home.drawn.dropped).toBe(0);
  // go to a pond with lilies: the ducks are on its water, and bread is on offer
  const pond = a.filter((L) => !L.frozen && L.pads > 5)[0];
  const there = await page.evaluate((id) => {
    const m = window.__meadow, g = m.geo; m.visitLake(id);
    for (let i = 0; i < 30; i++) m.tick(1 / 30);
    const L = m.lakes(300).find((q) => q.id === id), ducks = m.ducks().ducks;
    return { life: m.life(), afloat: ducks.filter((d) => Math.hypot(d.x - L.x, d.z - L.z) < L.rmax && g.height(d.x, d.z) < 0).length, of: ducks.length };
  }, pond.id);
  expect(there.life.lake).toBe(pond.id);
  expect(there.afloat, 'all the ducks are afloat on this lake').toBe(there.of);
  expect(there.life.reeds).toBeGreaterThan(0);
  expect(there.life.dropped).toBe(0);
  // a frozen lake: the ducks do not follow you onto the ice
  const ice = a.find((L) => L.frozen);
  const cold = await page.evaluate((id) => { const m = window.__meadow; m.visitLake(id); for (let i = 0; i < 30; i++) m.tick(1 / 30); const L = m.lakes(300).find((q) => q.id === id); return { life: m.life(), onIce: m.ducks().ducks.filter((d) => Math.hypot(d.x - L.x, d.z - L.z) < L.rmax).length }; }, ice.id);
  expect(cold.life.lake).toBe(ice.id);
  expect(cold.onIce).toBe(0);
  // lake after lake, twice round: nothing piles up, nothing goes undrawn
  const tour = await page.evaluate((ids) => {
    const m = window.__meadow, counts = [];
    let dropped = 0;
    for (let round = 0; round < 3; round++) { for (const id of ids) { m.visitLake(id); for (let i = 0; i < 200; i++) m.ground.update(m.player.x, m.player.z); for (let i = 0; i < 5; i++) m.tick(1 / 30); dropped += m.life().dropped; } counts.push(m.counts()); }
    return { counts, dropped };
  }, a.slice(0, 6).map((L) => L.id));
  expect(tour.dropped).toBe(0);
  expect(tour.counts[2]).toEqual(tour.counts[1]);
  // and each lake's are the same on another visit
  // (the game reopens where you last stood, so the lakes about you are not all the same ones: compare those seen both times)
  await open(page, 'weather=clear&season=summer', '#12');
  const again = new Map((await survey()).map((L) => [L.id, L.key])), both = a.filter((L) => again.has(L.id));
  expect(both.length).toBeGreaterThan(10);
  expect(both.every((L) => again.get(L.id) === L.key), 'the same reeds and lilies every time').toBe(true);
  noErrors(errors);
});
