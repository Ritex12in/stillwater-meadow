// The game as it was (docs/shorts, ADR 0006): checks out a commit into its own folder outside the repo,
// serves it, and opens it in a browser, so a short can film the real old version.
//
//   node tools/shorts/version.mjs <commit> [<commit> ...]     a trial: one still of each as it first appears,
//                                                            and what it offers for driving it (to
//                                                            e:/Games/_assets/shorts/_versions/trial-<commit>.png)
// As a module: `const v = await openVersion(browser, commit, { width, height, query })` gives
// `{ page, url, has, close() }` (`has`: what handles that version exposes).
//
// A version lives in e:/Games/_assets/shorts/_versions/<commit> (a git worktree). Versions built with
// Vite borrow this repo's node_modules (the packages have not changed since the first of them); the
// very first commit is plain files and needs nothing.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(fileURLToPath(import.meta.url), '../../..'), HOME = 'e:/Games/_assets/shorts/_versions';
const git = (...a) => execFileSync('git', a, { cwd: REPO }).toString().trim();
let nextPort = 8101;

/** The folder of a commit's checkout, made if need be. */
export function checkout(commit) {
  const sha = git('rev-parse', '--short=7', commit), dir = `${HOME}/${sha}`;
  mkdirSync(HOME, { recursive: true });
  if (!existsSync(dir)) git('worktree', 'add', '--detach', dir, sha);
  if (existsSync(dir + '/package.json') && !existsSync(dir + '/node_modules')) execFileSync('cmd', ['/c', 'mklink', '/J', (dir + '/node_modules').replace(/\//g, '\\'), (REPO + '/node_modules').replace(/\//g, '\\')]);
  return { sha, dir, date: git('show', '-s', '--format=%ad', '--date=short', sha), subject: git('show', '-s', '--format=%s', sha) };
}

/** Serve a commit and open it. */
export async function openVersion(browser, commit, { width = 1280, height = 720, query = '', hash = '#15', wait = 6000 } = {}) {
  const v = checkout(commit), port = nextPort++;
  const server = await createServer({ root: v.dir, configFile: existsSync(v.dir + '/vite.config.js') ? v.dir + '/vite.config.js' : false, server: { port, strictPort: true, host: '127.0.0.1' }, logLevel: 'error', clearScreen: false });
  await server.listen();
  const ctx = await browser.newContext({ viewport: { width, height } }), page = await ctx.newPage(), problems = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0, 200)); });
  const url = `http://127.0.0.1:${port}/${query ? '?' + query : ''}${hash}`;
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  // a start screen, if that version had one: press its button
  await page.waitForTimeout(1500);
  for (const sel of ['#startBtn', '#start button', 'button:has-text("Play")', 'button:has-text("Start")', 'button:has-text("Begin")']) { const b = page.locator(sel).first(); if (await b.count() && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); break; } }
  await page.waitForFunction(() => document.querySelector('canvas'), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(wait);
  const has = await page.evaluate(() => { const m = window.__meadow; return { canvas: !!document.querySelector('canvas'), handle: !!m, player: !!(m && m.player), camState: !!(m && m.camState), tick: !!(m && typeof m.tick === 'function'), travelTo: !!(m && typeof m.travelTo === 'function'), keys: m ? Object.keys(m).length : 0 }; });
  return { ...v, page, url, has, problems, close: async () => { await ctx.close(); await server.close(); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commits = process.argv.slice(2);
  if (!commits.length) { console.log('node tools/shorts/version.mjs <commit> [<commit> ...]'); process.exit(1); }
  const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const c of commits) {
    try {
      const v = await openVersion(browser, c, { query: 'weather=clear&season=summer' });
      await v.page.screenshot({ path: `${HOME}/trial-${v.sha}.png` });
      console.log(`${v.sha} ${v.date} ${v.subject.slice(0, 60)}\n   runs: ${v.has.canvas ? 'yes' : 'NO'} · handle ${v.has.handle ? 'yes (' + v.has.keys + ' things)' : 'no'} · player ${v.has.player} · camera ${v.has.camState} · tick ${v.has.tick} · travelTo ${v.has.travelTo}${v.problems.length ? '\n   problems: ' + v.problems.slice(0, 3).join(' | ') : ''}`);
      await v.close();
    } catch (e) { console.log(`${c}: FAILED ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
  process.exit(0);
}
