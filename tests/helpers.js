// Test helpers: the game exposes window.__meadow, and tests advance its clock directly with
// tick() so they don't depend on how often a headless browser draws frames.
import { expect } from './harness.js';

export async function open(page, query = '', hash = '#14') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) errors.push(m.text()); });
  // (a new player gets a world at random: tests play world 1 unless they ask for another)
  if (!/(^|&)seed=/.test(query)) query = query ? query + '&seed=1' : 'seed=1';
  await page.goto('/' + (query ? '?' + query : '') + hash);
  // (a long allowance: headless Chrome draws in software, and a busy machine can take a minute to build the world)
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 150000 });
  return errors;
}

/** Advance game time by `secs` in 1/30 s steps. */
export const step = (page, secs) => page.evaluate((s) => { const n = Math.round(s * 30); for (let i = 0; i < n; i++) window.__meadow.tick(1 / 30); }, secs);

/** Put the player somewhere, facing a direction (camera looks the same way). */
export const teleport = (page, x, z, fx = 0, fz = -1) => page.evaluate(([x, z, fx, fz]) => {
  const m = window.__meadow;
  m.player.x = x; m.player.z = z; m.player.slide = null;
  m.camState.yaw = Math.atan2(-fx, -fz);
}, [x, z, fx, fz]);

export const actions = (page) => page.evaluate(() => window.__meadow.actions());
export const activity = (page) => page.evaluate(() => window.__meadow.activity.current);
export const toastText = (page) => page.locator('#toast').textContent();

export async function press(page, key, settle = 0.2) {
  await step(page, 0.3); // let the prompts refresh
  await page.keyboard.press(key);
  await step(page, settle);
}

export function noErrors(errors) { expect(errors, errors.join('\n')).toEqual([]); }
