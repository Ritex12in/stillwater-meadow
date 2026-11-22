// Exploring: places found and gone back to, postcards, your own camp and lanterns, skating, the
// floating islands' updraft, the flower journal, the view distance, and the characters.
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

test('the characters: you and your friend are the sculpted children; there is no character picker', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await page.waitForFunction(() => window.__meadow.characters().friendShown, null, { timeout: 60000 });
  expect((await page.evaluate(() => window.__meadow.characters())).heroShown).toBe(true);
  await page.locator('[data-panel="settingsPanel"]').click();
  expect(await page.locator('#charYou').count(), 'no character list in Settings').toBe(0);
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

test('a fox by country at the lake you are at (red, white in the snow), slipping away when you come close; the deer come too', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(() => {
    const m = window.__meadow, out = {};
    for (let i = 0; i < 5; i++) m.tick(1 / 30);
    out.home = m.wild();
    const frozen = m.lakes(3000).find((L) => L.frozen && L.id !== 'home');
    m.visitLake(frozen.id); for (let i = 0; i < 10; i++) m.tick(1 / 30);
    out.snow = m.wild();
    // walk up to it: it runs
    const f = out.snow.fox; m.player.x = f.x + 5; m.player.z = f.z; m.player.slide = null;
    for (let i = 0; i < 6; i++) m.tick(1 / 30);
    out.near = m.wild();
    for (let i = 0; i < 150; i++) m.tick(1 / 30);
    out.after = m.wild();
    out.moved = Math.hypot(out.after.fox.x - f.x, out.after.fox.z - f.z);
    return out;
  });
  expect(r.home.fox.shown, 'a fox by the home lake').toBe(true);
  expect(r.home.fox.kind).toBe('red');
  expect(r.home.deer.spots, 'deer by the home lake').toBeGreaterThan(0);
  expect(r.snow.fox.kind, 'white in the snow country').toBe('snow');
  expect(r.snow.deer.spots, 'the deer come to the lake you are at').toBeGreaterThan(0);
  expect(r.near.fox.state).toBe('flee');
  expect(r.after.fox.shown, 'and is gone a while').toBe(false);
  noErrors(errors);
});

test('kinds of country: the World popover lists every biome with the nearest one, and Go takes you there', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await page.locator('[data-panel="worldPanel"]').click();
  const desert = page.locator('#countries button[data-country="desert"]');
  await expect(desert).toContainText(/Golden desert · [\d.]+ (m|km)/, { timeout: 15000 });
  expect(await page.locator('#countries button').count(), 'every kind is listed').toBe(16);
  await expect(page.locator('#countries button[data-country="meadow"]')).toContainText('here');
  await desert.click();
  await expect(desert).toContainText('here', { timeout: 15000 });
  const at = await page.evaluate(() => { const m = window.__meadow; return { desert: m.biomes(m.player.x, m.player.z).desert, dry: m.geo.walkable(m.player.x, m.player.z) }; });
  expect(at.desert, 'standing in the desert').toBeGreaterThan(0.5);
  expect(at.dry).toBe(true);
  // the wonders too: to the foot of the volcano, on ground you can stand on
  await page.locator('#countries button[data-country="volcano"]').click();
  await expect(page.locator('#countries button[data-country="volcano"]')).toContainText(/The volcano · [\d.]+ m/, { timeout: 15000 });
  expect(await page.evaluate(() => { const m = window.__meadow; return m.geo.walkable(m.player.x, m.player.z); })).toBe(true);
  // the same world, the same answers
  const again = await page.evaluate(() => { const m = window.__meadow, h = m.home; return JSON.stringify(m.countries(h.x, h.z)) === JSON.stringify(m.countries(h.x, h.z)); });
  expect(again).toBe(true);
  noErrors(errors);
});

test('rivers: springs in the hills run down to a lake or the sea, never near home; water is drawn on them, falls step down, and you can wade across', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), m = window.__meadow, H = m.home;
    const list = SH.riversNear(H.x, H.z, 2500);
    let rising = 0, nearHome = 1e9, falls = 0, ends = new Set();
    for (const v of list) {
      ends.add(v.end.split(':')[0]);
      for (let i = 0; i < v.n; i++) { if (i && v.lv[i] > v.lv[i - 1] + 1e-4) rising++; nearHome = Math.min(nearHome, Math.hypot(v.x[i] - H.x, v.z[i] - H.z)); falls += v.fall[i]; }
    }
    // a calm river near home, for wading: across it, from bank to bank, every step can be stood on, and its bed is under the water
    const calm = list.filter((v) => !v.fall.some((f) => f)).sort((a, b) => Math.hypot(a.x[0] - H.x, a.z[0] - H.z) - Math.hypot(b.x[0] - H.x, b.z[0] - H.z))[0];
    const i = Math.floor(calm.n / 2), tx = calm.x[i + 1] - calm.x[i], tz = calm.z[i + 1] - calm.z[i], tl = Math.hypot(tx, tz), nx = -tz / tl, nz = tx / tl;
    let stand = 0, tries = 0;
    for (let d = -calm.w[i] / 2 - 2; d <= calm.w[i] / 2 + 2; d += 0.5) { tries++; if (SH.walkable(calm.x[i] + nx * d, calm.z[i] + nz * d)) stand++; }
    return { count: list.length, ends: [...ends], rising, nearHome, falls, stand, tries, bed: SH.height(calm.x[i], calm.z[i]) - calm.lv[i], spot: { x: calm.x[i] + nx * 6, z: calm.z[i] + nz * 6, fx: calm.x[i], fz: calm.z[i] }, id: calm.id };
  });
  expect(r.count, 'rivers within 2.5 km of home').toBeGreaterThanOrEqual(3);
  expect(r.ends.every((e) => e === 'lake' || e === 'sea'), 'each ends in a lake or the sea').toBe(true);
  expect(r.rising, 'the water never runs uphill').toBe(0);
  expect(r.nearHome, 'none near home').toBeGreaterThan(440);
  expect(r.falls, 'some fall in steps').toBeGreaterThan(0);
  expect(r.stand, 'wadeable from bank to bank').toBe(r.tries);
  expect(r.bed, 'its bed is under the water').toBeLessThan(-0.2);
  // standing by it, its water is drawn
  await page.evaluate(({ x, z, fx, fz }) => window.__meadow.travelTo(x, z, fx, fz), r.spot);
  await step(page, 0.5);
  expect(await page.evaluate(() => window.__meadow.riversShown())).toContain(r.id);
  noErrors(errors);
});

test('ways across water: a footbridge where a trail crosses a river, and stepping stones out to each island; you walk on both', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const r = await page.evaluate(async () => {
    const url = (name) => performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(name));
    const SH = await import(url('/src/core/shape.js')), m = window.__meadow, H = m.home;
    const bridges = [];
    for (const v of SH.riversNear(H.x, H.z, 6000)) for (const b of SH.bridgesOf(v)) bridges.push(b);
    let lowDeck = 0, cantWalk = 0, offTrail = 0;
    for (const b of bridges) {
      if (SH.trailAt(b.x - b.ux * (b.half + 4), b.z - b.uz * (b.half + 4)) < 0.2 && SH.trailAt(b.x + b.ux * (b.half + 4), b.z + b.uz * (b.half + 4)) < 0.2) offTrail++;
      for (let a = -b.half; a <= b.half; a += 0.5) {
        const x = b.x + b.ux * a, z = b.z + b.uz * a;
        if (Math.abs(a) < b.half - 1.8 && SH.groundAt(x, z) < b.lv + 0.3) lowDeck++; // above the water (its ends rest on the banks)
        if (!SH.walkable(x, z)) cantWalk++;
      }
    }
    const isles = SH.lakesNear(H.x, H.z, 3000).filter((L) => L.isle);
    let noStones = 0, gaps = 0, wrongEnds = 0, wet = 0;
    for (const L of isles) {
      const S = SH.stonesOf(L);
      if (!S) { noStones++; continue; }
      for (let t = 0; t <= 1; t += 0.05) { const x = S.ax + (S.bx - S.ax) * t, z = S.az + (S.bz - S.az) * t; if (!SH.walkable(x, z)) gaps++; if (SH.groundAt(x, z) < 0.15) wet++; }
      if (L.t(S.ax - (S.bx - S.ax) * 0.15, S.az - (S.bz - S.az) * 0.15) < 1 || !SH.onIsland(S.bx, S.bz)) wrongEnds++; // from the shore to the island
    }
    return { bridges: bridges.length, lowDeck, cantWalk, offTrail, isles: isles.length, noStones, gaps, wrongEnds, wet };
  });
  expect(r.bridges, 'bridges within 6 km').toBeGreaterThanOrEqual(3);
  expect(r.offTrail, 'each on a trail').toBe(0);
  expect(r.lowDeck, 'decks above the water').toBe(0);
  expect(r.cantWalk, 'walkable end to end').toBe(0);
  expect(r.noStones, 'stones to every island').toBe(0);
  expect(r.gaps, 'no gap to fall in').toBe(0);
  expect(r.wet, 'stones stand out of the water').toBe(0);
  expect(r.wrongEnds, 'from the shore to the island').toBe(0);
  noErrors(errors);
});
