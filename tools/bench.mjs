// Frame-rate benchmark on this computer's own graphics card (needs `npm run dev`). Uncapped (no vsync),
// at 1920x1080, it visits a few places at each quality preset and measures frames: average fps, the
// slowest frames (95th and 99th percentile, in ms), the worst frame, and draw calls per frame. A run
// with new ground streaming in shows the hitches. PROFILE=1 adds a CPU profile of one place: where the
// script time goes. PHONE=1 runs as a slow phone instead (390x844 at 3x, CPU slowed 4x).
//   node tools/bench.mjs                     all presets
//   PRESETS=high,ultra PLACES=home,run node tools/bench.mjs
import { chromium } from 'playwright';

const phone = !!process.env.PHONE;
const PRESETS = (process.env.PRESETS || (phone ? 'low,medium' : 'low,medium,high,ultra')).split(',');
const PLACES = (process.env.PLACES || 'home,woods,cascade,coast,volcano,run,night').split(',');
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });

const COUNT = () => {
  const n = { draws: 0 };
  for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) { const o = P[f]; if (o) P[f] = function (...a) { n.draws++; return o.apply(this, a); }; }
  window.__draws = n;
};
async function open(preset, hour = 12) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  ERR', e.message));
  await page.addInitScript(COUNT);
  if (phone) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  await page.goto(`http://127.0.0.1:8080/?seed=1&weather=clear&season=summer#${hour}`);
  await page.waitForFunction(() => window.__meadow && window.__meadow.player, null, { timeout: 240000 });
  await page.evaluate(async (preset) => { const url = performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes('/src/systems/quality.js')); (await import(url)).setQuality(preset); }, preset);
  await page.waitForTimeout(2000);
  return { ctx, page };
}
/** Frames over `secs`: fps, slow frames, draws. */
const measure = (page, secs) => page.evaluate((secs) => new Promise((res) => {
  const dts = [], d0 = window.__draws.draws; let last = performance.now(); const t0 = last;
  const f = (now) => { dts.push(now - last); last = now; if (now - t0 < secs * 1000) requestAnimationFrame(f); else { const s = dts.slice(1).sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))]; res({ fps: Math.round(1000 * s.length / s.reduce((a, b) => a + b, 0)), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), worst: +s[s.length - 1].toFixed(1), draws: Math.round((window.__draws.draws - d0) / dts.length) }); } };
  requestAnimationFrame(f);
}), secs);
async function place(page, name) {
  return page.evaluate(async (name) => {
    const m = window.__meadow, url = (n) => performance.getEntriesByType('resource').map((e) => e.name).find((x) => x.includes(n));
    const S = await import(url('/src/core/shape.js')), H = S.HOME;
    const go = (x, z, fx, fz) => m.travelTo(x, z, fx, fz);
    if (name === 'home' || name === 'night') go(285, 277, 318, 261);
    else if (name === 'woods') { const C = await import(url('/src/ui/countries.js')), c = C.nearestCountries(H.x, H.z).lush || Object.values(C.nearestCountries(H.x, H.z)).find((k) => k.id === 'lush'); go(c.x, c.z, c.x + 30, c.z); }
    else if (name === 'cascade') { const r = S.riversNear(H.x, H.z, 1500).find((v) => v.id === '-1:0'), i = 30; go(r.x[i] + 8, r.z[i] + 8, r.x[10], r.z[10]); }
    else if (name === 'coast') { const s = S.sitesNear(H.x, H.z, 7000, 'ship')[0], p = S.landNear ? S.landNear(s.x, s.z) : null; go(p ? p.x : s.x + 60, p ? p.z : s.z, s.x, s.z); }
    else if (name === 'volcano') { const s = S.sitesNear(H.x, H.z, 7000, 'volcano')[0]; go(s.x + 420, s.z + 420, s.x, s.z); }
    else if (name === 'run') go(285, 277, 285 - 100, 277 + 300);
    return true;
  }, name);
}
const rows = [];
for (const preset of PRESETS) {
  for (const name of PLACES) {
    const { ctx, page } = await open(preset, name === 'night' ? 22 : 12);
    await place(page, name);
    await page.waitForTimeout(6000); // (the ground and the woods built round you)
    let r;
    if (name === 'run') { // running out across new ground: hold run and forward
      await page.mouse.click(400, 400).catch(() => {});
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
      r = await measure(page, 12);
      await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    } else r = await measure(page, 5);
    if (process.env.PROFILE && name === (process.env.PROFILE === '1' ? 'home' : process.env.PROFILE)) {
      const cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
      if (name === 'run') { await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); }
      await page.waitForTimeout(5000);
      if (name === 'run') { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
      const { profile } = await cdp.send('Profiler.stop');
      // self time by function, top 25
      const self = new Map(), byId = new Map(profile.nodes.map((n) => [n.id, n])), dt = new Map();
      for (let i = 0; i < profile.samples.length; i++) dt.set(profile.samples[i], (dt.get(profile.samples[i]) || 0) + (profile.timeDeltas[i] || 0));
      for (const [id, us] of dt) { const n = byId.get(id), cf = n.callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + us); }
      const total = [...self.values()].reduce((a, b) => a + b, 0);
      console.log(`  profile ${preset}/${name}: top self time of ${(total / 1000).toFixed(0)} ms`);
      for (const [k, us] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    ${(100 * us / total).toFixed(1).padStart(5)}%  ${k}`);
    }
    rows.push({ preset, place: name, ...r });
    console.log(`${preset.padEnd(7)} ${name.padEnd(8)} fps ${String(r.fps).padStart(4)}  p95 ${String(r.p95).padStart(5)} ms  p99 ${String(r.p99).padStart(5)} ms  worst ${String(r.worst).padStart(6)} ms  draws ${r.draws}`);
    await ctx.close();
  }
}
await browser.close();
