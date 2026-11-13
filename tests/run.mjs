// Minimal runner for the specs: one Chrome, a fresh page per test, a few tests at a time.
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { collected } from './harness.js';

const only = process.argv.slice(2).join(' ');
for (const f of readdirSync(new URL('.', import.meta.url)).filter((f) => f.endsWith('.spec.js'))) await import('./' + f);
const tests = collected.filter((t) => !only || t.name.includes(only));
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0;
const queue = [...tests];
async function worker() {
  while (queue.length) {
    const t = queue.shift();
    const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:8080', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const t0 = Date.now();
    try {
      await t.fn({ page });
      pass++;
      console.log(`  ✓ ${t.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      fail++;
      console.log(`  ✗ ${t.name}\n      ${String(e.message).split('\n').slice(0, 30).join('\n      ')}`);
    }
    await ctx.close();
  }
}
const workers = Math.max(1, +(process.env.MEADOW_WORKERS || 3)); // the software renderer is slow: fewer at once on a busy machine
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
