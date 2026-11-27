// The map: the land you have explored (kept per world), and the places you have found marked on it.
import { test, expect } from './harness.js';
import { open, step, press, actions, toastText, noErrors } from './helpers.js';

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
  await page.locator('#mapGo').click(); // (home is a point you can always travel to: the view fades, and you are there)
  await page.waitForFunction(() => { const m = window.__meadow; return !m.waypoints.busy && Math.hypot(m.player.x - m.home.x, m.player.z - m.home.z) / m.home.rmax < 2.5; }, null, { timeout: 90000 }); // (the software renderer takes its time making the land you arrive in)
  await step(page, 0.5);
  await expect(page.locator('#mapPanel'), 'the map closes as you arrive').toBeHidden();
  // another panel takes the map's place: it is closed, not left working unseen
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  expect((await state(page)).open).toBe(true);
  await page.keyboard.press('KeyI');
  await step(page, 0.2);
  await expect(page.locator('#mapPanel')).toBeHidden();
  expect((await state(page)).open).toBe(false);
  await page.keyboard.press('Escape');

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

test('waystones: one to a stretch of country, on the map from the start; track one to be shown the way; asleep until you wake it, then you can travel to it, and it stays awake', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 1);
  // where they stand: by the seed, spread out, on dry ground clear of home
  const land = await page.evaluate(async () => {
    const m = window.__meadow, H = m.home, S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')));
    const all = S.sitesNear(H.x, H.z, 4000, 'waystone');
    let gap = Infinity;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) gap = Math.min(gap, Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z));
    return { n: all.length, key: JSON.stringify(all.map((s) => [s.id, s.x, s.z])), gap, home: Math.hypot(all[0].x - H.x, all[0].z - H.z),
      dry: all.every((s) => m.geo.height(s.x, s.z) > 1 && m.geo.lakeT(s.x, s.z) > 2 && !m.geo.riverNear(s.x, s.z)), first: { id: all[0].id, x: all[0].x, z: all[0].z } };
  });
  expect(land.n, 'a fair number within four kilometres').toBeGreaterThan(10);
  expect(land.gap, 'well apart').toBeGreaterThan(600);
  expect(land.home, 'none by the home lake').toBeGreaterThan(600);
  expect(land.dry, 'each on dry ground, clear of lakes and rivers').toBe(true);
  // in play the lists that take you anywhere are gone; to begin with you can travel home, and nowhere else
  await page.locator('[data-panel="worldPanel"]').evaluate((el) => el.click()); // (clicked in the page: the software renderer's frames can take many seconds, and a real click waits on them)
  await expect(page.locator('#hereNow')).toBeVisible();
  expect(await page.locator('#places, #countries, #timeSlider, #weather, #season').count(), 'no lists that take you anywhere, no pickers: those are commands').toBe(0);
  await page.keyboard.press('Escape');
  const w0 = await page.evaluate(() => window.__meadow.waypoints);
  expect(w0.awake).toEqual([]);
  expect(w0.points.map((p) => p.kind)).toEqual(['home']);
  expect(w0.asleep.map((s) => s.id)).toContain(land.first.id);

  // the map marks waystones in land you have not explored; one asleep can be tracked, not travelled to
  const s = land.first;
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  await page.locator('#mapOut').click();
  await page.locator('#mapOut').click();
  await step(page, 0.2);
  await page.evaluate(() => { window.__meadow.map.settle(); });
  const far = (await state(page)).marks.find((k) => k.id === s.id);
  expect(far && far.awake, 'marked though its land is unexplored').toBe(false);
  expect(await page.evaluate(([x, z]) => window.__meadow.map.explored(x, z), [s.x, s.z])).toBe(false);
  const box0 = await page.locator('#mapCanvas').boundingBox();
  await page.mouse.click(box0.x + far.x, box0.y + far.y);
  expect((await state(page)).chosen).toBe(s.id);
  await expect(page.locator('#mapGo'), 'asleep: no travelling there').toBeHidden();
  await expect(page.locator('#mapTrack')).toHaveText('Track');
  await page.locator('#mapTrack').click();
  await expect(page.locator('#mapTrack')).toHaveText('Stop tracking');
  expect((await page.evaluate(() => window.__meadow.waypoints.track)).id).toBe(s.id);
  await step(page, 0.1);
  expect((await state(page)).marks.find((k) => k.id === s.id).tracked).toBe(true);
  await page.keyboard.press('Escape');
  // tracking shows the way in the world: a marker with its name and how far, and a mark on the compass
  await step(page, 1);
  await expect(page.locator('#trackMark')).toBeVisible();
  await expect(page.locator('#trackMark')).toContainText(/waystone.*\d(\.\d)? km/);
  const cm = await page.evaluate(() => window.__meadow.compass().marks.find((k) => k.kind === 'track'));
  expect(cm, 'on the compass').toBeTruthy();
  const want = await page.evaluate(([x, z]) => { const p = window.__meadow.player; return (Math.atan2(x - p.x, -(z - p.z)) * 180 / Math.PI + 360) % 360; }, [s.x, s.z]);
  expect(Math.abs(((cm.bearing - want + 540) % 360) - 180), 'pointing at the stone').toBeLessThan(1);

  // walk up to it: it stands there asleep, shown dimly on the map
  await page.evaluate((s) => { window.__meadow.travelTo(s.x - 1.5, s.z + 3, s.x, s.z); }, s);
  await step(page, 1.5);
  expect(await page.evaluate(() => window.__meadow.landmarks().some((l) => l.kind === 'waystone')), 'the stone stands there').toBe(true);
  expect((await actions(page)).map((a) => a.id)).toContain('waystone-wake');
  expect(await page.evaluate(() => window.__meadow.found().some((f) => f.kind === 'waystone')), 'a waystone is woken, not found').toBe(false);
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  let mark = (await state(page)).marks.find((k) => k.id === s.id);
  expect(mark && mark.awake, 'marked on the map, asleep').toBe(false);
  await page.keyboard.press('Escape');
  // wake it
  await press(page, 'KeyE', 0.5);
  const w1 = await page.evaluate(() => window.__meadow.waypoints);
  expect(w1.awake.map((w) => w.id)).toEqual([s.id]);
  expect(w1.awake[0].name).toMatch(/ waystone$/);
  expect(w1.asleep.map((q) => q.id)).not.toContain(s.id);
  expect(await toastText(page)).toContain('is awake');
  expect((await actions(page)).map((a) => a.id)).toContain('waystone-map');
  expect(await page.evaluate(() => window.__meadow.waypoints.track), 'woken: the tracking is done').toBeNull();
  await step(page, 0.2);
  await expect(page.locator('#trackMark')).toBeHidden();

  // from home, choose it on the map and travel: the view fades, you stand by the stone, the map has closed
  await page.evaluate(() => { const m = window.__meadow; m.travelTo(m.spawn.x, m.spawn.z); });
  await step(page, 1);
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  await page.locator('#mapOut').click();
  await page.locator('#mapOut').click();
  await step(page, 0.2);
  mark = (await state(page)).marks.find((k) => k.id === s.id);
  expect(mark && mark.awake, 'marked on the map, awake').toBe(true);
  await expect(page.locator('#mapGo')).toBeHidden();
  const box = await page.locator('#mapCanvas').boundingBox();
  await page.mouse.click(box.x + mark.x, box.y + mark.y);
  expect((await state(page)).chosen).toBe(s.id);
  await expect(page.locator('#mapGo')).toBeVisible();
  await page.locator('#mapGo').click();
  await page.waitForFunction(([x, z]) => { const m = window.__meadow; return !m.waypoints.busy && Math.hypot(m.player.x - x, m.player.z - z) < 6; }, [s.x, s.z], { timeout: 90000 }); // (the software renderer takes its time making the land you arrive in)
  await step(page, 0.5);
  await expect(page.locator('#mapPanel')).toBeHidden();
  expect(await page.locator('#fade').evaluate((el) => el.classList.contains('on')), 'the view has faded back in').toBe(false);

  // a stone far beyond the end of the view: its marker still lies the way the stone does
  const farOff = await page.evaluate(async () => {
    const m = window.__meadow, pl = m.player, S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')));
    const st = S.sitesNear(pl.x, pl.z, 9000, 'waystone').find((q) => Math.hypot(q.x - pl.x, q.z - pl.z) > 5000);
    m.track({ id: st.id, name: 'Far stone', x: st.x, z: st.z });
    m.camState.yaw = Math.atan2(pl.x - st.x, pl.z - st.z); m.camState.pitch = 0.2; // (facing it)
    return { st: { x: st.x, z: st.z }, far: Math.hypot(st.x - pl.x, st.z - pl.z) };
  });
  expect(farOff.far).toBeGreaterThan(5000);
  const markAt = async (turn) => {
    await page.evaluate(([x, z, turn]) => { const m = window.__meadow, pl = m.player; m.camState.yaw = Math.atan2(pl.x - x, pl.z - z) + turn; }, [farOff.st.x, farOff.st.z, turn]);
    await step(page, 0.3);
    return page.evaluate(() => { const t = /translate\(([-\d.]+)px/.exec(document.getElementById('trackMark').style.transform); return +t[1] / window.innerWidth; });
  };
  const ahead = await markAt(0);
  expect(ahead, 'facing it: the marker is in the middle of the view').toBeGreaterThan(0.4);
  expect(ahead).toBeLessThan(0.6);
  // (the camera's yaw grows turning left: with it at your right shoulder the marker is at the right edge)
  expect(await markAt(1.4), 'turned left of it: the marker is at the right edge').toBeGreaterThan(0.9);
  expect(await markAt(-1.4), 'turned right of it: at the left edge').toBeLessThan(0.1);
  await page.evaluate(() => window.__meadow.track(null));

  // it stays awake
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  expect((await page.evaluate(() => window.__meadow.waypoints.awake)).map((w) => w.id)).toEqual([s.id]);
  // and the stones stand where they did, though this visit began out by the stone and came on the land another way
  const again = await page.evaluate(async () => {
    const m = window.__meadow, H = m.home, S = await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/core/shape.js')));
    return { key: JSON.stringify(S.sitesNear(H.x, H.z, 4000, 'waystone').map((q) => [q.id, q.x, q.z])), far: Math.hypot(m.player.x - H.x, m.player.z - H.z) };
  });
  expect(again.far, 'begun away from home').toBeGreaterThan(600);
  expect(again.key).toBe(land.key);
  noErrors(errors);
});

test('harbours: one on each continent facing each neighbour; coming to one notes it; the skipper sails you over to the harbour facing it, visited or not; harbours you have been to are points to travel to', async ({ page }) => {
  const errors = await open(page, 'weather=clear');
  await step(page, 1);
  const v0 = await page.evaluate(() => window.__meadow.harbours);
  expect(v0.near.length, 'harbours on the coasts about home').toBeGreaterThan(2);
  expect(v0.known).toEqual([]);
  const h = v0.near[0];
  expect(h.name).toMatch(/ Harbour$/);
  expect(v0.passages.length, 'the nearest sails somewhere').toBeGreaterThan(0);
  expect(v0.passages.every((t) => t.cont !== h.cont), 'to another continent').toBe(true);
  // the map marks harbours you have not been to (they can be tracked, not travelled to)
  await page.keyboard.press('KeyM');
  await step(page, 0.2);
  await page.evaluate(() => { for (let i = 0; i < 6; i++) document.getElementById('mapOut').click(); window.__meadow.map.settle(); }); // (out far enough to take in the coast)
  const mk = (await state(page)).marks.find((k) => k.id === h.id);
  expect(mk && mk.kind, 'marked on the map').toBe('harbour');
  expect(mk.awake).toBe(false);
  await page.keyboard.press('Escape');

  // come to it: it is noted, and the skipper says where he sails
  await page.evaluate((h) => { window.__meadow.travelTo(h.ax, h.az, h.x, h.z); }, h);
  await step(page, 1.2);
  expect((await page.evaluate(() => window.__meadow.harbours.known)).map((k) => k.id)).toEqual([h.id]);
  expect(await toastText(page)).toContain('skipper');
  expect((await actions(page)).map((a) => a.id)).toContain('harbour-sail');
  await press(page, 'KeyE', 0.3);
  await expect(page.locator('#harbourPanel')).toBeVisible();
  await expect(page.locator('#harbourTitle')).toHaveText(h.name);
  const to = v0.passages[0];
  await expect(page.locator(`#harbourList button[data-harbour="${to.id}"]`)).toBeVisible();
  await expect(page.locator('#harbourList')).toContainText('not yet visited');
  // sail: the panel closes, the view fades, you stand at the far harbour, on another continent
  await page.locator(`#harbourList button[data-harbour="${to.id}"]`).evaluate((el) => el.click());
  await expect(page.locator('#harbourPanel')).toBeHidden();
  await page.waitForTimeout(2200); // (the view stays dark while you sail)
  await step(page, 1);
  const there = await page.evaluate((to) => { const m = window.__meadow; return { far: Math.hypot(m.player.x - to.x, m.player.z - to.z), known: m.harbours.known.map((k) => k.id), points: m.waypoints.points.filter((p) => p.kind === 'harbour').map((p) => p.id), busy: m.waypoints.busy }; }, to);
  expect(there.far, 'by the far harbour').toBeLessThan(8);
  expect(there.busy).toBe(false);
  expect(there.known.sort()).toEqual([h.id, to.id].sort());
  expect(there.points.sort(), 'both are points to travel to').toEqual([h.id, to.id].sort());
  expect(await toastText(page)).toContain('sail across the sea');
  // and back, from the map's travel points
  await page.evaluate((id) => { const m = window.__meadow; m.travelToPoint(m.waypoints.points.find((p) => p.id === id)); }, h.id);
  await page.waitForTimeout(800);
  await step(page, 0.5);
  expect(await page.evaluate((h) => Math.hypot(window.__meadow.player.x - h.x, window.__meadow.player.z - h.z), h)).toBeLessThan(8);
  noErrors(errors);
});
