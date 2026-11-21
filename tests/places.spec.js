// Settled lakes and the landmarks that follow you: the jetty with its boat, the fire, the bench.
import { test, expect } from './harness.js';
import { open, step, teleport, press, actions, noErrors } from './helpers.js';

const settled = (page) => page.evaluate(() => window.__meadow.settled(3000));

test('settled lakes lie far apart, each with its own landmarks; the home lake has them all', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const a = await settled(page);
  expect(a.length, 'a fair number within three kilometres').toBeGreaterThan(8);
  let gap = Infinity;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) gap = Math.min(gap, Math.hypot(a[i].x - a[j].x, a[i].z - a[j].z));
  expect(gap, 'no two within sight of each other').toBeGreaterThan(480);
  const home = a.find((L) => L.id === 'home');
  expect(home.kit).toEqual({ dock: true, fire: true, bench: true });
  expect(a.every((L) => L.kit.dock || L.kit.fire || L.kit.bench), 'every settled lake has something').toBe(true);
  expect(a.filter((L) => L.kit.dock).length, 'several have a jetty').toBeGreaterThan(3);
  expect(a.filter((L) => !L.kit.dock).length, 'several have none').toBeGreaterThan(1);
  expect(a.filter((L) => !L.kit.bench || !L.kit.fire).length, 'and some lack a bench or a fire').toBeGreaterThan(1);
  expect(a.filter((L) => L.frozen && L.kit.dock).length, 'no jetty on a frozen lake').toBe(0);
  expect(new Set(a.map((L) => Math.round(L.turn * 10))).size, 'they face different ways').toBeGreaterThan(4);
  // a jetty stands on dry land at one end and deep water at the other, with the mooring beyond it
  for (const L of a.filter((q) => q.kit.dock).slice(0, 5)) {
    const j = await page.evaluate((id) => { const m = window.__meadow, g = m.geo; m.moveAnchor(id); const root = g.dockAt(-1, 0), end = g.dockAt(8, 0), moor = g.dockAt(9.85, 0); return { root: g.height(root.x, root.z), end: g.height(end.x, end.z), moor: g.height(moor.x, moor.z), deck: g.onDock(end.x, end.z), boat: m.boatShown() }; }, L.id);
    expect(j.root, `${L.name}: the jetty leaves dry land`).toBeGreaterThan(0.2);
    expect(j.end, `${L.name}: and ends over water`).toBeLessThan(-0.3);
    expect(j.moor).toBeLessThan(-0.3);
    expect(j.deck && j.boat).toBe(true);
  }
  await open(page, 'weather=clear&season=summer', '#12');
  expect(await settled(page), 'the same on another visit').toEqual(a);
  noErrors(errors);
});

test('the landmarks follow you from lake to lake: everything works there, and nothing is left behind', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  await page.evaluate(() => { window.__meadow.store.rod = true; });
  const there = (await settled(page)).find((L) => L.id !== 'home' && L.kit.dock && L.kit.fire && L.kit.bench);
  await page.evaluate((id) => { window.__meadow.visitLake(id); }, there.id);
  await step(page, 0.5);
  expect(await page.evaluate(() => window.__meadow.anchor())).toBe(there.id);
  // the bench: its seat is at the lake's bench spot, and you can sit on it
  const b = await page.evaluate(() => { const g = window.__meadow.geo, s = g.bench(); return { x: s.x, z: s.z, rot: s.rot, off: Math.hypot(s.x - g.BENCH_SPOT.x, s.z - g.BENCH_SPOT.z), dry: g.height(s.x, s.z) }; });
  expect(b.off).toBeLessThan(0.01);
  expect(b.dry).toBeGreaterThan(0.3);
  await teleport(page, b.x + Math.sin(b.rot) * 1.3, b.z + Math.cos(b.rot) * 1.3);
  await step(page, 0.4);
  expect((await actions(page)).map((x) => x.id)).toContain('sit');
  // the fire: light it
  const f = await page.evaluate(() => window.__meadow.geo.FIRE_SPOT);
  await teleport(page, f.x + 1.5, f.z);
  await step(page, 0.4);
  expect((await actions(page)).map((x) => x.id)).toContain('campfire');
  await press(page, 'KeyE', 0.5);
  expect(await page.evaluate(() => window.__meadow.fire.on)).toBe(true);
  // the jetty: you stand on its deck, can cast from it, and can board the boat at its end
  const d = await page.evaluate(() => { const m = window.__meadow, g = m.geo, p = g.dockAt(5, 0), s = { x: g.dockDir.z, z: -g.dockDir.x }; return { p, s, board: m.BOARD_POINT }; });
  await teleport(page, d.p.x, d.p.z, d.s.x, d.s.z);
  await step(page, 0.5);
  expect(await page.evaluate(() => { const m = window.__meadow; return m.geo.onDock(m.player.x, m.player.z) && m.player.y > 0.4; }), 'standing on the deck').toBe(true);
  expect((await actions(page)).map((x) => x.id)).toContain('fish-cast');
  await teleport(page, d.board.x, d.board.z);
  await step(page, 0.5);
  expect((await actions(page)).map((x) => x.id)).toContain('board');
  // there and back, again and again: the same seats, the same obstacles, the same scene
  const round = () => page.evaluate((id) => {
    const m = window.__meadow, settle = () => { for (let i = 0; i < 200; i++) m.ground.update(m.player.x, m.player.z); for (let i = 0; i < 5; i++) m.tick(1 / 30); };
    m.visitLake(id); settle();
    const away = { anchor: m.anchor(), counts: m.counts() };
    m.visitLake('home'); m.travelTo(m.spawn.x, m.spawn.z); settle();
    return { away, home: { anchor: m.anchor(), counts: m.counts() } };
  }, there.id);
  await round();
  const second = await round(), third = await round();
  expect(second.away.anchor).toBe(there.id);
  expect(second.home.anchor).toBe('home');
  expect(second.home.counts.seats).toBe(6);
  expect(third.away.counts, 'nothing piles up at the far lake').toEqual(second.away.counts);
  expect(third.home.counts, 'nor at home').toEqual(second.home.counts);
  noErrors(errors);
});

test('walking, the landmarks move only when the old lake is well behind you, and never while you sit', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const there = (await settled(page)).find((L) => L.id !== 'home' && L.kit.bench);
  const dry = (x, z) => page.evaluate(([x, z]) => { const g = window.__meadow.geo; for (let r = 0; r < 60; r += 3) for (let a = 0; a < 6.28; a += 0.7) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (g.walkable(px, pz)) return { x: px, z: pz }; } return { x, z }; }, [x, z]);
  // a little way from home: they stay
  const home = await page.evaluate(() => window.__meadow.home);
  const near = await dry(home.x + 120, home.z + 60);
  await teleport(page, near.x, near.z);
  await step(page, 1.2);
  expect(await page.evaluate(() => window.__meadow.anchor())).toBe('home');
  // by the other lake, but sitting down: they stay until you get up
  const by = await dry(there.x + 60, there.z);
  await page.evaluate(([x, z]) => { const m = window.__meadow; m.player.x = x; m.player.z = z; m.player.slide = null; m.player.seat = { name: 'stump', x, z, baseY: m.geo.height(x, z), top: 0.4, rot: 0, standOff: 0.5 }; }, [by.x, by.z]);
  await step(page, 1.2);
  expect(await page.evaluate(() => window.__meadow.anchor()), 'not while you sit').toBe('home');
  await page.evaluate(() => { window.__meadow.player.seat = null; });
  await step(page, 1.2);
  expect(await page.evaluate(() => window.__meadow.anchor()), 'now they come').toBe(there.id);
  // and home again on foot
  await teleport(page, near.x, near.z);
  await step(page, 1.2);
  expect(await page.evaluate(() => window.__meadow.anchor())).toBe('home');
  noErrors(errors);
});

test('each place keeps its own: a bouquet left on one bench is not on another, and waits for you', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#11');
  await step(page, 1.5);
  for (let k = 0; k < 3; k++) {
    const f = await page.evaluate(() => { const m = window.__meadow; return m.flowers().filter((it) => it.shown).sort((a, b) => Math.hypot(a.x - m.player.x, a.z - m.player.z) - Math.hypot(b.x - m.player.x, b.z - m.player.z))[0]; });
    await teleport(page, f.x + 0.4, f.z);
    await press(page, 'KeyG', 0.8);
  }
  const b = await page.evaluate(() => window.__meadow.geo.bench());
  await teleport(page, b.x + Math.sin(b.rot) * 1.3, b.z + Math.cos(b.rot) * 1.3);
  await press(page, 'KeyG', 0.3);
  const left = await page.evaluate(() => window.__meadow.store.benchBouquet);
  expect(left.length, 'flowers on the home bench').toBe(3);
  const there = (await settled(page)).find((L) => L.id !== 'home' && L.kit.bench);
  // at another lake the bench is bare
  await page.evaluate((id) => { window.__meadow.visitLake(id); }, there.id);
  await step(page, 0.3);
  const away = await page.evaluate(() => { const s = window.__meadow.store; return { anchor: s.anchor, bench: s.benchBouquet, kept: s.places.home.benchBouquet }; });
  expect(away.anchor).toBe(there.id);
  expect(away.bench).toBeNull();
  expect(away.kept).toEqual(left);
  // leave, close the game, come back: you are still at the other lake, its bench still bare, the home bouquet still kept
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  const again = await page.evaluate(() => { const m = window.__meadow, s = m.store; return { anchor: m.anchor(), bench: s.benchBouquet || null, kept: s.places.home.benchBouquet }; });
  expect(again.anchor).toBe(there.id);
  expect(again.bench).toBeNull();
  expect(again.kept).toEqual(left);
  // home: the bouquet is on the bench where you left it
  await page.evaluate(() => { window.__meadow.visitLake('home'); });
  await step(page, 0.3);
  expect(await page.evaluate(() => window.__meadow.store.benchBouquet)).toEqual(left);
  noErrors(errors);
});

test('a lake with no jetty has none: no deck to stand on, no boat to board, and its woods are the same with or without the landmarks', async ({ page }) => {
  const errors = await open(page, 'weather=clear&season=summer', '#12');
  const all = await settled(page), bare = all.find((L) => !L.kit.dock);
  // the woods round it, before the landmarks have ever been there
  const woods = () => page.evaluate((L) => { const w = window.__meadow.wilds, S = 57.6, cx = Math.floor(L.x / S), cz = Math.floor(L.z / S), out = []; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) out.push(w.square(cx + dx, cz + dz).map((t) => [t.x, t.z, t.type]), w.rocks(cx + dx, cz + dz).map((r) => [r.x, r.z])); return JSON.stringify(out); }, bare);
  const before = await woods();
  await page.evaluate((id) => { window.__meadow.visitLake(id); }, bare.id);
  await step(page, 0.5);
  const look = await page.evaluate((L) => {
    const m = window.__meadow, g = m.geo, w = m.wilds, S = 57.6;
    let deck = 0, inClearing = 0;
    for (let x = L.x - 80; x <= L.x + 80; x += 2) for (let z = L.z - 80; z <= L.z + 80; z += 2) if (g.onDock(x, z)) deck++;
    const cx = Math.floor(L.x / S), cz = Math.floor(L.z / S);
    // (a tree is in the way if it stands in the water or on the shore, on the fire, or on the bench)
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (const t of w.square(cx + dx, cz + dz)) {
      const by = (p, reach) => Math.abs(p.x) < 1e5 && Math.hypot(t.x - p.x, t.z - p.z) < reach;
      if (g.lakeT(t.x, t.z) < 1.2 || by(g.FIRE_SPOT, 5) || by(g.BENCH_SPOT, 3.5)) inClearing++;
    }
    return { anchor: m.anchor(), kit: m.kit, deck, inClearing, boat: m.boatShown(), acts: m.actions().map((a) => a.id), far: Math.abs(m.BOARD_POINT.x) > 1e5 };
  }, bare);
  expect(look.anchor).toBe(bare.id);
  expect(look.kit.dock).toBe(false);
  expect(look.deck, 'no unseen jetty anywhere about the lake').toBe(0);
  expect(look.boat).toBe(false);
  expect(look.far, 'the boarding point is put away').toBe(true);
  expect(look.acts).not.toContain('board');
  expect(look.inClearing, 'no tree stands where its landmarks go').toBe(0);
  expect(await woods(), 'the woods are the same now the landmarks are here').toBe(before);
  noErrors(errors);
});
